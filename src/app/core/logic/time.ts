/**
 * Utilidades de tiempo y zonas horarias.
 *
 * Regla de oro del proyecto: los resets se calculan siempre con "hora de
 * pared" (wall clock) del servidor del juego, nunca con diferencias de UTC
 * fijas. Así un reset a las 04:00 lo es aunque el servidor cambie de horario
 * de verano.
 */

export const SECOND_MS = 1_000;
export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export interface WallClock {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
  /** 0-23 */
  hour: number;
  /** 0-59 */
  minute: number;
  /** 0 = domingo … 6 = sábado */
  weekday: number;
}

export interface WallDate {
  year: number;
  month: number;
  day: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  const key = timezone || 'UTC';
  const cached = formatterCache.get(key);
  if (cached) return cached;

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: key,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  formatterCache.set(key, formatter);
  return formatter;
}

/** Zona horaria del equipo; se usa como valor por defecto al crear un juego. */
export function systemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Lista de zonas horarias disponibles en el navegador. */
export function timezoneList(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  try {
    const values = intl.supportedValuesOf?.('timeZone');
    if (values?.length) return ['system', ...values];
  } catch {
    /* sin soporte */
  }
  return ['system', 'UTC'];
}

/** Convierte una zona "system" en la zona real del equipo. */
export function resolveTimezone(timezone: string): string {
  return !timezone || timezone === 'system' ? systemTimezone() : timezone;
}

/** Etiqueta legible de la zona horaria de un juego, para mostrar en la interfaz. */
export function timezoneLabel(timezone: string): string {
  return !timezone || timezone === 'system'
    ? `${systemTimezone()} (equipo)`
    : timezone;
}

/** Descompone un instante UTC en la hora de pared de una zona horaria. */
export function wallClock(timestampMs: number, timezone: string): WallClock {
  const parts = formatterFor(resolveTimezone(timezone)).formatToParts(new Date(timestampMs));
  const pick = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : 0;
  };
  const year = pick('year');
  const month = pick('month');
  const day = pick('day');
  const hour = pick('hour') % 24;
  const minute = pick('minute');
  return { year, month, day, hour, minute, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

/** Diferencia (hora de pared − UTC) en milisegundos para un instante dado. */
function timezoneOffset(timestampMs: number, timezone: string): number {
  const wall = wallClock(timestampMs, timezone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  return asUtc - Math.floor(timestampMs / MINUTE_MS) * MINUTE_MS;
}

/**
 * Convierte una hora de pared de una zona horaria al instante UTC real.
 * Resuelve el offset por iteración (a prueba de cambios de horario de verano).
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): number {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let i = 0; i < 3; i += 1) {
    const next = target - timezoneOffset(guess, timezone);
    if (next === guess) break;
    guess = next;
  }
  return guess;
}

/** Suma días a una fecha de pared (aritmética pura, sin zonas horarias). */
export function addWallDays(date: WallDate, days: number): WallDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function wallDateFromMs(timestampMs: number): WallDate {
  const date = new Date(timestampMs);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** "04:30" → minutos desde medianoche. */
export function parseTime(value: string): number {
  const [rawHour = '0', rawMinute = '0'] = String(value ?? '').split(':');
  const hour = Math.min(23, Math.max(0, Number.parseInt(rawHour, 10) || 0));
  const minute = Math.min(59, Math.max(0, Number.parseInt(rawMinute, 10) || 0));
  return hour * 60 + minute;
}

/** minutos desde medianoche → "04:30". */
export function formatTime(minutes: number): string {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Cuenta atrás compacta: "2 d 03:12:09", "03:12:09", "12:09". */
export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  if (ms <= 0) return 'ahora';
  const totalSeconds = Math.floor(ms / SECOND_MS);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');

  if (days > 0) return `${days} d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** "2 h 15 min" — versión humana para textos. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'ahora';
  const minutes = Math.round(ms / MINUTE_MS);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  const chunks: string[] = [];
  if (days) chunks.push(`${days} d`);
  if (hours) chunks.push(`${hours} h`);
  if (rest && !days) chunks.push(`${rest} min`);
  return chunks.join(' ') || 'menos de 1 min';
}

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(timezone: string): Intl.DateTimeFormat {
  const key = resolveTimezone(timezone);
  const cached = dateFormatterCache.get(key);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('es', {
    timeZone: key,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
     hour: '2-digit',
    minute: '2-digit',
  });
  dateFormatterCache.set(key, formatter);
  return formatter;
}

/** "lun, 18 oct, 04:00 (hora del servidor)". */
export function formatDateTimeInZone(timestampMs: number, timezone: string): string {
  try {
    return dateFormatter(timezone).format(new Date(timestampMs));
  } catch {
    return new Date(timestampMs).toLocaleString('es');
  }
}

/** Fecha corta en la zona indicada: "18 oct". */
export function formatShortDate(timestampMs: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('es', {
      timeZone: resolveTimezone(timezone),
      day: 'numeric',
      month: 'short',
    }).format(new Date(timestampMs));
  } catch {
    return new Date(timestampMs).toLocaleDateString('es');
  }
}
