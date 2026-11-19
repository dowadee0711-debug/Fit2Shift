import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Hand, RotateCcw, Zap } from 'lucide-react';

type ArenaPhase = 'idle' | 'waiting' | 'go' | 'false-start' | 'round-result' | 'complete';

interface ReactionTestArenaProps {
  trials: number[];
  onTrialsChange: (trials: number[]) => void;
  onActivityStart?: () => void;
}

const TOTAL_ROUNDS = 3;

export const ReactionTestArena: React.FC<ReactionTestArenaProps> = ({
  trials,
  onTrialsChange,
  onActivityStart,
}) => {
  const [phase, setPhase] = useState<ArenaPhase>(
    trials.length >= TOTAL_ROUNDS ? 'complete' : 'idle'
  );
  const [lastMs, setLastMs] = useState<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const goStartTimeRef = useRef<number>(0);

  const clearPendingTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearPendingTimer();
  }, [clearPendingTimer]);

  useEffect(() => {
    if (trials.length === 0 && phase === 'complete') {
      setPhase('idle');
      setLastMs(null);
    }
  }, [trials.length, phase]);

  const startWaitingRound = useCallback(() => {
    clearPendingTimer();
    onActivityStart?.();
    setPhase('waiting');
    const delayMs = 1100 + Math.floor(Math.random() * 1700);
    timeoutRef.current = window.setTimeout(() => {
      goStartTimeRef.current = performance.now();
      setPhase('go');
    }, delayMs);
  }, [clearPendingTimer, onActivityStart]);

  const handleArenaPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (phase === 'idle' || phase === 'false-start' || phase === 'round-result') {
      startWaitingRound();
      return;
    }

    if (phase === 'waiting') {
      clearPendingTimer();
      setPhase('false-start');
      return;
    }

    if (phase === 'go') {
      const elapsed = Math.max(80, Math.round(performance.now() - goStartTimeRef.current));
      const updated = [...trials, elapsed];
      setLastMs(elapsed);
      onTrialsChange(updated);
      if (updated.length >= TOTAL_ROUNDS) {
        setPhase('complete');
      } else {
        setPhase('round-result');
      }
    }
  };

  const handleReset = () => {
    clearPendingTimer();
    onTrialsChange([]);
    setLastMs(null);
    setPhase('idle');
  };

  const avgMs =
    trials.length > 0
      ? Math.round(trials.reduce((sum, val) => sum + val, 0) / trials.length)
      : null;

  const currentRoundDisplay = Math.min(trials.length + 1, TOTAL_ROUNDS);

  const arenaStyles: Record<ArenaPhase, string> = {
    idle: 'border-slate-950 bg-[#FCE38A] hover:bg-[#fbd85d] text-slate-950',
    waiting: 'border-slate-950 bg-slate-900 text-[#FCE38A]',
    go: 'border-slate-950 bg-[#95E1D3] text-slate-950 shadow-[0_0_0_6px_#EAFFD0]',
    'false-start': 'border-slate-950 bg-[#F38181] text-slate-950',
    'round-result': 'border-slate-950 bg-[#EAFFD0] hover:bg-[#dffab9] text-slate-950',
    complete: 'border-slate-950 bg-[#95E1D3]/45 text-slate-950',
  };

  return (
    <div className="rounded-2xl border-2 border-slate-900 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-950 sm:text-2xl">
            1. แบบทดสอบปฏิกิริยาตอบสนอง
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            ทดสอบ 3 รอบเพื่อวัดความตื่นตัว — เมื่อหน้าจอเปลี่ยนเป็น{' '}
            <strong className="text-teal-900 underline decoration-[#95E1D3] decoration-4">
              สีเขียวมิ้นต์
            </strong>{' '}
            ให้แตะทันที
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-extrabold text-slate-900 tabular-nums">
            รอบที่ {trials.length}/{TOTAL_ROUNDS}
          </span>
          {trials.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-[#EAFFD0] px-3 py-1.5 text-xs font-bold text-slate-950 transition-colors hover:bg-[#FCE38A] whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>ทดสอบใหม่</span>
            </button>
          )}
        </div>
      </div>

      {/* Large Interactive Reaction Arena */}
      <button
        type="button"
        onPointerDown={handleArenaPointerDown}
        disabled={phase === 'complete'}
        aria-live="polite"
        className={`mt-4 flex min-h-[260px] w-full select-none flex-col items-center justify-center rounded-2xl border-4 p-6 text-center transition-colors duration-100 touch-manipulation sm:min-h-[310px] ${arenaStyles[phase]} disabled:cursor-default`}
      >
        {phase === 'idle' && (
          <>
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-slate-950 bg-white text-slate-950">
              <Zap className="h-9 w-9 stroke-[2.5]" />
            </span>
            <span className="mt-5 font-display text-2xl font-extrabold text-slate-950 sm:text-3xl">
              แตะที่นี่เพื่อเริ่มทดสอบ
            </span>
            <span className="mt-2 text-sm font-semibold text-slate-800">
              เริ่มรอบที่ 1 จาก 3 (ใช้เวลาประมาณ 10 วินาที)
            </span>
          </>
        )}

        {phase === 'waiting' && (
          <>
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#FCE38A] bg-[#FCE38A]/15 text-[#FCE38A]">
              <Hand className="h-9 w-9 stroke-[2.2]" />
            </span>
            <span className="mt-5 font-display text-2xl font-extrabold text-[#FCE38A] sm:text-3xl">
              รอสัญญาณสีเขียวมิ้นต์...
            </span>
            <span className="mt-2 text-sm font-semibold text-[#EAFFD0]">
              ห้ามแตะก่อนสัญญาณไฟจะปรากฏ
            </span>
          </>
        )}

        {phase === 'go' && (
          <>
            <span className="font-display text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              แตะทันที!
            </span>
            <span className="mt-3 text-base font-extrabold text-slate-950">
              TAP NOW — รอบที่ {currentRoundDisplay}/{TOTAL_ROUNDS}
            </span>
          </>
        )}

        {phase === 'false-start' && (
          <>
            <span className="font-display text-2xl font-extrabold text-slate-950 sm:text-3xl">
              กดเร็วเกินไป!
            </span>
            <span className="mt-2 text-sm font-bold text-slate-900">
              คุณแตะก่อนสัญญาณจะขึ้น — แตะอีกครั้งเพื่อเริ่มรอบที่ {currentRoundDisplay} ใหม่
            </span>
          </>
        )}

        {phase === 'round-result' && (
          <>
            <span className="font-mono text-5xl font-extrabold text-slate-950 tabular-nums sm:text-6xl">
              {lastMs} <span className="text-2xl font-bold text-slate-700">ms</span>
            </span>
            <span className="mt-4 inline-flex items-center rounded-xl border-2 border-slate-950 bg-[#FCE38A] px-5 py-2.5 text-sm font-extrabold text-slate-950">
              แตะเพื่อเริ่มรอบที่ {currentRoundDisplay}/{TOTAL_ROUNDS} ต่อทันที
            </span>
          </>
        )}

        {phase === 'complete' && (
          <>
            <span className="text-sm font-extrabold text-teal-950">
              ทดสอบปฏิกิริยาครบ 3 รอบเรียบร้อยแล้ว
            </span>
            <span className="mt-2 font-mono text-5xl font-extrabold text-slate-950 tabular-nums sm:text-6xl">
              {avgMs} <span className="text-2xl font-bold text-slate-700">ms</span>
            </span>
            <span className="mt-2 text-sm font-semibold text-slate-800">
              ค่าเฉลี่ยความเร็วในการตอบสนอง
            </span>
          </>
        )}
      </button>

      {/* Trial Breakdown Strip */}
      <div className="mt-4 grid grid-cols-3 divide-x-2 divide-slate-900/15 rounded-xl border-2 border-slate-900 bg-[#EAFFD0]/60 py-3">
        {[0, 1, 2].map((idx) => {
          const val = trials[idx];
          return (
            <div key={idx} className="px-3 text-center">
              <div className="text-xs font-bold text-slate-700">
                รอบที่ {idx + 1}
              </div>
              <div className="mt-1 font-mono text-lg font-extrabold text-slate-950 tabular-nums">
                {val !== undefined ? `${val} ms` : '—'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
