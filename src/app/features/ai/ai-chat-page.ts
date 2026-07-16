import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiChatService, ChatMessage } from './ai-chat.service';
import { renderMarkdown } from './markdown.utils';

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
  protected readonly streaming = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly renderMarkdown = renderMarkdown;

  private abortController: AbortController | null = null;

  async sendMessage(): Promise<void> {
    const content = this.inputMessage().trim();
    if (!content || this.streaming()) return;

    this.messages.update(msgs => [...msgs, { role: 'user', content }]);
    this.inputMessage.set('');
    this.error.set(null);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    this.messages.update(msgs => [...msgs, assistantMsg]);
    this.streaming.set(true);

    this.abortController = new AbortController();

    try {
      for await (const delta of this.aiChat.sendMessageStream(
        this.messages().filter(m => !m.aborted),
        this.abortController.signal,
      )) {
        assistantMsg.content += delta;
        this.messages.update(msgs => [...msgs]);
      }
    } catch (err: unknown) {
      if ((err instanceof DOMException || err instanceof Error) && err.name === 'AbortError') {
        assistantMsg.aborted = true;
        this.messages.update(msgs => [...msgs]);
        return;
      }
      this.error.set(err instanceof Error ? err.message : 'Error desconocido');
      this.messages.update(msgs => {
        const last = msgs[msgs.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          return msgs.slice(0, -1);
        }
        return msgs;
      });
    } finally {
      this.streaming.set(false);
      this.abortController = null;
    }
  }

  cancelStream(): void {
    this.abortController?.abort();
  }

  retryLast(): void {
    const msgs = this.messages();
    const lastUserIdx = this.findLastIndex(msgs, m => m.role === 'user');
    if (lastUserIdx === -1) return;

    const lastUserMsg = msgs[lastUserIdx];
    const lastAssistantIdx = this.findLastIndex(
      msgs,
      m => m.role === 'assistant' && !!m.aborted,
    );

    this.messages.update(prev => {
      const updated = prev.slice(0, lastAssistantIdx >= 0 ? lastAssistantIdx : prev.length);
      return updated;
    });

    this.inputMessage.set(lastUserMsg.content);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  clearChat(): void {
    this.abortController?.abort();
    this.messages.set([]);
    this.error.set(null);
  }

  private findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (predicate(arr[i])) return i;
    }
    return -1;
  }

  sendSuggestion(text: string): void {
    if (this.streaming()) return;
    this.inputMessage.set(text);
    this.sendMessage();
  }
}
