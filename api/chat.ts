export const config = { runtime: 'edge' };

interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface RequestBody {
  messages: GeminiMessage[];
  systemPrompt: string;
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
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  const { messages, systemPrompt } = (await req.json()) as RequestBody;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.4,
        },
      }),
    }
  );

  type GeminiResponse = {
    candidates?: { content: { parts: { text: string }[] } }[];
    error?: { message: string };
  };

  const data = (await geminiRes.json()) as GeminiResponse;

  if (data.error) {
    return new Response(
      JSON.stringify({ error: data.error.message }),
      { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text ??
    '응답을 생성할 수 없습니다.';

  return new Response(JSON.stringify({ text }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
