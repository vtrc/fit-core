import { Component, computed, inject } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  template: `
    <main class="dashboard">
      <div class="hero">
        <img src="/image.png" alt="" class="hero-img" />
        <div class="hero-overlay"></div>
        <div class="hero-text">
          <h1>Hola {{ displayName() }}.</h1>
          <p>Tu espacio para planificar y registrar cada entrenamiento.</p>
        </div>
      </div>
    </main>
  `,
  styles: `
    :host { display: block; position: fixed; z-index: 1; inset: 0; bottom: 3.5rem; overflow: hidden; }
    .dashboard { height: 100%; background: #f5f1e8; color: #1f3028; display: flex; flex-direction: column; }
    .hero { position: relative; flex: 1; overflow: hidden; }
    .hero-img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .hero-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.55) 0%, transparent 50%); }
    .hero-text { position: absolute; bottom: 0; left: 0; right: 0; padding: 2rem; padding-bottom: 4rem; color: #fff; }
    .hero-text h1 { margin: 0 0 .5rem; }
    h1 { font-size: clamp(3rem, 9vw, 7rem); line-height: .9; margin: .8rem 0; }
  `,
})
export class DashboardPage {
  protected readonly auth = inject(AuthService);
  protected readonly displayName = computed(() => {
    const name = this.auth.user()?.profile?.name;
    return typeof name === 'string' && name.trim().length > 0 ? name : 'atleta';
  });
}
