import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  OctagonAlert,
  RotateCcw,
  Send,
} from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';
import type { ReadinessEvaluation } from '../types/fit2shift';

interface FatigueResultPanelProps {
  evaluation: ReadinessEvaluation;
  notes: string;
  onNotesChange: (notes: string) => void;
  onSubmitAssessment: () => void;
  onResetAssessment: () => void;
  submitting: boolean;
  submitSuccess: string | null;
  submitError: string | null;
  isGoogleAuthed: boolean;
  onGoogleLogin: () => void;
  isGoogleLoggingIn: boolean;
}

export const FatigueResultPanel: React.FC<FatigueResultPanelProps> = ({
  evaluation,
  notes,
  onNotesChange,
  onSubmitAssessment,
  onResetAssessment,
  submitting,
  submitSuccess,
  submitError,
  isGoogleAuthed,
  onGoogleLogin,
  isGoogleLoggingIn,
}) => {
  const isPass = evaluation.status === 'PASS';
  const isFailReady = evaluation.readyToSubmit && !isPass;
  const fatiguePct = evaluation.fatigueScore;

  const fatigueToneColor =
    fatiguePct < 25
      ? 'bg-[#95E1D3]'
      : fatiguePct < 45
        ? 'bg-[#FCE38A]'
        : 'bg-[#F38181]';

  return (
    <div className="rounded-2xl border-2 border-slate-900 bg-white p-5 sm:p-6">
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        {/* Left: Fatigue Score Indicator + Gauge */}
        <div className="flex flex-col justify-between rounded-xl border-2 border-slate-900 bg-[#EAFFD0]/50 p-5 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-900">
                ดัชนีความเหนื่อยล้า (Fatigue Score)
              </span>
              <span className="font-mono text-xs font-bold text-slate-700">
                เกณฑ์ผ่าน &lt; 45
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-3">
              <span className="font-mono text-5xl font-extrabold text-slate-950 tabular-nums">
                {fatiguePct}
              </span>
              <span className="font-mono text-lg font-bold text-slate-600 tabular-nums">
                / 100
              </span>
            </div>

            {/* Segmented Fatigue Meter */}
            <div className="mt-4">
              <div className="h-5 w-full overflow-hidden rounded-full border-2 border-slate-900 bg-white">
                <div
                  className={`h-full transition-all duration-200 ${fatigueToneColor}`}
                  style={{ width: `${Math.max(4, fatiguePct)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs font-bold text-slate-800">
                <span>0–24 สดชื่น</span>
                <span>25–44 เฝ้าระวัง</span>
                <span>45–100 เสี่ยงสูง</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 divide-x-2 divide-slate-900/15 border-t-2 border-slate-900/15 pt-4">
            <div className="pr-3">
              <div className="text-xs font-semibold text-slate-700">ชั่วโมงนอน</div>
              <div className="mt-0.5 font-mono text-lg font-extrabold text-slate-950 tabular-nums">
                {evaluation.sleepHours.toFixed(1)} ชม.
              </div>
            </div>
            <div className="pl-3">
              <div className="text-xs font-semibold text-slate-700">ปฏิกิริยาเฉลี่ย</div>
              <div className="mt-0.5 font-mono text-lg font-extrabold text-slate-950 tabular-nums">
                {evaluation.avgReactionMs !== null
                  ? `${evaluation.avgReactionMs} ms`
                  : 'รอทดสอบ'}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Instant PASS/FAIL Status + Save */}
        <div className="flex flex-col justify-between gap-4 lg:col-span-7">
          {/* Instant Pass/Fail Status Banner */}
          <div
            role="status"
            aria-live="polite"
            className={`rounded-xl border-2 border-slate-950 p-5 text-slate-950 ${
              !evaluation.readyToSubmit
                ? 'bg-[#FCE38A]'
                : isPass
                  ? 'bg-[#95E1D3]'
                  : 'bg-[#F38181]'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className="shrink-0 pt-0.5">
                {!evaluation.readyToSubmit ? (
                  <OctagonAlert className="h-8 w-8 text-slate-950" />
                ) : isPass ? (
                  <CheckCircle2 className="h-9 w-9 text-slate-950 stroke-[2.5]" />
                ) : (
                  <OctagonAlert className="h-9 w-9 text-slate-950 stroke-[2.5]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-2xl font-extrabold leading-tight">
                  {!evaluation.readyToSubmit
                    ? 'รอผลการทดสอบปฏิกิริยาให้ครบ 3 รอบ'
                    : isPass
                      ? 'ผ่านเกณฑ์ — พร้อมเข้าปฏิบัติงาน'
                      : 'ไม่ผ่านเกณฑ์ (FAIL) — ห้ามเข้าปฏิบัติงานเสี่ยงสูง'}
                </div>
                <ul className="mt-2 space-y-1 text-sm font-bold text-slate-900">
                  {evaluation.reasons.map((reason, idx) => (
                    <li key={idx}>• {reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Urgent Safety Recommendations when FAIL (without email alert UI) */}
          {isFailReady && (
            <div className="rounded-xl border-2 border-slate-950 bg-[#FCE38A] p-4 text-slate-950">
              <div className="flex items-center gap-2 font-display text-base font-extrabold">
                <AlertTriangle className="h-5 w-5 shrink-0 stroke-[2.5]" />
                <span>คำแนะนำความปลอดภัยเร่งด่วน</span>
              </div>
              <ul className="mt-2 space-y-1.5 text-sm font-semibold text-slate-900">
                {evaluation.recommendations.map((rec, idx) => (
                  <li key={idx}>• {rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes + Save Action Controls */}
          <div className="flex flex-col gap-3">
            <div>
              <label
                htmlFor="assessment-notes"
                className="block text-xs font-bold text-slate-800"
              >
                หมายเหตุเพิ่มเติมสำหรับหัวหน้างาน (ถ้ามี)
              </label>
              <input
                id="assessment-notes"
                type="text"
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="เช่น พักผ่อนเพียงพอ หรือ แจ้งขอสลับหน้าที่ชั่วคราว"
                className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-900 bg-[#EAFFD0]/40 px-3.5 text-sm font-medium text-slate-950 placeholder:text-slate-500 focus:border-[#F38181] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onSubmitAssessment}
                disabled={!evaluation.readyToSubmit || submitting}
                className="flex min-h-[52px] flex-1 items-center justify-center gap-2.5 rounded-xl border-2 border-slate-950 bg-[#FCE38A] px-6 py-3 text-base font-extrabold text-slate-950 transition-colors hover:bg-[#95E1D3] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 whitespace-nowrap"
              >
                <Send className="h-5 w-5 stroke-[2.5]" />
                <span>
                  {submitting ? 'กำลังบันทึกผลการประเมิน...' : 'บันทึกผลการประเมิน'}
                </span>
              </button>

              <button
                type="button"
                onClick={onResetAssessment}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-slate-900 bg-[#EAFFD0] px-4 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-[#95E1D3] whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-4 w-4" />
                <span>รีเซ็ตแบบประเมิน</span>
              </button>
            </div>

            {submitSuccess && (
              <div
                role="status"
                className="rounded-xl border-2 border-slate-950 bg-[#95E1D3] px-4 py-3 text-sm font-bold text-slate-950"
              >
                {submitSuccess}
              </div>
            )}

            {submitError && (
              <div
                role="alert"
                className="rounded-xl border-2 border-slate-950 bg-[#F38181] px-4 py-3 text-sm font-bold text-slate-950"
              >
                {submitError}
              </div>
            )}

            {!isGoogleAuthed && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-900/25 bg-[#EAFFD0]/45 px-3.5 py-2.5">
                <span className="text-xs font-semibold text-slate-700">
                  บันทึกข้อมูลลงระบบอัตโนมัติได้ทันที (ซิงค์เข้า Google Sheets ส่วนตัวเพิ่มเติมได้ตามต้องการ)
                </span>
                <GoogleSignInButton
                  onClick={onGoogleLogin}
                  loading={isGoogleLoggingIn}
                  label="Sign in with Google"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
