import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="dashboard">
      <header><p class="eyebrow">FIT CORE</p><button type="button" (click)="signOut()">Cerrar sesión</button></header>
      <section><p class="eyebrow">PANEL</p><h1>Hola {{ displayName() }}.</h1><p>Tu espacio para planificar y registrar cada entrenamiento.</p></section>
      <div class="actions">
        <a class="primary" routerLink="/routines/new">
          <button type="button">Crear rutina</button>
        </a>
        <button type="button" routerLink="/workouts/start">Entrenamiento libre</button>
      </div>
      <nav class="nav-links">
        <a routerLink="/routines">Mis rutinas</a>
        <a routerLink="/history">Historial</a>
        <a routerLink="/statistics">Estadísticas</a>
      </nav>
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100vh; }
    .dashboard { min-height: 100vh; padding: 2rem clamp(1rem, 5vw, 5rem); background: #f5f1e8; color: #1f3028; }
    header { display: flex; justify-content: space-between; align-items: center; }
    header button { border: 0; background: transparent; color: #a44a2c; cursor: pointer; }
    section { max-width: 48rem; padding: 14vh 0 3rem; } h1 { font-size: clamp(3rem, 9vw, 7rem); line-height: .9; margin: .8rem 0; }
    .eyebrow { color: #a44a2c; font-size: .75rem; font-weight: 800; letter-spacing: .16em; }
    .actions { display: flex; flex-wrap: wrap; gap: .75rem; } .actions button { padding: .9rem 1.1rem; border: 0; border-radius: .6rem; background: #1f3028; color: #fff; cursor: pointer; }
    .nav-links { display: flex; flex-wrap: wrap; gap: 1.5rem; margin-top: 2rem; }
    .nav-links a { color: #1f3028; font-weight: 600; text-decoration: underline; text-underline-offset: 4px; font-size: 1.1rem; }
  `,
})
export class DashboardPage {
  protected readonly auth = inject(AuthService);
  protected readonly displayName = computed(() => {
    const name = this.auth.user()?.profile?.name;
    return typeof name === 'string' && name.trim().length > 0 ? name : 'atleta';
  });
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
