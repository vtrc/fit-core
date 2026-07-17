import { Component, viewChild, inject, signal, effect, ElementRef, injectAsync } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiChatService, ChatMessage, RoutineProposal, RoutineProfile } from './ai-chat.service';
import { MarkdownRenderer } from './markdown-renderer';
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
  protected readonly routineProposal = signal<RoutineProposal | null>(null);
  protected readonly routineId = signal<string | null>(null);
  private lastProfile: RoutineProfile | null = null;
  private scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');
  protected renderMarkdownFn: ((markdown: string) => string) | null = null;

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
    this.renderMarkdownFn = (markdown: string) => render.renderMarkdown(markdown);
  }

  async sendMessage(): Promise<void> {
    const content = this.inputMessage().trim();
    if (!content || this.loading()) return;

    this.messages.update(msgs => [...msgs, { role: 'user', content }]);
    this.inputMessage.set('');
    this.error.set(null);

    const proposal = this.routineProposal();
    this.routineProposal.set(null);
    this.loading.set(true);
    try {
      const result = await this.aiChat.sendRoutineMessage(content, proposal ?? undefined, this.lastProfile ?? undefined, this.messages());
      if (result.action === 'approve') {
        this.routineId.set(result.id!);
        this.messages.update(msgs => [...msgs, { role: 'assistant', content: `La rutina se ha guardado correctamente.\n\n[Ver rutina](/routines/${result.id})` }]);
      } else if (result.action === 'rename' || result.action === 'modify') {
        this.routineProposal.set(result.proposal!);
        this.lastProfile = result.profile ?? this.lastProfile;
        this.messages.update(msgs => [...msgs, { role: 'assistant', content: this.formatProposal(result.proposal!) }]);
      } else if (result.action === 'chat') {
        this.messages.update(msgs => [...msgs, { role: 'assistant', content: result.content! }]);
      } else if (result.state === 'profile_ready') {
        this.lastProfile = result.profile!;
        this.messages.update(msgs => [...msgs, { role: 'assistant', content: '¡Perfecto! Estoy creando tu rutina personalizada... 🔥' }]);
        const genProposal = await this.aiChat.generateRoutine(result.profile!);
        this.routineProposal.set(genProposal);
        this.messages.update(msgs => [...msgs, { role: 'assistant', content: this.formatProposal(genProposal) }]);
      } else {
        this.messages.update(msgs => [...msgs, { role: 'assistant', content: result.message ?? '¿Qué más necesito saber de ti para crear tu rutina?' }]);
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Algo salió mal, ¿probamos de nuevo?');
    } finally {
      this.loading.set(false);
    }
  }

  clearChat(): void {
    this.messages.set([]);
    this.error.set(null);
    this.routineProposal.set(null);
    this.routineId.set(null);
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

  async approveRoutine(): Promise<void> {
    const proposal = this.routineProposal();
    if (!proposal || this.loading()) return;
    this.inputMessage.set('Sí');
    await this.sendMessage();
  }

  private formatProposal(proposal: RoutineProposal): string {
    const exercises = proposal.exercises.map((exercise, index) => {
      const sets = exercise.planned_sets ? `${exercise.planned_sets} series x ${exercise.planned_repetitions} repeticiones` : `${exercise.planned_duration_seconds} segundos`;
      const weight = exercise.planned_weight ? ` @ ${exercise.planned_weight}kg` : '';
      return `${index + 1}. **${exercise.exercise_name ?? 'Ejercicio'}** — ${sets}${weight}`;
    }).join('\n');
    return `## ${proposal.name}\n\n${proposal.description}\n\n${exercises}\n\n¿La rutina es correcta? Responde **sí** para guardarla o indica qué quieres cambiar.`;
  }
}
