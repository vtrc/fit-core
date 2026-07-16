import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiChatService, ChatMessage } from './ai-chat.service';

@Component({
  selector: 'app-ai-chat-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './ai-chat-page.html',
  styleUrl: './ai-chat-page.scss',
})
export class AiChatPage {
  private readonly aiChat = inject(AiChatService);

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly inputMessage = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  async sendMessage(): Promise<void> {
    const content = this.inputMessage().trim();
    if (!content || this.loading()) return;

    this.messages.update(msgs => [...msgs, { role: 'user', content }]);
    this.inputMessage.set('');
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.aiChat.sendMessage(this.messages());
      this.messages.update(msgs => [...msgs, { role: 'assistant', content: response }]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      this.loading.set(false);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  clearChat(): void {
    this.messages.set([]);
    this.error.set(null);
  }

  sendSuggestion(text: string): void {
    if (this.loading()) return;
    this.inputMessage.set(text);
    this.sendMessage();
  }
}
