export const config = { runtime: 'edge' };

interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface RequestBody {
  messages: GeminiMessage[];
  systemPrompt: string;
}

interface GeminiResponse {
  candidates?: { content: { parts: { text: string }[] } }[];
  error?: { message: string; code?: number };
}

export default async function handler(req: Request): Promise<Response> {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set');
    return new Response(
      JSON.stringify({ error: 'AI 서비스를 현재 이용할 수 없습니다.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  const { messages, systemPrompt } = (await req.json()) as RequestBody;

  // Hard timeout — Vercel Edge limit is 30s; abort well inside that.
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), 20_000);

  let geminiRes: Response;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: messages,
          generationConfig: { maxOutputTokens: 1024, temperature: 0.4 },
        }),
      }
    );
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    console.error('Gemini fetch error:', isTimeout ? 'timeout (20s)' : err);
    return new Response(
      JSON.stringify({
        error: isTimeout
          ? 'AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
          : '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      }),
      { status: 504, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
  clearTimeout(timeoutId);

  const data = (await geminiRes.json()) as GeminiResponse;

  if (data.error) {
    console.error('Gemini API error:', data.error);
    return new Response(
      JSON.stringify({ error: 'AI 응답 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }),
      { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text ??
    'AI 응답을 생성할 수 없습니다. 다시 시도해주세요.';

  return new Response(JSON.stringify({ text }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
