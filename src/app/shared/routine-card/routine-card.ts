import { Component, input, output } from '@angular/core';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { SwipeToDeleteDirective } from '../swipe-to-delete.directive';

@Component({
  selector: 'app-routine-card',
  standalone: true,
  imports: [CdkDragHandle, SwipeToDeleteDirective],
  templateUrl: './routine-card.html',
  styleUrl: './routine-card.scss',
  host: {
    '[class.has-drag-handle]': 'dragHandle()',
  },
})
export class RoutineCardComponent {
  eyebrow = input.required<string>();
  name = input.required<string>();
  description = input<string | null>(null);
  dragHandle = input(false);
  swipeable = input(false);

  swiped = output<void>();

  onDelete(): void {
    this.swiped.emit();
  }
}
