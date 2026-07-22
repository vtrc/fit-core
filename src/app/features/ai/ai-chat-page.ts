import { Component, viewChild, inject, signal, effect, ElementRef, injectAsync } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiChatService, ChatMessage } from './ai-chat.service';
import { PageHeaderComponent } from '../../shared/page-header/page-header';

@Component({
  selector: 'app-ai-chat-page',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent],
  templateUrl: './ai-chat-page.html',
  styleUrl: './ai-chat-page.scss',
})
export class AiChatPage {
  private readonly aiChat = inject(AiChatService);

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly inputMessage = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly renderMarkdown = injectAsync(() => import('./markdown-renderer').then(m => m.MarkdownRenderer));
  private scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');
  protected readonly renderMarkdownFn = signal<((markdown: string) => string) | null>(null);

  constructor() {
    effect(() => {
      this.messages();
      this.loading();
      const el = this.scrollContainer()?.nativeElement;
      if (el) {
        setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
      }
    });
  }
  async ngOnInit() {
    const render = await this.renderMarkdown()
    this.renderMarkdownFn.set((markdown: string) => render.renderMarkdown(markdown));
  }

  async sendMessage(): Promise<void> {
    const content = this.inputMessage().trim();
    if (!content || this.loading()) return;

    this.messages.update(msgs => [...msgs, { role: 'user', content }]);
    this.inputMessage.set('');
    this.error.set(null);

    this.loading.set(true);
    try {
      const response = await this.aiChat.sendAgenticMessage(content);
      this.messages.update(msgs => [...msgs, { role: 'assistant', content: response }]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Algo salió mal, ¿probamos de nuevo?');
    } finally {
      this.loading.set(false);
    }
  }

  async clearChat(): Promise<void> {
    if (this.loading()) return;
    try {
      await this.aiChat.clearAgenticContext();
      this.messages.set([]);
      this.error.set(null);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo limpiar el contexto del chat.');
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendSuggestion(text: string): void {
    if (this.loading()) return;
    this.inputMessage.set(text);
    this.sendMessage();
  }

}
