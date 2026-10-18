import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  allProgress,
  dailyStats,
  globalStats,
  streakMap,
  weeklyStats,
  type DayStat,
} from '../../core/logic/progress';
import type { Game } from '../../core/models/models';
import { UiService } from '../../core/services/ui.service';
import { ClockService } from '../../core/state/clock.service';
import { DataStore } from '../../core/state/data.store';
import { GameCoverComponent } from '../../shared/game-cover/game-cover';
import { HeatmapComponent } from '../../shared/heatmap/heatmap';
import { IconComponent } from '../../shared/icon/icon';

interface GameHistory {
  game: Game;
  daily: DayStat[];
  weekly: DayStat[];
  rate: number;
  weeklyRate: number;
  streak: number;
  completions: number;
}

@Component({
  selector: 'app-history-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, GameCoverComponent, HeatmapComponent, IconComponent],
  templateUrl: './history.html',
})
export class HistoryPage {
  private readonly store = inject(DataStore);
  private readonly clock = inject(ClockService);
  private readonly ui = inject(UiService);

  protected readonly ranges = [30, 60, 90] as const;
  protected readonly range = signal<(typeof this.ranges)[number]>(30);
  protected readonly pruneMonths = signal(12);

  protected readonly stats = computed(() => globalStats(this.store.data(), this.clock.slowNow(), this.range()));

  protected readonly history = computed<GameHistory[]>(() => {
    const data = this.store.data();
    const now = this.clock.slowNow();
    const streaks = streakMap(data, now);
    const days = this.range();

    return allProgress(data, now, true).map((entry) => {
      const daily = dailyStats(data, entry.game, now, days);
      const weekly = weeklyStats(data, entry.game, now, 12);
      const dailyWorth = daily.filter((item) => item.total > 0);
      const weeklyWorth = weekly.filter((item) => item.total > 0);
      const missions = data.missions.filter((mission) => mission.gameId === entry.game.id);
      return {
        game: entry.game,
        daily,
        weekly,
        rate: dailyWorth.length
          ? dailyWorth.reduce((acc, item) => acc + item.rate, 0) / dailyWorth.length
          : 0,
        weeklyRate: weeklyWorth.length
          ? weeklyWorth.reduce((acc, item) => acc + item.rate, 0) / weeklyWorth.length
          : 0,
        streak: Math.max(0, ...missions.map((mission) => streaks.get(mission.id) ?? 0)),
        completions: data.completions.filter((completion) => completion.gameId === entry.game.id).length,
      };
    });
  });

  protected readonly topMissions = computed(() => {
    const data = this.store.data();
    const streaks = streakMap(data, this.clock.slowNow());
    return data.missions
      .map((mission) => ({
        mission,
        game: this.store.gameById(mission.gameId),
        streak: streaks.get(mission.id) ?? 0,
      }))
      .filter((entry) => entry.streak > 0 && entry.game)
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 8);
  });

  protected readonly hasHistory = computed(() => this.store.data().completions.length > 0);

  protected percent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  protected async prune(): Promise<void> {
    const months = this.pruneMonths();
    const confirmed = await this.ui.confirm({
      title: 'Borrar historial antiguo',
      message: `Se eliminarán los registros de cumplimiento anteriores a ${months} meses. Los juegos y las misiones se conservan.`,
      confirmLabel: 'Borrar historial',
      danger: true,
    });
    if (!confirmed) return;
    const removed = this.store.pruneHistory(months);
    this.ui.toast(
      removed > 0 ? `${removed} registros antiguos eliminados` : 'No había registros tan antiguos',
      removed > 0 ? 'ok' : 'info',
    );
  }
}
