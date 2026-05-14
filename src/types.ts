export type MedStatus = 'pending' | 'taken' | 'missed' | 'skipped' | 'planned';

export const STATUS_META: Record<MedStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:  { label: '미복용',   color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' },
  taken:    { label: '복용함',   color: '#166534', bg: '#F0FDF4', border: '#86EFAC' },
  missed:   { label: '시간 지남', color: '#991B1B', bg: '#FEF2F2', border: '#FECACA' },
  skipped:  { label: '복용 안 함', color: '#92400E', bg: '#FFFBEB', border: '#FCD34D' },
  planned:  { label: '복용 예정', color: '#1B3A6B', bg: '#EEF3FB', border: '#93C5FD' },
};

export const SKIP_REASONS = ['깜빡함', '약 없음', '속이 불편함', '의사 지시', '기타'] as const;
export type SkipReason = typeof SKIP_REASONS[number];

export interface Schedule {
  time: string;   // "08:00"
  label: string;  // "아침"
  dose: string;   // "1정"
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  category: string;
  color: string;
  isStudy: boolean;
  daysLeft: number;
  schedules: Schedule[];
  notifEnabled: boolean;
}

export interface MedLogEntry {
  medicationId: string;
  medName: string;
  scheduleLabel: string;
  scheduleTime: string;
  status: MedStatus;
  skipReason?: SkipReason;
  isStudy: boolean;
}

export type DayLogs = Record<string, MedLogEntry>; // key = `${medId}_${scheduleLabel}`
export type AllLogs = Record<string, DayLogs>;     // key = date "YYYY-MM-DD"

export interface Checkin {
  id: string;
  date: string;
  mood: string;
  symptoms: string[];
  note: string;
}

export interface Checkup {
  id: string;
  date: string;
  inst: string;
  // 기본
  ht: string; wt: string; bmi: string; waist: string;
  // 혈압/맥박
  sbp: string; dbp: string; pulse: string;
  // 혈당
  gl: string; hba1c: string;
  // 지질
  chol: string; ldl: string; hdl: string; tri: string;
  // 간기능
  ast: string; alt: string; ggt: string; alp: string; bili: string;
  // 신장
  cr: string; egfr: string; bun: string; uprotein: string;
  // 혈액
  wbc: string; rbc: string; hb: string; hct: string; platelet: string;
  // 염증
  crp: string; esr: string;
  // 전해질
  na: string; k: string; cl: string;
  // 갑상선
  tsh: string; ft4: string;
  // 종양표지자
  cea: string; ca199: string; afp: string; psa: string;
  // 소변/영상
  urine: string; imaging: string;
  comment: string;
}

export interface AppState {
  tab: 'home' | 'meds' | 'checkin' | 'checkup' | 'report' | 'ai';
  meds: Medication[];
  logs: AllLogs;
  checkins: Checkin[];
  checkups: Checkup[];
  patientName: string;
  onboarded: boolean;
}
