import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Hoy · Diary Check',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardPage),
  },
  {
    path: 'games',
    title: 'Mis juegos · Diary Check',
    loadComponent: () => import('./features/games/games-list').then((m) => m.GamesListPage),
  },
  {
    path: 'games/new',
    title: 'Nuevo juego · Diary Check',
    loadComponent: () => import('./features/games/game-form').then((m) => m.GameFormPage),
  },
  {
    path: 'games/:id/edit',
    title: 'Editar juego · Diary Check',
    loadComponent: () => import('./features/games/game-form').then((m) => m.GameFormPage),
  },
  {
    path: 'games/:id',
    title: 'Misiones · Diary Check',
    loadComponent: () => import('./features/game-detail/game-detail').then((m) => m.GameDetailPage),
  },
  {
    path: 'history',
    title: 'Historial · Diary Check',
    loadComponent: () => import('./features/history/history').then((m) => m.HistoryPage),
  },
  {
    path: 'settings',
    title: 'Ajustes · Diary Check',
    loadComponent: () => import('./features/settings/settings').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: '' },
];
