import { Component, viewChild, inject, signal, effect, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiChatService, ChatMessage, RoutineProposal, RoutineProfile } from './ai-chat.service';
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
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly renderMarkdown = renderMarkdown;
  protected readonly routineProposal = signal<RoutineProposal | null>(null);
  protected readonly routineId = signal<string | null>(null);
  private routineMode = false;
  private lastProfile: RoutineProfile | null = null;
  private scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

  private abortController: AbortController | null = null;

  constructor() {
    effect(() => {
      this.messages();
      this.loading();
      const el = this.scrollContainer()?.nativeElement;
      if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    });
  }

  async sendMessage(): Promise<void> {
    const content = this.inputMessage().trim();
    if (!content || this.streaming()) return;

    this.messages.update(msgs => [...msgs, { role: 'user', content }]);
    this.inputMessage.set('');
    this.error.set(null);

    if (this.routineMode || /crear|generar|rutina/i.test(content)) {
      this.routineMode = true;
      this.inputMessage.set('');
      const proposal = this.routineProposal();
      if (proposal && /^(sí|si|correcta|correcto|acepto|guardar|ok)/i.test(content)) {
        await this.approveRoutine();
        return;
      }
      if (proposal) {
        const nameMatch = content.match(/(?:nombre|llámala|llamala)\s*[:=]?\s*(.+)$/i);
        if (nameMatch) {
          const renamed = { ...proposal, name: nameMatch[1].trim() };
          this.routineProposal.set(renamed);
          this.messages.update(msgs => [...msgs, { role: 'assistant', content: this.formatProposal(renamed) }]);
          return;
        }
        this.routineProposal.set(null);
        this.loading.set(true);
        try {
          const result = await this.aiChat.sendRoutineMessage(content, proposal, this.lastProfile ?? undefined);
          const newProposal = result.proposal;
          if (newProposal) {
            this.routineProposal.set(newProposal);
            this.lastProfile = result.profile ?? this.lastProfile;
            this.messages.update(msgs => [...msgs, { role: 'assistant', content: this.formatProposal(newProposal) }]);
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
        return;
      }
      // initial routine message — no proposal yet, extract profile
      this.loading.set(true);
      try {
        const result = await this.aiChat.sendRoutineMessage(content, undefined, undefined, this.messages());
        const newProposal = result.proposal;
        if (newProposal) {
          this.routineProposal.set(newProposal);
          this.lastProfile = result.profile ?? this.lastProfile;
          this.messages.update(msgs => [...msgs, { role: 'assistant', content: this.formatProposal(newProposal) }]);
        } else if (result.state === 'profile_ready') {
          this.lastProfile = result.profile!;
          this.messages.update(msgs => [...msgs, { role: 'assistant', content: 'Generando rutina...' }]);
          const genProposal = await this.aiChat.generateRoutine(result.profile!);
          this.routineProposal.set(genProposal);
          this.messages.update(msgs => [...msgs, { role: 'assistant', content: this.formatProposal(genProposal) }]);
        } else {
          this.messages.update(msgs => [...msgs, { role: 'assistant', content: result.message ?? '¿Qué más necesito saber de ti para crear tu rutina?' }]);
        }
      } catch (err) {
        this.error.set(err instanceof Error ? err.message : 'Vaya, algo salió mal generando tu rutina. Inténtalo de nuevo.');
      } finally {
        this.loading.set(false);
      }
      return;
    }

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
    this.routineMode = false;
    this.routineProposal.set(null);
    this.routineId.set(null);
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

  async approveRoutine(): Promise<void> {
    const proposal = this.routineProposal();
    if (!proposal) return;
    try {
      const result = await this.aiChat.approveRoutine(proposal);
      this.routineId.set(result.id);
      this.messages.update(msgs => [...msgs, { role: 'assistant', content: `La rutina se ha guardado correctamente.\n\n[Ver rutina](/routines/${result.id})` }]);
      this.routineProposal.set(null);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Vaya, no pude guardar la rutina. Inténtalo de nuevo.');
    }
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
