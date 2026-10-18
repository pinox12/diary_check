/**
 * Normalización y migración de datos.
 *
 * Todo lo que entra (archivo local, localStorage o un JSON importado a mano)
 * pasa por aquí: así la app nunca se rompe con datos a medias, corruptos o de
 * una versión anterior del esquema.
 */
import {
  APP_DATA_VERSION,
  PALETTE,
  emptyAppData,
  defaultSettings,
  uid,
  type AppData,
  type Completion,
  type Game,
  type Mission,
  type MissionType,
  type Settings,
  type ThemeMode,
} from '../models/models';
import { systemTimezone } from '../logic/time';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAILY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WEEKLY_KEY_PATTERN = /^\d{4}-W\d{2}$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function asTime(value: unknown, fallback: string): string {
  const text = asString(value, fallback);
  return TIME_PATTERN.test(text) ? text : fallback;
}

function asColor(value: unknown, fallback: string): string {
  const text = asString(value, fallback);
  return COLOR_PATTERN.test(text) ? text.toLowerCase() : fallback;
}

function asId(value: unknown): string {
  const text = asString(value);
  return text.trim() ? text : uid();
}

function normalizeSettings(raw: unknown): Settings {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  const defaults = defaultSettings();
  const theme: ThemeMode = source.theme === 'light' ? 'light' : 'dark';
  return {
    theme,
    locale: 'es',
    notifyEnabled: asBoolean(source.notifyEnabled, defaults.notifyEnabled),
    notifyLeadMinutes: Math.round(asNumber(source.notifyLeadMinutes, defaults.notifyLeadMinutes, 0, 1440)),
    notifySummaryOnOpen: asBoolean(source.notifySummaryOnOpen, defaults.notifySummaryOnOpen),
    notifyWeekly: asBoolean(source.notifyWeekly, defaults.notifyWeekly),
    autoBackup: asBoolean(source.autoBackup, defaults.autoBackup),
    historyMonths: Math.round(asNumber(source.historyMonths, defaults.historyMonths, 0, 120)),
    notifiedKeys: Array.isArray(source.notifiedKeys)
      ? [...new Set(source.notifiedKeys.filter((key): key is string => typeof key === 'string'))].slice(-400)
      : [],
  };
}

function normalizeGame(raw: unknown, index: number): Game | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Partial<Game>;
  const name = asString(source.name).trim();
  if (!name) return null;
  return {
    id: asId(source.id),
    name: name.slice(0, 120),
    cover: asString(source.cover) || undefined,
    accentColor: asColor(source.accentColor, PALETTE[index % PALETTE.length]!),
    timezone: asString(source.timezone, systemTimezone()) || systemTimezone(),
    dailyResetTime: asTime(source.dailyResetTime, '04:00'),
    weeklyResetDay: Math.round(asNumber(source.weeklyResetDay, 1, 0, 6)),
    weeklyResetTime: asTime(source.weeklyResetTime, '04:00'),
    notes: asString(source.notes).slice(0, 2000) || undefined,
    archived: asBoolean(source.archived, false),
    sortOrder: Math.round(asNumber(source.sortOrder, index, 0, 100000)),
    createdAt: asString(source.createdAt, new Date().toISOString()),
  };
}

function normalizeMission(raw: unknown, index: number, gameIds: Set<string>): Mission | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Partial<Mission>;
  const title = asString(source.title).trim();
  const gameId = asString(source.gameId);
  if (!title || !gameIds.has(gameId)) return null;
  const type: MissionType = source.type === 'weekly' ? 'weekly' : 'daily';
  return {
    id: asId(source.id),
    gameId,
    title: title.slice(0, 160),
    description: asString(source.description).slice(0, 1000) || undefined,
    type,
    target: Math.round(asNumber(source.target, 1, 1, 999)),
    active: asBoolean(source.active, true),
    sortOrder: Math.round(asNumber(source.sortOrder, index, 0, 100000)),
    createdAt: asString(source.createdAt, new Date().toISOString()),
  };
}

function normalizeCompletion(raw: unknown, missionIds: Set<string>): Completion | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Partial<Completion>;
  const missionId = asString(source.missionId);
  const periodKey = asString(source.periodKey);
  const periodType: MissionType = source.periodType === 'weekly' ? 'weekly' : 'daily';
  if (!missionIds.has(missionId)) return null;
  const validKey = periodType === 'daily' ? DAILY_KEY_PATTERN.test(periodKey) : WEEKLY_KEY_PATTERN.test(periodKey);
  if (!validKey) return null;
  const count = Math.round(asNumber(source.count, 1, 0, 999));
  if (count <= 0) return null;
  return {
    id: asId(source.id),
    missionId,
    gameId: asString(source.gameId),
    periodType,
    periodKey,
    count,
    completedAt: asString(source.completedAt, new Date().toISOString()),
  };
}

/** Convierte cualquier entrada en un AppData válido y consistente. */
export function normalizeAppData(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') return emptyAppData();
  const source = raw as Partial<AppData>;

  const gamesRaw = Array.isArray(source.games) ? source.games : [];
  const games: Game[] = [];
  const seenGames = new Set<string>();
  gamesRaw.forEach((entry, index) => {
    const game = normalizeGame(entry, index);
    if (!game) return;
    if (seenGames.has(game.id)) game.id = uid();
    seenGames.add(game.id);
    games.push(game);
  });

  const gameIds = new Set(games.map((game) => game.id));
  const missionsRaw = Array.isArray(source.missions) ? source.missions : [];
  const missions: Mission[] = [];
  const seenMissions = new Set<string>();
  missionsRaw.forEach((entry, index) => {
    const mission = normalizeMission(entry, index, gameIds);
    if (!mission) return;
    if (seenMissions.has(mission.id)) mission.id = uid();
    seenMissions.add(mission.id);
    missions.push(mission);
  });

  const missionIds = new Set(missions.map((mission) => mission.id));
  const completionsRaw = Array.isArray(source.completions) ? source.completions : [];
  const completionsByKey = new Map<string, Completion>();
  for (const entry of completionsRaw) {
    const completion = normalizeCompletion(entry, missionIds);
    if (!completion) continue;
    const dedupeKey = `${completion.missionId}|${completion.periodType}|${completion.periodKey}`;
    const existing = completionsByKey.get(dedupeKey);
    if (!existing || completion.count > existing.count) completionsByKey.set(dedupeKey, completion);
  }

  return {
    schemaVersion: APP_DATA_VERSION,
    games: games.sort((a, b) => a.sortOrder - b.sortOrder),
    missions,
    completions: [...completionsByKey.values()],
    settings: normalizeSettings(source.settings),
    updatedAt: asString(source.updatedAt, new Date().toISOString()),
  };
}

/** Tamaño aproximado del JSON, para avisar del límite de localStorage. */
export function estimateSize(data: AppData): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return JSON.stringify(data).length;
  }
}
