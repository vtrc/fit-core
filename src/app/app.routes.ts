import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { AppShell } from './shared/shell/shell';
import { DashboardPage } from './features/dashboard/dashboard-page';
import { LoginPage } from './features/auth/login-page';
import { RoutineDetailPage } from './features/routines/routine-detail-page';
import { RoutineEditarorPage } from './features/routines/routine-editor-page';
import { RoutinesListPage } from './features/routines/routines-list-page';
import { WorkoutSessionPage } from './features/workouts/workout-session-page';
import { WorkoutStartPage } from './features/workouts/workout-start-page';
import { WorkoutSummaryPage } from './features/workouts/workout-summary-page';
import { HistoryListPage } from './features/history/history-list-page';
import { HistoryDetailPage } from './features/history/history-detail-page';
import { StatisticsPage } from './features/statistics/statistics-page';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  {
    path: '',
    canActivate: [authGuard],
    component: AppShell,
    children: [
      { path: 'dashboard', component: DashboardPage },
      { path: 'routines', component: RoutinesListPage },
      { path: 'routines/new', component: RoutineEditarorPage },
      { path: 'routines/:id', component: RoutineDetailPage },
      { path: 'routines/:id/edit', component: RoutineEditarorPage },
      { path: 'workouts/start', component: WorkoutStartPage },
      { path: 'workouts/session', component: WorkoutSessionPage },
      { path: 'workouts/summary', component: WorkoutSummaryPage },
      { path: 'history', component: HistoryListPage },
      { path: 'history/:id', component: HistoryDetailPage },
      { path: 'statistics', component: StatisticsPage },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
