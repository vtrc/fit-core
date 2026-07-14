import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <router-outlet />

      <nav class="nav-footer" aria-label="Navegación principal">
        <a routerLink="/routines" routerLinkActive="active" class="nav-item">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <path d="M9 12h6M9 16h6"/>
          </svg>
          <span class="nav-label">Rutinas</span>
        </a>

        <a routerLink="/workouts/start" routerLinkActive="active" class="nav-item">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/>
          </svg>
          <span class="nav-label">Entrenamiento</span>
        </a>

        <a routerLink="/statistics" routerLinkActive="active" class="nav-item">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 20V10M12 20V4M6 20v-6"/>
          </svg>
          <span class="nav-label">Estadísticas</span>
        </a>
      </nav>
    </div>
  `,
  styles: [
    `
    .shell { min-height: 100vh; padding-bottom: 3.5rem; background: #f5f1e8; }
    .nav-footer { position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; display: flex; border-top: 1px solid #ded6c7; background: #fffdf8; padding-bottom: env(safe-area-inset-bottom); }
    .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: .2rem; padding: .55rem 0 .4rem; text-decoration: none; color: #a4b0a6; font-size: .7rem; border-radius: 0; background: transparent; transition: color .12s; }
    .nav-item.active { color: #1f3028; }
    .nav-icon { width: 1.5rem; height: 1.5rem; display: block; }
    .nav-label { font-weight: 600; }
  `,
  ],
})
export class AppShell {}
