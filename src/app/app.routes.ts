import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
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
  { path: 'dashboard', component: DashboardPage, canActivate: [authGuard] },
  { path: 'routines', component: RoutinesListPage, canActivate: [authGuard] },
  { path: 'routines/new', component: RoutineEditarorPage, canActivate: [authGuard] },
  { path: 'routines/:id', component: RoutineDetailPage, canActivate: [authGuard] },
  { path: 'routines/:id/edit', component: RoutineEditarorPage, canActivate: [authGuard] },
  { path: 'workouts/start', component: WorkoutStartPage, canActivate: [authGuard] },
  { path: 'workouts/session', component: WorkoutSessionPage, canActivate: [authGuard] },
  { path: 'workouts/summary', component: WorkoutSummaryPage, canActivate: [authGuard] },
  { path: 'history', component: HistoryListPage, canActivate: [authGuard] },
  { path: 'history/:id', component: HistoryDetailPage, canActivate: [authGuard] },
  { path: 'statistics', component: StatisticsPage, canActivate: [authGuard] },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];
