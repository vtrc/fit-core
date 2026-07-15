import { Component, input } from '@angular/core';

@Component({
  selector: 'app-routine-card',
  standalone: true,
  templateUrl: './routine-card.html',
  styleUrl: './routine-card.scss',
})
export class RoutineCardComponent {
  eyebrow = input.required<string>();
  name = input.required<string>();
  description = input<string | null>(null);
}
