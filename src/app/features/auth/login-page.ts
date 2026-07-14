import { Component, inject } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  template: `
    <main class="login-page">
      <section class="login-panel">
        <p class="eyebrow">FIT CORE</p>
        <h1>Tu entrenamiento, con contexto.</h1>
        <p>Guarda rutinas, registra fuerza y cardio, y consulta tu evolución.</p>
        <button type="button" class="google-btn" (click)="auth.signInWithGoogle()">
          <svg class="google-icon" viewBox="0 0 48 48" width="20" height="20"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.54 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.87 7.35 2.56 10.56l7.98-5.97z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.97C6.51 42.62 14.62 48 24 48z"/></svg>
          Continuar con Google
        </button>
        @if (auth.error(); as error) {
          <p role="alert">{{ error }}</p>
        }
      </section>
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100vh; }
    .login-page { display: grid; place-items: center; min-height: 100vh; padding: 2rem; background: #f5f1e8; }
    .login-panel { width: min(100%, 32rem); padding: 3rem; background: #fffdf8; border: 1px solid #ded6c7; border-radius: 1.25rem; }
    .eyebrow { color: #a44a2c; font-size: .75rem; font-weight: 800; letter-spacing: .16em; }
    h1 { margin: 1rem 0; font-size: clamp(2.2rem, 7vw, 4rem); line-height: .95; }
    button { margin-top: 1.5rem; width: 100%; padding: .9rem 1rem; border: 0; border-radius: .6rem; background: #1f3028; color: white; font-weight: 700; cursor: pointer; }
    .google-btn { display: flex; align-items: center; justify-content: center; gap: .6rem; }
    .google-icon { flex-shrink: 0; }
  `,
})
export class LoginPage {
  protected readonly auth = inject(AuthService);
}
