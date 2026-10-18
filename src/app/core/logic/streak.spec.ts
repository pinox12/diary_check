import { describe, expect, it } from 'vitest';
import { currentStreak, longestStreak, streakSummary } from './streak';

describe('rachas', () => {
  it('cuenta periodos diarios consecutivos', () => {
    const keys = new Set(['2026-10-16', '2026-10-17', '2026-10-18']);
    expect(currentStreak(keys, 'daily', '2026-10-18')).toBe(3);
  });

  it('no rompe la racha si el periodo actual aún no está marcado', () => {
    const keys = new Set(['2026-10-16', '2026-10-17']);
    expect(currentStreak(keys, 'daily', '2026-10-18')).toBe(2);
  });

  it('se corta cuando hay un hueco', () => {
    const keys = new Set(['2026-10-14', '2026-10-17', '2026-10-18']);
    expect(currentStreak(keys, 'daily', '2026-10-18')).toBe(2);
  });

  it('devuelve 0 sin marcas', () => {
    expect(currentStreak(new Set(), 'daily', '2026-10-18')).toBe(0);
    expect(currentStreak(new Set(['2026-10-10']), 'daily', '2026-10-18')).toBe(0);
  });

  it('funciona con semanas consecutivas', () => {
    const keys = new Set(['2026-W40', '2026-W41', '2026-W42']);
    expect(currentStreak(keys, 'weekly', '2026-W42')).toBe(3);
    expect(currentStreak(keys, 'weekly', '2026-W43')).toBe(3);
  });

  it('no mezcla días sueltos con semanas', () => {
    const keys = new Set(['2026-10-11', '2026-10-18']);
    expect(currentStreak(keys, 'daily', '2026-10-18')).toBe(1);
  });

  it('encuentra la racha más larga aunque haya huecos', () => {
    const keys = new Set([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-10',
      '2026-09-11',
    ]);
    expect(longestStreak(keys, 'daily')).toBe(4);
  });

  it('resume racha actual, máxima y total', () => {
    const keys = new Set(['2026-10-17', '2026-10-18', '2026-10-01', '2026-10-02', '2026-10-03']);
    const summary = streakSummary(keys, 'daily', '2026-10-18');
    expect(summary.current).toBe(2);
    expect(summary.longest).toBe(3);
    expect(summary.total).toBe(5);
  });
});
