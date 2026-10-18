/**
 * Modelo de datos de Diary Check.
 *
 * Todo se guarda en un único documento `AppData` serializable a JSON, tanto en
 * el archivo local de Electron como en localStorage en la versión web.
 */

export type MissionType = 'daily' | 'weekly';
export type ThemeMode = 'dark' | 'light';

/** Versión del esquema; se usa para migrar datos antiguos. */
export const APP_DATA_VERSION = 2;

export interface Game {
  id: string;
  name: string;
  /** Portada como data URL (webp/jpeg comprimido) o URL remota. */
  cover?: string;
  /** Color de acento propio del juego (hex). */
  accentColor: string;
  /** Zona horaria IANA del servidor ("America/Santiago", "UTC"…). */
  timezone: string;
  /** Hora local del servidor a la que se reinician las misiones diarias ("04:00"). */
  dailyResetTime: string;
  /** Día de la semana del reset semanal: 0 = domingo … 6 = sábado. */
  weeklyResetDay: number;
  /** Hora local del servidor a la que se reinician las misiones semanales ("04:00"). */
  weeklyResetTime: string;
  notes?: string;
  archived: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Mission {
  id: string;
  gameId: string;
  title: string;
  description?: string;
  type: MissionType;
  /** Repeticiones necesarias para completarla (1 = simple casilla). */
  target: number;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Completion {
  id: string;
  missionId: string;
  gameId: string;
  periodType: MissionType;
  /** Clave del periodo: "2026-10-18" (diaria) o "2026-W42" (semanal). */
  periodKey: string;
  /** Progreso alcanzado dentro del periodo (>= target = completada). */
  count: number;
  /** ISO timestamp de la última actualización. */
  completedAt: string;
}

export interface Settings {
  theme: ThemeMode;
  locale: 'es';
  notifyEnabled: boolean;
  /** Minutos de antelación con los que avisar antes de un reset. */
  notifyLeadMinutes: number;
  /** Aviso al abrir la app con el resumen de pendientes. */
  notifySummaryOnOpen: boolean;
  /** Aviso de semanales pendientes cuando queda poco para el reset semanal. */
  notifyWeekly: boolean;
  autoBackup: boolean;
  /** Meses de historial que se conservan (0 = sin límite). */
  historyMonths: number;
  /** Claves de notificación ya enviadas, para no repetir avisos. */
  notifiedKeys: string[];
}

export interface AppData {
  schemaVersion: number;
  games: Game[];
  missions: Mission[];
  completions: Completion[];
  settings: Settings;
  updatedAt: string;
}

export const PALETTE = [
  '#7c5cff',
  '#f472b6',
  '#38bdf8',
  '#34d399',
  '#fbbf24',
  '#fb923c',
  '#f87171',
  '#a78bfa',
  '#22d3ee',
  '#a3e635',
] as const;

export const WEEKDAYS_ES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

export const WEEKDAYS_ES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

export function defaultSettings(): Settings {
  return {
    theme: 'dark',
    locale: 'es',
    notifyEnabled: true,
    notifyLeadMinutes: 60,
    notifySummaryOnOpen: true,
    notifyWeekly: true,
    autoBackup: true,
    historyMonths: 0,
    notifiedKeys: [],
  };
}

export function emptyAppData(): AppData {
  return {
    schemaVersion: APP_DATA_VERSION,
    games: [],
    missions: [],
    completions: [],
    settings: defaultSettings(),
    updatedAt: new Date().toISOString(),
  };
}

export function uid(): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** ¿La misión ya está completada con ese progreso? */
export function isMissionDone(mission: Mission, count: number): boolean {
  return count >= Math.max(1, mission.target);
}
