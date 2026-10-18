/**
 * Claves de periodo: la pieza central del seguimiento.
 *
 * Cada misión se marca dentro de un "periodo" (día o semana) identificado por
 * una clave estable. El periodo se calcula desplazando la hora de pared del
 * servidor del juego por su hora de reset:
 *
 *   - una diaria con reset a las 04:00 marcada a las 02:30 pertenece al día anterior;
 *   - una semanal con reset el lunes (cualquier hora) pertenece a esa semana.
 *
 * Por eso cada juego guarda su propia zona horaria, su hora de reset diario y
 * su día + hora de reset semanal.
 */
import type { Game, MissionType } from '../models/models';
import { DAY_MS, MINUTE_MS, addWallDays, parseTime, wallClock, type WallDate, zonedTimeToUtc } from './time';

const WEEKDAY_INDEX_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** ms (interpretado como UTC) → "2026-10-18". */
export function isoDateFromMs(timestampMs: number): string {
  const date = new Date(timestampMs);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function isoDateFromWall(date: WallDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

/** Fecha de pared de una clave diaria: "2026-10-18" → WallDate. */
export function wallDateFromKey(key: string): WallDate {
  const [year, month, day] = key.split('-').map((part) => Number.parseInt(part, 10));
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
}

/* -------------------------------------------------------------------------- */
/* Semanas ISO                                                                */
/* -------------------------------------------------------------------------- */

/** Semana ISO (lunes-domingo) y año ISO de una fecha de pared expresada en ms UTC. */
export function isoWeekOf(timestampMs: number): { year: number; week: number } {
  const date = new Date(timestampMs);
  const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (thursday.getUTCDay() + 6) % 7; // lunes = 0
  thursday.setUTCDate(thursday.getUTCDate() - dayNumber + 3);

  const isoYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);

  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return { year: isoYear, week };
}

export function isoWeekKeyOf(timestampMs: number): string {
  const { year, week } = isoWeekOf(timestampMs);
  return `${year}-W${pad(week)}`;
}

/** Lunes (en ms UTC) de una semana ISO concreta. */
export function isoWeekStartMs(isoYear: number, week: number): number {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const dayNumber = (jan4.getUTCDay() + 6) % 7;
  jan4.setUTCDate(jan4.getUTCDate() - dayNumber);
  jan4.setUTCDate(jan4.getUTCDate() + (week - 1) * 7);
  return jan4.getTime();
}

export function parseWeekKey(key: string): { year: number; week: number } {
  const [rawYear, rawWeek] = key.split('-W');
  return {
    year: Number.parseInt(rawYear ?? '1970', 10),
    week: Number.parseInt(rawWeek ?? '1', 10),
  };
}

/* -------------------------------------------------------------------------- */
/* Periodos por juego                                                         */
/* -------------------------------------------------------------------------- */

/** Fecha de pared del servidor desplazada por la hora de reset. */
function shiftedWallMs(game: Game, nowMs: number, resetMinutes: number): number {
  const wall = wallClock(nowMs, game.timezone);
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute) - resetMinutes * MINUTE_MS;
}

/** Clave del periodo diario activo: "2026-10-18". */
export function dailyPeriodKey(game: Game, nowMs: number): string {
  return isoDateFromMs(shiftedWallMs(game, nowMs, parseTime(game.dailyResetTime)));
}

/** Clave del periodo semanal activo: "2026-W42". */
export function weeklyPeriodKey(game: Game, nowMs: number): string {
  const resetMinutes = parseTime(game.weeklyResetTime);
  const shifted = shiftedWallMs(game, nowMs, resetMinutes);
  const weekday = new Date(shifted).getUTCDay();
  const resetDay = ((Math.round(game.weeklyResetDay) % 7) + 7) % 7;
  const delta = (weekday - resetDay + 7) % 7;
  return isoWeekKeyOf(shifted - delta * DAY_MS);
}

export function periodKey(type: MissionType, game: Game, nowMs: number): string {
  return type === 'daily' ? dailyPeriodKey(game, nowMs) : weeklyPeriodKey(game, nowMs);
}

export function periodKeys(game: Game, nowMs: number): Record<MissionType, string> {
  return {
    daily: dailyPeriodKey(game, nowMs),
    weekly: weeklyPeriodKey(game, nowMs),
  };
}

/** Clave del periodo anterior, usada para recorrer rachas. */
export function previousPeriodKey(type: MissionType, key: string): string {
  if (type === 'daily') {
    const date = wallDateFromKey(key);
    const previous = addWallDays(date, -1);
    return isoDateFromWall(previous);
  }
  const { year, week } = parseWeekKey(key);
  const monday = isoWeekStartMs(year, week);
  return isoWeekKeyOf(monday - 7 * DAY_MS);
}

