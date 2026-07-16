import { Injectable, signal } from '@angular/core';
import type { UserSchema } from '@insforge/shared-schemas';

import { InsforgeClientService } from '../insforge/insforge-client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<UserSchema | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  private restoreSessionPromise: Promise<void> | null = null;

  constructor(private readonly insforge: InsforgeClientService) {
    void this.restoreSession();
  }

  restoreSession(): Promise<void> {
    if (this.restoreSessionPromise) return this.restoreSessionPromise;

    this.restoreSessionPromise = this.restoreSessionInternal().finally(() => {
      this.restoreSessionPromise = null;
    });
    return this.restoreSessionPromise;
  }

  private async restoreSessionInternal(): Promise<void> {
    this.loading.set(true);
    await this.insforge.ready;
    const { data, error } = await this.insforge.client.auth.getCurrentUser();
    this.user.set(error ? null : (data?.user ?? null));
    this.error.set(this.isUnauthenticated(error) ? null : (error?.message ?? null));
    this.loading.set(false);
  }

  async signInWithGoogle(): Promise<void> {
    this.error.set(null);
    const { data, error } = await this.insforge.client.auth.signInWithOAuth('google', {
      redirectTo: `${window.location.origin}/dashboard`,
    });
    if (error) {
      this.error.set(error.message);
      return;
    }
    if (data?.url) window.location.assign(data.url);
  }

  async signOut(): Promise<void> {
    const { error } = await this.insforge.client.auth.signOut();
    if (error) {
      this.error.set(error.message);
      return;
    }
    this.insforge.clearStoredSession?.();
    this.user.set(null);
  }

  private isUnauthenticated(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const statusCode = 'statusCode' in error ? error.statusCode : undefined;
    return statusCode === 401 || statusCode === 403;
  }
}
