import type { AlertnessChecks, ReadinessEvaluation } from '../types/fit2shift';

export function evaluateReadiness(
  sleepHours: number,
  trialsMs: number[],
  checks: AlertnessChecks
): ReadinessEvaluation {
  const hasTrials = trialsMs.length >= 3;
  const avgReactionMs =
    trialsMs.length > 0
      ? Math.round(trialsMs.reduce((acc, v) => acc + v, 0) / trialsMs.length)
      : null;

  // 1. Sleep fatigue component (0 - 65 pts)
  let sleepPenalty = 0;
  if (sleepHours >= 7.5) {
    sleepPenalty = 0;
  } else if (sleepHours >= 7.0) {
    sleepPenalty = 8;
  } else if (sleepHours >= 6.5) {
    sleepPenalty = 16;
  } else if (sleepHours >= 6.0) {
    sleepPenalty = 26;
  } else if (sleepHours >= 5.5) {
    sleepPenalty = 38;
  } else if (sleepHours >= 5.0) {
    sleepPenalty = 50;
  } else {
    sleepPenalty = 65;
  }

  // 2. Reaction time component (0 - 48 pts)
  let reactionPenalty = 0;
  if (avgReactionMs !== null) {
    if (avgReactionMs <= 260) {
      reactionPenalty = 0;
    } else if (avgReactionMs <= 310) {
      reactionPenalty = 10;
    } else if (avgReactionMs <= 360) {
      reactionPenalty = 20;
    } else if (avgReactionMs <= 420) {
      reactionPenalty = 32;
    } else {
      reactionPenalty = 48;
    }
  }

  // 3. Pre-shift alertness confirmation penalty
  let checkPenalty = 0;
  if (!checks.noDrowsiness) checkPenalty += 18;
  if (!checks.noSedatingMeds) checkPenalty += 18;
  if (!checks.ppeReady) checkPenalty += 14;

  const fatigueScore = Math.min(100, Math.max(0, sleepPenalty + reactionPenalty + checkPenalty));
  const readinessScore = 100 - fatigueScore;

  const reasons: string[] = [];
  const recommendations: string[] = [];

  if (sleepHours < 5.5) {
    reasons.push(`ชั่วโมงการนอนต่ำกว่าเกณฑ์ปลอดภัย (${sleepHours.toFixed(1)} ชม. — ขั้นต่ำ 5.5 ชม.)`);
    recommendations.push('งดเข้าปฏิบัติงานในพื้นที่เสี่ยงสูงทันที และพักผ่อนนอนหลับเพิ่มเติมอย่างน้อย 2–4 ชั่วโมงก่อนตรวจประเมินซ้ำ');
  } else if (sleepHours < 7.0) {
    reasons.push(`พักผ่อนน้อยกว่าค่าแนะนำ (${sleepHours.toFixed(1)} ชม. — แนะนำ ≥ 7.0 ชม.)`);
  }

  if (avgReactionMs !== null) {
    if (avgReactionMs > 420) {
      reasons.push(`ความเร็วปฏิกิริยาช้ากว่าเกณฑ์วิกฤต (${avgReactionMs} ms — เกณฑ์ ≤ 420 ms)`);
      recommendations.push('ห้ามควบคุมเครื่องจักรกลหนัก งานบนที่สูง หรือระบบไฟฟ้าแรงสูงโดยเด็ดขาด จนกว่าความตื่นตัวจะกลับสู่เกณฑ์ปกติ');
    } else if (avgReactionMs > 340) {
      reasons.push(`ปฏิกิริยาตอบสนองชะลอตัวเล็กน้อย (${avgReactionMs} ms)`);
    }
  } else {
    reasons.push('รอผลการทดสอบปฏิกิริยาตอบสนองครบ 3 รอบ');
  }

  if (!checks.noDrowsiness) {
    reasons.push('พบอาการง่วงซึม/เวียนศีรษะก่อนเข้ากะ');
    recommendations.push('แจ้งหัวหน้างานเพื่อสลับไปปฏิบัติงานสนับสนุนที่มีความเสี่ยงต่ำ หรือพบเจ้าหน้าที่พยาบาลประจำสถานประกอบการ');
  }
  if (!checks.noSedatingMeds) {
    reasons.push('มีการใช้ยาที่มีฤทธิ์ทำให้ง่วงซึม');
    recommendations.push('ห้ามปฏิบัติงานกับเครื่องจักรที่เคลื่อนไหวหรือขับขี่ยานพาหนะขณะยาออกฤทธิ์ กรุณารายงานแพทย์/หัวหน้ากะ');
  }
  if (!checks.ppeReady) {
    reasons.push('ยังไม่ได้ยืนยันความพร้อมของอุปกรณ์ PPE');
    recommendations.push('ตรวจสอบและสวมใส่อุปกรณ์ป้องกันส่วนบุคคล (PPE) ให้ครบถ้วนสมบูรณ์ก่อนเข้าพื้นที่ปฏิบัติงาน');
  }

  const criticalSleepFail = sleepHours < 5.5;
  const criticalReactionFail = avgReactionMs !== null && avgReactionMs > 420;
  const missingSafetyConfirmations = !checks.noDrowsiness || !checks.noSedatingMeds || !checks.ppeReady;

  const isPass =
    fatigueScore < 45 &&
    !criticalSleepFail &&
    !criticalReactionFail &&
    !missingSafetyConfirmations;

  const riskLevel: 'LOW' | 'MODERATE' | 'HIGH' =
    fatigueScore >= 45 || criticalSleepFail || criticalReactionFail || missingSafetyConfirmations
      ? 'HIGH'
      : fatigueScore >= 24
        ? 'MODERATE'
        : 'LOW';

  if (isPass) {
    if (reasons.length === 0) {
      reasons.push('ชั่วโมงการนอนหลับและปฏิกิริยาตอบสนองอยู่ในเกณฑ์ปลอดภัย');
    }
    recommendations.push('ปฏิบัติงานตามขั้นตอนความปลอดภัยมาตรฐานและสวมใส่อุปกรณ์ PPE ตลอดกะการทำงาน');
  } else {
    if (recommendations.length === 0) {
      recommendations.push('คะแนนความเหนื่อยล้ารวมสูงเกินเกณฑ์ปลอดภัย กรุณาพักผ่อนและแจ้งหัวหน้างานเพื่อทบทวนการมอบหมายงาน');
    }
    recommendations.push('รายงานผลต่อหัวหน้ากะทันที และดำเนินการประเมินซ้ำอีกครั้งเมื่อร่างกายพร้อมเต็มที่');
  }

  return {
    fatigueScore,
    readinessScore,
    status: isPass ? 'PASS' : 'FAIL',
    riskLevel,
    avgReactionMs,
    sleepHours,
    reasons,
    recommendations,
    readyToSubmit: hasTrials,
  };
}

export function getSleepGuidance(hours: number): {
  label: string;
  tone: 'emerald' | 'amber' | 'red';
} {
  if (hours >= 7.0) {
    return {
      label: 'พักผ่อนเพียงพอสำหรับงานเสี่ยงสูง (แนะนำ ≥ 7.0 ชม.)',
      tone: 'emerald',
    };
  }
  if (hours >= 5.5) {
    return {
      label: 'พักผ่อนค่อนข้างน้อย — ต้องผ่านการทดสอบปฏิกิริยาที่แม่นยำ',
      tone: 'amber',
    };
  }
  return {
    label: 'ขาดนอนรุนแรง (ต่ำกว่า 5.5 ชม.) — ไม่ปลอดภัยต่อการเข้ากะ',
    tone: 'red',
  };
}
