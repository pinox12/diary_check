import { describe, expect, it } from 'vitest';
import type { AppData, Game, Mission } from '../models/models';
import { allProgress, completionIndex, countPending, dailyStats, gameProgress, streakMap, weeklyStats } from './progress';

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    name: 'Genshin Impact',
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

function makeMission(id: string, type: Mission['type'], overrides: Partial<Mission> = {}): Mission {
  return {
    id,
    gameId: 'g1',
    title: id,
    type,
    target: 1,
    active: true,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const NOW = Date.parse('2026-10-18T12:00:00Z');

function makeData(): AppData {
  return {
    schemaVersion: 2,
    games: [makeGame()],
    missions: [makeMission('d1', 'daily'), makeMission('d2', 'daily'), makeMission('w1', 'weekly')],
    completions: [
      {
        id: 'c1',
        missionId: 'd1',
        gameId: 'g1',
        periodType: 'daily',
        periodKey: '2026-10-18',
        count: 1,
        completedAt: '2026-10-18T10:00:00.000Z',
      },
      {
        id: 'c2',
        missionId: 'd1',
        gameId: 'g1',
        periodType: 'daily',
        periodKey: '2026-10-17',
        count: 1,
        completedAt: '2026-10-17T10:00:00.000Z',
      },
      {
        id: 'c3',
        missionId: 'd2',
        gameId: 'g1',
        periodType: 'daily',
        periodKey: '2026-10-17',
        count: 1,
        completedAt: '2026-10-17T11:00:00.000Z',
      },
      {
        id: 'c4',
        missionId: 'w1',
        gameId: 'g1',
        periodType: 'weekly',
        periodKey: '2026-W42',
        count: 1,
        completedAt: '2026-10-18T09:00:00.000Z',
      },
    ],
    settings: {
      theme: 'dark',
      locale: 'es',
      notifyEnabled: true,
      notifyLeadMinutes: 60,
      notifySummaryOnOpen: true,
      notifyWeekly: true,
      autoBackup: true,
      historyMonths: 0,
      notifiedKeys: [],
    },
    updatedAt: '2026-10-18T00:00:00.000Z',
  };
}

describe('progreso por juego', () => {
  it('cuenta diarias y semanales completadas del periodo actual', () => {
    const data = makeData();
    const progress = gameProgress(data, data.games[0]!, NOW);
    expect(progress.dailyTotal).toBe(2);
    expect(progress.dailyDone).toBe(1);
    expect(progress.weeklyTotal).toBe(1);
    expect(progress.weeklyDone).toBe(1);
    expect(progress.pending).toBe(1);
    expect(progress.dailyKey).toBe('2026-10-18');
    expect(progress.weeklyKey).toBe('2026-W42');
  });

  it('ignora las misiones pausadas', () => {
    const data = makeData();
    data.missions = data.missions.map((mission) =>
      mission.id === 'd2' ? { ...mission, active: false } : mission,
    );
    const progress = gameProgress(data, data.games[0]!, NOW);
    expect(progress.dailyTotal).toBe(1);
    expect(progress.pending).toBe(0);
  });

  it('respeta el contador de repeticiones', () => {
    const data = makeData();
    data.missions = data.missions.map((mission) => (mission.id === 'd2' ? { ...mission, target: 3 } : mission));
    data.completions.push({
      id: 'c5',
      missionId: 'd2',
      gameId: 'g1',
      periodType: 'daily',
      periodKey: '2026-10-18',
      count: 2,
      completedAt: '2026-10-18T11:00:00.000Z',
    });
    const progress = gameProgress(data, data.games[0]!, NOW);
    const entry = progress.daily.find((item) => item.mission.id === 'd2');
    expect(entry?.count).toBe(2);
    expect(entry?.done).toBe(false);
  });

  it('resume los pendientes globales', () => {
    const data = makeData();
    const summary = countPending(data, NOW);
    expect(summary.missions).toBe(1);
    expect(summary.games).toBe(1);
    expect(summary.daily).toBe(1);
    expect(summary.weekly).toBe(0);
  });

  it('ordenado y sin archivados por defecto', () => {
    const data = makeData();
    data.games.push(makeGame({ id: 'g2', name: 'Archivado', archived: true, sortOrder: 1 }));
    expect(allProgress(data, NOW)).toHaveLength(1);
    expect(allProgress(data, NOW, true)).toHaveLength(2);
  });
});

describe('estadísticas e historial', () => {
  it('calcula la serie diaria de los últimos días', () => {
    const data = makeData();
    const stats = dailyStats(data, data.games[0]!, NOW, 3);
    expect(stats.map((entry) => entry.key)).toEqual(['2026-10-16', '2026-10-17', '2026-10-18']);
    expect(stats[1]).toMatchObject({ done: 2, total: 2, rate: 1 });
    expect(stats[2]).toMatchObject({ done: 1, total: 2, rate: 0.5 });
    expect(stats[0]).toMatchObject({ done: 0, total: 2, rate: 0 });
  });

  it('no cuenta misiones que todavía no existían', () => {
    const data = makeData();
    data.missions.push(makeMission('d3', 'daily', { createdAt: '2026-10-18T08:00:00.000Z' }));
    const stats = dailyStats(data, data.games[0]!, NOW, 3);
    expect(stats[0]).toMatchObject({ key: '2026-10-16', total: 2 });
    expect(stats[1]).toMatchObject({ key: '2026-10-17', total: 2 });
    expect(stats[2]).toMatchObject({ key: '2026-10-18', total: 3 });
  });

  it('calcula la serie semanal', () => {    const data = makeData();
    const stats = weeklyStats(data, data.games[0]!, NOW, 2);
    expect(stats.map((entry) => entry.key)).toEqual(['2026-W41', '2026-W42']);
    expect(stats[1]).toMatchObject({ done: 1, total: 1, rate: 1 });
  });

  it('crea un índice de completados por misión y periodo', () => {
    const data = makeData();
    const index = completionIndex(data.completions);
    expect(index.get('d1|daily|2026-10-18')).toBe(1);
    expect(index.get('w1|weekly|2026-W42')).toBe(1);
    expect(index.get('d2|daily|2026-10-18')).toBeUndefined();
  });
});

describe('rachas agregadas', () => {
  it('calcula la racha de cada misión', () => {
    const data = makeData();
    const streaks = streakMap(data, NOW);
    expect(streaks.get('d1')).toBe(2); // 17 y 18 de octubre
    expect(streaks.get('d2')).toBe(1); // solo el 17 (el 18 sigue pendiente)
    expect(streaks.get('w1')).toBe(1);
  });

  it('no cuenta periodos futuros', () => {
    const data = makeData();
    data.completions.push({
      id: 'c6',
      missionId: 'd1',
      gameId: 'g1',
      periodType: 'daily',
      periodKey: '2026-10-20',
      count: 1,
      completedAt: '2026-10-20T10:00:00.000Z',
    });
    const streaks = streakMap(data, NOW);
    expect(streaks.get('d1')).toBe(2);
  });
});
