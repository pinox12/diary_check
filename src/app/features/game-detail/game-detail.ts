import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  dailyStats as computeDailyStats,
  gameProgress,
  missionsOfGame,
  streakMap,
  weeklyStats as computeWeeklyStats,
} from '../../core/logic/progress';
import { periodLabel } from '../../core/logic/period-keys';
import { longestStreak } from '../../core/logic/streak';
import { timezoneLabel } from '../../core/logic/time';
import { weekdayLabel } from '../../core/logic/period-keys';
import { isMissionDone, type Mission, type MissionType } from '../../core/models/models';
import { UiService } from '../../core/services/ui.service';
import { ClockService } from '../../core/state/clock.service';
import { DataStore } from '../../core/state/data.store';
import { CountdownComponent } from '../../shared/countdown/countdown';
import { GameCoverComponent } from '../../shared/game-cover/game-cover';
import { HeatmapComponent } from '../../shared/heatmap/heatmap';
import { IconComponent } from '../../shared/icon/icon';
import { MissionRowComponent } from '../../shared/mission-row/mission-row';
import { ModalComponent } from '../../shared/modal/modal';
import { ProgressBarComponent } from '../../shared/progress-bar/progress-bar';

@Component({
  selector: 'app-game-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    CountdownComponent,
    GameCoverComponent,
    HeatmapComponent,
    IconComponent,
    MissionRowComponent,
    ModalComponent,
    ProgressBarComponent,
  ],
  templateUrl: './game-detail.html',
})
export class GameDetailPage {
  private readonly store = inject(DataStore);
  private readonly clock = inject(ClockService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);

  /** Id del juego de la ruta. El router puede entregarlo como `undefined`. */
  readonly id = input<string | undefined>(undefined);
  protected readonly gameId = computed(() => this.id() ?? '');

  protected readonly weekdayLabel = weekdayLabel;
  protected readonly periodLabel = periodLabel;
  protected readonly zoneLabel = timezoneLabel;

  protected readonly game = computed(() => this.store.gameById(this.gameId()));
  protected readonly progress = computed(() => {
    const game = this.game();
    return game ? gameProgress(this.store.data(), game, this.clock.now()) : null;
  });

  protected readonly missions = computed(() => {
    const game = this.game();
    return game ? missionsOfGame(this.store.data(), game.id, false) : [];
  });

  protected readonly daily = computed(() => this.progress()?.daily ?? []);
  protected readonly weekly = computed(() => this.progress()?.weekly ?? []);

  protected readonly dailyHistory = computed(() => {
    const game = this.game();
    return game ? computeDailyStats(this.store.data(), game, this.clock.slowNow(), 30) : [];
  });

  protected readonly weeklyHistory = computed(() => {
    const game = this.game();
    return game ? computeWeeklyStats(this.store.data(), game, this.clock.slowNow(), 12) : [];
  });

  private readonly streaks = computed(() => streakMap(this.store.data(), this.clock.slowNow()));
  protected readonly bestStreak = computed(() => {
    const values = [...this.streaks().values()];
    return values.length ? Math.max(...values) : 0;
  });

  protected readonly completionRate = computed(() => {
    const entries = this.dailyHistory().filter((entry) => entry.total > 0);
    if (entries.length === 0) return 0;
    return entries.reduce((acc, entry) => acc + entry.rate, 0) / entries.length;
  });

  /* ------------------------------ editor de misión --------------------------- */

  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<Mission | null>(null);
  protected readonly formTitle = signal('');
  protected readonly formDescription = signal('');
  protected readonly formType = signal<MissionType>('daily');
  protected readonly formTarget = signal(1);

  constructor() {
    // Si el juego no existe (por ejemplo tras borrarlo), volvemos al listado.
    effect(() => {
      const id = this.gameId();
      if (!id) return;
      untracked(() => {
        if (this.store.ready() && !this.store.gameById(id)) {
          this.ui.toast('Ese juego ya no existe', 'error');
          void this.router.navigate(['/games']);
        }
      });
    });
  }

  protected streakOf(missionId: string): number {
    return this.streaks().get(missionId) ?? 0;
  }

  protected openCreate(type: MissionType): void {
    this.editing.set(null);
    this.formTitle.set('');
    this.formDescription.set('');
    this.formType.set(type);
    this.formTarget.set(1);
    this.editorOpen.set(true);
  }

  protected openEdit(mission: Mission): void {
    this.editing.set(mission);
    this.formTitle.set(mission.title);
    this.formDescription.set(mission.description ?? '');
    this.formType.set(mission.type);
    this.formTarget.set(mission.target);
    this.editorOpen.set(true);
  }

  protected saveMission(): void {
    const title = this.formTitle().trim();
    if (!title) {
      this.ui.toast('La misión necesita un título', 'error');
      return;
    }
    const existing = this.editing();
    if (existing) {
      this.store.updateMission(existing.id, {
        title,
        description: this.formDescription(),
        type: this.formType(),
        target: this.formTarget(),
      });
      this.ui.toast('Misión actualizada', 'ok');
    } else {
      this.store.addMission({
        gameId: this.gameId(),
        title,
        description: this.formDescription(),
        type: this.formType(),
        target: this.formTarget(),
      });
      this.ui.toast('Misión añadida', 'ok');
    }
    this.editorOpen.set(false);
  }

  protected async removeMission(mission: Mission): Promise<void> {
    const confirmed = await this.ui.confirm({
      title: `Eliminar «${mission.title}»`,
      message: 'Se borrará también su historial de cumplimiento.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;
    this.store.removeMission(mission.id);
    this.ui.toast('Misión eliminada', 'ok');
  }

  protected move(mission: Mission, direction: -1 | 1): void {
    this.store.moveMission(mission.id, direction);
  }

  protected toggleActive(mission: Mission): void {
    this.store.updateMission(mission.id, { active: !mission.active });
  }

  protected toggle(mission: Mission): void {
    this.store.toggleMission(mission);
  }

  protected setCount(mission: Mission, count: number): void {
    this.store.setMissionProgress(mission, count);
  }

  protected toggleAll(type: MissionType): void {
    const entry = this.progress();
    const game = this.game();
    if (!entry || !game) return;
    const done = type === 'daily' ? entry.dailyDone === entry.dailyTotal : entry.weeklyDone === entry.weeklyTotal;
    this.store.setGameComplete(game.id, type, !done);
  }

  protected bestStreakFor(mission: Mission): number {
    const data = this.store.data();
    const keys = new Set(
      data.completions
        .filter((completion) => completion.missionId === mission.id && isMissionDone(mission, completion.count))
        .map((completion) => completion.periodKey),
    );
    return longestStreak(keys, mission.type);
  }

  protected async toggleArchived(): Promise<void> {
    const game = this.game();
    if (!game) return;
    this.store.updateGame(game.id, { archived: !game.archived });
    this.ui.toast(game.archived ? 'Juego restaurado' : 'Juego archivado', 'ok');
  }

  protected async removeGame(): Promise<void> {
    const game = this.game();
    if (!game) return;
    const confirmed = await this.ui.confirm({
      title: `Eliminar «${game.name}»`,
      message: 'Se borrarán el juego, sus misiones y todo su historial.',
      confirmLabel: 'Eliminar juego',
      danger: true,
    });
    if (!confirmed) return;
    this.store.removeGame(game.id);
    this.ui.toast('Juego eliminado', 'ok');
    await this.router.navigate(['/games']);
  }
}
