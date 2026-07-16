import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { InsforgeClientService } from '../../core/insforge/insforge-client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  aborted?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AiChatService {
  private readonly insforge = inject(InsforgeClientService);

  async *sendMessageStream(
    messages: ChatMessage[],
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    await this.insforge.ready;
    const token = this.insforge.getAccessToken();

    const response = await fetch(
      `${environment.functionsRunnerUrl}/minimax-chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          apikey: environment.insforgeAnonKey,
        },
        body: JSON.stringify({ messages, stream: true }),
        signal,
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error((body as any)?.error || `Error ${response.status}`);
    }

    const reader = response.body!
      .pipeThrough(new TextDecoderStream())
      .getReader();

    let buffer = '';
    let inThink = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (value) buffer += value;

        const events = buffer.split(/\r?\n\r?\n/);
        buffer = done ? '' : events.pop() || '';

        for (const event of events) {
          for (const line of event.split(/\r?\n/)) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (!delta) continue;

              const cleaned = this.stripThinkTags(delta, inThink);
              if (signal?.aborted) {
                inThink = false;
                cleaned.inThink = false;
              } else {
                inThink = cleaned.inThink;
              }
              if (cleaned.result) yield cleaned.result;
            } catch {
              // skip malformed JSON
            }
          }
        }

        if (done) break;
      }
    } finally {
      reader.cancel();
    }
  }

  private stripThinkTags(
    chunk: string,
    initialInThink: boolean,
  ): { result: string; inThink: boolean } {
    let remaining = true;
    let inThink = initialInThink;
    let result = '';
    let cursor = chunk;

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

    return { result, inThink };
  }
}
