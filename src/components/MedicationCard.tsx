import { STATUS_META, SKIP_REASONS } from '../types';
import type { MedLogEntry, MedStatus, Medication, SkipReason } from '../types';
import { useState } from 'react';

interface Props {
  med: Medication;
  entries: MedLogEntry[];
  onStatusChange: (scheduleLabel: string, status: MedStatus, skipReason?: SkipReason) => void;
}

export default function MedicationCard({ med, entries, onStatusChange }: Props) {
  const [openSheet, setOpenSheet] = useState<string | null>(null); // scheduleLabel
  const [pendingSkip, setPendingSkip] = useState<string | null>(null);

  const sm = STATUS_META;

  return (
    <>
      <div className="card" style={{ borderLeft: `4px solid ${med.color}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '.8px', textTransform: 'uppercase',
              color: med.isStudy ? '#6D28D9' : '#64748B',
              background: med.isStudy ? '#F5F3FF' : '#F1F5F9',
              border: `1px solid ${med.isStudy ? '#C4B5FD' : '#E2E8F0'}`,
              padding: '2px 7px', borderRadius: 5, marginRight: 6,
            }}>
              {med.isStudy ? '동정적 사용' : med.category}
            </span>
          </div>
          <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>잔여 {med.daysLeft}일</span>
        </div>

        <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A', marginBottom: 3 }}>{med.name}</div>
        <div style={{ fontSize: 11, color: '#64748B', marginBottom: 10 }}>{med.dosage}</div>

        {entries.map(entry => {
          const st = sm[entry.status];
          return (
            <div key={entry.scheduleLabel} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 11px', borderRadius: 9,
              background: st.bg, border: `1px solid ${st.border}`,
              marginBottom: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                  {entry.scheduleLabel} {entry.scheduleTime}
                </span>
                <span style={{ fontSize: 10, fontWeight: 800, color: st.color }}>{st.label}</span>
              </div>
              <button
                onClick={() => setOpenSheet(entry.scheduleLabel)}
                style={{
                  background: '#fff', border: `1.5px solid ${st.border}`,
                  borderRadius: 7, padding: '5px 11px',
                  fontSize: 11, fontWeight: 700, color: st.color, cursor: 'pointer',
                }}>
                변경
              </button>
            </div>
          );
        })}
      </div>

      {/* 상태 변경 시트 */}
      {openSheet && (
        <div className="ov" onClick={() => { setOpenSheet(null); setPendingSkip(null); }}>
          <div className="mbox" onClick={e => e.stopPropagation()}>
            <div className="mhdr">
              <span className="mtitle">복약 상태 변경</span>
              <button className="mclose" onClick={() => { setOpenSheet(null); setPendingSkip(null); }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 14 }}>
              {med.name} · {openSheet}
            </div>

            {pendingSkip ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 10 }}>
                  복용하지 않은 사유를 선택해주세요
                </div>
                {SKIP_REASONS.map(r => (
                  <button key={r} className="sht-btn"
                    style={{ background: '#FFFBEB', borderColor: '#FCD34D', color: '#92400E' }}
                    onClick={() => {
                      onStatusChange(openSheet, 'skipped', r);
                      setOpenSheet(null); setPendingSkip(null);
                    }}>
                    {r}
                  </button>
                ))}
                <button className="bo" style={{ marginTop: 8 }} onClick={() => setPendingSkip(null)}>← 뒤로</button>
              </>
            ) : (
              <>
                {([
                  ['taken',  '복용함',    '#166534', '#F0FDF4', '#86EFAC'],
                  ['planned','복용 예정',  '#1B3A6B', '#EEF3FB', '#93C5FD'],
                  ['missed', '시간 지남',  '#991B1B', '#FEF2F2', '#FECACA'],
                  ['pending','미복용',     '#64748B', '#F1F5F9', '#CBD5E1'],
                ] as [MedStatus, string, string, string, string][]).map(([s, label, c, bg, bd]) => (
                  <button key={s} className="sht-btn"
                    style={{ background: bg, borderColor: bd, color: c }}
                    onClick={() => {
                      onStatusChange(openSheet, s);
                      setOpenSheet(null);
                    }}>
                    <span className="sht-dot" style={{ background: c }} />
                    {label}
                  </button>
                ))}
                <button className="sht-btn"
                  style={{ background: '#FFFBEB', borderColor: '#FCD34D', color: '#92400E' }}
                  onClick={() => setPendingSkip(openSheet)}>
                  <span className="sht-dot" style={{ background: '#92400E' }} />
                  복용 안 함 (사유 선택)
                </button>
              </>
            )}
            <div style={{ height: 8 }} />
          </div>
        </div>
      )}
    </>
  );
}
