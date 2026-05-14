import { STATUS_META } from '../types';
import type { MedLogEntry } from '../types';
import type { RemoteRecord } from '../lib/supabase';

interface Props {
  todayEntries: MedLogEntry[];
  remoteRecords: RemoteRecord[];
}

export default function Timeline({ todayEntries, remoteRecords }: Props) {
  type TimelineItem =
    | { kind: 'med'; time: string; entry: MedLogEntry }
    | { kind: 'remote'; time: string; record: RemoteRecord };

  const items: TimelineItem[] = [
    ...todayEntries.map(e => ({
      kind: 'med' as const,
      time: e.scheduleTime,
      entry: e,
    })),
    ...remoteRecords.map(r => ({
      kind: 'remote' as const,
      time: new Date(r.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      record: r,
    })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '28px 0', color: '#94A3B8', fontSize: 13 }}>
        오늘 기록이 없습니다
      </div>
    );
  }

  return (
    <div style={{ padding: '0 13px' }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', marginTop: 4,
              background: item.kind === 'med'
                ? STATUS_META[item.entry.status].color
                : '#6D28D9',
            }} />
            {i < items.length - 1 && (
              <div style={{ width: 1, flex: 1, background: '#E2E8F0', marginTop: 3 }} />
            )}
          </div>
          <div style={{ flex: 1, paddingBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, marginBottom: 2 }}>
              {item.time}
            </div>
            {item.kind === 'med' ? (
              <div style={{
                background: STATUS_META[item.entry.status].bg,
                border: `1px solid ${STATUS_META[item.entry.status].border}`,
                borderRadius: 8, padding: '8px 11px',
              }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>
                  {item.entry.medName}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 800, marginLeft: 8,
                  color: STATUS_META[item.entry.status].color,
                }}>
                  {STATUS_META[item.entry.status].label}
                </span>
                {item.entry.skipReason && (
                  <div style={{ fontSize: 10, color: '#92400E', marginTop: 2 }}>
                    사유: {item.entry.skipReason}
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                background: '#F5F3FF', border: '1px solid #C4B5FD',
                borderRadius: 8, padding: '8px 11px',
              }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: '#6D28D9' }}>
                  {item.record.record_type === 'checkin' ? '상태 기록' :
                   item.record.record_type === 'checkup' ? '건강검진' : '기록'}
                </span>
                {item.record.record_type === 'checkin' && (
                  <span style={{ fontSize: 11, color: '#64748B', marginLeft: 8 }}>
                    {String((item.record.payload as { mood?: string }).mood ?? '')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
