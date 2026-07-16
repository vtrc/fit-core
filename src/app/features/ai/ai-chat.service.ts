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
        body: JSON.stringify({ messages, stream: false }),
        signal,
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error((body as any)?.error || `Error ${response.status}`);
    }

    const body = await response.json();
    if (signal?.aborted) return;

    const content = body?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content) yield content;
  }

}
