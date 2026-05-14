import { useEffect, useRef, useState } from 'react';
import type { AppState, Checkup } from '../types';

interface Props {
  state: AppState;
}

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

function buildSystemPrompt(state: AppState): string {
  const medList = state.meds.length
    ? state.meds.map(m =>
        `- ${m.name}${m.dosage ? ` (${m.dosage})` : ''}: ${m.schedules.map(s => `${s.label} ${s.time}`).join(', ')}`
      ).join('\n')
    : '등록된 약 없음';

  const recentCheckins = state.checkins.slice(0, 5).length
    ? state.checkins.slice(0, 5).map(c =>
        `- ${c.date}: 컨디션 ${c.mood}${c.symptoms.length ? `, 증상 ${c.symptoms.join('/')}` : ''}${c.note ? `, 메모: ${c.note}` : ''}`
      ).join('\n')
    : '기록 없음';

  const cu: Checkup | undefined = state.checkups[0];
  const checkupInfo = cu
    ? [
        `검진일: ${cu.date}${cu.inst ? ` (${cu.inst})` : ''}`,
        cu.sbp && cu.dbp ? `혈압: ${cu.sbp}/${cu.dbp} mmHg` : '',
        cu.gl ? `공복혈당: ${cu.gl} mg/dL` : '',
        cu.hba1c ? `HbA1c: ${cu.hba1c}%` : '',
        cu.chol ? `총콜레스테롤: ${cu.chol} mg/dL` : '',
        cu.ldl ? `LDL: ${cu.ldl} mg/dL` : '',
        cu.hdl ? `HDL: ${cu.hdl} mg/dL` : '',
        cu.cr ? `크레아티닌: ${cu.cr} mg/dL` : '',
        cu.hb ? `혈색소: ${cu.hb} g/dL` : '',
        cu.bmi ? `BMI: ${cu.bmi}` : '',
        cu.comment ? `소견: ${cu.comment}` : '',
      ].filter(Boolean).join('\n')
    : '검진 기록 없음';

  return `당신은 "${state.patientName}" 환자의 복약 관리 AI 도우미입니다.
환자의 복약 현황과 건강 기록을 바탕으로 도움을 드립니다.

[복용 중인 약]
${medList}

[최근 상태 기록]
${recentCheckins}

[최근 건강검진]
${checkupInfo}

[답변 규칙]
- 한국어로 간결하게 답변 (200자 이내 권장)
- 의학적 진단이나 처방 변경 권유 금지
- 심각한 증상은 반드시 의사 상담 권고
- 약 정보는 일반적인 안내만 제공
- 수치 해석 시 정상 범위와 비교해서 설명`;
}

const QUICK_ACTIONS = [
  { label: '상태 분석', prompt: '최근 상태 기록을 분석해서 패턴과 주의할 점을 알려줘' },
  { label: '검진 해석', prompt: '최근 건강검진 수치를 쉽게 설명해줘' },
  { label: '복약 안내', prompt: '현재 복용 중인 약들의 주요 부작용과 복용 시 주의사항을 알려줘' },
  { label: '리마인더', prompt: '오늘 복약 일정을 정리하고 각 약의 복용 팁을 알려줘' },
];

export default function AiChat({ state }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'ai',
      text: `안녕하세요, ${state.patientName}님! 복약 관련 궁금한 점을 편하게 물어보세요.\n아래 빠른 질문 버튼을 눌러도 됩니다.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages(prev => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);

    // Build Gemini-format message history (user/model alternating)
    const history = messages
      .filter(m => m.role !== 'ai' || messages.indexOf(m) > 0) // skip greeting
      .map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.text }],
      }));
    history.push({ role: 'user', parts: [{ text: trimmed }] });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          systemPrompt: buildSystemPrompt(state),
        }),
      });
      const data = await res.json() as { text?: string; error?: string };
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: data.text ?? data.error ?? '오류가 발생했습니다.' },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: '연결 오류가 발생했습니다.\n배포 환경(Vercel)에서 사용해주세요.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* 헤더 */}
      <div style={{ background: '#1B3A6B', padding: '16px', flexShrink: 0 }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 17 }}>AI 의료 도우미</div>
        <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 11, marginTop: 3 }}>
          Gemini 2.0 Flash · 참고용 정보, 의료 진단 아님
        </div>
      </div>

      {/* 빠른 질문 */}
      <div style={{ padding: '10px 13px', borderBottom: '1px solid #E2E8F0', flexShrink: 0, background: '#fff' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {QUICK_ACTIONS.map(a => (
            <button
              key={a.label}
              className="pill"
              onClick={() => send(a.prompt)}
              disabled={loading}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* 메시지 목록 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 13px', background: '#F8FAFC' }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              marginBottom: 12,
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {m.role === 'ai' && (
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: '#1B3A6B', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 800, flexShrink: 0,
                marginRight: 8, marginTop: 2,
              }}>
                AI
              </div>
            )}
            <div style={{
              maxWidth: '75%',
              background: m.role === 'user' ? '#1B3A6B' : '#fff',
              color: m.role === 'user' ? '#fff' : '#0F172A',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              padding: '10px 14px',
              fontSize: 13,
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              boxShadow: '0 1px 4px rgba(0,0,0,.07)',
            }}>
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#1B3A6B', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, flexShrink: 0,
            }}>AI</div>
            <div style={{
              background: '#fff', borderRadius: '16px 16px 16px 4px',
              padding: '10px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.07)',
            }}>
              <span style={{ color: '#94A3B8', letterSpacing: 4, fontSize: 16 }}>···</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div style={{
        padding: '10px 13px',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        borderTop: '1px solid #E2E8F0',
        display: 'flex', gap: 8,
        flexShrink: 0,
        background: '#fff',
      }}>
        <input
          className="inp"
          style={{ flex: 1, margin: 0 }}
          placeholder="복약에 대해 물어보세요..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
          }}
          disabled={loading}
        />
        <button
          className="bp"
          style={{ padding: '0 18px', margin: 0, flexShrink: 0 }}
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
        >
          전송
        </button>
      </div>
    </div>
  );
}
