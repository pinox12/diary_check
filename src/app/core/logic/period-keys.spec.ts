import { describe, expect, it } from 'vitest';
import {
  dailyPeriodKey,
  isoWeekKeyOf,
  nextDailyReset,
  nextWeeklyReset,
  periodOrdinal,
  periodLabel,
  previousPeriodKey,
  recentDailyKeys,
  weeklyPeriodKey,
} from './period-keys';
import { wallClock } from './time';
import type { Game } from '../models/models';

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'game',
    name: 'Test',
    accentColor: '#7c5cff',
    timezone: 'UTC',
    dailyResetTime: '04:00',
    weeklyResetDay: 1,
    weeklyResetTime: '04:00',
    archived: false,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const at = (iso: string): number => Date.parse(iso);

describe('periodo diario', () => {
  it('antes del reset sigue perteneciendo al día anterior', () => {
    const game = makeGame({ dailyResetTime: '04:00' });
    expect(dailyPeriodKey(game, at('2026-10-18T02:30:00Z'))).toBe('2026-10-17');
    expect(dailyPeriodKey(game, at('2026-10-18T03:59:00Z'))).toBe('2026-10-17');
  });

  it('justo en el reset empieza el día nuevo', () => {
    const game = makeGame({ dailyResetTime: '04:00' });
    expect(dailyPeriodKey(game, at('2026-10-18T04:00:00Z'))).toBe('2026-10-18');
    expect(dailyPeriodKey(game, at('2026-10-18T23:59:00Z'))).toBe('2026-10-18');
  });

  it('con reset a medianoche el día cambia a las 00:00', () => {
    const game = makeGame({ dailyResetTime: '00:00' });
    expect(dailyPeriodKey(game, at('2026-10-17T23:59:00Z'))).toBe('2026-10-17');
    expect(dailyPeriodKey(game, at('2026-10-18T00:00:00Z'))).toBe('2026-10-18');
  });

  it('respeta la zona horaria del servidor', () => {
    // Tokio es UTC+9 sin horario de verano.
    const game = makeGame({ timezone: 'Asia/Tokyo', dailyResetTime: '04:00' });
    // 2026-10-19T03:00 en Tokio (aún no ha reiniciado)
    expect(dailyPeriodKey(game, at('2026-10-18T18:00:00Z'))).toBe('2026-10-18');
    // 2026-10-19T05:00 en Tokio (ya reinició)
    expect(dailyPeriodKey(game, at('2026-10-18T20:00:00Z'))).toBe('2026-10-19');
  });

  it('encadena periodos consecutivos con previousPeriodKey', () => {
    expect(previousPeriodKey('daily', '2026-10-18')).toBe('2026-10-17');
    expect(previousPeriodKey('daily', '2026-01-01')).toBe('2025-12-31');
    expect(previousPeriodKey('daily', '2026-03-01')).toBe('2026-02-28');
  });

  it('lista los últimos días terminando en el periodo actual', () => {
    const game = makeGame({ dailyResetTime: '04:00' });
    const keys = recentDailyKeys(game, at('2026-10-18T10:00:00Z'), 3);
    expect(keys).toEqual(['2026-10-16', '2026-10-17', '2026-10-18']);
  });
});

describe('periodo semanal', () => {
  it('usa la semana ISO anclada al día de reset (lunes 04:00)', () => {
    const game = makeGame({ weeklyResetDay: 1, weeklyResetTime: '04:00' });
    // Domingo por la noche: sigue siendo la semana que empezó el lunes 12.
    expect(weeklyPeriodKey(game, at('2026-10-18T20:00:00Z'))).toBe('2026-W42');
    // Lunes 03:00: todavía no ha reiniciado.
    expect(weeklyPeriodKey(game, at('2026-10-19T03:00:00Z'))).toBe('2026-W42');
    // Lunes 05:00: semana nueva.
    expect(weeklyPeriodKey(game, at('2026-10-19T05:00:00Z'))).toBe('2026-W43');
  });

  it('permite que cada juego reinicie en un día distinto', () => {
    const wednesday = makeGame({ weeklyResetDay: 3, weeklyResetTime: '00:00' });
    expect(weeklyPeriodKey(wednesday, at('2026-10-13T12:00:00Z'))).toBe('2026-W41');
    expect(weeklyPeriodKey(wednesday, at('2026-10-14T12:00:00Z'))).toBe('2026-W42');
  });

  it('calcula bien la semana ISO a caballo de año', () => {
    // El 29/12/2025 es el lunes de la semana 1 de 2026.
    expect(isoWeekKeyOf(at('2025-12-29T00:00:00Z'))).toBe('2026-W01');
    expect(previousPeriodKey('weekly', '2026-W01')).toBe('2025-W52');
    expect(previousPeriodKey('weekly', '2026-W42')).toBe('2026-W41');
  });

  it('etiqueta el rango de la semana', () => {
    expect(periodLabel('weekly', '2026-W42')).toContain('S42');
    expect(periodLabel('daily', '2026-10-18')).toBe('18 oct');
  });
});

describe('próximo reset', () => {
  it('devuelve el reset diario siguiente', () => {
    const game = makeGame({ dailyResetTime: '04:00' });
    expect(nextDailyReset(game, at('2026-10-18T05:00:00Z'))).toBe(at('2026-10-19T04:00:00Z'));
    expect(nextDailyReset(game, at('2026-10-18T03:00:00Z'))).toBe(at('2026-10-18T04:00:00Z'));
  });

  it('nunca devuelve el instante actual', () => {
    const game = makeGame({ dailyResetTime: '04:00' });
    const now = at('2026-10-18T04:00:00Z');
    expect(nextDailyReset(game, now)).toBeGreaterThan(now);
  });

  it('devuelve el reset semanal siguiente', () => {
    const game = makeGame({ weeklyResetDay: 1, weeklyResetTime: '04:00' });
    expect(nextWeeklyReset(game, at('2026-10-18T20:00:00Z'))).toBe(at('2026-10-19T04:00:00Z'));
    expect(nextWeeklyReset(game, at('2026-10-19T10:00:00Z'))).toBe(at('2026-10-26T04:00:00Z'));
  });

  it('mantiene la hora de pared con cambios de horario de verano', () => {
    const zones = ['Europe/Madrid', 'America/Santiago', 'America/New_York', 'Australia/Sydney'];
    for (const timezone of zones) {
      const game = makeGame({ timezone, dailyResetTime: '04:00', weeklyResetTime: '04:00' });
      for (let step = 0; step < 500; step += 1) {
        const now = at('2026-01-01T00:00:00Z') + step * 12 * 60 * 60 * 1000;
        const daily = nextDailyReset(game, now);
        const dailyWall = wallClock(daily, timezone);
        expect({ hour: dailyWall.hour, minute: dailyWall.minute }).toEqual({ hour: 4, minute: 0 });
        expect(daily).toBeGreaterThan(now);

        const weekly = nextWeeklyReset(game, now);
        const weeklyWall = wallClock(weekly, timezone);
        expect({ hour: weeklyWall.hour, minute: weeklyWall.minute }).toEqual({ hour: 4, minute: 0 });
        expect(weekly).toBeGreaterThan(now);
      }
    }
  });
});

describe('ordinales de periodo', () => {
  it('avanza un día por periodo diario y siete por semanal', () => {
    expect(periodOrdinal('daily', '2026-10-19') - periodOrdinal('daily', '2026-10-18')).toBe(1);
    expect(periodOrdinal('weekly', '2026-W43') - periodOrdinal('weekly', '2026-W42')).toBe(7);
  });
});
