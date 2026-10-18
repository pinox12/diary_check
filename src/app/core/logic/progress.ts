/**
 * Vistas derivadas de los datos: progreso por juego, pendientes, estadísticas
 * y rachas. Todo son funciones puras para poder testearlas sin Angular.
 */
import type { AppData, Completion, Game, Mission, MissionType } from '../models/models';
import { isMissionDone } from '../models/models';
import {
  dailyPeriodKey,
  nextDailyReset,
  nextWeeklyReset,
  periodKey,
  periodLabel,
  periodOrdinal,
  recentDailyKeys,
  recentWeeklyKeys,
  weeklyPeriodKey,
} from './period-keys';
import { currentStreak, streakSummary, type StreakSummary } from './streak';

export interface MissionState {
  mission: Mission;
  count: number;
  done: boolean;
}

export interface GameProgress {
  game: Game;
  daily: MissionState[];
  weekly: MissionState[];
  dailyDone: number;
  dailyTotal: number;
  weeklyDone: number;
  weeklyTotal: number;
  pending: number;
  dailyKey: string;
  weeklyKey: string;
  nextDaily: number;
  nextWeekly: number;
}

export interface DayStat {
  key: string;
  label: string;
  done: number;
  total: number;
  rate: number;
}

export function completionKey(missionId: string, periodType: MissionType, key: string): string {
  return `${missionId}|${periodType}|${key}`;
}

/** Índice rápido misión+periodo → progreso, para no recorrer el array entero. */
export function completionIndex(completions: readonly Completion[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const completion of completions) {
    index.set(completionKey(completion.missionId, completion.periodType, completion.periodKey), completion.count);
  }
  return index;
}

