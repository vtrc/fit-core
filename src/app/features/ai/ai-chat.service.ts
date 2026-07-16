import { Injectable, inject } from '@angular/core';
import { InsforgeClientService } from '../../core/insforge/insforge-client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable({ providedIn: 'root' })
export class AiChatService {
  private readonly insforge = inject(InsforgeClientService);

  async sendMessage(messages: ChatMessage[]): Promise<string> {
    const { data, error } = await this.insforge.client.functions.invoke('minimax-chat', {
      body: { messages }
    });

    if (error) {
      throw new Error(error.message || 'Function call failed');
    }

    return (data as any)?.choices?.[0]?.message?.content || 'No se pudo obtener respuesta';
  }
}
