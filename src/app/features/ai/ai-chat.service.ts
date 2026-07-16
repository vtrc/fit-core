import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { InsforgeClientService } from '../../core/insforge/insforge-client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  aborted?: boolean;
}

export interface RoutineProfile {
  age: number;
  weightKg: number;
  goal: 'strength' | 'cardio' | 'fat_loss' | 'general';
  level: 'beginner' | 'intermediate' | 'advanced';
  daysPerWeek: number;
}

export interface RoutineProposal {
  name: string;
  description: string;
  exercises: Array<{
    exercise_id: string;
    position: number;
    planned_sets: number | null;
    planned_repetitions: number | null;
    planned_weight: number | null;
    planned_duration_seconds: number | null;
    planned_distance: number | null;
    rest_seconds: number | null;
    notes: string | null;
  }>;
}

@Injectable({ providedIn: 'root' })
export class AiChatService {
  private readonly insforge = inject(InsforgeClientService);

  async generateRoutine(profile: RoutineProfile): Promise<RoutineProposal> {
    const response = await this.callRoutineAction({ action: 'generate_routine', profile });
    return response.proposal as RoutineProposal;
  }

  async approveRoutine(routine: RoutineProposal): Promise<{ id: string }> {
    return this.callRoutineAction({ action: 'approve_routine', routine }) as Promise<{ id: string }>;
  }

  private async callRoutineAction(body: unknown): Promise<any> {
    await this.insforge.ready;
    const token = this.insforge.getAccessToken();
    const response = await fetch(`${environment.functionsRunnerUrl}/minimax-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        apikey: environment.insforgeAnonKey,
      },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error || `Error ${response.status}`);
    return result;
  }

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

    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    let inThink = false;

    try {
      while (!signal?.aborted) {
        const { done, value } = await reader.read();
        buffer += value ?? '';
        const lines = buffer.split(/\r?\n/);
        buffer = done ? '' : lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (!delta) continue;

            const cleaned = this.stripThinkTags(delta, inThink);
            inThink = cleaned.inThink;
            if (cleaned.result) yield cleaned.result;
          } catch {
            // Ignore malformed events and continue with the remaining response.
          }
        }

        if (done) break;
      }
    } finally {
      reader.releaseLock();
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
