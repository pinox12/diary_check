import { Injectable, inject, signal } from '@angular/core';
import {
  emptyAppData,
  isMissionDone,
  uid,
  type AppData,
  type Game,
  type Mission,
  type MissionType,
  type Settings,
} from '../models/models';
import { completionIndex, completionKey, missionsOfGame } from '../logic/progress';
import { periodKey } from '../logic/period-keys';
import { normalizeAppData } from '../storage/migrate';
import { PlatformService } from '../platform/platform.service';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface NewGameInput {
  name: string;
  cover?: string;
  accentColor: string;
  timezone: string;
  dailyResetTime: string;
  weeklyResetDay: number;
  weeklyResetTime: string;
  notes?: string;
}

export interface NewMissionInput {
  gameId: string;
  title: string;
  description?: string;
  type: MissionType;
  target?: number;
}

const SAVE_DEBOUNCE_MS = 400;

/**
 * Fuente única de verdad de la aplicación.
 *
 * Mantiene el AppData en un signal, expone vistas derivadas y guarda solo
 * (con debounce) en cuanto algo cambia.
 */
@Injectable({ providedIn: 'root' })
export class DataStore {
  private readonly platform = inject(PlatformService);
  private readonly stateSignal = signal<AppData>(emptyAppData());
  private readonly readySignal = signal(false);
  private readonly loadErrorSignal = signal<string | null>(null);
  private readonly saveStatusSignal = signal<SaveStatus>('idle');
  private readonly saveErrorSignal = signal<string | null>(null);
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  readonly data = this.stateSignal.asReadonly();
  readonly ready = this.readySignal.asReadonly();
  readonly loadError = this.loadErrorSignal.asReadonly();
  readonly saveStatus = this.saveStatusSignal.asReadonly();
  readonly saveError = this.saveErrorSignal.asReadonly();

