import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { InsforgeClientService } from '../../core/insforge/insforge-client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
  action?: 'approve' | 'rename' | 'modify' | 'chat';
  id?: string;
  content?: string;
}

@Injectable({ providedIn: 'root' })
export class AiChatService {
  private readonly insforge = inject(InsforgeClientService);

  async generateRoutine(profile: RoutineProfile): Promise<RoutineProposal> {
    const { data, error } = await this.insforge.client.functions.invoke<{ proposal: RoutineProposal }>('minimax-chat', {
      body: { action: 'generate_routine', profile },
    });
    if (error) throw new Error(typeof error === 'string' ? error : error.message);
    return data!.proposal;
  }

  async sendRoutineMessage(
    message: string,
    currentProposal?: RoutineProposal,
    profile?: RoutineProfile,
    messages?: ChatMessage[],
  ): Promise<RoutineMessageResponse> {
    const { data, error } = await this.insforge.client.functions.invoke<RoutineMessageResponse>('minimax-chat', {
      body: { action: 'routine_message', message, proposal: currentProposal, profile, messages },
    });
    if (error) throw new Error(typeof error === 'string' ? error : error.message);
    return data!;
  }
}
