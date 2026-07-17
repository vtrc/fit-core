import { RATE_LIMIT, RATE_WINDOW, rateLimitStore } from './constants.ts';

export function extractUserIdFromToken(authHeader: string | null): string | null {
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

export function checkRateLimit(userId: string): boolean {
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

export function buildCorsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export function stripThinkTags(delta: string, initialInThink: boolean): { cleaned: string; inThink: boolean } {
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

export function parseMiniMaxJson(text: string): unknown {
  return JSON.parse(
    text.replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```json|```/gi, '')
      .trim(),
  );
}
