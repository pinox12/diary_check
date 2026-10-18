import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { allProgress } from '../../core/logic/progress';
import { weekdayLabel } from '../../core/logic/period-keys';
import { timezoneLabel } from '../../core/logic/time';
import type { Game } from '../../core/models/models';
import { UiService } from '../../core/services/ui.service';
import { ClockService } from '../../core/state/clock.service';
import { DataStore } from '../../core/state/data.store';
import { CountdownComponent } from '../../shared/countdown/countdown';
import { GameCoverComponent } from '../../shared/game-cover/game-cover';
import { IconComponent } from '../../shared/icon/icon';

@Component({
  selector: 'app-games-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CountdownComponent, GameCoverComponent, IconComponent],
  templateUrl: './games-list.html',
})
export class GamesListPage {
  private readonly store = inject(DataStore);
  private readonly clock = inject(ClockService);
  private readonly ui = inject(UiService);

  protected readonly weekdayLabel = weekdayLabel;
  protected readonly zoneLabel = timezoneLabel;
  protected readonly query = signal('');
  protected readonly showArchived = signal(false);

  protected readonly progress = computed(() => allProgress(this.store.data(), this.clock.slowNow(), true));
  protected readonly hasAny = computed(() => this.store.data().games.length > 0);

  protected readonly games = computed(() => {
    const needle = this.query().trim().toLowerCase();
    return this.progress().filter((entry) => {
      if (!this.showArchived() && entry.game.archived) return false;
      if (needle && !entry.game.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  });

  protected readonly archivedCount = computed(() => this.store.data().games.filter((game) => game.archived).length);

  protected missionCount(gameId: string): number {
    return this.store.missionsForGame(gameId, true).length;
  }

  protected move(game: Game, direction: -1 | 1): void {
    this.store.moveGame(game.id, direction);
  }

  protected async toggleArchived(game: Game): Promise<void> {
    this.store.updateGame(game.id, { archived: !game.archived });
    this.ui.toast(game.archived ? `«${game.name}» restaurado` : `«${game.name}» archivado`, 'ok');
  }

  protected async remove(game: Game): Promise<void> {
    const confirmed = await this.ui.confirm({
      title: `Eliminar «${game.name}»`,
      message:
        'Se borrarán también sus misiones y todo su historial de cumplimiento. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;
    this.store.removeGame(game.id);
    this.ui.toast(`«${game.name}» eliminado`, 'ok');
  }
}