export function missionsOfGame(data: AppData, gameId: string, onlyActive = false): Mission[] {
  return data.missions
    .filter((mission) => mission.gameId === gameId && (!onlyActive || mission.active))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

export function gamesSorted(data: AppData, includeArchived = false): Game[] {
  return data.games
    .filter((game) => includeArchived || !game.archived)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'));
}

function state(mission: Mission, index: Map<string, number>, type: MissionType, key: string): MissionState {
  const count = index.get(completionKey(mission.id, type, key)) ?? 0;
  return { mission, count, done: isMissionDone(mission, count) };
}

export function gameProgress(data: AppData, game: Game, nowMs: number): GameProgress {
  return progressWithIndex(data, game, nowMs, completionIndex(data.completions));
}

function progressWithIndex(
  data: AppData,
  game: Game,
  nowMs: number,
  index: Map<string, number>,
): GameProgress {
  const dailyKey = dailyPeriodKey(game, nowMs);
  const weeklyKey = weeklyPeriodKey(game, nowMs);
  const missions = missionsOfGame(data, game.id, true);

  const daily = missions.filter((m) => m.type === 'daily').map((m) => state(m, index, 'daily', dailyKey));
  const weekly = missions.filter((m) => m.type === 'weekly').map((m) => state(m, index, 'weekly', weeklyKey));
  const dailyDone = daily.filter((entry) => entry.done).length;
  const weeklyDone = weekly.filter((entry) => entry.done).length;

  return {
    game,
    daily,
    weekly,
    dailyDone,
    dailyTotal: daily.length,
    weeklyDone,
    weeklyTotal: weekly.length,
    pending: daily.length - dailyDone + (weekly.length - weeklyDone),
    dailyKey,
    weeklyKey,
    nextDaily: nextDailyReset(game, nowMs),
    nextWeekly: nextWeeklyReset(game, nowMs),
  };
}

export function allProgress(data: AppData, nowMs: number, includeArchived = false): GameProgress[] {
  const index = completionIndex(data.completions);
  return gamesSorted(data, includeArchived).map((game) => progressWithIndex(data, game, nowMs, index));
}

export function countPending(data: AppData, nowMs: number): { games: number; missions: number; daily: number; weekly: number } {
  const progress = allProgress(data, nowMs);
  return progress.reduce(
    (acc, entry) => ({
      games: acc.games + (entry.pending > 0 ? 1 : 0),
      missions: acc.missions + entry.pending,
      daily: acc.daily + (entry.dailyTotal - entry.dailyDone),
      weekly: acc.weekly + (entry.weeklyTotal - entry.weeklyDone),
    }),
    { games: 0, missions: 0, daily: 0, weekly: 0 },
  );
}

/** Claves de periodo en las que una misión quedó completada. */
export function completionKeysFor(data: AppData, mission: Mission): Set<string> {
  const keys = new Set<string>();
  for (const completion of data.completions) {
    if (completion.missionId !== mission.id) continue;
    if (isMissionDone(mission, completion.count)) keys.add(completion.periodKey);
  }
  return keys;
}

export function missionStreak(data: AppData, mission: Mission, nowMs: number): StreakSummary {
  const keys = completionKeysFor(data, mission);
  const currentKey = periodKey(mission.type, gameOfMission(data, mission), nowMs);
  return streakSummary(keys, mission.type, currentKey);
}

/**
 * Rachas actuales de todas las misiones en un solo recorrido.
 * Pensado para listados largos (el dashboard se repinta cada segundo).
 */
export function streakMap(data: AppData, nowMs: number): Map<string, number> {
  const missionsById = new Map(data.missions.map((mission) => [mission.id, mission]));
  const keysByMission = new Map<string, Set<string>>();

  for (const completion of data.completions) {
    const mission = missionsById.get(completion.missionId);
    if (!mission || !isMissionDone(mission, completion.count)) continue;
    let keys = keysByMission.get(mission.id);
    if (!keys) {
      keys = new Set<string>();
      keysByMission.set(mission.id, keys);
    }
    keys.add(completion.periodKey);
  }

  const gamesById = new Map(data.games.map((game) => [game.id, game]));
  const streaks = new Map<string, number>();

  for (const mission of data.missions) {
    const keys = keysByMission.get(mission.id);
    if (!keys || keys.size === 0) continue;
    const game = gamesById.get(mission.gameId);
    if (!game) continue;
    const currentKey = periodKey(mission.type, game, nowMs);
    const value = currentStreak(keys, mission.type, currentKey);
    if (value > 0) streaks.set(mission.id, value);
  }

  return streaks;
}

export function gameOfMission(data: AppData, mission: Mission): Game {  const game = data.games.find((candidate) => candidate.id === mission.gameId);
  if (game) return game;
  // Juego eliminado: devolvemos un marcador para no romper los cálculos.
  return {
    id: mission.gameId,
    name: 'Juego eliminado',
    accentColor: '#7c5cff',
    timezone: 'system',
    dailyResetTime: '04:00',
    weeklyResetDay: 1,
    weeklyResetTime: '04:00',
    archived: true,
    sortOrder: 0,
    createdAt: new Date(0).toISOString(),
  };
}

/** Serie diaria de cumplimiento para un juego (para el heatmap). */
export function dailyStats(data: AppData, game: Game, nowMs: number, days: number): DayStat[] {
  const index = completionIndex(data.completions);
  const missions = missionsOfGame(data, game.id, true).filter((m) => m.type === 'daily');
  // Una misión creada hoy no debería contar como fallada en días anteriores.
  const bornKey = new Map(missions.map((mission) => [mission.id, dailyPeriodKey(game, createdAtMs(mission))]));

  return recentDailyKeys(game, nowMs, days).map((key) => {
    const applicable = missions.filter((mission) => (bornKey.get(mission.id) ?? key) <= key);
    const done = applicable.filter((mission) => {
      const count = index.get(completionKey(mission.id, 'daily', key)) ?? 0;
      return isMissionDone(mission, count);
    }).length;
    return {
      key,
      label: periodLabel('daily', key),
      done,
      total: applicable.length,
      rate: applicable.length === 0 ? 0 : done / applicable.length,
    };
  });
}

/** Serie semanal de cumplimiento para un juego. */
export function weeklyStats(data: AppData, game: Game, nowMs: number, weeks: number): DayStat[] {
  const index = completionIndex(data.completions);
  const missions = missionsOfGame(data, game.id, true).filter((m) => m.type === 'weekly');
  const bornOrdinal = new Map(
    missions.map((mission) => [
      mission.id,
      periodOrdinal('weekly', weeklyPeriodKey(game, createdAtMs(mission))),
    ]),
  );

  return recentWeeklyKeys(game, nowMs, weeks).map((key) => {
    const ordinal = periodOrdinal('weekly', key);
    const applicable = missions.filter((mission) => (bornOrdinal.get(mission.id) ?? ordinal) <= ordinal);
    const done = applicable.filter((mission) => {
      const count = index.get(completionKey(mission.id, 'weekly', key)) ?? 0;
      return isMissionDone(mission, count);
    }).length;
    return {
      key,
      label: periodLabel('weekly', key),
      done,
      total: applicable.length,
      rate: applicable.length === 0 ? 0 : done / applicable.length,
    };
  });
}

function createdAtMs(mission: Mission): number {
  const parsed = Date.parse(mission.createdAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface GlobalStats {  games: number;
  missions: number;
  completions: number;
  dailyRate: number;
  weeklyRate: number;
  averageDailyCompletion: number;
}

/** Resumen global de los últimos `days` días. */
export function globalStats(data: AppData, nowMs: number, days = 30): GlobalStats {
  const games = gamesSorted(data);
  const stats = games.map((game) => dailyStats(data, game, nowMs, days));
  const totalRate = stats.reduce((acc, series) => {
    const values = series.filter((entry) => entry.total > 0);
    if (values.length === 0) return acc;
    return acc + values.reduce((sum, entry) => sum + entry.rate, 0) / values.length;
  }, 0);

  const weekly = games.map((game) => weeklyStats(data, game, nowMs, 12));
  const totalWeeklyRate = weekly.reduce((acc, series) => {
    const values = series.filter((entry) => entry.total > 0);
    if (values.length === 0) return acc;
    return acc + values.reduce((sum, entry) => sum + entry.rate, 0) / values.length;
  }, 0);

  const activeMissions = data.missions.filter((mission) => mission.active).length;
  const dailyAverage = stats.reduce((acc, series) => {
    const values = series.filter((entry) => entry.total > 0);
    if (values.length === 0) return acc;
    return acc + values.reduce((sum, entry) => sum + entry.done, 0) / values.length;
  }, 0);

  return {
    games: games.length,
    missions: activeMissions,
    completions: data.completions.length,
    dailyRate: games.length ? totalRate / games.length : 0,
    weeklyRate: games.length ? totalWeeklyRate / games.length : 0,
    averageDailyCompletion: games.length ? dailyAverage / games.length : 0,
  };
}
