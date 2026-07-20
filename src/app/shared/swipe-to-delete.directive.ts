import { Directive, ElementRef, inject, input } from '@angular/core';

@Directive({
  selector: '[appSwipeToDelete]',
  standalone: true,
})
export class SwipeToDeleteDirective {
  readonly appSwipeToDelete = input(true);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  private startX = 0;
  private currentX = 0;
  private isDragging = false;
  private revealed = false;
  private readonly threshold = 50;

  constructor() {
    const el = this.el.nativeElement;
    el.addEventListener('touchstart', (e) => this.onStart(e), { passive: false });
    el.addEventListener('touchmove', (e) => this.onMove(e), { passive: true });
    el.addEventListener('touchend', () => this.onEnd());
    el.addEventListener('touchcancel', () => this.onCancel());
  }

  private onStart(e: TouchEvent): void {
    if (!this.appSwipeToDelete()) return;

    if (this.revealed) {
      e.preventDefault();
      this.reset();
      return;
    }

    const target = e.target as HTMLElement | null;
    if (target?.closest('.cdk-drag-handle')) {
      return;
    }

    this.startX = e.touches[0].clientX;
    this.currentX = this.startX;
    this.isDragging = true;
    this.el.nativeElement.style.transition = 'none';
  }

  private onMove(e: TouchEvent): void {
    if (!this.isDragging) return;
    this.currentX = e.touches[0].clientX;
    const diffX = this.startX - this.currentX;

    if (diffX > 0) {
      this.el.nativeElement.style.transform = `translateX(${-Math.min(diffX, 90)}px)`;
    }
  }

  private onEnd(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    const diff = this.startX - this.currentX;
    this.el.nativeElement.style.transition = 'transform 0.2s ease';

    if (diff > this.threshold) {
      this.el.nativeElement.style.transform = 'translateX(-90px)';
      this.revealed = true;
    } else {
      this.el.nativeElement.style.transform = 'translateX(0)';
    }
  }

  private onCancel(): void {
    this.isDragging = false;
    this.el.nativeElement.style.transition = 'transform 0.2s ease';
    this.el.nativeElement.style.transform = 'translateX(0)';
  }

  reset(): void {
    this.revealed = false;
    this.isDragging = false;
    this.el.nativeElement.style.transition = 'transform 0.2s ease';
    this.el.nativeElement.style.transform = 'translateX(0)';
  }
}
