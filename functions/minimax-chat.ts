const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function extractUserIdFromToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || payload.user_id || null;
  } catch {
    return null;
  }
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(userId);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

const SYSTEM_PROMPT = `Eres un asistente de fitness especializado en crear rutinas de entrenamiento personalizadas.
Tu objetivo es guiar al usuario para crear una rutina personalizada basada en sus objetivos, nivel de fitness y preferencias.

El proceso para crear una rutina:
1. Pregunta sobre los objetivos del usuario (perder peso, ganar músculo, resistencia, etc.)
2. Pregunta sobre su nivel de fitness (principiante, intermedio, avanzado)
3. Pregunta sobre cuántos días por semana puede entrenar
4. Crea una rutina personalizada con ejercicios específicos
5. Explica cada ejercicio y cómo hacerlo correctamente

Responde siempre en español y sé motivador y profesional.`;

function buildCorsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function stripThinkTags(delta: string, initialInThink: boolean): { cleaned: string; inThink: boolean } {
  let remaining = true;
  let inThink = initialInThink;
  let result = '';
  let cursor = delta;

  while (remaining && cursor.length > 0) {
    if (inThink) {
      const end = cursor.indexOf('</think>');
      if (end === -1) {
        remaining = false;
      } else {
        cursor = cursor.slice(end + 8);
        inThink = false;
      }
    } else {
      const start = cursor.indexOf('<think>');
      if (start === -1) {
        result += cursor;
        remaining = false;
      } else {
        result += cursor.slice(0, start);
        cursor = cursor.slice(start + 7);
        inThink = true;
      }
    }
  }

  return { cleaned: result, inThink };
}

export default async function(req: Request): Promise<Response> {
  const origin = req.headers.get('Origin') || 'https://4af6r2tm.insforge.site';
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  const userId = extractUserIdFromToken(authHeader);

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!checkRateLimit(userId)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { messages, stream } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('MINIMAX_API_KEY');

    const minimaxResponse = await fetch('https://api.minimax.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: stream ?? false,
      }),
    });

    if (!minimaxResponse.ok) {
      const errorText = await minimaxResponse.text();
      return new Response(
        JSON.stringify({ error: `MiniMax API error: ${minimaxResponse.status} ${errorText}` }),
        { status: minimaxResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (stream) {
      let inThink = false;

      const stripStream = new TransformStream<string, string>({
        transform(chunk, controller) {
          const { cleaned, inThink: newInThink } = stripThinkTags(chunk, inThink);
          inThink = newInThink;
          if (cleaned) controller.enqueue(cleaned);
        },
        flush(controller) {
          if (!inThink) controller.enqueue('');
        },
      });

      const streamingBody = minimaxResponse.body!
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(stripStream)
        .pipeThrough(new TextEncoderStream());

      return new Response(streamingBody, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    const apiResponse = await minimaxResponse.json();

    if (apiResponse?.choices?.[0]?.message?.content) {
      apiResponse.choices[0].message.content = apiResponse.choices[0].message.content
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .trim();
    }

    return new Response(
      JSON.stringify(apiResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
