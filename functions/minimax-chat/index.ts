import { buildCorsHeaders, extractUserIdFromToken, checkRateLimit, stripThinkTags } from './utils.ts';
import { handleRoutineMessage } from './handler.ts';
import { generateRoutineProposal } from './routine.ts';
import { persistRoutine } from './persistence.ts';
import { SYSTEM_PROMPT } from './constants.ts';

export default async function(req: Request): Promise<Response> {
  const origin = req.headers.get('Origin') || 'https://4af6r2tm.insforge.site';
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  const userId = extractUserIdFromToken(authHeader);
  const token = authHeader?.slice(7);
  const anonKey = req.headers.get('apikey') ?? '';

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (!checkRateLimit(userId)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const { messages, stream, action, routine, profile, message, proposal } = await req.json();

    if (action === 'routine_message') {
      const result = await handleRoutineMessage(
        message, userId, proposal, profile, token, anonKey,
        messages as Array<{ role: string; content: string }> | undefined,
      );
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'generate_routine') {
      const result = await generateRoutineProposal(profile, token ?? '', anonKey);
      return new Response(JSON.stringify({ state: 'awaiting_approval', proposal: result }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'approve_routine') {
      return persistRoutine(req, userId, routine, corsHeaders);
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
        { status: minimaxResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (stream) {
      return handleStreamingResponse(minimaxResponse, corsHeaders);
    }

    const apiResponse = await minimaxResponse.json();
    if (apiResponse?.choices?.[0]?.message?.content) {
      apiResponse.choices[0].message.content = apiResponse.choices[0].message.content
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .trim();
    }

    return new Response(JSON.stringify(apiResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error('minimax-chat runtime error', e);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
}

function handleStreamingResponse(minimaxResponse: Response, corsHeaders: Record<string, string>): Response {
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
