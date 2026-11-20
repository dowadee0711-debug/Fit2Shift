import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DATA_DIR = path.resolve(__dirname, 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'fit2shift-records.json');

interface StoredAssessment {
  id: string;
  timestamp: string;
  employeeId: string;
  employeeName: string;
  department: string;
  shift: string;
  sleepHours: number;
  avgReactionMs: number;
  reactionTrials: string;
  fatigueScore: number;
  status: 'PASS' | 'FAIL';
  notes: string;
  syncedToSheet: boolean;
}

const SHEET_HEADERS = [
  'Timestamp',
  'Employee ID',
  'Employee Name',
  'Department',
  'Shift',
  'Sleep Hours',
  'Avg Reaction (ms)',
  'Reaction Trials (ms)',
  'Fatigue Score',
  'Safety Status',
  'Alertness Notes',
];

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  return trimmed;
}

async function parseGoogleResponse(res: globalThis.Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

let cachedServiceToken: { token: string; expiresAt: number } | null = null;

function readStoredAssessments(): StoredAssessment[] {
  try {
    if (!fs.existsSync(RECORDS_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(RECORDS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredAssessments(records: StoredAssessment[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempFile = `${RECORDS_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(records, null, 2), 'utf-8');
  fs.renameSync(tempFile, RECORDS_FILE);
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getServiceAccountAccessToken(): Promise<string | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
  if (!email || !rawKey) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedServiceToken && cachedServiceToken.expiresAt > now + 120) {
    return cachedServiceToken.token;
  }

  const privateKey = rawKey.replace(/\\n/g, '\n');
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
  );

  const signingInput = `${header}.${claimSet}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = base64UrlEncode(signer.sign(privateKey));
  const assertion = `${signingInput}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  if (!tokenRes.ok) {
    return null;
  }

  const tokenJson = (await tokenRes.json()) as { access_token?: string; expires_in?: number };
  if (!tokenJson.access_token) {
    return null;
  }

  cachedServiceToken = {
    token: tokenJson.access_token,
    expiresAt: now + (tokenJson.expires_in || 3600),
  };
  return cachedServiceToken.token;
}

async function forwardToServerConfiguredSheet(record: StoredAssessment): Promise<boolean> {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID?.trim();
  const sheetName = process.env.GOOGLE_SHEET_NAME?.trim() || 'ShiftLogs';
  const webhookUrl = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL?.trim();

  if (spreadsheetId) {
    try {
      const saToken = await getServiceAccountAccessToken();
      if (saToken) {
        const rowValues = [
          record.timestamp,
          record.employeeId,
          record.employeeName,
          record.department,
          record.shift,
          record.sleepHours.toFixed(1),
          String(Math.round(record.avgReactionMs)),
          record.reactionTrials,
          String(Math.round(record.fatigueScore)),
          record.status,
          record.notes,
        ];
        const appendRes = await fetch(
          `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(sheetName)}!A:K:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${saToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              majorDimension: 'ROWS',
              values: [rowValues],
            }),
          }
        );
        if (appendRes.ok) {
          return true;
        }
      }
    } catch {
      // Fallback safely to local persistent storage
    }
  }

  if (webhookUrl) {
    try {
      const hookRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      if (hookRes.ok) {
        return true;
      }
    } catch {
      // Fallback safely to local persistent storage
    }
  }

  return false;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'fit2shift-api' });
  });

  // Save assessment persistently on the backend without requiring Gmail sign-in
  app.post('/api/assessments', async (req: Request, res: Response) => {
    const {
      timestamp,
      employeeId,
      employeeName,
      department,
      shift,
      sleepHours,
      avgReactionMs,
      reactionTrials,
      fatigueScore,
      status,
      notes,
    } = req.body || {};

    if (!employeeId) {
      res.status(400).json({ error: 'กรุณาระบุรหัสพนักงานสำหรับการบันทึก' });
      return;
    }

    try {
      const record: StoredAssessment = {
        id: crypto.randomUUID(),
        timestamp: String(timestamp || new Date().toISOString()),
        employeeId: String(employeeId),
        employeeName: String(employeeName || '-'),
        department: String(department || '-'),
        shift: String(shift || '-'),
        sleepHours: Number(sleepHours ?? 0),
        avgReactionMs: Math.round(Number(avgReactionMs ?? 0)),
        reactionTrials: String(reactionTrials || '-'),
        fatigueScore: Math.round(Number(fatigueScore ?? 0)),
        status: status === 'PASS' ? 'PASS' : 'FAIL',
        notes: String(notes || '-'),
        syncedToSheet: false,
      };

      const syncedByServer = await forwardToServerConfiguredSheet(record);
      record.syncedToSheet = syncedByServer;

      const existing = readStoredAssessments();
      existing.push(record);
      writeStoredAssessments(existing);

      res.status(201).json({ success: true, record });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลลงเซิร์ฟเวอร์ได้';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/assessments', (_req: Request, res: Response) => {
    const records = readStoredAssessments();
    res.json({ records: [...records].reverse() });
  });

  app.post('/api/assessments/mark-synced', (req: Request, res: Response) => {
    const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : [];
    if (ids.length === 0) {
      res.json({ updated: 0 });
      return;
    }
    const idSet = new Set(ids);
    const records = readStoredAssessments();
    let updated = 0;
    const next = records.map((rec) => {
      if (idSet.has(rec.id) && !rec.syncedToSheet) {
        updated += 1;
        return { ...rec, syncedToSheet: true };
      }
      return rec;
    });
    if (updated > 0) {
      writeStoredAssessments(next);
    }
    res.json({ updated });
  });

  // Create a brand new Fit2Shift Google Sheet with formatted headers
  app.post('/api/sheets/create', async (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'กรุณาเข้าสู่ระบบด้วย Google ก่อนสร้าง Google Sheet' });
      return;
    }

    try {
      const requestedTitle =
        typeof req.body?.title === 'string' && req.body.title.trim().length > 0
          ? req.body.title.trim()
          : 'Fit2Shift - ฐานข้อมูลประเมินความพร้อมก่อนเข้ากะ';
      const sheetName = 'ShiftLogs';

      const createRes = await fetch(SHEETS_API_BASE, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title: requestedTitle },
          sheets: [
            {
              properties: {
                title: sheetName,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          ],
        }),
      });

      const created = await parseGoogleResponse(createRes);
      if (!createRes.ok) {
        res.status(createRes.status).json({
          error: created?.error?.message || 'ไม่สามารถสร้าง Google Sheet ได้',
        });
        return;
      }

      const spreadsheetId = created.spreadsheetId as string;
      const spreadsheetUrl = created.spreadsheetUrl as string;
      const firstSheetId = created.sheets?.[0]?.properties?.sheetId ?? 0;

      // Write header row
      await fetch(
        `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:K1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: `${sheetName}!A1:K1`,
            majorDimension: 'ROWS',
            values: [SHEET_HEADERS],
          }),
        }
      );

      // Style header row with Industrial Safety Yellow (#FACC15) & Slate Dark (#0F172A)
      await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: firstSheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: SHEET_HEADERS.length,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.988, green: 0.89, blue: 0.541 },
                    textFormat: {
                      foregroundColor: { red: 0.06, green: 0.09, blue: 0.16 },
                      bold: true,
                      fontSize: 10,
                    },
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)',
              },
            },
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId: firstSheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: SHEET_HEADERS.length,
                },
              },
            },
          ],
        }),
      });

      res.json({
        spreadsheetId,
        spreadsheetUrl,
        title: requestedTitle,
        sheetName,
        sheetId: firstSheetId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการสร้าง Google Sheet';
      res.status(500).json({ error: message });
    }
  });

  // Connect to an existing Google Sheet by URL or Spreadsheet ID
  app.post('/api/sheets/connect', async (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'กรุณาเข้าสู่ระบบด้วย Google ก่อนเชื่อมต่อ Google Sheet' });
      return;
    }

    const rawInput = typeof req.body?.spreadsheetIdOrUrl === 'string' ? req.body.spreadsheetIdOrUrl : '';
    const spreadsheetId = extractSpreadsheetId(rawInput);
    if (!spreadsheetId) {
      res.status(400).json({ error: 'กรุณาระบุ Google Sheet URL หรือ Spreadsheet ID ให้ถูกต้อง' });
      return;
    }

    try {
      const metaRes = await fetch(
        `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties(sheetId,title)`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const meta = await parseGoogleResponse(metaRes);
      if (!metaRes.ok) {
        res.status(metaRes.status).json({
          error: meta?.error?.message || 'ไม่สามารถเข้าถึง Google Sheet นี้ได้ โปรดตรวจสอบสิทธิ์และรหัสไฟล์',
        });
        return;
      }

      const sheetsList = Array.isArray(meta.sheets) ? meta.sheets : [];
      const preferred =
        sheetsList.find((s: { properties?: { title?: string } }) => s.properties?.title === 'ShiftLogs') ||
        sheetsList[0];

      if (!preferred?.properties?.title) {
        res.status(400).json({ error: 'ไม่พบแท็บชีตภายในไฟล์ Google Sheet นี้' });
        return;
      }

      const sheetName = preferred.properties.title as string;
      const sheetId = preferred.properties.sheetId as number;

      // Inspect row 1 to ensure headers exist if the sheet is blank
      const headerRes = await fetch(
        `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(sheetName)}!A1:K1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const headerData = await parseGoogleResponse(headerRes);
      if (headerRes.ok && (!Array.isArray(headerData.values) || headerData.values.length === 0)) {
        await fetch(
          `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(sheetName)}!A1:K1?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              range: `${sheetName}!A1:K1`,
              majorDimension: 'ROWS',
              values: [SHEET_HEADERS],
            }),
          }
        );
      }

      res.json({
        spreadsheetId: meta.spreadsheetId,
        spreadsheetUrl: meta.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${meta.spreadsheetId}/edit`,
        title: meta.properties?.title || 'Fit2Shift Sheet',
        sheetName,
        sheetId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheet';
      res.status(500).json({ error: message });
    }
  });

  // Read records from the connected Google Sheet
  app.get('/api/sheets/records', async (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'กรุณาเข้าสู่ระบบด้วย Google เพื่อดึงข้อมูล' });
      return;
    }

    const spreadsheetId = String(req.query.spreadsheetId || '').trim();
    const sheetName = String(req.query.sheetName || '').trim();
    const employeeFilter = String(req.query.employeeId || '').trim().toLowerCase();

    if (!spreadsheetId || !sheetName) {
      res.status(400).json({ error: 'ต้องระบุ spreadsheetId และ sheetName' });
      return;
    }

    try {
      const valuesRes = await fetch(
        `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(sheetName)}!A1:K500`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await parseGoogleResponse(valuesRes);
      if (!valuesRes.ok) {
        res.status(valuesRes.status).json({
          error: data?.error?.message || 'ไม่สามารถอ่านข้อมูลจาก Google Sheet ได้',
        });
        return;
      }

      const rows: string[][] = Array.isArray(data.values) ? data.values : [];
      const records = rows
        .slice(1)
        .map((row, idx) => {
          const rowNumber = idx + 2; // 1-based sheet row number
          const sleepHours = Number.parseFloat(row[5] ?? '0') || 0;
          const avgReactionMs = Number.parseInt(row[6] ?? '0', 10) || 0;
          const fatigueScore = Number.parseInt(row[8] ?? '0', 10) || 0;
          const rawStatus = String(row[9] ?? '').toUpperCase();
          const status = rawStatus === 'PASS' || rawStatus.includes('ผ่าน') && !rawStatus.includes('ไม่ผ่าน') ? 'PASS' : 'FAIL';

          return {
            rowNumber,
            timestamp: row[0] || '',
            employeeId: row[1] || '',
            employeeName: row[2] || '',
            department: row[3] || '',
            shift: row[4] || '',
            sleepHours,
            avgReactionMs,
            reactionTrials: row[7] || '',
            fatigueScore,
            status,
            notes: row[10] || '',
          };
        })
        .filter((rec) => rec.employeeId.length > 0 || rec.timestamp.length > 0)
        .filter((rec) => (employeeFilter ? rec.employeeId.toLowerCase().includes(employeeFilter) : true))
        .reverse();

      res.json({ records });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ไม่สามารถโหลดรายการจาก Google Sheet';
      res.status(500).json({ error: message });
    }
  });

  // Append a new readiness assessment record to the Google Sheet
  app.post('/api/sheets/records', async (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'กรุณาเข้าสู่ระบบด้วย Google เพื่อบันทึกข้อมูล' });
      return;
    }

    const {
      spreadsheetId,
      sheetName,
      timestamp,
      employeeId,
      employeeName,
      department,
      shift,
      sleepHours,
      avgReactionMs,
      reactionTrials,
      fatigueScore,
      status,
      notes,
    } = req.body || {};

    if (!spreadsheetId || !sheetName || !employeeId) {
      res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วนสำหรับการบันทึก' });
      return;
    }

    const rowValues = [
      String(timestamp || new Date().toISOString()),
      String(employeeId),
      String(employeeName || '-'),
      String(department || '-'),
      String(shift || '-'),
      Number(sleepHours ?? 0).toFixed(1),
      String(Math.round(Number(avgReactionMs ?? 0))),
      String(reactionTrials || '-'),
      String(Math.round(Number(fatigueScore ?? 0))),
      status === 'PASS' ? 'PASS' : 'FAIL',
      String(notes || '-'),
    ];

    try {
      const appendRes = await fetch(
        `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(sheetName)}!A:K:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            majorDimension: 'ROWS',
            values: [rowValues],
          }),
        }
      );

      const appended = await parseGoogleResponse(appendRes);
      if (!appendRes.ok) {
        res.status(appendRes.status).json({
          error: appended?.error?.message || 'ไม่สามารถบันทึกแถวข้อมูลลง Google Sheet ได้',
        });
        return;
      }

      res.json({
        success: true,
        updatedRange: appended?.updates?.updatedRange || '',
        record: {
          timestamp: rowValues[0],
          employeeId: rowValues[1],
          employeeName: rowValues[2],
          department: rowValues[3],
          shift: rowValues[4],
          sleepHours: Number(rowValues[5]),
          avgReactionMs: Number(rowValues[6]),
          reactionTrials: rowValues[7],
          fatigueScore: Number(rowValues[8]),
          status: rowValues[9] as 'PASS' | 'FAIL',
          notes: rowValues[10],
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดระหว่างการบันทึก';
      res.status(500).json({ error: message });
    }
  });

  // Delete a specific row from the Google Sheet (called only after explicit user confirmation dialog)
  app.delete('/api/sheets/records/:rowNumber', async (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'กรุณาเข้าสู่ระบบด้วย Google ก่อนลบรายการ' });
      return;
    }

    const rowNumber = Number.parseInt(String(req.params.rowNumber || ''), 10);
    const spreadsheetId = String(req.query.spreadsheetId || '').trim();
    const sheetName = String(req.query.sheetName || '').trim();

    if (!spreadsheetId || !sheetName || !Number.isFinite(rowNumber) || rowNumber < 2) {
      res.status(400).json({ error: 'ระบุตำแหน่งแถวหรือไฟล์ Google Sheet ไม่ถูกต้อง' });
      return;
    }

    try {
      const metaRes = await fetch(
        `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties(sheetId,title)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const meta = await parseGoogleResponse(metaRes);
      if (!metaRes.ok) {
        res.status(metaRes.status).json({ error: meta?.error?.message || 'ไม่สามารถค้นหาแท็บชีตได้' });
        return;
      }

      const targetSheet = (meta.sheets || []).find(
        (s: { properties?: { title?: string } }) => s.properties?.title === sheetName
      );
      if (targetSheet?.properties?.sheetId === undefined) {
        res.status(404).json({ error: 'ไม่พบแท็บชีตที่ต้องการลบข้อมูล' });
        return;
      }

      const deleteRes = await fetch(`${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: targetSheet.properties.sheetId,
                  dimension: 'ROWS',
                  startIndex: rowNumber - 1,
                  endIndex: rowNumber,
                },
              },
            },
          ],
        }),
      });

      const deleted = await parseGoogleResponse(deleteRes);
      if (!deleteRes.ok) {
        res.status(deleteRes.status).json({
          error: deleted?.error?.message || 'ไม่สามารถลบแถวข้อมูลใน Google Sheet ได้',
        });
        return;
      }

      res.json({ success: true, deletedRowNumber: rowNumber });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดระหว่างการลบแถว';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fit2Shift server running on http://localhost:${PORT}`);
  });
}

startServer();
