import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { TopNav } from './components/TopNav';
import { LoginScreen } from './components/LoginScreen';
import { ReactionTestArena } from './components/ReactionTestArena';
import { SleepAndChecksPanel } from './components/SleepAndChecksPanel';
import { FatigueResultPanel } from './components/FatigueResultPanel';
import { ConfirmModal } from './components/ConfirmModal';
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

interface PendingEmailAlert {
  toEmail: string;
  record: Omit<BackendAssessmentRecord, 'id' | 'syncedToSheet'>;
  recommendations: string[];
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

  // Optional Google Workspace Auth state (access token kept strictly in memory via firebaseAuth.ts)
  const [isGoogleAuthed, setIsGoogleAuthed] = useState(false);
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false);
  const [alertEmail, setAlertEmail] = useState('nutthawadee.kae@dome.tu.ac.th');

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

  // Submission & Alert state
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [pendingEmailAlert, setPendingEmailAlert] = useState<PendingEmailAlert | null>(null);

  useEffect(() => {
    fetch('/api/alerts/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.defaultAlertEmail) {
          setAlertEmail((prev) => prev || String(data.defaultAlertEmail));
        }
      })
      .catch(() => {
        // Keep default email
      });
  }, []);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setIsGoogleAuthed(true);
        if (user.email) {
          setAlertEmail(user.email);
        }
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
    setAlertError(null);
    try {
      const result = await googleSignIn();
      setIsGoogleAuthed(true);
      const targetEmail = result.user.email || alertEmail;
      if (result.user.email) {
        setAlertEmail(result.user.email);
      }
      await syncPendingRecordsToSheet(result.accessToken);

      if (employeeSession && evaluation.readyToSubmit && evaluation.status === 'FAIL') {
        setPendingEmailAlert({
          toEmail: targetEmail.trim() || 'nutthawadee.kae@dome.tu.ac.th',
          record: {
            timestamp: new Date().toISOString(),
            employeeId: employeeSession.employeeId,
            employeeName: employeeSession.employeeName,
            department: employeeSession.department,
            shift: employeeSession.shift,
            sleepHours: evaluation.sleepHours,
            avgReactionMs: evaluation.avgReactionMs ?? 0,
            reactionTrials: trialsMs.join(', '),
            fatigueScore: evaluation.fatigueScore,
            status: evaluation.status,
            notes: notes.trim() || evaluation.reasons.join(' | '),
          },
          recommendations: evaluation.recommendations,
        });
      }
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
    setAlertSuccess(null);
    setAlertError(null);
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
    setAlertSuccess(null);
    setAlertError(null);
  };

  const buildCurrentAlertPayload = useCallback((): PendingEmailAlert | null => {
    if (!employeeSession) return null;
    return {
      toEmail: alertEmail.trim() || 'nutthawadee.kae@dome.tu.ac.th',
      record: {
        timestamp: new Date().toISOString(),
        employeeId: employeeSession.employeeId,
        employeeName: employeeSession.employeeName,
        department: employeeSession.department,
        shift: employeeSession.shift,
        sleepHours: evaluation.sleepHours,
        avgReactionMs: evaluation.avgReactionMs ?? 0,
        reactionTrials: trialsMs.join(', '),
        fatigueScore: evaluation.fatigueScore,
        status: evaluation.status,
        notes: notes.trim() || evaluation.reasons.join(' | '),
      },
      recommendations: evaluation.recommendations,
    };
  }, [employeeSession, alertEmail, evaluation, trialsMs, notes]);

  const handleRequestSendAlertEmail = () => {
    const alertPayload = buildCurrentAlertPayload();
    if (!alertPayload) return;
    setAlertError(null);
    setAlertSuccess(null);
    setPendingEmailAlert(alertPayload);
  };

  const handleConfirmSendAlertEmail = async () => {
    if (!pendingEmailAlert) return;
    const token = getAccessToken();
    setSendingAlert(true);
    setAlertError(null);
    setAlertSuccess(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch('/api/alerts/email', {
        method: 'POST',
        headers,
        body: JSON.stringify(pendingEmailAlert),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถส่งอีเมลแจ้งเตือนได้');
      }

      setAlertSuccess(
        `ส่งอีเมลแจ้งเตือนสถานะไม่ผ่านเกณฑ์ไปยัง ${data.recipient || pendingEmailAlert.toEmail} เรียบร้อยแล้ว`
      );
      setPendingEmailAlert(null);
    } catch (err: unknown) {
      setAlertError(
        err instanceof Error ? err.message : 'เกิดข้อผิดพลาดระหว่างส่งอีเมลแจ้งเตือน'
      );
      setPendingEmailAlert(null);
    } finally {
      setSendingAlert(false);
    }
  };

  const handleSubmitAssessment = async () => {
    if (!employeeSession || !evaluation.readyToSubmit) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    setAlertSuccess(null);
    setAlertError(null);

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
      recommendations: evaluation.recommendations,
      alertEmail: alertEmail.trim() || 'nutthawadee.kae@dome.tu.ac.th',
    };

    try {
      // 1. Always persist immediately to backend database without requiring Gmail login
      const saveRes = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveData.error || 'บันทึกข้อมูลไม่สำเร็จ');
      }

      // 2. If user also signed in with Google in this browser session, flush to Google Sheets automatically
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

      // 3. On FAIL status: notify database email
      if (evaluation.status === 'FAIL') {
        if (saveData.emailAlertSent) {
          setAlertSuccess(
            `ระบบส่งอีเมลแจ้งเตือนสถานะไม่ผ่านเกณฑ์ไปยัง ${payload.alertEmail} เรียบร้อยแล้ว`
          );
        } else if (token) {
          // Require explicit confirmation before sending email on the user's behalf via Gmail API
          setPendingEmailAlert({
            toEmail: payload.alertEmail,
            record: {
              timestamp: payload.timestamp,
              employeeId: payload.employeeId,
              employeeName: payload.employeeName,
              department: payload.department,
              shift: payload.shift,
              sleepHours: payload.sleepHours,
              avgReactionMs: payload.avgReactionMs ?? 0,
              reactionTrials: payload.reactionTrials,
              fatigueScore: payload.fatigueScore,
              status: payload.status,
              notes: payload.notes,
            },
            recommendations: evaluation.recommendations,
          });
        } else {
          setAlertError(
            `บันทึกข้อมูลแล้ว แต่ยังไม่ได้ส่งอีเมลแจ้งเตือนไปที่ ${payload.alertEmail} — กรุณากด "Sign in with Google เพื่อส่งอีเมล" หรือตั้งค่า RESEND_API_KEY / GOOGLE_APPS_SCRIPT_WEBHOOK_URL ในระบบหลังบ้านเพื่อให้ส่งอัตโนมัติ`
          );
        }
      }
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
                alertEmail={alertEmail}
                onAlertEmailChange={setAlertEmail}
                onSubmitAssessment={handleSubmitAssessment}
                onRequestSendAlertEmail={handleRequestSendAlertEmail}
                onResetAssessment={handleResetAssessment}
                submitting={submitting}
                sendingAlert={sendingAlert}
                submitSuccess={submitSuccess}
                submitError={submitError}
                alertSuccess={alertSuccess}
                alertError={alertError}
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

      {/* Explicit Confirmation Modal before sending alert email via Gmail API */}
      <ConfirmModal
        open={pendingEmailAlert !== null}
        title="ยืนยันการส่งอีเมลแจ้งเตือนสถานะไม่ผ่านเกณฑ์ (FAIL)?"
        description={
          pendingEmailAlert
            ? `ระบบจะส่งอีเมลแจ้งเตือนผลการประเมินของรหัส ${pendingEmailAlert.record.employeeId} (${pendingEmailAlert.record.employeeName}) คะแนนความเหนื่อยล้า ${pendingEmailAlert.record.fatigueScore}/100 พร้อมคำแนะนำความปลอดภัยไปยัง ${pendingEmailAlert.toEmail}`
            : ''
        }
        confirmLabel="ยืนยันส่งอีเมลแจ้งเตือน"
        cancelLabel="ยกเลิก"
        destructive={false}
        loading={sendingAlert}
        onConfirm={handleConfirmSendAlertEmail}
        onCancel={() => {
          if (!sendingAlert) setPendingEmailAlert(null);
        }}
      />
    </div>
  );
}
