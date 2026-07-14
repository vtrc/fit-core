import { TestBed } from '@angular/core/testing';
import { describe, beforeEach, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';
import { InsforgeClientService } from '../insforge/insforge-client';

describe('AuthService', () => {
  const getCurrentUser = vi.fn();
  const signInWithOAuth = vi.fn();
  const signOut = vi.fn();

  const insforgeClient = {
    auth: {
      getCurrentUser,
      signInWithOAuth,
      signOut,
    },
  };

  beforeEach(() => {
    getCurrentUser.mockReset();
    signInWithOAuth.mockReset();
    signOut.mockReset();

    getCurrentUser.mockResolvedValue({ data: { user: null }, error: null });
    signInWithOAuth.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        {
          provide: InsforgeClientService,
          useValue: { client: insforgeClient },
        },
      ],
    });
  });

  it('restores the current user and clears loading state', async () => {
    const user = { id: 'user-1', name: 'Victor' };
    getCurrentUser.mockResolvedValue({ data: { user }, error: null });

    const service = TestBed.inject(AuthService);
    await Promise.resolve();

    expect(getCurrentUser).toHaveBeenCalledTimes(1);
    expect(service.user()).toEqual(user);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('delegates Google sign-in to InsForge with the dashboard redirect', async () => {
    const service = TestBed.inject(AuthService);

    await service.signInWithGoogle();

    expect(signInWithOAuth).toHaveBeenCalledWith('google', {
      redirectTo: `${window.location.origin}/dashboard`,
    });
    expect(service.error()).toBeNull();
  });

  it('clears the user on successful sign-out', async () => {
    const user = { id: 'user-1', name: 'Victor' };
    getCurrentUser.mockResolvedValue({ data: { user }, error: null });

    const service = TestBed.inject(AuthService);
    await Promise.resolve();
    await service.signOut();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(service.user()).toBeNull();
    expect(service.error()).toBeNull();
  });

  it('surfaces sign-out errors without clearing the current user', async () => {
    const user = { id: 'user-1', name: 'Victor' };
    getCurrentUser.mockResolvedValue({ data: { user }, error: null });
    signOut.mockResolvedValueOnce({ error: { message: 'network failed' } });

    const service = TestBed.inject(AuthService);
    await Promise.resolve();
    await service.signOut();

    expect(service.user()).toEqual(user);
    expect(service.error()).toBe('network failed');
  });
});
