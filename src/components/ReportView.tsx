import { STATUS_META } from '../types';
import type { AppState } from '../types';

interface Props {
  state: AppState;
}

const today = () => new Date().toISOString().split('T')[0];
const DKR = ['일', '월', '화', '수', '목', '금', '토'];

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function normStat(key: string, raw: string): 'ok' | 'warn' | 'bad' | null {
  const v = parseFloat(raw);
  if (isNaN(v)) return null;
  const R: Record<string, [number, number]> = {
    sbp: [120, 140], dbp: [80, 90], gl: [100, 126], chol: [200, 240],
    hdl: [40, 60], ldl: [130, 160], tri: [150, 200],
    ast: [40, 80], alt: [40, 80], cr: [0.6, 1.2], hb: [12, 17],
  };
  const r = R[key];
  if (!r) return null;
  if (key === 'hdl') return v >= 60 ? 'ok' : v >= 40 ? 'warn' : 'bad';
  if (key === 'cr' || key === 'hb') return v >= r[0] && v <= r[1] ? 'ok' : 'warn';
  return v < r[0] ? 'ok' : v < r[1] ? 'warn' : 'bad';
}

const NS = {
  ok:   { l: '정상', c: '#166534', bg: '#F0FDF4', bd: '#86EFAC' },
  warn: { l: '주의', c: '#92400E', bg: '#FFFBEB', bd: '#FCD34D' },
  bad:  { l: '이상', c: '#991B1B', bg: '#FEF2F2', bd: '#FECACA' },
};

const sC = (r: number) => r >= 80 ? '#166534' : r >= 60 ? '#92400E' : '#991B1B';

