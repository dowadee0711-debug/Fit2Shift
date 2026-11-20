import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { TopNav } from './components/TopNav';
import { LoginScreen } from './components/LoginScreen';
import { ReactionTestArena } from './components/ReactionTestArena';
import { SleepAndChecksPanel } from './components/SleepAndChecksPanel';
import { FatigueResultPanel } from './components/FatigueResultPanel';
import { evaluateReadiness } from './lib/fatigueCalculator';
import {
  getAccessToken,
  googleSignIn,
  initAuth,
} from './lib/firebaseAuth';
import type {
  AlertnessChecks,
  EmployeeSession,
  SheetConnection,
} from './types/fit2shift';

const SHEET_META_STORAGE_KEY = 'fit2shift_sheet_connection_v1';

interface BackendAssessmentRecord {
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

function loadSavedSheetConnection(): SheetConnection | null {
  try {
    const raw = window.localStorage.getItem(SHEET_META_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SheetConnection;
    if (parsed?.spreadsheetId && parsed?.sheetName) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export default function App() {
  const [employeeSession, setEmployeeSession] = useState<EmployeeSession | null>(null);

  // Optional Google Workspace Auth state for Google Sheets sync (token kept in memory)
  const [isGoogleAuthed, setIsGoogleAuthed] = useState(false);
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false);

  // Background Google Sheet database metadata
  const [sheetConnection, setSheetConnection] = useState<SheetConnection | null>(() =>
    loadSavedSheetConnection()
  );

  // Quick Assessment state
  const [trialsMs, setTrialsMs] = useState<number[]>([]);
  const [sleepHours, setSleepHours] = useState<number>(7.0);
  const [checks, setChecks] = useState<AlertnessChecks>({
    noDrowsiness: true,
    noSedatingMeds: true,
    ppeReady: true,
  });
  const [notes, setNotes] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      () => {
        setIsGoogleAuthed(true);
      },
      () => {
        setIsGoogleAuthed(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const evaluation = useMemo(
    () => evaluateReadiness(sleepHours, trialsMs, checks),
    [sleepHours, trialsMs, checks]
  );

  const persistSheetConnection = useCallback((conn: SheetConnection | null) => {
    setSheetConnection(conn);
    try {
      if (conn) {
        window.localStorage.setItem(SHEET_META_STORAGE_KEY, JSON.stringify(conn));
      } else {
        window.localStorage.removeItem(SHEET_META_STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota issues
    }
  }, []);

  const ensureBackendSheet = useCallback(
    async (token: string): Promise<SheetConnection> => {
      if (sheetConnection) {
        return sheetConnection;
      }

      const res = await fetch('/api/sheets/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Fit2Shift - ฐานข้อมูลประเมินความพร้อมก่อนเข้ากะ',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถเตรียมฐานข้อมูล Google Sheet ได้');
      }
      const created = data as SheetConnection;
      persistSheetConnection(created);
      return created;
    },
    [sheetConnection, persistSheetConnection]
  );

  const syncPendingRecordsToSheet = useCallback(
    async (token: string) => {
      const listRes = await fetch('/api/assessments');
      if (!listRes.ok) return;
      const listData = (await listRes.json()) as { records?: BackendAssessmentRecord[] };
      const pending = (listData.records || []).filter((r) => !r.syncedToSheet).reverse();
      if (pending.length === 0) return;

      let targetSheet = await ensureBackendSheet(token);
      const syncedIds: string[] = [];

      for (const rec of pending) {
        const postRow = (sheet: SheetConnection) =>
          fetch('/api/sheets/records', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              spreadsheetId: sheet.spreadsheetId,
              sheetName: sheet.sheetName,
              timestamp: rec.timestamp,
              employeeId: rec.employeeId,
              employeeName: rec.employeeName,
              department: rec.department,
              shift: rec.shift,
              sleepHours: rec.sleepHours,
              avgReactionMs: rec.avgReactionMs,
              reactionTrials: rec.reactionTrials,
              fatigueScore: rec.fatigueScore,
              status: rec.status,
              notes: rec.notes,
            }),
          });

        let res = await postRow(targetSheet);
        if (res.status === 404) {
          persistSheetConnection(null);
          const createRes = await fetch('/api/sheets/create', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: 'Fit2Shift - ฐานข้อมูลประเมินความพร้อมก่อนเข้ากะ',
            }),
          });
          if (createRes.ok) {
            targetSheet = (await createRes.json()) as SheetConnection;
            persistSheetConnection(targetSheet);
            res = await postRow(targetSheet);
          }
        }
        if (res.ok) {
          syncedIds.push(rec.id);
        }
      }

      if (syncedIds.length > 0) {
        await fetch('/api/assessments/mark-synced', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: syncedIds }),
        });
      }
    },
    [ensureBackendSheet, persistSheetConnection]
  );

  const handleGoogleLogin = async () => {
    setIsGoogleLoggingIn(true);
    setSubmitError(null);
    try {
      const result = await googleSignIn();
      setIsGoogleAuthed(true);
      await syncPendingRecordsToSheet(result.accessToken);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'เข้าสู่ระบบ Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
      );
    } finally {
      setIsGoogleLoggingIn(false);
    }
  };

  const handleResetAssessment = () => {
    setTrialsMs([]);
    setSleepHours(7.0);
    setChecks({
      noDrowsiness: true,
      noSedatingMeds: true,
      ppeReady: true,
    });
    setNotes('');
    setSubmitSuccess(null);
    setSubmitError(null);
  };

  const handleEmployeeLogin = (session: EmployeeSession) => {
    setEmployeeSession(session);
    handleResetAssessment();
  };

  const handleEmployeeLogout = () => {
    setEmployeeSession(null);
    setTrialsMs([]);
    setSubmitSuccess(null);
    setSubmitError(null);
  };

  const handleSubmitAssessment = async () => {
    if (!employeeSession || !evaluation.readyToSubmit) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    const payload = {
      timestamp: new Date().toISOString(),
      employeeId: employeeSession.employeeId,
      employeeName: employeeSession.employeeName,
      department: employeeSession.department,
      shift: employeeSession.shift,
      sleepHours: evaluation.sleepHours,
      avgReactionMs: evaluation.avgReactionMs,
      reactionTrials: trialsMs.join(', '),
      fatigueScore: evaluation.fatigueScore,
      status: evaluation.status,
      notes: notes.trim() || evaluation.reasons.join(' | '),
    };

    try {
      // Persist immediately to backend database without requiring Google login
      const saveRes = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveData.error || 'บันทึกข้อมูลไม่สำเร็จ');
      }

      // If Google Sheets auth is active in this session, also sync to Google Sheets automatically
      const token = getAccessToken();
      if (token && !saveData.record?.syncedToSheet) {
        try {
          await syncPendingRecordsToSheet(token);
        } catch {
          // Record is already safely stored in backend database
        }
      }

      setSubmitSuccess(
        `บันทึกผลการประเมินของรหัส ${employeeSession.employeeId} (${evaluation.status === 'PASS' ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}) ลงระบบเรียบร้อยแล้ว`
      );
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : 'เกิดข้อผิดพลาดระหว่างบันทึกข้อมูล'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EAFFD0] pb-12 text-slate-950">
      <TopNav
        session={employeeSession}
        onLogoutEmployee={handleEmployeeLogout}
      />

      <main>
        {!employeeSession ? (
          <LoginScreen onLogin={handleEmployeeLogin} />
        ) : (
          <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
            {/* Employee Shift Banner */}
            <div className="mb-6 rounded-2xl border-2 border-slate-900 bg-white px-5 py-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
                <span className="font-mono font-extrabold text-slate-950">
                  {employeeSession.employeeId}
                </span>
                <span aria-hidden="true">·</span>
                <span>{employeeSession.department}</span>
                <span aria-hidden="true">·</span>
                <span>{employeeSession.shift}</span>
              </div>
              <h1 className="mt-1 font-display text-xl font-extrabold text-slate-950 sm:text-2xl">
                ประเมินความพร้อมก่อนเข้ากะ: {employeeSession.employeeName}
              </h1>
            </div>

            {/* Main 2-Column Assessment Instruments */}
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <ReactionTestArena
                  trials={trialsMs}
                  onTrialsChange={setTrialsMs}
                />
              </div>

              <div className="lg:col-span-5">
                <SleepAndChecksPanel
                  sleepHours={sleepHours}
                  onSleepHoursChange={setSleepHours}
                  checks={checks}
                  onChecksChange={setChecks}
                />
              </div>
            </div>

            {/* Instant Fatigue Score & Pass/Fail Safety Status */}
            <div className="mt-6">
              <FatigueResultPanel
                evaluation={evaluation}
                notes={notes}
                onNotesChange={setNotes}
                onSubmitAssessment={handleSubmitAssessment}
                onResetAssessment={handleResetAssessment}
                submitting={submitting}
                submitSuccess={submitSuccess}
                submitError={submitError}
                isGoogleAuthed={isGoogleAuthed}
                onGoogleLogin={handleGoogleLogin}
                isGoogleLoggingIn={isGoogleLoggingIn}
              />
            </div>

            {/* Quiet Safety Protocol Note */}
            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-slate-800">
              <ShieldAlert className="h-4 w-4 shrink-0 text-slate-950" />
              <span>
                เกณฑ์ความปลอดภัย: ชั่วโมงนอน ≥ 5.5 ชม., ปฏิกิริยาเฉลี่ย ≤ 420 ms, คะแนนความเหนื่อยล้า &lt; 45 และยืนยันความพร้อมครบทุกข้อ
              </span>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
