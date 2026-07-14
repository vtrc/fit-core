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
        <button type="button" (click)="auth.signInWithGoogle()">Continuar con Google</button>
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
  `,
})
export class LoginPage {
  protected readonly auth = inject(AuthService);
}
