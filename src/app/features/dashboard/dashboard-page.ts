import { Component, computed, inject } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  protected readonly auth = inject(AuthService);
  protected readonly displayName = computed(() => {
    const name = this.auth.user()?.profile?.name;
    return typeof name === 'string' && name.trim().length > 0 ? name : 'atleta';
  });
}