export default function ReportView({ state }: Props) {
  const t = today();
  const dayData = Array.from({ length: 7 }, (_, i) => {
    const date = daysAgo(6 - i);
    const dl = Object.values(state.logs[date] ?? {});
    const total = dl.length;
    const taken = dl.filter(l => l.status === 'taken').length;
    return {
      date, label: DKR[new Date(date + 'T12:00:00').getDay()],
      rate: total ? Math.round(taken / total * 100) : 0,
      isToday: date === t,
    };
  });

  const avg = Math.round(dayData.reduce((s, d) => s + d.rate, 0) / 7);

  const allEntries = Object.values(state.logs).flatMap(d => Object.values(d));
  const stats = {
    taken: allEntries.filter(e => e.status === 'taken').length,
    skipped: allEntries.filter(e => e.status === 'skipped').length,
    missed: allEntries.filter(e => e.status === 'missed').length,
    pending: allEntries.filter(e => e.status === 'pending').length,
  };

  const studyMed = state.meds.find(m => m.isStudy);
  const studyEntries = allEntries.filter(e => e.isStudy);
  const sRate = studyEntries.length
    ? Math.round(studyEntries.filter(e => e.status === 'taken').length / studyEntries.length * 100)
    : 0;

  const cu = state.checkups[0];
  const cuRows: [string, string, string, string][] = [
    ['수축기혈압', cu?.sbp, 'mmHg', 'sbp'],
    ['이완기혈압', cu?.dbp, 'mmHg', 'dbp'],
    ['공복혈당', cu?.gl, 'mg/dL', 'gl'],
    ['총콜레스테롤', cu?.chol, 'mg/dL', 'chol'],
    ['HDL', cu?.hdl, 'mg/dL', 'hdl'],
    ['LDL', cu?.ldl, 'mg/dL', 'ldl'],
    ['중성지방', cu?.tri, 'mg/dL', 'tri'],
    ['AST', cu?.ast, 'U/L', 'ast'],
    ['ALT', cu?.alt, 'U/L', 'alt'],
    ['크레아티닌', cu?.cr, 'mg/dL', 'cr'],
    ['혈색소', cu?.hb, 'g/dL', 'hb'],
  ].filter(r => r[1]) as [string, string, string, string][];

  const maxRate = Math.max(...dayData.map(d => d.rate), 1);

  const printReport = () => {
    window.print();
  };

  return (
    <div className="screen" style={{ paddingBottom: 100 }}>
      {/* 헤더 */}
      <div style={{ background: '#1B3A6B', padding: '16px' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 17 }}>복약 관리 보고서</div>
        <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 11, marginTop: 3 }}>
          {state.patientName} · {new Date().toLocaleDateString('ko-KR')}
        </div>
      </div>

      {/* 동정적 사용 배너 */}
      {studyMed && (
        <div style={{ background: 'linear-gradient(135deg,#4C1D95,#6D28D9)', padding: '16px 14px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: sRate >= 80 ? '#86EFAC' : sRate >= 60 ? '#FCD34D' : '#FECACA' }}>
            {sRate}%
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,.6)', letterSpacing: '.9px', textTransform: 'uppercase', marginBottom: 3 }}>
              동정적 사용 약물 복약 순응도
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{studyMed.name}</div>
          </div>
        </div>
      )}

      {/* 상태 요약 */}
      <div className="card" style={{ margin: '12px 13px' }}>
        <div className="card-hd">복약 상태 요약 (전체)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 14 }}>
          {([
            ['복용함', stats.taken, STATUS_META.taken],
            ['복용 안 함', stats.skipped, STATUS_META.skipped],
            ['시간 지남', stats.missed, STATUS_META.missed],
            ['미복용', stats.pending, STATUS_META.pending],
          ] as [string, number, typeof STATUS_META.taken][]).map(([label, count, meta]) => (
            <div key={label} style={{ background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 9, padding: '10px 12px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: meta.color }}>{count}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: meta.color }}>{label}</div>
            </div>
          ))}
        </div>

        {/* 7일 바 차트 */}
        <div className="card-hd">7일 복약률</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 52, marginBottom: 4 }}>
          {dayData.map(d => {
            const bh = Math.max(3, Math.round(d.rate / maxRate * 44));
            return (
              <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 8, fontWeight: 800, color: sC(d.rate) }}>{d.rate}%</span>
                <div style={{ width: '100%', height: bh, background: sC(d.rate), borderRadius: '3px 3px 0 0' }} />
                <span style={{ fontSize: 9, color: d.isToday ? '#1B3A6B' : '#94A3B8', fontWeight: d.isToday ? 800 : 400 }}>
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, color: '#64748B', marginTop: 6 }}>
          7일 평균 <strong style={{ color: sC(avg) }}>{avg}%</strong>
        </div>
      </div>

      {/* 약물 현황 */}
      <div className="card" style={{ margin: '0 13px 10px' }}>
        <div className="card-hd">복용 약물 현황</div>
        {state.meds.map(m => (
          <div key={m.id} className="row">
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{m.name}</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>
                {m.schedules.map(s => `${s.label} ${s.time}`).join(' / ')} · {m.dosage}
              </div>
            </div>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>잔여 {m.daysLeft}일</span>
          </div>
        ))}
      </div>

      {/* 최근 검진 */}
      {cu && (
        <div className="card" style={{ margin: '0 13px 10px' }}>
          <div className="card-hd">최근 건강검진</div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>{cu.inst} / {cu.date}</div>
          {cuRows.map(([label, val, unit, key]) => {
            const s = normStat(key, val);
            const ns = s ? NS[s] : null;
            return (
              <div key={label} className="row" style={{ padding: '8px 0' }}>
                <span style={{ flex: 1, fontSize: 13, color: '#334155' }}>{label}</span>
                <span style={{ fontWeight: 800, fontSize: 13 }}>{val}</span>
                <span style={{ fontSize: 11, color: '#64748B', marginLeft: 4 }}>{unit}</span>
                {ns && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 5,
                    background: ns.bg, color: ns.c, border: `1px solid ${ns.bd}`, marginLeft: 6,
                  }}>{ns.l}</span>
                )}
              </div>
            );
          })}
          {cu.ht && cu.wt && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {[['신장', cu.ht, 'cm'], ['체중', cu.wt, 'kg'], ['BMI', cu.bmi, '']].map(([l, v, u]) => (
                <div key={l} style={{ flex: 1, background: '#F8FAFC', borderRadius: 8, padding: '9px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#64748B' }}>{l}</div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{v}{u}</div>
                </div>
              ))}
            </div>
          )}
          {cu.comment && (
            <div style={{ background: '#EFF6FF', borderLeft: '3px solid #1B3A6B', padding: '10px 14px', borderRadius: '0 8px 8px 0', marginTop: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#1B3A6B', marginBottom: 3 }}>담당의 소견</div>
              <div style={{ fontSize: 12, color: '#334155' }}>{cu.comment}</div>
            </div>
          )}
        </div>
      )}

      {/* 상태 기록 */}
      {state.checkins.length > 0 && (
        <div className="card" style={{ margin: '0 13px 10px' }}>
          <div className="card-hd">상태 기록 (최근 10건)</div>
          {state.checkins.slice(0, 10).map(c => (
            <div key={c.id} className="row">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{c.mood}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  {c.symptoms.join(', ') || '-'} · {c.date}
                </div>
                {c.note && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{c.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '0 13px 20px' }}>
        <button className="bp" onClick={printReport}>PDF로 저장 / 인쇄</button>
      </div>
    </div>
  );
}
