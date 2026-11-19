export type ShiftType = 'กะเช้า (06:00–14:00)' | 'กะบ่าย (14:00–22:00)' | 'กะดึก (22:00–06:00)';

export interface EmployeeSession {
  employeeId: string;
  employeeName: string;
  department: string;
  shift: ShiftType;
  loginAt: string;
}

export interface AlertnessChecks {
  noDrowsiness: boolean;
  noSedatingMeds: boolean;
  ppeReady: boolean;
}

export interface ReadinessEvaluation {
  fatigueScore: number; // 0 = fresh, 100 = critical fatigue
  readinessScore: number; // 100 - fatigueScore
  status: 'PASS' | 'FAIL';
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  avgReactionMs: number | null;
  sleepHours: number;
  reasons: string[];
  recommendations: string[];
  readyToSubmit: boolean;
}

export interface SheetConnection {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  sheetName: string;
  sheetId?: number;
}

export interface ShiftAssessmentRecord {
  rowNumber?: number;
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
}
