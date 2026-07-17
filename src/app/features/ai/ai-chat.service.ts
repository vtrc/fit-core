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

interface RoutineExercise {
  exercise_id: string;
  exercise_name?: string;
  position: number;
  planned_sets: number | null;
  planned_repetitions: number | null;
  planned_weight: number | null;
  planned_duration_seconds: number | null;
  planned_distance: number | null;
  rest_seconds: number | null;
  notes: string | null;
}

export interface RoutineProposal {
  name: string;
  description: string;
  exercises: RoutineExercise[];
}

export interface RoutineMessageResponse {
  state: string;
  message?: string;
  proposal?: RoutineProposal;
  missing?: string[];
  profile?: RoutineProfile;
}

@Injectable({ providedIn: 'root' })
export class AiChatService {
  private readonly insforge = inject(InsforgeClientService);
  private readonly endpoint = `${environment.functionsRunnerUrl}/minimax-chat`;

  async generateRoutine(profile: RoutineProfile): Promise<RoutineProposal> {
    const { proposal } = await this.post<{ proposal: RoutineProposal }>({ action: 'generate_routine', profile });
    return proposal;
  }

  async sendRoutineMessage(
    message: string,
    currentProposal?: RoutineProposal,
    profile?: RoutineProfile,
    messages?: ChatMessage[],
  ): Promise<RoutineMessageResponse> {
    return this.post({ action: 'routine_message', message, proposal: currentProposal, profile, messages });
  }

  async approveRoutine(routine: RoutineProposal): Promise<{ id: string }> {
    return this.post({ action: 'approve_routine', routine });
  }

  async *sendMessageStream(
    messages: ChatMessage[],
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const { choices } = await this.post<{ choices: { message: { content: string } }[] }>(
      { messages, stream: false },
      signal,
    );
    if (signal?.aborted) return;
    const content = choices?.[0]?.message?.content;
    if (content) yield content;
  }

  private async post<T>(body: unknown, signal?: AbortSignal): Promise<T> {
    await this.insforge.ready;
    const token = this.insforge.getAccessToken();
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        apikey: environment.insforgeAnonKey,
      },
      body: JSON.stringify(body),
      signal,
    });
    const result: T = await response.json();
    if (!response.ok) throw new Error((result as { error?: string })?.error || `Error ${response.status}`);
    return result;
  }
}
