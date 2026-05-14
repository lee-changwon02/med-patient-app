import React, { useCallback, useEffect, useState } from 'react';
import './App.css';
import type { AppState, Checkin, Checkup, MedLogEntry, MedStatus, Medication, Schedule, SkipReason } from './types';
import { ensureTodayLog, getInitialState, saveState } from './store';
import { createPatient, insertRecord, deleteRecord, upsertMedRecord, fetchTodayRecords, fetchRecordsByType } from './lib/supabase';
import type { RemoteRecord } from './lib/supabase';
import MedicationCard from './components/MedicationCard';
import Timeline from './components/Timeline';
import CheckinForm from './components/CheckinForm';
import CheckupForm from './components/CheckupForm';
import OcrImport from './components/OcrImport';
import ReportView from './components/ReportView';
import Toast from './components/Toast';
import type { ToastType } from './components/Toast';

// ── constants ─────────────────────────────────────────────────────────────────
const LS_TOKEN = 'patient_token';
const LS_NAME  = 'patient_name';
const LS_MEMO  = 'patient_memo';

const todayStr = () => new Date().toISOString().split('T')[0];
const DKR = ['일', '월', '화', '수', '목', '금', '토'];

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function generateToken(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `P${ts}${rand}`;
}

// ── RegisterScreen ────────────────────────────────────────────────────────────
function RegisterScreen({
  onRegistered,
}: {
  onRegistered: (token: string, name: string) => void;
}) {
  const [name, setName] = useState('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    const token = generateToken();
    const err = await createPatient(token, trimmed);
    if (err) {
      setError('서버 연결 실패 — 로컬에만 저장됩니다.');
    }
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_NAME, trimmed);
    if (memo.trim()) localStorage.setItem(LS_MEMO, memo.trim());
    setLoading(false);
    onRegistered(token, trimmed);
  };

  return (
    <div className="onboard">
      <div className="ob">
        <div className="ob-icon">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
            stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <h1>복약 관리</h1>
        <p>
          이름 또는 별칭을 입력하면<br />
          바로 시작할 수 있습니다.<br />
          QR 코드 없이도 사용 가능합니다.
        </p>

        <input
          className="inp"
          type="text"
          placeholder="이름 또는 별칭 *"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && name.trim() && handleSubmit()}
          autoFocus
        />
        <input
          className="inp"
          type="text"
          placeholder="전화번호 뒤 4자리 또는 메모 (선택)"
          value={memo}
          onChange={e => setMemo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && name.trim() && handleSubmit()}
          style={{ marginTop: 8 }}
        />

        {error && (
          <div style={{
            marginTop: 10, fontSize: 11, color: '#FCD34D',
            background: 'rgba(255,255,255,.08)', borderRadius: 8, padding: '8px 12px',
            lineHeight: 1.6, width: '100%',
          }}>
            {error}
          </div>
        )}

        <button
          className="bp"
          style={{ marginTop: 14 }}
          disabled={!name.trim() || loading}
          onClick={handleSubmit}
        >
          {loading ? '등록 중...' : '시작하기'}
        </button>
      </div>
    </div>
  );
}

// ── OnboardingScreen (URL token 진입 시 이름 입력) ────────────────────────────
function OnboardingScreen({ onComplete }: { onComplete: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <div className="onboard">
      <div className="ob">
        <div className="ob-icon">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
            stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <h1>복약 관리</h1>
        <p>약 복용 일정을 관리하고<br />건강 상태를 기록하세요</p>
        <input
          className="inp"
          type="text"
          placeholder="이름을 입력해주세요"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onComplete(name.trim())}
          autoFocus
        />
        <button
          className="bp"
          style={{ marginTop: 12 }}
          disabled={!name.trim()}
          onClick={() => onComplete(name.trim())}
        >
          시작하기
        </button>
      </div>
    </div>
  );
}

// ── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({
  patientName,
  token,
  memo,
  onReset,
  onClose,
}: {
  patientName: string;
  token: string;
  memo: string;
  onReset: () => void;
  onClose: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="ov" onClick={onClose}>
      <div className="mbox" onClick={e => e.stopPropagation()}>
        <div className="mhdr">
          <span className="mtitle">설정</span>
          <button className="mclose" onClick={onClose}>✕</button>
        </div>

        {/* 사용자 정보 */}
        <div className="card-hd">사용자 정보</div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row" style={{ padding: '10px 0' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>이름</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{patientName || '미입력'}</div>
            </div>
          </div>
          <div className="row" style={{ padding: '10px 0' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>토큰</div>
              <div style={{
                fontFamily: 'monospace', fontSize: 12, color: '#334155',
                background: '#F1F5F9', borderRadius: 6, padding: '4px 8px',
                display: 'inline-block', letterSpacing: 1,
              }}>
                {token}
              </div>
            </div>
          </div>
          {memo && (
            <div className="row" style={{ padding: '10px 0' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>메모</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{memo}</div>
              </div>
            </div>
          )}
        </div>

        {/* 초기화 */}
        <div className="card-hd">데이터 관리</div>
        {!confirmReset ? (
          <button
            className="bp"
            style={{ background: '#991B1B', marginBottom: 8 }}
            onClick={() => setConfirmReset(true)}
          >
            사용자 정보 초기화
          </button>
        ) : (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: 10, padding: '14px', marginBottom: 8,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#991B1B', marginBottom: 8 }}>
              정말 초기화하시겠습니까?
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 12, lineHeight: 1.6 }}>
              로컬 저장 데이터(약 목록, 복약 기록, 검진 기록)와<br />
              사용자 토큰이 모두 삭제됩니다.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="bp" style={{ background: '#991B1B', flex: 1 }} onClick={onReset}>
                초기화
              </button>
              <button className="bo" style={{ flex: 1 }} onClick={() => setConfirmReset(false)}>
                취소
              </button>
            </div>
          </div>
        )}

        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

// ── Add/Edit Med Modal ────────────────────────────────────────────────────────
interface MedFormData {
  name: string;
  dosage: string;
  category: string;
  isStudy: boolean;
  daysLeft: number;
  schedules: Schedule[];
}

const SCHEDULE_PRESETS: Record<string, Schedule[]> = {
  QD:   [{ time: '08:00', label: '아침', dose: '1정' }],
  BID:  [{ time: '08:00', label: '아침', dose: '1정' }, { time: '20:00', label: '저녁', dose: '1정' }],
  TID:  [{ time: '08:00', label: '아침', dose: '1정' }, { time: '12:00', label: '점심', dose: '1정' }, { time: '19:00', label: '저녁', dose: '1정' }],
  QID:  [{ time: '08:00', label: '아침', dose: '1정' }, { time: '12:00', label: '점심', dose: '1정' }, { time: '17:00', label: '오후', dose: '1정' }, { time: '21:00', label: '취침전', dose: '1정' }],
  취침전: [{ time: '21:30', label: '취침전', dose: '1정' }],
  식전: [{ time: '07:30', label: '식전아침', dose: '1정' }, { time: '11:30', label: '식전점심', dose: '1정' }, { time: '18:30', label: '식전저녁', dose: '1정' }],
  식후: [{ time: '08:30', label: '식후아침', dose: '1정' }, { time: '12:30', label: '식후점심', dose: '1정' }, { time: '19:30', label: '식후저녁', dose: '1정' }],
};

function MedFormModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: MedFormData;
  onSave: (data: MedFormData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<MedFormData>(initial ?? {
    name: '', dosage: '', category: '일반약', isStudy: false, daysLeft: 30,
    schedules: [{ time: '08:00', label: '아침', dose: '1정' }],
  });

  const set = <K extends keyof MedFormData>(k: K, v: MedFormData[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const updateSchedule = (i: number, k: keyof Schedule, v: string) =>
    setForm(prev => ({
      ...prev,
      schedules: prev.schedules.map((s, idx) => idx === i ? { ...s, [k]: v } : s),
    }));

  const addSchedule = () =>
    setForm(prev => ({
      ...prev,
      schedules: [...prev.schedules, { time: '12:00', label: '점심', dose: '1정' }],
    }));

  const removeSchedule = (i: number) =>
    setForm(prev => ({
      ...prev,
      schedules: prev.schedules.filter((_, idx) => idx !== i),
    }));

  const applyPreset = (preset: string) =>
    setForm(prev => ({ ...prev, schedules: [...SCHEDULE_PRESETS[preset]] }));

  return (
    <div className="ov" onClick={onClose}>
      <div className="mbox" onClick={e => e.stopPropagation()}>
        <div className="mhdr">
          <span className="mtitle">{initial ? '약 정보 수정' : '약 추가'}</span>
          <button className="mclose" onClick={onClose}>✕</button>
        </div>

        <div className="ig">
          <label className="lbl">약 이름 *</label>
          <input className="inp" value={form.name}
            onChange={e => set('name', e.target.value)} placeholder="예: 리피토정 10mg" />
        </div>
        <div className="ig">
          <label className="lbl">용량</label>
          <input className="inp" value={form.dosage}
            onChange={e => set('dosage', e.target.value)} placeholder="예: 1정, 10mg" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div>
            <label className="lbl">분류</label>
            <select className="inp" value={form.category} onChange={e => set('category', e.target.value)}>
              {['일반약','고혈압약','고지혈증약','당뇨약','항생제','진통제','동정적 사용','기타'].map(c =>
                <option key={c}>{c}</option>
              )}
            </select>
          </div>
          <div>
            <label className="lbl">잔여일수</label>
            <input className="inp" type="number" value={form.daysLeft}
              onChange={e => set('daysLeft', parseInt(e.target.value) || 30)} min={1} />
          </div>
        </div>

        <div className="ig">
          <label className="lbl">복용 빈도 프리셋</label>
          <div className="pr">
            {Object.keys(SCHEDULE_PRESETS).map(p => (
              <button key={p} className="pill" onClick={() => applyPreset(p)}>{p}</button>
            ))}
          </div>
        </div>

        <div className="ig">
          <label className="lbl">복용 스케줄</label>
          {form.schedules.map((sc, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input className="inp" type="time" value={sc.time}
                onChange={e => updateSchedule(i, 'time', e.target.value)} style={{ flex: 1 }} />
              <input className="inp" value={sc.label}
                onChange={e => updateSchedule(i, 'label', e.target.value)}
                placeholder="이름" style={{ flex: 1 }} />
              <input className="inp" value={sc.dose}
                onChange={e => updateSchedule(i, 'dose', e.target.value)}
                placeholder="용량" style={{ flex: 1 }} />
              {form.schedules.length > 1 && (
                <button className="bred" onClick={() => removeSchedule(i)} style={{ flexShrink: 0 }}>✕</button>
              )}
            </div>
          ))}
          <button className="bo" style={{ marginTop: 4 }} onClick={addSchedule}>+ 시간 추가</button>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 0', marginBottom: 12,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>동정적 사용 약물</span>
          <button
            onClick={() => set('isStudy', !form.isStudy)}
            style={{
              width: 50, height: 28, borderRadius: 14,
              background: form.isStudy ? '#166534' : '#CBD5E1',
              position: 'relative', cursor: 'pointer', border: 'none', transition: 'background .2s',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: form.isStudy ? 25 : 3,
              width: 22, height: 22, borderRadius: '50%', background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s',
            }} />
          </button>
        </div>

        <button className="bp" disabled={!form.name.trim()} onClick={() => onSave(form)}>저장</button>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  // ① URL token (기존 ?token=P001 방식 유지)
  const urlToken = new URLSearchParams(window.location.search).get('token');

  // ② localStorage token (자가 등록 방식)
  const [lsToken, setLsToken] = useState<string | null>(
    () => localStorage.getItem(LS_TOKEN)
  );

  // 최종 활성 token: URL > localStorage
  const activeToken = urlToken ?? lsToken;

  const [state, setStateRaw] = useState<AppState>(getInitialState);
  const [toast, setToast] = useState<{ msg: string; type: ToastType }>({ msg: '', type: '' });
  const [remoteRecords, setRemoteRecords] = useState<RemoteRecord[]>([]);

  // modals
  const [showAddMed,    setShowAddMed]    = useState(false);
  const [editMed,       setEditMed]       = useState<Medication | null>(null);
  const [showCheckin,   setShowCheckin]   = useState(false);
  const [showCheckup,   setShowCheckup]   = useState(false);
  const [editCheckup,   setEditCheckup]   = useState<Checkup | null>(null);
  const [showOCR,       setShowOCR]       = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [savingCheckup, setSavingCheckup] = useState(false);

  const setState = useCallback(
    (patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
      setStateRaw(prev => {
        const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
        saveState(next);
        return next;
      });
    },
    []
  );

  const showToast = useCallback((msg: string, type: ToastType = '') => {
    setToast({ msg, type });
  }, []);

  // 오늘 날짜 변경 시 로그 보장
  useEffect(() => {
    const t = todayStr();
    if (!state.logs[t]) {
      setState(prev => ({ logs: ensureTodayLog(prev.meds, { ...prev.logs }) }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Supabase 초기 로드: 오늘 기록(타임라인용) + 전체 checkin/checkup (Supabase UUID 획득)
  useEffect(() => {
    if (!activeToken) return;

    fetchTodayRecords(activeToken).then(({ data }) => {
      if (data) setRemoteRecords(data);
    });

    fetchRecordsByType(activeToken, 'checkin').then(({ data }) => {
      if (!data) return;
      const checkins: Checkin[] = data.map(r => ({
        id: r.id,
        date: r.created_at.split('T')[0],
        mood: String(r.payload.mood ?? ''),
        symptoms: (r.payload.symptoms as string[]) ?? [],
        note: String(r.payload.note ?? ''),
      }));
      setState(prev => ({ ...prev, checkins }));
    });

    fetchRecordsByType(activeToken, 'checkup').then(({ data }) => {
      if (!data) return;
      const checkups: Checkup[] = data.map(r => ({
        id: r.id,
        ...(r.payload as Omit<Checkup, 'id'>),
      }));
      setState(prev => ({
        ...prev,
        checkups: checkups.sort((a, b) => b.date.localeCompare(a.date)),
      }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToken]);

  // ── 등록 완료 콜백 ────────────────────────────────────────────────────────
  const handleRegistered = useCallback((token: string, name: string) => {
    setLsToken(token);
    setState({ patientName: name, onboarded: true });
    showToast(`환영합니다, ${name}님`, 'ok');
  }, [setState, showToast]);

  // ── 초기화 ────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_NAME);
    localStorage.removeItem(LS_MEMO);
    localStorage.removeItem('medapp_v8');
    setLsToken(null);
    setStateRaw(getInitialState());
    setShowSettings(false);
    setRemoteRecords([]);
  }, []);

  // ── 화면 분기 ────────────────────────────────────────────────────────────
  // 토큰 없음 → 등록 화면
  if (!activeToken) {
    return <RegisterScreen onRegistered={handleRegistered} />;
  }

  // 토큰 있지만 이름 미등록 (URL token 진입 시)
  if (!state.onboarded) {
    return (
      <OnboardingScreen onComplete={name => {
        setState({ patientName: name, onboarded: true });
        showToast(`환영합니다, ${name}님`, 'ok');
      }} />
    );
  }

  // ── 이하 메인 앱 ─────────────────────────────────────────────────────────
  const t = todayStr();
  const todayLogs = state.logs[t] ?? {};

  const todayEntries: MedLogEntry[] = state.meds
    .flatMap(m =>
      m.schedules.map(sc => {
        const key = `${m.id}_${sc.label}`;
        return todayLogs[key] ?? {
          medicationId: m.id, medName: m.name,
          scheduleLabel: sc.label, scheduleTime: sc.time,
          status: 'pending' as MedStatus, isStudy: m.isStudy,
        };
      })
    )
    .sort((a, b) => a.scheduleTime.localeCompare(b.scheduleTime));

  const takenCount   = todayEntries.filter(e => e.status === 'taken').length;
  const totalCount   = todayEntries.length;
  const pct          = totalCount ? Math.round(takenCount / totalCount * 100) : 0;
  const pendingCount = todayEntries.filter(e => e.status === 'pending').length;

  // ── 핸들러 ───────────────────────────────────────────────────────────────
  const handleStatusChange = async (
    medId: string, scheduleLabel: string,
    status: MedStatus, skipReason?: SkipReason
  ) => {
    const key = `${medId}_${scheduleLabel}`;
    const entry = todayLogs[key];
    if (!entry) return;

    setState(prev => ({
      logs: {
        ...prev.logs,
        [t]: { ...prev.logs[t], [key]: { ...entry, status, ...(skipReason ? { skipReason } : {}) } },
      },
    }));

    showToast(
      status === 'taken'   ? '복용함' :
      status === 'skipped' ? `복용 안 함 (${skipReason})` :
      status === 'missed'  ? '시간 지남' : '미복용',
      status === 'taken' ? 'ok' : status === 'skipped' ? 'err' : 'warn'
    );

    const med = state.meds.find(m => m.id === medId);
    const sc  = med?.schedules.find(s => s.label === scheduleLabel);
    const { error: err } = await upsertMedRecord(activeToken, t, {
      medicationId: medId,
      medName: entry.medName,
      scheduleLabel,
      scheduleTime: sc?.time ?? '',
      medicine: entry.medName,
      status,
      dose: sc?.dose ?? '',
      period: scheduleLabel,
      ...(skipReason ? { skipReason } : {}),
    });
    if (err) showToast('서버 저장 실패', 'err');
    else {
      const { data } = await fetchTodayRecords(activeToken);
      if (data) setRemoteRecords(data);
    }
  };

  const handleAddMed = (data: MedFormData) => {
    const nm: Medication = {
      id: `m${Date.now()}`, name: data.name.trim(), dosage: data.dosage.trim(),
      category: data.category, color: data.isStudy ? '#6D28D9' : '#1B3A6B',
      isStudy: data.isStudy, daysLeft: data.daysLeft, schedules: data.schedules,
      notifEnabled: true,
    };
    setState(prev => {
      const newLogs = { ...prev.logs };
      Object.keys(newLogs).forEach(d => {
        nm.schedules.forEach(sc => {
          newLogs[d][`${nm.id}_${sc.label}`] = {
            medicationId: nm.id, medName: nm.name,
            scheduleLabel: sc.label, scheduleTime: sc.time,
            status: 'pending', isStudy: nm.isStudy,
          };
        });
      });
      return { meds: [...prev.meds, nm], logs: newLogs };
    });
    setShowAddMed(false);
    showToast(`${nm.name} 추가됨`, 'ok');
  };

  const handleEditMed = (data: MedFormData) => {
    if (!editMed) return;
    setState(prev => ({
      meds: prev.meds.map(m => m.id !== editMed.id ? m : {
        ...m, name: data.name.trim(), dosage: data.dosage.trim(),
        category: data.category, isStudy: data.isStudy, daysLeft: data.daysLeft,
        schedules: data.schedules, color: data.isStudy ? '#6D28D9' : '#1B3A6B',
      }),
    }));
    setEditMed(null);
    showToast('수정되었습니다', 'ok');
  };

  const handleDeleteMed = (id: string, name: string) => {
    if (!window.confirm(`"${name}" 약을 삭제하시겠습니까?`)) return;
    setState(prev => {
      const newLogs = { ...prev.logs };
      Object.keys(newLogs).forEach(d => {
        Object.keys(newLogs[d])
          .filter(k => k.startsWith(id))
          .forEach(k => delete newLogs[d][k]);
      });
      return { meds: prev.meds.filter(m => m.id !== id), logs: newLogs };
    });
    showToast('삭제되었습니다');
  };

  const handleSaveCheckin = async (data: Omit<Checkin, 'id' | 'date'>) => {
    setSavingCheckin(true);
    const { id: remoteId, error } = await insertRecord(activeToken, 'checkin', {
      mood: data.mood, symptoms: data.symptoms, note: data.note,
    });
    if (error) {
      showToast('서버 저장 실패', 'err');
      setSavingCheckin(false);
      return;
    }
    const entry: Checkin = { id: remoteId ?? `ci${Date.now()}`, date: t, ...data };
    setState(prev => ({ checkins: [entry, ...prev.checkins] }));
    const { data: recs } = await fetchTodayRecords(activeToken);
    if (recs) setRemoteRecords(recs);
    setShowCheckin(false);
    showToast('상태 기록 완료', 'ok');
    setSavingCheckin(false);
  };

  const handleSaveCheckup = async (data: Omit<Checkup, 'id'>) => {
    setSavingCheckup(true);
    const { id: remoteId, error } = await insertRecord(
      activeToken, 'checkup', data as unknown as Record<string, unknown>
    );
    if (error) {
      showToast('서버 저장 실패', 'err');
      setSavingCheckup(false);
      return;
    }
    const entry: Checkup = { id: remoteId ?? `cu${Date.now()}`, ...data };
    setState(prev => ({
      checkups: [entry, ...prev.checkups].sort((a, b) => b.date.localeCompare(a.date)),
    }));
    setShowCheckup(false);
    setEditCheckup(null);
    showToast('건강검진 결과 저장됨', 'ok');
    setSavingCheckup(false);
  };

  const handleOcrImport = (meds: { name: string; dosage: string; period: string; category: string }[]) => {
    meds.forEach(med => {
      const nm: Medication = {
        id: `m${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: med.name, dosage: med.dosage, category: med.category,
        color: '#1B3A6B', isStudy: false, daysLeft: 30, notifEnabled: true,
        schedules: [{ time: '08:00', label: med.period, dose: med.dosage || '1정' }],
      };
      setState(prev => {
        const newLogs = { ...prev.logs };
        Object.keys(newLogs).forEach(d => {
          nm.schedules.forEach(sc => {
            newLogs[d][`${nm.id}_${sc.label}`] = {
              medicationId: nm.id, medName: nm.name,
              scheduleLabel: sc.label, scheduleTime: sc.time,
              status: 'pending', isStudy: false,
            };
          });
        });
        return { meds: [...prev.meds, nm], logs: newLogs };
      });
    });
    setShowOCR(false);
    showToast(`${meds.length}개 약물 등록됨`, 'ok');
  };

  // 7일 데이터
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const date = daysAgo(6 - i);
    const dl = Object.values(state.logs[date] ?? {});
    const total = dl.length;
    const taken = dl.filter(l => l.status === 'taken').length;
    return {
      date,
      label: DKR[new Date(date + 'T12:00:00').getDay()],
      rate: total ? Math.round(taken / total * 100) : 0,
      isToday: date === t,
    };
  });

  // ── 공통 헤더 ─────────────────────────────────────────────────────────────
  const renderHeader = (title: string, sub?: string, action?: { label: string; fn: () => void }) => (
    <div className="hdr">
      <div className="hdr-row">
        <div>
          <div className="hdr-title">{title}</div>
          {sub && <div className="hdr-sub">{sub}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {action && (
            <button className="hdr-btn" onClick={action.fn}>{action.label}</button>
          )}
          {/* 설정 아이콘 */}
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)',
              color: '#fff', borderRadius: 8, width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  // ── 탭 렌더 ───────────────────────────────────────────────────────────────
  const renderHome = () => (
    <div className="screen">
      {renderHeader('복약 관리', `${state.patientName} · ${t}`, { label: '보고서', fn: () => setState({ tab: 'report' }) })}
      <div style={{ height: 12 }} />

      <div className="card">
        <div className="card-hd">오늘 복약 현황</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
          <div style={{ position: 'relative', width: 70, height: 70, flexShrink: 0 }}>
            <svg width="70" height="70" viewBox="0 0 70 70">
              <circle cx="35" cy="35" r="28" fill="none" stroke="#E2E8F0" strokeWidth="7" />
              <circle cx="35" cy="35" r="28" fill="none"
                stroke={pct >= 80 ? '#166534' : pct >= 60 ? '#92400E' : '#2563EB'}
                strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - pct / 100)}`}
                transform="rotate(-90 35 35)" />
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 14, color: '#0F172A',
            }}>{pct}%</div>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#0F172A' }}>
              {takenCount}/{totalCount}
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>오늘 복약 완료</div>
            {pendingCount > 0 && (
              <div style={{ fontSize: 11, color: '#92400E', marginTop: 4, fontWeight: 700 }}>
                미복용 {pendingCount}건 남음
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 48 }}>
          {weekData.map(d => {
            const maxR = Math.max(...weekData.map(x => x.rate), 1);
            const bh = Math.max(3, Math.round(d.rate / maxR * 38));
            const c = d.rate >= 80 ? '#166534' : d.rate >= 60 ? '#92400E' : '#2563EB';
            return (
              <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{
                  width: '100%', height: bh, background: c,
                  borderRadius: '3px 3px 0 0', opacity: d.isToday ? 1 : 0.55,
                }} />
                <span style={{ fontSize: 9, color: d.isToday ? '#1B3A6B' : '#94A3B8', fontWeight: d.isToday ? 800 : 400 }}>
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sec-t" style={{ marginTop: 4 }}>오늘 타임라인</div>
      <Timeline
        todayEntries={todayEntries}
        remoteRecords={remoteRecords.filter(r => r.record_type !== 'medication')}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '12px 13px 0' }}>
        <button className="bg" onClick={() => setShowCheckin(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 7L10 17l-5-5" />
          </svg>
          상태 기록
        </button>
        <button className="bo" onClick={() => setShowOCR(true)}>
          <span style={{ marginRight: 4 }}>📷</span>처방전 OCR
        </button>
      </div>
    </div>
  );

  const renderMeds = () => (
    <div className="screen">
      {renderHeader('내 약 목록', `${state.meds.length}개 등록`, { label: '+ 추가', fn: () => setShowAddMed(true) })}
      <div style={{ height: 12 }} />
      {state.meds.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💊</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>등록된 약이 없습니다</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>위 + 추가 버튼으로 약을 등록하세요</div>
        </div>
      ) : (
        state.meds.map(med => {
          const entries = med.schedules.map(sc => {
            const key = `${med.id}_${sc.label}`;
            return todayLogs[key] ?? {
              medicationId: med.id, medName: med.name,
              scheduleLabel: sc.label, scheduleTime: sc.time,
              status: 'pending' as MedStatus, isStudy: med.isStudy,
            };
          });
          return (
            <div key={med.id}>
              <MedicationCard
                med={med}
                entries={entries}
                onStatusChange={(label, status, skipReason) =>
                  handleStatusChange(med.id, label, status, skipReason)
                }
              />
              <div style={{ display: 'flex', gap: 8, margin: '-4px 13px 8px' }}>
                <button className="bo" style={{ fontSize: 12, padding: '8px' }}
                  onClick={() => setEditMed(med)}>수정</button>
                <button className="bred" onClick={() => handleDeleteMed(med.id, med.name)}>삭제</button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const renderCheckin = () => (
    <div className="screen">
      {renderHeader('상태 기록', `${state.checkins.length}건 기록`, { label: '+ 기록', fn: () => setShowCheckin(true) })}
      <div style={{ height: 12 }} />
      {state.checkins.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>기록된 상태가 없습니다</div>
        </div>
      ) : (
        state.checkins.map(c => (
          <div className="card" key={c.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{c.mood}</span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>{c.date}</span>
            </div>
            {c.symptoms.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                {c.symptoms.map(s => (
                  <span key={s} style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                    background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE',
                  }}>{s}</span>
                ))}
              </div>
            )}
            {c.note && <div style={{ fontSize: 12, color: '#64748B' }}>{c.note}</div>}
            <button className="bred" style={{ marginTop: 8 }}
              onClick={async () => {
                if (!window.confirm('삭제하시겠습니까?')) return;
                const err = await deleteRecord(c.id);
                if (err) { showToast('삭제 실패', 'err'); return; }
                setState(prev => ({ checkins: prev.checkins.filter(x => x.id !== c.id) }));
                showToast('삭제되었습니다');
              }}>삭제</button>
          </div>
        ))
      )}
    </div>
  );

  const renderCheckup = () => (
    <div className="screen">
      {renderHeader('건강검진', `${state.checkups.length}건 기록`, { label: '+ 입력', fn: () => setShowCheckup(true) })}
      <div style={{ height: 12 }} />
      {state.checkups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏥</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>기록된 검진 결과가 없습니다</div>
        </div>
      ) : (
        state.checkups.map(cu => (
          <div className="card" key={cu.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{cu.inst || '기관 미입력'}</span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>{cu.date}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 8 }}>
              {([
                ['혈압',   cu.sbp && cu.dbp ? `${cu.sbp}/${cu.dbp}` : '-', 'mmHg'],
                ['혈당',   cu.gl   || '-', 'mg/dL'],
                ['콜레스테롤', cu.chol  || '-', 'mg/dL'],
                ['Hb',    cu.hb    || '-', 'g/dL'],
                ['Cr',    cu.cr    || '-', 'mg/dL'],
                ['BMI',   cu.bmi   || '-', ''],
              ] as [string, string, string][]).map(([l, v, u]) => (
                <div key={l} style={{
                  background: '#F8FAFC', borderRadius: 8,
                  padding: '8px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 9, color: '#64748B', fontWeight: 700 }}>{l}</div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{v}</div>
                  {u && <div style={{ fontSize: 9, color: '#94A3B8' }}>{u}</div>}
                </div>
              ))}
            </div>
            {cu.comment && (
              <div style={{
                fontSize: 12, color: '#64748B', background: '#F8FAFC',
                borderRadius: 8, padding: '8px 10px', marginBottom: 8,
              }}>{cu.comment}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="bo" style={{ fontSize: 12, padding: '8px' }}
                onClick={() => setEditCheckup(cu)}>수정</button>
              <button className="bred"
                onClick={async () => {
                  if (!window.confirm('삭제하시겠습니까?')) return;
                  const err = await deleteRecord(cu.id);
                  if (err) { showToast('삭제 실패', 'err'); return; }
                  setState(prev => ({ checkups: prev.checkups.filter(x => x.id !== cu.id) }));
                  showToast('삭제되었습니다');
                }}>삭제</button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const tabMap: Record<AppState['tab'], () => React.ReactElement> = {
    home:    renderHome,
    meds:    renderMeds,
    checkin: renderCheckin,
    checkup: renderCheckup,
    report:  () => <ReportView state={state} />,
  };

  return (
    <div className="app-wrap">
      <Toast message={toast.msg} type={toast.type} onDone={() => setToast({ msg: '', type: '' })} />

      {tabMap[state.tab]()}

      <nav className="bnav">
        {([
          ['home',    '홈',    'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z'],
          ['meds',   '약',    'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18'],
          ['checkin','상태',   'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'],
          ['checkup','검진',   'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'],
          ['report', '보고서', 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'],
        ] as [AppState['tab'], string, string][]).map(([id, label, path]) => (
          <button
            key={id}
            className={`nt${state.tab === id ? ' active' : ''}`}
            onClick={() => setState({ tab: id })}
          >
            <svg viewBox="0 0 24 24" strokeWidth="2">
              <path d={path} />
            </svg>
            <span>{label}</span>
            {id === 'meds' && pendingCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, fontSize: 8, fontWeight: 800,
                background: '#991B1B', color: '#fff', padding: '1px 4px', borderRadius: 8,
              }}>{pendingCount}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Modals */}
      {showSettings && (
        <SettingsModal
          patientName={state.patientName}
          token={activeToken}
          memo={localStorage.getItem(LS_MEMO) ?? ''}
          onReset={handleReset}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showAddMed && (
        <MedFormModal onSave={handleAddMed} onClose={() => setShowAddMed(false)} />
      )}
      {editMed && (
        <MedFormModal
          initial={{
            name: editMed.name, dosage: editMed.dosage,
            category: editMed.category, isStudy: editMed.isStudy,
            daysLeft: editMed.daysLeft, schedules: editMed.schedules,
          }}
          onSave={handleEditMed}
          onClose={() => setEditMed(null)}
        />
      )}
      {showCheckin && (
        <CheckinForm onSave={handleSaveCheckin} onClose={() => setShowCheckin(false)} saving={savingCheckin} />
      )}
      {showCheckup && (
        <CheckupForm onSave={handleSaveCheckup} onClose={() => setShowCheckup(false)} saving={savingCheckup} />
      )}
      {editCheckup && (
        <CheckupForm
          initial={editCheckup}
          onSave={handleSaveCheckup}
          onClose={() => setEditCheckup(null)}
          saving={savingCheckup}
        />
      )}
      {showOCR && (
        <OcrImport onImportMeds={handleOcrImport} onClose={() => setShowOCR(false)} />
      )}
    </div>
  );
}