/** Índice ordinal (días desde epoch) del inicio de un periodo; sirve para medir rachas. */
export function periodOrdinal(type: MissionType, key: string): number {
  if (type === 'daily') {
    const date = wallDateFromKey(key);
    return Math.round(Date.UTC(date.year, date.month - 1, date.day) / DAY_MS);
  }
  const { year, week } = parseWeekKey(key);
  return Math.round(isoWeekStartMs(year, week) / DAY_MS);
}

/* -------------------------------------------------------------------------- */
/* Próximo reset                                                              */
/* -------------------------------------------------------------------------- */

/** Instante UTC del próximo reset diario del juego. */
export function nextDailyReset(game: Game, nowMs: number): number {
  const resetMinutes = parseTime(game.dailyResetTime);
  const wall = wallClock(nowMs, game.timezone);
  let date: WallDate = { year: wall.year, month: wall.month, day: wall.day };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const candidate = zonedTimeToUtc(
      date.year,
      date.month,
      date.day,
      Math.floor(resetMinutes / 60),
      resetMinutes % 60,
      game.timezone,
    );
    if (candidate > nowMs) return candidate;
    date = addWallDays(date, 1);
  }
  return nowMs + DAY_MS;
}

/** Instante UTC del próximo reset semanal del juego. */
export function nextWeeklyReset(game: Game, nowMs: number): number {
  const resetMinutes = parseTime(game.weeklyResetTime);
  const shifted = shiftedWallMs(game, nowMs, resetMinutes);
  const weekday = new Date(shifted).getUTCDay();
  const resetDay = ((Math.round(game.weeklyResetDay) % 7) + 7) % 7;
  const delta = (weekday - resetDay + 7) % 7;
  const weekStart = new Date(shifted - delta * DAY_MS);
  let date: WallDate = {
    year: weekStart.getUTCFullYear(),
    month: weekStart.getUTCMonth() + 1,
    day: weekStart.getUTCDate(),
  };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    date = addWallDays(date, 7);
    const candidate = zonedTimeToUtc(
      date.year,
      date.month,
      date.day,
      Math.floor(resetMinutes / 60),
      resetMinutes % 60,
      game.timezone,
    );
    if (candidate > nowMs) return candidate;
  }
  return nowMs + 7 * DAY_MS;
}

export function nextResetAt(type: MissionType, game: Game, nowMs: number): number {
  return type === 'daily' ? nextDailyReset(game, nowMs) : nextWeeklyReset(game, nowMs);
}

export function msUntilReset(type: MissionType, game: Game, nowMs: number): number {
  return Math.max(0, nextResetAt(type, game, nowMs) - nowMs);
}

/* -------------------------------------------------------------------------- */
/* Etiquetas y listados                                                       */
/* -------------------------------------------------------------------------- */

/** "18 oct" para una clave diaria; "13 oct – 19 oct" para una semanal. */
export function periodLabel(type: MissionType, key: string): string {
  if (type === 'daily') {
    const date = wallDateFromKey(key);
    return `${date.day} ${MONTHS_ES[(date.month - 1) % 12]}`;
  }
  const { year, week } = parseWeekKey(key);
  const start = new Date(isoWeekStartMs(year, week));
  const end = new Date(start.getTime() + 6 * DAY_MS);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const startLabel = `${start.getUTCDate()} ${MONTHS_ES[start.getUTCMonth()]}`;
  const endLabel = sameMonth
    ? `${end.getUTCDate()} ${MONTHS_ES[end.getUTCMonth()]}`
    : `${end.getUTCDate()} ${MONTHS_ES[end.getUTCMonth()]}`;
  return `${startLabel} – ${endLabel} · S${week}`;
}

export function weekdayLabel(day: number): string {
  return WEEKDAY_INDEX_ES[((Math.round(day) % 7) + 7) % 7] ?? 'lun';
}

/** Últimas `count` claves diarias, de la más antigua a la más reciente. */
export function recentDailyKeys(game: Game, nowMs: number, count: number): string[] {
  const current = dailyPeriodKey(game, nowMs);
  const keys: string[] = [];
  let cursor = current;
  for (let i = 0; i < count; i += 1) {
    keys.push(cursor);
    cursor = previousPeriodKey('daily', cursor);
  }
  return keys.reverse();
}

/** Últimas `count` claves semanales, de la más antigua a la más reciente. */
export function recentWeeklyKeys(game: Game, nowMs: number, count: number): string[] {
  const current = weeklyPeriodKey(game, nowMs);
  const keys: string[] = [];
  let cursor = current;
  for (let i = 0; i < count; i += 1) {
    keys.push(cursor);
    cursor = previousPeriodKey('weekly', cursor);
  }
  return keys.reverse();
}
