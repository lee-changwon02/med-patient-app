import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppState, Checkup } from '../types';

interface Props {
  state: AppState;
}

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  ts: string;
}

function nowStr(): string {
  return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function buildSystemPrompt(state: AppState): string {
  const medList = state.meds.length
    ? state.meds.map(m =>
        `- ${m.name}${m.dosage ? ` (${m.dosage})` : ''}: ${m.schedules.map(s => `${s.label} ${s.time}`).join(', ')}`
      ).join('\n')
    : '등록된 약 없음';

  const recent = state.checkins.slice(0, 5);
  const recentCheckins = recent.length
    ? recent.map(c =>
        `- ${c.date}: 컨디션 ${c.mood}${c.symptoms.length ? `, 증상 ${c.symptoms.join('/')}` : ''}${c.note ? `, 메모: ${c.note}` : ''}`
      ).join('\n')
    : '기록 없음';

  const cu: Checkup | undefined = state.checkups[0];
  const checkupInfo = cu
    ? [
        `검진일: ${cu.date}${cu.inst ? ` (${cu.inst})` : ''}`,
        cu.sbp && cu.dbp ? `혈압: ${cu.sbp}/${cu.dbp} mmHg` : '',
        cu.gl       ? `공복혈당: ${cu.gl} mg/dL`           : '',
        cu.hba1c    ? `HbA1c: ${cu.hba1c}%`               : '',
        cu.chol     ? `총콜레스테롤: ${cu.chol} mg/dL`     : '',
        cu.ldl      ? `LDL: ${cu.ldl} mg/dL`              : '',
        cu.hdl      ? `HDL: ${cu.hdl} mg/dL`              : '',
        cu.cr       ? `크레아티닌: ${cu.cr} mg/dL`         : '',
        cu.hb       ? `혈색소: ${cu.hb} g/dL`             : '',
        cu.bmi      ? `BMI: ${cu.bmi}`                    : '',
        cu.comment  ? `소견: ${cu.comment}`               : '',
      ].filter(Boolean).join('\n')
    : '검진 기록 없음';

  return `당신은 "${state.patientName}" 환자의 복약 관리 AI 건강 도우미입니다.

[복용 중인 약]
${medList}

[최근 상태 기록]
${recentCheckins}

[최근 건강검진]
${checkupInfo}

[답변 방식]
- 한국어로 핵심 내용을 먼저 설명합니다
- 항목이 여러 개면 줄바꿈으로 가독성 있게 구성합니다
- 의학적 진단이나 처방 변경은 절대 권유하지 않습니다
- 심각한 증상은 즉시 의사 상담을 권고합니다
- 수치 해석 시 정상 범위와 비교해서 알기 쉽게 설명합니다
- 모든 답변 마지막에 빈 줄 후 다음 문구를 추가합니다: "※ 참고용 정보이며, 정확한 진단은 의료진 상담이 필요합니다."`;
}

const QUICK_ACTIONS = [
  { label: '약 복용 방법',    prompt: '현재 복용 중인 약들의 복용 방법과 주의사항을 알려줘' },
  { label: '검진 결과 보기',  prompt: '최근 건강검진 수치를 알기 쉽게 설명해줘' },
  { label: '현재 상태 요약',  prompt: '최근 상태 기록을 바탕으로 건강 패턴과 주의할 점을 요약해줘' },
  { label: '복용 알림 문구',  prompt: '오늘 복약 일정과 각 약의 복용 시 주의사항을 정리해줘' },
];

function AiAvatar({ size = 32 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #1B3A6B 0%, #2563EB 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24"
        fill="none" stroke="#fff" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    </div>
  );
}

export default function AiChat({ state }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [{
    role: 'ai',
    ts: nowStr(),
    text: `안녕하세요, ${state.patientName}님!\n복약이나 건강 관련 궁금한 점을 편하게 질문해주세요.\n아래 빠른 질문 버튼을 눌러도 됩니다.`,
  }]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const systemPrompt = useMemo(() => buildSystemPrompt(state), [state]);

  const copyText = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1800);
    } catch { /* clipboard unavailable */ }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages(prev => [...prev, { role: 'user', text: trimmed, ts: nowStr() }]);
    setInput('');
    setLoading(true);

    const history = messages.slice(1).map(m => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.text }],
    }));
    history.push({ role: 'user', parts: [{ text: trimmed }] });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, systemPrompt }),
      });
      const data = await res.json() as { text?: string; error?: string };
      const reply = res.ok
        ? (data.text ?? 'AI 응답을 가져오는 중 문제가 발생했습니다.')
        : res.status === 504
          ? 'AI 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.'
          : 'AI 응답을 가져오는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
      setMessages(prev => [...prev, { role: 'ai', text: reply, ts: nowStr() }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: '네트워크 연결을 확인해주세요.\n잠시 후 다시 시도해주세요.',
        ts: nowStr(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: '#F1F5F9' }}>

      {/* ── 헤더 ── */}
      <div style={{
        background: '#1B3A6B',
        padding: '14px 16px',
        paddingTop: 'max(env(safe-area-inset-top), 14px)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AiAvatar size={36} />
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-.3px' }}>
              건강 AI 상담
            </div>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 11, marginTop: 2 }}>
              참고용 건강 정보 서비스
            </div>
          </div>
        </div>
      </div>

      {/* ── 빠른 질문 ── */}
      <div style={{
        padding: '10px 14px 8px', borderBottom: '1px solid #E2E8F0',
        flexShrink: 0, background: '#fff',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: '#94A3B8',
          letterSpacing: '.6px', textTransform: 'uppercase', marginBottom: 7,
        }}>
          빠른 질문
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {QUICK_ACTIONS.map(a => (
            <button
              key={a.label}
              onClick={() => send(a.prompt)}
              disabled={loading}
              style={{
                padding: '7px 13px', borderRadius: 20,
                border: '1.5px solid #CBD5E1', background: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 12, fontWeight: 600, color: '#475569',
                opacity: loading ? 0.5 : 1,
                fontFamily: 'inherit', minHeight: 34, WebkitAppearance: 'none',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 메시지 목록 ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '18px 14px 8px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            marginBottom: 20,
            display: 'flex',
            flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-end',
            gap: 8,
          }}>
            {m.role === 'ai' && (
              <div style={{ flexShrink: 0, marginBottom: 18 }}>
                <AiAvatar size={30} />
              </div>
            )}

            <div style={{
              maxWidth: '78%',
              display: 'flex', flexDirection: 'column',
              alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
              gap: 5,
            }}>
              {/* 말풍선 */}
              <div style={{
                background:   m.role === 'user' ? '#2563EB' : '#fff',
                color:        m.role === 'user' ? '#fff'    : '#1E293B',
                borderRadius: m.role === 'user'
                  ? '18px 18px 5px 18px'
                  : '5px 18px 18px 18px',
                padding: '13px 16px',
                fontSize: 14,
                lineHeight: 1.85,
                whiteSpace: 'pre-wrap',
                wordBreak: 'keep-all',
                overflowWrap: 'break-word',
                boxShadow: m.role === 'user'
                  ? '0 2px 8px rgba(37,99,235,.25)'
                  : '0 1px 5px rgba(0,0,0,.07)',
                border: m.role === 'user' ? 'none' : '1px solid #E2E8F0',
              }}>
                {m.text}
              </div>

              {/* 시간 + 복사 버튼 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>
                  {m.ts}
                </span>
                {m.role === 'ai' && (
                  <button
                    onClick={() => copyText(m.text, i)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '2px 6px', borderRadius: 4,
                      fontSize: 10, fontWeight: 600,
                      color: copiedIdx === i ? '#166534' : '#94A3B8',
                      fontFamily: 'inherit',
                    }}
                  >
                    {copiedIdx === i ? '✓ 복사됨' : '복사'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* 타이핑 인디케이터 */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 20 }}>
            <AiAvatar size={30} />
            <div style={{
              background: '#fff', border: '1px solid #E2E8F0',
              borderRadius: '5px 18px 18px 18px',
              padding: '14px 18px',
              boxShadow: '0 1px 5px rgba(0,0,0,.07)',
            }}>
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── 입력창 ── */}
      <div style={{
        flexShrink: 0, background: '#fff', borderTop: '1px solid #E2E8F0',
        padding: '10px 14px',
        // 하단 고정 nav(~56px) + safe-area 위로 입력창이 올라와야 함
        paddingBottom: 'max(70px, calc(env(safe-area-inset-bottom) + 60px))',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="inp"
            style={{ flex: 1, minWidth: 0, fontSize: 15 }}
            placeholder="복약이나 건강 관련 궁금한 점을 입력하세요"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
            disabled={loading}
          />
          <button
            className="bp"
            style={{ width: 48, padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div style={{ fontSize: 10, color: '#B0BBCC', textAlign: 'center', marginTop: 8 }}>
          참고용 정보 제공 서비스 · 의료 진단을 대체하지 않습니다
        </div>
      </div>

    </div>
  );
}
