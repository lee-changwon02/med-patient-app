import type { AllLogs, AppState, Checkup, Medication } from './types';

const STORE = 'medapp_v8';
const today = () => new Date().toISOString().split('T')[0];

export const INIT_MEDS: Medication[] = [
  {
    id: 'm1', name: '리피토정 10mg', dosage: '1정', category: '고지혈증약',
    color: '#166534', isStudy: false, daysLeft: 67, notifEnabled: true,
    schedules: [{ time: '19:00', label: '저녁', dose: '1정' }],
  },
  {
    id: 'm2', name: '아모잘탄정 5/50mg', dosage: '1정', category: '고혈압약',
    color: '#1B3A6B', isStudy: false, daysLeft: 44, notifEnabled: true,
    schedules: [{ time: '08:00', label: '아침', dose: '1정' }],
  },
  {
    id: 'study1', name: 'Penetrium 100mg', dosage: '100mg', category: '동정적 사용',
    color: '#6D28D9', isStudy: true, daysLeft: 30, notifEnabled: true,
    schedules: [
      { time: '08:00', label: '아침', dose: '1정' },
      { time: '20:00', label: '저녁', dose: '1정' },
    ],
  },
];

const INIT_CU: Checkup[] = [{
  id: 'cu0', date: '2025-03-15', inst: '서울대병원',
  ht: '172', wt: '75', bmi: '25.3', waist: '84',
  sbp: '125', dbp: '82', pulse: '72',
  gl: '98', hba1c: '5.6',
  chol: '198', ldl: '128', hdl: '52', tri: '145',
  ast: '28', alt: '24', ggt: '22', alp: '68', bili: '0.8',
  cr: '0.9', egfr: '88', bun: '14', uprotein: '음성',
  wbc: '6.2', rbc: '4.8', hb: '14.2', hct: '42', platelet: '210',
  crp: '0.3', esr: '8',
  na: '140', k: '4.0', cl: '102',
  tsh: '2.1', ft4: '1.2',
  cea: '', ca199: '', afp: '', psa: '',
  urine: '이상없음', imaging: '',
  comment: '전반적으로 양호. 콜레스테롤 경계값 지속 모니터링 필요.',
}];

function hashRand(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return (h >>> 0) / 4294967295;
}

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export function buildLogs(meds: Medication[], days = 28): AllLogs {
  const logs: AllLogs = {};
  for (let i = days - 1; i >= 0; i--) {
    const date = daysAgo(i);
    logs[date] = {};
    meds.forEach(m => {
      m.schedules.forEach(sc => {
        const key = `${m.id}_${sc.label}`;
        const taken = i === 0 ? (sc.label === '아침') : hashRand(date + m.id + sc.label) > 0.18;
        logs[date][key] = {
          medicationId: m.id, medName: m.name,
          scheduleLabel: sc.label, scheduleTime: sc.time,
          status: taken ? 'taken' : 'pending', isStudy: m.isStudy,
        };
      });
    });
  }
  return logs;
}

export function ensureTodayLog(meds: Medication[], logs: AllLogs): AllLogs {
  const t = today();
  if (!logs[t]) {
    logs[t] = {};
    meds.forEach(m => {
      m.schedules.forEach(sc => {
        const key = `${m.id}_${sc.label}`;
        logs[t][key] = {
          medicationId: m.id, medName: m.name,
          scheduleLabel: sc.label, scheduleTime: sc.time,
          status: 'pending', isStudy: m.isStudy,
        };
      });
    });
  }
  return logs;
}

export function emptyCheckup(): Omit<Checkup, 'id'> {
  return {
    date: today(), inst: '',
    ht: '', wt: '', bmi: '', waist: '',
    sbp: '', dbp: '', pulse: '',
    gl: '', hba1c: '',
    chol: '', ldl: '', hdl: '', tri: '',
    ast: '', alt: '', ggt: '', alp: '', bili: '',
    cr: '', egfr: '', bun: '', uprotein: '',
    wbc: '', rbc: '', hb: '', hct: '', platelet: '',
    crp: '', esr: '',
    na: '', k: '', cl: '',
    tsh: '', ft4: '',
    cea: '', ca199: '', afp: '', psa: '',
    urine: '', imaging: '',
    comment: '',
  };
}

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

export function saveState(s: AppState) {
  try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* ignore */ }
}

export function getInitialState(): AppState {
  const saved = loadState();
  const meds = saved?.meds ?? INIT_MEDS;
  const rawLogs = saved?.logs ?? buildLogs(meds);
  return {
    tab: 'home',
    meds,
    logs: ensureTodayLog(meds, rawLogs),
    checkins: saved?.checkins ?? [],
    checkups: saved?.checkups ?? [...INIT_CU],
    patientName: saved?.patientName ?? '',
    onboarded: saved?.onboarded ?? false,
  };
}
