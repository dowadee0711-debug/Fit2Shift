import React from 'react';
import { Check, Minus, Moon, Plus } from 'lucide-react';
import { getSleepGuidance } from '../lib/fatigueCalculator';
import type { AlertnessChecks } from '../types/fit2shift';

interface SleepAndChecksPanelProps {
  sleepHours: number;
  onSleepHoursChange: (hours: number) => void;
  checks: AlertnessChecks;
  onChecksChange: (checks: AlertnessChecks) => void;
}

export const SleepAndChecksPanel: React.FC<SleepAndChecksPanelProps> = ({
  sleepHours,
  onSleepHoursChange,
  checks,
  onChecksChange,
}) => {
  const guidance = getSleepGuidance(sleepHours);
  const progressPct = Math.round((sleepHours / 12) * 100);

  const trackColor =
    guidance.tone === 'emerald'
      ? '#95E1D3'
      : guidance.tone === 'amber'
        ? '#FCE38A'
        : '#F38181';

  const toneBoxClass =
    guidance.tone === 'emerald'
      ? 'bg-[#95E1D3]/40 text-slate-950'
      : guidance.tone === 'amber'
        ? 'bg-[#FCE38A]/70 text-slate-950'
        : 'bg-[#F38181]/65 text-slate-950';

  const adjustSleep = (delta: number) => {
    const next = Math.min(12, Math.max(0, Math.round((sleepHours + delta) * 2) / 2));
    onSleepHoursChange(next);
  };

  const toggleCheck = (key: keyof AlertnessChecks) => {
    onChecksChange({
      ...checks,
      [key]: !checks[key],
    });
  };

  const checkItems: { key: keyof AlertnessChecks; title: string; subtitle: string }[] = [
    {
      key: 'noDrowsiness',
      title: 'ไม่ง่วงซึม ไม่มีอาการเวียนศีรษะ',
      subtitle: 'ยืนยันความตื่นตัวทางร่างกายก่อนเข้าพื้นที่เสี่ยงสูง',
    },
    {
      key: 'noSedatingMeds',
      title: 'ไม่ได้ทานยาที่มีฤทธิ์ทำให้ง่วง',
      subtitle: 'เช่น ยาแก้แพ้ ยาคลายกล้ามเนื้อ หรือยาที่มีผลต่อการตอบสนอง',
    },
    {
      key: 'ppeReady',
      title: 'อุปกรณ์ PPE และเครื่องมือพร้อมใช้งาน',
      subtitle: 'หมวกนิรภัย รองเท้าเซฟตี้ และอุปกรณ์ป้องกันครบถ้วน',
    },
  ];

  return (
    <div className="space-y-6 rounded-2xl border-2 border-slate-900 bg-white p-5 sm:p-6">
      {/* Sleep Hours Slider Section */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-900 bg-[#FCE38A] text-slate-950">
              <Moon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-950">
                2. ชั่วโมงการนอนหลับ
              </h2>
              <p className="text-xs font-medium text-slate-600">
                ในช่วง 24 ชั่วโมงที่ผ่านมา
              </p>
            </div>
          </div>

          <div className="font-mono text-3xl font-extrabold text-slate-950 tabular-nums sm:text-4xl">
            {sleepHours.toFixed(1)}{' '}
            <span className="font-sans text-base font-bold text-slate-700">ชม.</span>
          </div>
        </div>

        {/* Tactile Slider + Step Buttons */}
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => adjustSleep(-0.5)}
            disabled={sleepHours <= 0}
            aria-label="ลดชั่วโมงการนอน 0.5 ชั่วโมง"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-slate-900 bg-[#EAFFD0] text-slate-950 transition-colors hover:bg-[#FCE38A] disabled:opacity-40"
          >
            <Minus className="h-5 w-5 stroke-[2.5]" />
          </button>

          <div className="flex-1">
            <label htmlFor="sleep-hours-slider" className="sr-only">
              แถบเลื่อนชั่วโมงการนอนหลับ
            </label>
            <input
              id="sleep-hours-slider"
              type="range"
              min={0}
              max={12}
              step={0.5}
              value={sleepHours}
              onChange={(e) => onSleepHoursChange(Number.parseFloat(e.target.value))}
              className="safety-slider"
              style={{
                background: `linear-gradient(to right, ${trackColor} 0%, ${trackColor} ${progressPct}%, #EAFFD0 ${progressPct}%, #EAFFD0 100%)`,
              }}
            />
            <div className="mt-2 flex justify-between font-mono text-xs font-bold text-slate-700 tabular-nums">
              <span>0 ชม.</span>
              <span>4 ชม.</span>
              <span className="text-slate-950 underline decoration-[#FCE38A] decoration-4">7 ชม.</span>
              <span>10 ชม.</span>
              <span>12 ชม.</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => adjustSleep(0.5)}
            disabled={sleepHours >= 12}
            aria-label="เพิ่มชั่วโมงการนอน 0.5 ชั่วโมง"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-slate-900 bg-[#EAFFD0] text-slate-950 transition-colors hover:bg-[#FCE38A] disabled:opacity-40"
          >
            <Plus className="h-5 w-5 stroke-[2.5]" />
          </button>
        </div>

        <p className={`mt-3 rounded-xl border border-slate-900/20 px-3.5 py-2 text-sm font-bold ${toneBoxClass}`}>
          {guidance.label}
        </p>
      </div>

      {/* Hairline Divider */}
      <div className="border-t-2 border-slate-900/10" />

      {/* Quick Pre-Shift Safety Checkboxes */}
      <div>
        <h3 className="text-sm font-extrabold text-slate-950">
          3. ยืนยันความพร้อมก่อนเข้ากะ
        </h3>
        <div className="mt-3 space-y-2.5">
          {checkItems.map((item) => {
            const checked = checks[item.key];
            return (
              <button
                key={item.key}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggleCheck(item.key)}
                className={`flex min-h-[54px] w-full items-center gap-3.5 rounded-xl border-2 border-slate-900 px-4 py-2.5 text-left transition-colors ${
                  checked
                    ? 'bg-[#EAFFD0] text-slate-950'
                    : 'bg-[#F38181]/45 text-slate-950'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-slate-950 transition-colors ${
                    checked
                      ? 'bg-[#95E1D3] text-slate-950'
                      : 'bg-[#F38181] text-transparent'
                  }`}
                >
                  <Check className="h-4 w-4 stroke-[3]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold leading-snug">{item.title}</div>
                  <div className="text-xs text-slate-700 leading-snug">
                    {item.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
