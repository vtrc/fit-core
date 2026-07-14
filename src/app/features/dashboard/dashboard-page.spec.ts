import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, beforeEach, expect, it, vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { DashboardPage } from './dashboard-page';

describe('DashboardPage', () => {
  const auth = {
    user: signal<any>(null),
    signOut: vi.fn(),
  };

  beforeEach(() => {
    auth.user.set(null);
    auth.signOut.mockReset();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
      ],
    });
  });

  it('shows a safe fallback when the user name is missing', () => {
    auth.user.set({ profile: {} });

    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Hola atleta.');
  });
});
