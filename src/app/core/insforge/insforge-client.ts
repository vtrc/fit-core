import { Injectable } from '@angular/core';
import { createClient, type InsForgeClient } from '@insforge/sdk';

import { environment } from '../../../environments/environment';

const REFRESH_TOKEN_KEY = 'fit-core_refresh_token';

function readRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeRefreshToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // The user can still authenticate for the current tab if storage is unavailable.
  }
}

@Injectable({ providedIn: 'root' })
export class InsforgeClientService {
  readonly client: InsForgeClient;
  readonly ready: Promise<void>;

  constructor() {
    const client = createClient({
      baseUrl: environment.insforgeUrl,
      anonKey: environment.insforgeAnonKey,
      functionsUrl: `${environment.insforgeUrl}/functions`,
      headers: { apikey: environment.insforgeAnonKey },
      isServerMode: true,
      auth: { detectOAuthCallback: false },
    });
    const http = (client as any).http;
    const tokenManager = (client as any).tokenManager;

    http.setAuthToken = ((token: string | null) => {
      http.userToken = token;
    }) as any;
    http.setRefreshToken = ((token: string | null) => {
      writeRefreshToken(token);
      http.refreshToken = token;
    }) as any;

    const saveSession = tokenManager.saveSession.bind(tokenManager);
    tokenManager.saveSession = (session: any) => {
      if (session.refreshToken) writeRefreshToken(session.refreshToken);
      saveSession(session);
    };

    this.client = client;
    const code = new URLSearchParams(window.location.search).get('insforge_code');
    this.ready = code ? this.exchangeOAuthCode(code) : this.restoreMobileSession();
  }

  getAccessToken(): string | null {
    return (this.client as any).http?.userToken ?? null;
  }

  clearStoredSession(): void {
    writeRefreshToken(null);
  }

  private async restoreMobileSession(): Promise<void> {
    const refreshToken = readRefreshToken();
    if (!refreshToken) return;

    try {
      const response = await fetch(
        `${environment.insforgeUrl}/api/auth/refresh?client_type=mobile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: environment.insforgeAnonKey,
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.accessToken || !data.user) {
        writeRefreshToken(null);
        return;
      }

      this.saveSession(data);
    } catch {
      writeRefreshToken(null);
    }
  }

  private async exchangeOAuthCode(code: string): Promise<void> {
    const codeVerifier = sessionStorage.getItem('insforge_pkce_verifier');
    if (!codeVerifier) {
      window.history.replaceState({}, '', window.location.pathname);
      await this.restoreMobileSession();
      return;
    }

    try {
      const { data, error } = await this.client.auth.exchangeOAuthCode(code, codeVerifier);
      if (error) throw error;
      if (!data?.accessToken || !data.user) throw new Error('OAuth exchange did not return a valid session');

      this.saveSession(data);
    } catch {
      writeRefreshToken(null);
    } finally {
      window.history.replaceState({}, '', window.location.pathname);
      sessionStorage.removeItem('insforge_pkce_verifier');
    }
  }

  private saveSession(data: { accessToken: string; refreshToken?: string }): void {
    const http = (this.client as any).http;
    const tokenManager = (this.client as any).tokenManager;
    this.client.setAccessToken(data.accessToken);
    http.setRefreshToken(data.refreshToken ?? null);
    tokenManager.saveSession(data);
  }
}