  constructor() {
    void this.load();
    if (typeof window !== 'undefined') {
      const flush = () => void this.flush();
      window.addEventListener('pagehide', flush);
      window.addEventListener('beforeunload', flush);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
      });
    }
  }

  /* ----------------------------- carga y guardado ---------------------------- */

  private async load(): Promise<void> {
    try {
      const raw = await this.platform.load();
      this.stateSignal.set(normalizeAppData(raw));
      this.applyTheme(this.stateSignal().settings.theme);
    } catch (error) {
      this.loadErrorSignal.set(error instanceof Error ? error.message : 'No se pudieron leer tus datos');
      this.stateSignal.set(emptyAppData());
    } finally {
      this.readySignal.set(true);
    }
  }

  /** Fuerza el guardado inmediato (por ejemplo antes de salir). */
  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.persist();
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.persist();
    }, SAVE_DEBOUNCE_MS);
  }

  private async persist(): Promise<void> {
    this.saveStatusSignal.set('saving');
    try {
      await this.platform.save(this.stateSignal());
      this.saveStatusSignal.set('saved');
      this.saveErrorSignal.set(null);
    } catch (error) {
      this.saveStatusSignal.set('error');
      this.saveErrorSignal.set(error instanceof Error ? error.message : 'No se pudieron guardar los cambios');
    }
  }

  private commit(mutator: (data: AppData) => AppData): void {
    this.stateSignal.update((current) => ({
      ...mutator(current),
      schemaVersion: current.schemaVersion,
      updatedAt: new Date().toISOString(),
    }));
    this.scheduleSave();
  }

  /* --------------------------------- consultas ------------------------------- */

  gameById(id: string | null | undefined): Game | undefined {
    if (!id) return undefined;
    return this.stateSignal().games.find((game) => game.id === id);
  }

  missionById(id: string | null | undefined): Mission | undefined {
    if (!id) return undefined;
    return this.stateSignal().missions.find((mission) => mission.id === id);
  }

  missionsForGame(gameId: string, onlyActive = false): Mission[] {
    return missionsOfGame(this.stateSignal(), gameId, onlyActive);
  }

  completionCount(mission: Mission, key: string, nowMs = Date.now()): number {
    const game = this.gameById(mission.gameId);
    if (!game) return 0;
    const currentKey = key || periodKey(mission.type, game, nowMs);
    const index = completionIndex(this.stateSignal().completions);
    return index.get(completionKey(mission.id, mission.type, currentKey)) ?? 0;
  }

  /* ----------------------------------- juegos -------------------------------- */

  addGame(input: NewGameInput): Game {
    const now = new Date().toISOString();
    const games = this.stateSignal().games;
    const game: Game = {
      id: uid(),
      name: input.name.trim(),
      cover: input.cover,
      accentColor: input.accentColor,
      timezone: input.timezone,
      dailyResetTime: input.dailyResetTime,
      weeklyResetDay: input.weeklyResetDay,
      weeklyResetTime: input.weeklyResetTime,
      notes: input.notes?.trim() || undefined,
      archived: false,
      sortOrder: games.length ? Math.max(...games.map((entry) => entry.sortOrder)) + 1 : 0,
      createdAt: now,
    };
    this.commit((data) => ({ ...data, games: [...data.games, game] }));
    return game;
  }

  updateGame(id: string, patch: Partial<NewGameInput> & { archived?: boolean }): void {
    this.commit((data) => ({
      ...data,
      games: data.games.map((game) =>
        game.id === id
          ? {
              ...game,
              ...patch,
              name: patch.name !== undefined ? patch.name.trim() : game.name,
              notes: patch.notes !== undefined ? patch.notes.trim() || undefined : game.notes,
            }
          : game,
      ),
    }));
  }

  removeGame(id: string): void {
    this.commit((data) => ({
      ...data,
      games: data.games.filter((game) => game.id !== id),
      missions: data.missions.filter((mission) => mission.gameId !== id),
      completions: data.completions.filter((completion) => completion.gameId !== id),
    }));
  }

  /** Mueve un juego arriba (-1) o abajo (+1) en el orden del panel. */
  moveGame(id: string, direction: -1 | 1): void {
    this.commit((data) => {
      const games = [...data.games].sort((a, b) => a.sortOrder - b.sortOrder);
      const index = games.findIndex((game) => game.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= games.length) return data;
      const current = games[index]!;
      const neighbour = games[target]!;
      return {
        ...data,
        games: data.games.map((game) => {
          if (game.id === current.id) return { ...game, sortOrder: neighbour.sortOrder };
          if (game.id === neighbour.id) return { ...game, sortOrder: current.sortOrder };
          return game;
        }),
      };
    });
  }

  /* ---------------------------------- misiones -------------------------------- */

  addMission(input: NewMissionInput): Mission {
    const now = new Date().toISOString();
    const siblings = this.stateSignal().missions.filter(
      (mission) => mission.gameId === input.gameId && mission.type === input.type,
    );
    const mission: Mission = {
      id: uid(),
      gameId: input.gameId,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      type: input.type,
      target: Math.max(1, Math.round(input.target ?? 1)),
      active: true,
      sortOrder: siblings.length ? Math.max(...siblings.map((entry) => entry.sortOrder)) + 1 : 0,
      createdAt: now,
    };
    this.commit((data) => ({ ...data, missions: [...data.missions, mission] }));
    return mission;
  }

  updateMission(id: string, patch: Partial<Pick<Mission, 'title' | 'description' | 'type' | 'target' | 'active'>>): void {
    this.commit((data) => ({
      ...data,
      missions: data.missions.map((mission) =>
        mission.id === id
          ? {
              ...mission,
              ...patch,
              title: patch.title !== undefined ? patch.title.trim() : mission.title,
              description:
                patch.description !== undefined ? patch.description.trim() || undefined : mission.description,
            }
          : mission,
      ),
    }));
  }

  removeMission(id: string): void {
    this.commit((data) => ({
      ...data,
      missions: data.missions.filter((mission) => mission.id !== id),
      completions: data.completions.filter((completion) => completion.missionId !== id),
    }));
  }

  moveMission(id: string, direction: -1 | 1): void {
    this.commit((data) => {
      const mission = data.missions.find((entry) => entry.id === id);
      if (!mission) return data;
      const siblings = data.missions
        .filter((entry) => entry.gameId === mission.gameId && entry.type === mission.type)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const index = siblings.findIndex((entry) => entry.id === id);
      const target = index + direction;
      if (target < 0 || target >= siblings.length) return data;
      const neighbour = siblings[target]!;
      return {
        ...data,
        missions: data.missions.map((entry) => {
          if (entry.id === mission.id) return { ...entry, sortOrder: neighbour.sortOrder };
          if (entry.id === neighbour.id) return { ...entry, sortOrder: mission.sortOrder };
          return entry;
        }),
      };
    });
  }

  /* -------------------------------- progreso --------------------------------- */

  /** Ajusta el progreso de una misión en el periodo actual. */
  setMissionProgress(mission: Mission, count: number, nowMs = Date.now()): number {
    const game = this.gameById(mission.gameId);
    if (!game) return 0;
    const key = periodKey(mission.type, game, nowMs);
    const clamped = Math.max(0, Math.min(999, Math.round(count)));
    this.commit((data) => {
      const rest = data.completions.filter(
        (completion) =>
          !(completion.missionId === mission.id && completion.periodType === mission.type && completion.periodKey === key),
      );
      if (clamped === 0) return { ...data, completions: rest };
      return {
        ...data,
        completions: [
          ...rest,
          {
            id: uid(),
            missionId: mission.id,
            gameId: mission.gameId,
            periodType: mission.type,
            periodKey: key,
            count: clamped,
            completedAt: new Date(nowMs).toISOString(),
          },
        ],
      };
    });
    return clamped;
  }

  toggleMission(mission: Mission, nowMs = Date.now()): number {
    const current = this.completionCount(mission, '', nowMs);
    const next = isMissionDone(mission, current) ? 0 : Math.max(1, mission.target);
    return this.setMissionProgress(mission, next, nowMs);
  }

  /** Marca (o desmarca) todas las misiones de un juego en el periodo actual. */
  setGameComplete(gameId: string, type: MissionType, done: boolean, nowMs = Date.now()): void {
    const game = this.gameById(gameId);
    if (!game) return;
    const missions = this.missionsForGame(gameId, true).filter((mission) => mission.type === type);
    for (const mission of missions) {
      const current = this.completionCount(mission, '', nowMs);
      if (done && !isMissionDone(mission, current)) this.setMissionProgress(mission, mission.target, nowMs);
      if (!done && current > 0) this.setMissionProgress(mission, 0, nowMs);
    }
  }

  /* --------------------------------- ajustes --------------------------------- */

  updateSettings(patch: Partial<Settings>): void {
    this.commit((data) => ({ ...data, settings: { ...data.settings, ...patch } }));
    if (patch.theme) this.applyTheme(patch.theme);
  }

  applyTheme(theme: Settings['theme']): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('theme-light', theme === 'light');
    root.classList.toggle('theme-dark', theme === 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f2f4f9' : '#0a0c11');
  }

  /** Registra avisos ya enviados para no repetirlos. */
  markNotified(keys: string[]): void {
    if (keys.length === 0) return;
    this.commit((data) => ({
      ...data,
      settings: {
        ...data.settings,
        notifiedKeys: [...new Set([...data.settings.notifiedKeys, ...keys])].slice(-400),
      },
    }));
  }

  /* ------------------------------- datos globales ----------------------------- */

  async exportData(): Promise<{ ok: boolean; message: string }> {
    await this.flush();
    const stamp = new Date().toISOString().slice(0, 10);
    const result = await this.platform.exportFile(this.stateSignal(), `diary-check-${stamp}.json`);
    if (result.canceled) return { ok: false, message: 'Exportación cancelada' };
    if (!result.ok) return { ok: false, message: result.error ?? 'No se pudo exportar' };
    return { ok: true, message: `Datos exportados${result.path ? ` en ${result.path}` : ''}` };
  }

  async importData(): Promise<{ ok: boolean; message: string }> {
    const result = await this.platform.importFile();
    if (result.canceled) return { ok: false, message: 'Importación cancelada' };
    if (!result.ok) return { ok: false, message: result.error ?? 'No se pudo leer el archivo' };
    this.replaceAll(normalizeAppData(result.data));
    await this.flush();
    return { ok: true, message: `Datos importados${result.path ? ` desde ${result.path}` : ''}` };
  }

  replaceAll(data: AppData): void {
    this.stateSignal.set(normalizeAppData(data));
    this.applyTheme(this.stateSignal().settings.theme);
    this.scheduleSave();
  }

  resetAll(): void {
    const theme = this.stateSignal().settings.theme;
    const fresh = emptyAppData();
    fresh.settings.theme = theme;
    this.stateSignal.set(fresh);
    this.scheduleSave();
  }

  /** Borra el historial anterior a `months` meses (0 = conservar todo). */
  pruneHistory(months: number): number {
    if (months <= 0) return 0;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    let removed = 0;
    this.commit((data) => {
      const completions = data.completions.filter((completion) => {
        const comparable = completion.periodKey.slice(0, 10);
        const keep = comparable >= cutoffKey;
        if (!keep) removed += 1;
        return keep;
      });
      return removed > 0 ? { ...data, completions } : data;
    });
    return removed;
  }
}
