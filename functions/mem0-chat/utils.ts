import { createClient } from 'npm:@insforge/sdk';
import { RATE_LIMIT, RATE_WINDOW } from './constants.ts';

export function extractUserIdFromToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    const userId = payload.sub ?? payload.user_id;
    return typeof userId === 'string' && userId.trim() ? userId.trim() : null;
  } catch {
    return null;
  }
}

export async function checkRateLimit(userId: string, token: string, anonKey: string): Promise<boolean> {
  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_URL') ?? 'https://4af6r2tm.eu-central.insforge.app',
    anonKey,
  });
  client.setAccessToken(token);
  const { data, error } = await client.database.rpc('check_chat_rate_limit', {
    p_user_id: userId,
    p_limit: RATE_LIMIT,
    p_window_seconds: RATE_WINDOW / 1000,
  });
  if (error) throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  return data === true;
}

export function buildCorsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Access-Control-Allow-Credentials': 'true',
  };
}
