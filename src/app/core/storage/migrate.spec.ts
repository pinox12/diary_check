import { describe, expect, it } from 'vitest';
import { APP_DATA_VERSION, type AppData } from '../models/models';
import { estimateSize, normalizeAppData } from './migrate';

function baseData(): AppData {
  return {
    schemaVersion: 1,
    games: [
      {
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
      },
    ],
    missions: [
      {
        id: 'm1',
        gameId: 'g1',
        title: 'Diaria',
        type: 'daily',
        target: 1,
        active: true,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    completions: [
      {
        id: 'c1',
        missionId: 'm1',
        gameId: 'g1',
        periodType: 'daily',
        periodKey: '2026-10-18',
        count: 1,
        completedAt: '2026-10-18T10:00:00.000Z',
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
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('normalizeAppData', () => {
  it('devuelve datos vacíos y válidos ante entradas basura', () => {
    for (const input of [null, undefined, 'texto', 42, [], {}]) {
      const data = normalizeAppData(input);
      expect(data.schemaVersion).toBe(APP_DATA_VERSION);
      expect(data.games).toEqual([]);
      expect(data.missions).toEqual([]);
      expect(data.completions).toEqual([]);
      expect(data.settings.theme).toBe('dark');
      expect(data.settings.notifyLeadMinutes).toBe(60);
    }
  });

  it('migra la versión antigua al esquema actual', () => {
    const data = normalizeAppData(baseData());
    expect(data.schemaVersion).toBe(APP_DATA_VERSION);
    expect(data.games).toHaveLength(1);
    expect(data.missions).toHaveLength(1);
    expect(data.missions[0]!.target).toBe(1);
    expect(Array.isArray(data.settings.notifiedKeys)).toBe(true);
  });

  it('descarta misiones sin juego y completados inválidos', () => {
    const raw = baseData();
    raw.missions.push({
      id: 'm2',
      gameId: 'desconocido',
      title: 'Huérfana',
      type: 'daily',
      target: 1,
      active: true,
      sortOrder: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    raw.completions.push({
      id: 'c2',
      missionId: 'm1',
      gameId: 'g1',
      periodType: 'daily',
      periodKey: 'ayer',
      count: 1,
      completedAt: '2026-10-18T10:00:00.000Z',
    });
    raw.completions.push({
      id: 'c3',
      missionId: 'm1',
      gameId: 'g1',
      periodType: 'daily',
      periodKey: '2026-10-17',
      count: 0,
      completedAt: '2026-10-17T10:00:00.000Z',
    });

    const data = normalizeAppData(raw);
    expect(data.missions.map((mission) => mission.id)).toEqual(['m1']);
    expect(data.completions.map((completion) => completion.id)).toEqual(['c1']);
  });

  it('no duplica registros del mismo periodo y conserva el progreso mayor', () => {
    const raw = baseData();
    raw.completions.push({
      id: 'c-dup',
      missionId: 'm1',
      gameId: 'g1',
      periodType: 'daily',
      periodKey: '2026-10-18',
      count: 3,
      completedAt: '2026-10-18T20:00:00.000Z',
    });
    const data = normalizeAppData(raw);
    expect(data.completions).toHaveLength(1);
    expect(data.completions[0]!.count).toBe(3);
  });

  it('sanea ajustes fuera de rango', () => {
    const raw = baseData();
    const settings = raw.settings as unknown as Record<string, unknown>;
    settings['notifyLeadMinutes'] = 99_999;
    settings['theme'] = 'arcoiris';
    settings['notifiedKeys'] = ['a', 'a', 5, null];

    const data = normalizeAppData(raw);
    expect(data.settings.notifyLeadMinutes).toBe(1440);
    expect(data.settings.theme).toBe('dark');
    expect(data.settings.notifiedKeys).toEqual(['a']);
  });

  it('corrige identificadores duplicados', () => {
    const raw = baseData();
    raw.games.push({ ...raw.games[0]! });
    const data = normalizeAppData(raw);
    expect(data.games).toHaveLength(2);
    expect(new Set(data.games.map((game) => game.id)).size).toBe(2);
  });

  it('estima el tamaño del JSON', () => {
    expect(estimateSize(baseData())).toBeGreaterThan(100);
  });
});
