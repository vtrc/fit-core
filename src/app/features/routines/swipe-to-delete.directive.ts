import { Directive, ElementRef, EventEmitter, inject, Output } from '@angular/core';

@Directive({
  selector: '[appSwipeToDelete]',
  standalone: true,
})
export class SwipeToDeleteDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  @Output() swiped = new EventEmitter<void>();

  private startX = 0;
  private currentX = 0;
  private isDragging = false;
  private readonly threshold = 80;

  constructor() {
    const el = this.el.nativeElement;
    el.addEventListener('touchstart', (e) => this.onStart(e), { passive: true });
    el.addEventListener('touchmove', (e) => this.onMove(e), { passive: true });
    el.addEventListener('touchend', () => this.onEnd());
    el.addEventListener('touchcancel', () => this.onCancel());
  }

  private onStart(e: TouchEvent): void {
    this.startX = e.touches[0].clientX;
    this.currentX = this.startX;
    this.isDragging = true;
    this.el.nativeElement.style.transition = 'none';
  }

  private onMove(e: TouchEvent): void {
    if (!this.isDragging) return;
    this.currentX = e.touches[0].clientX;
    const diff = this.startX - this.currentX;
    if (diff > 0) {
      this.el.nativeElement.style.transform = `translateX(${-Math.min(diff, 120)}px)`;
    }
  }

  private onEnd(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    const diff = this.startX - this.currentX;
    this.el.nativeElement.style.transition = 'transform 0.2s ease';
    if (diff > this.threshold) {
      this.el.nativeElement.style.transform = 'translateX(-120px)';
      this.swiped.emit();
      setTimeout(() => {
        this.el.nativeElement.style.transform = 'translateX(0)';
      }, 400);
    } else {
      this.el.nativeElement.style.transform = 'translateX(0)';
    }
  }

  private onCancel(): void {
    this.isDragging = false;
    this.el.nativeElement.style.transition = 'transform 0.2s ease';
    this.el.nativeElement.style.transform = 'translateX(0)';
  }
}
