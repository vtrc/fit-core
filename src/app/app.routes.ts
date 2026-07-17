import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { AppShell } from './shared/shell/shell';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login-page').then(m => m.LoginPage) },
  {
    path: '',
    canActivate: [authGuard],
    component: AppShell,
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard-page').then(m => m.DashboardPage) },
      { path: 'routines', loadComponent: () => import('./features/routines/routines-list-page').then(m => m.RoutinesListPage) },
      { path: 'routines/new', loadComponent: () => import('./features/routines/routine-editor-page').then(m => m.RoutineEditarorPage) },
      { path: 'routines/:id', loadComponent: () => import('./features/routines/routine-detail-page').then(m => m.RoutineDetailPage) },
      { path: 'routines/:id/edit', loadComponent: () => import('./features/routines/routine-editor-page').then(m => m.RoutineEditarorPage) },
      { path: 'workouts/start', loadComponent: () => import('./features/workouts/workout-start-page').then(m => m.WorkoutStartPage) },
      { path: 'workouts/session', loadComponent: () => import('./features/workouts/workout-session-page').then(m => m.WorkoutSessionPage) },
      { path: 'workouts/summary', loadComponent: () => import('./features/workouts/workout-summary-page').then(m => m.WorkoutSummaryPage) },
      { path: 'history', loadComponent: () => import('./features/history/history-list-page').then(m => m.HistoryListPage) },
      { path: 'history/:id', loadComponent: () => import('./features/history/history-detail-page').then(m => m.HistoryDetailPage) },
      { path: 'statistics', loadComponent: () => import('./features/statistics/statistics-page').then(m => m.StatisticsPage) },
      { path: 'ai', loadComponent: () => import('./features/ai/ai-chat-page').then(m => m.AiChatPage) },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
