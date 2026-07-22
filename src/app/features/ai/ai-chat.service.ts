import { Injectable, inject } from '@angular/core';
import { InsforgeClientService } from '../../core/insforge/insforge-client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable({ providedIn: 'root' })
export class AiChatService {
  private readonly insforge = inject(InsforgeClientService);

  async sendAgenticMessage(message: string): Promise<string> {
    const { data, error } = await this.insforge.client.functions.invoke<{ response: string }>('mem0-chat', {
      body: { message },
    });
    if (error) throw new Error(typeof error === 'string' ? error : error.message);
    return data!.response;
  }

  async clearAgenticContext(): Promise<void> {
    const { error } = await this.insforge.client.functions.invoke('mem0-chat', {
      body: { action: 'clear_context' },
    });
    if (error) throw new Error(typeof error === 'string' ? error : error.message);
  }
}
