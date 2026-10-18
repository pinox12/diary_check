import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { allProgress, countPending, streakMap, type GameProgress } from '../../core/logic/progress';
import { weekdayLabel } from '../../core/logic/period-keys';
import type { Mission, MissionType } from '../../core/models/models';
import { UiService } from '../../core/services/ui.service';
import { ClockService } from '../../core/state/clock.service';
import { DataStore } from '../../core/state/data.store';
import { CountdownComponent } from '../../shared/countdown/countdown';
import { GameCoverComponent } from '../../shared/game-cover/game-cover';
import { IconComponent } from '../../shared/icon/icon';
import { MissionRowComponent } from '../../shared/mission-row/mission-row';
import { ProgressBarComponent } from '../../shared/progress-bar/progress-bar';

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    CountdownComponent,
    GameCoverComponent,
    IconComponent,
    MissionRowComponent,
    ProgressBarComponent,
  ],
  templateUrl: './dashboard.html',
})
export class DashboardPage {
  private readonly store = inject(DataStore);
  private readonly clock = inject(ClockService);
  protected readonly ui = inject(UiService);

  protected readonly onlyPending = signal(false);
  protected readonly weekdayLabel = weekdayLabel;

  protected readonly now = this.clock.now;
  protected readonly progress = computed(() => allProgress(this.store.data(), this.now()));
  protected readonly streaks = computed(() => streakMap(this.store.data(), this.clock.slowNow()));
  protected readonly summary = computed(() => countPending(this.store.data(), this.clock.slowNow()));

  protected readonly games = computed(() =>
    this.onlyPending() ? this.progress().filter((entry) => entry.pending > 0) : this.progress(),
  );

  protected readonly totals = computed(() => {
    const entries = this.progress();
    return {
      dailyDone: entries.reduce((acc, entry) => acc + entry.dailyDone, 0),
      dailyTotal: entries.reduce((acc, entry) => acc + entry.dailyTotal, 0),
      weeklyDone: entries.reduce((acc, entry) => acc + entry.weeklyDone, 0),
      weeklyTotal: entries.reduce((acc, entry) => acc + entry.weeklyTotal, 0),
    };
  });

  protected readonly hasGames = computed(() => this.progress().length > 0);

  protected readonly greeting = computed(() => {
    const hour = new Date(this.now()).getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 20) return 'Buenas tardes';
    return 'Buenas noches';
  });

  protected readonly todayLabel = computed(() =>
    new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(this.now())),
  );

  protected streakOf(missionId: string): number {
    return this.streaks().get(missionId) ?? 0;
  }

  protected toggle(mission: Mission): void {
    this.store.toggleMission(mission);
  }

  protected setCount(mission: Mission, count: number): void {
    this.store.setMissionProgress(mission, count);
  }

  protected toggleAll(entry: GameProgress, type: MissionType): void {
    const done = type === 'daily' ? entry.dailyDone === entry.dailyTotal : entry.weeklyDone === entry.weeklyTotal;
    this.store.setGameComplete(entry.game.id, type, !done);
    this.ui.toast(
      done
        ? `${type === 'daily' ? 'Diarias' : 'Semanales'} de ${entry.game.name} reiniciadas`
        : `${type === 'daily' ? 'Diarias' : 'Semanales'} de ${entry.game.name} completadas`,
      'ok',
    );
  }

  protected allDone(type: MissionType): boolean {
    const totals = this.totals();
    if (type === 'daily') return totals.dailyTotal > 0 && totals.dailyDone === totals.dailyTotal;
    return totals.weeklyTotal > 0 && totals.weeklyDone === totals.weeklyTotal;
  }
}
