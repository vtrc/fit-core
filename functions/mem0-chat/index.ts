import { buildCorsHeaders, extractUserIdFromToken, checkRateLimit } from './utils.ts';
import { clearChatContext, handleChatRequest } from './handler.ts';

export default async function (req: Request): Promise<Response> {
  const origin = req.headers.get('Origin')!;
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  const userId = extractUserIdFromToken(authHeader);

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const token = authHeader!.slice(7);
  const anonKey = req.headers.get('apikey') ?? '';

  if (!(await checkRateLimit(userId, token, anonKey))) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  let body: { action?: string; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (body.action === 'clear_context') {
    return clearChatContext(userId, token, anonKey, corsHeaders);
  }

  if (!body.message || typeof body.message !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Message is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return handleChatRequest(userId, token, anonKey, body.message, corsHeaders);
}
