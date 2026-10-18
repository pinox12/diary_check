import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CoverArtService, coverSourceLabel, type CoverCandidate } from '../../core/services/cover-art.service';
import { findPresets, type GamePreset } from '../../core/logic/presets';
import { dailyPeriodKey, nextDailyReset, nextWeeklyReset, periodLabel, weeklyPeriodKey, weekdayLabel } from '../../core/logic/period-keys';
import { systemTimezone, timezoneList } from '../../core/logic/time';
import { PALETTE, WEEKDAYS_ES, type Game } from '../../core/models/models';
import { UiService } from '../../core/services/ui.service';
import { ClockService } from '../../core/state/clock.service';
import { DataStore } from '../../core/state/data.store';
import { CountdownComponent } from '../../shared/countdown/countdown';
import { GameCoverComponent } from '../../shared/game-cover/game-cover';
import { IconComponent } from '../../shared/icon/icon';

const TIMEZONES = timezoneList();

@Component({
  selector: 'app-game-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CountdownComponent, GameCoverComponent, IconComponent],
  templateUrl: './game-form.html',
})
export class GameFormPage {
  private readonly store = inject(DataStore);
  private readonly coverArt = inject(CoverArtService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);
  private readonly clock = inject(ClockService);

  /**
   * Id del juego cuando se edita (binding automático de la ruta /games/:id/edit).
   * En rutas sin parámetro (`/games/new`) el router lo entrega como `undefined`,
   * por eso el tipo lo admite y se normaliza en `gameId`.
   */
  readonly id = input<string | undefined>(undefined);
  protected readonly gameId = computed(() => this.id() ?? '');

  protected readonly palette = PALETTE;
  protected readonly weekdays = WEEKDAYS_ES;
  protected readonly timezones = TIMEZONES;
  protected readonly systemZone = systemTimezone();
  protected readonly coverSourceLabel = coverSourceLabel;
  protected readonly weekdayLabel = weekdayLabel;

  protected readonly name = signal('');
  protected readonly cover = signal<string | undefined>(undefined);
  protected readonly accentColor = signal<string>(PALETTE[0]);
  protected readonly timezone = signal<string>(this.systemZone);
  protected readonly dailyResetTime = signal('04:00');
  protected readonly weeklyResetDay = signal(1);
  protected readonly weeklyResetTime = signal('04:00');
  protected readonly notes = signal('');

  protected readonly presetSuggestions = computed(() => findPresets(this.name()));
  protected readonly searching = signal(false);
  protected readonly searched = signal(false);
  protected readonly results = signal<CoverCandidate[]>([]);
  protected readonly coverUrl = signal('');
  protected readonly coverBusy = signal(false);
  protected readonly saving = signal(false);

  protected readonly isEdit = computed(() => this.gameId().length > 0);
  protected readonly canSave = computed(() => this.name().trim().length > 0);

  protected readonly previewGame = computed<Game>(() => ({
    id: 'preview',
    name: this.name().trim() || 'Juego',
    cover: this.cover(),
    accentColor: this.accentColor(),
    timezone: this.timezone(),
    dailyResetTime: this.dailyResetTime(),
    weeklyResetDay: this.weeklyResetDay(),
    weeklyResetTime: this.weeklyResetTime(),
    archived: false,
    sortOrder: 0,
    createdAt: new Date(0).toISOString(),
  }));

  protected readonly preview = computed(() => {
    const game = this.previewGame();
    const now = this.clock.now();
    const dailyKey = dailyPeriodKey(game, now);
    const weeklyKey = weeklyPeriodKey(game, now);
    return {
      nextDaily: nextDailyReset(game, now),
      nextWeekly: nextWeeklyReset(game, now),
      dailyLabel: periodLabel('daily', dailyKey),
      weeklyLabel: periodLabel('weekly', weeklyKey),
    };
  });

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private loadedId = '';

  constructor() {
    // El id llega por binding de ruta: cuando aparece, cargamos el juego.
    effect(() => {
      const id = this.gameId();
      if (!id || id === this.loadedId) return;
      this.loadedId = id;
      untracked(() => this.loadGame(id));
    });
  }

  private loadGame(id: string): void {
    const game = this.store.gameById(id);
    if (!game) {
      this.ui.toast('Ese juego ya no existe', 'error');
      void this.router.navigate(['/games']);
      return;
    }
    this.name.set(game.name);
    this.cover.set(game.cover);
    this.accentColor.set(game.accentColor);
    this.timezone.set(game.timezone);
    this.dailyResetTime.set(game.dailyResetTime);
    this.weeklyResetDay.set(game.weeklyResetDay);
    this.weeklyResetTime.set(game.weeklyResetTime);
    this.notes.set(game.notes ?? '');
  }

  /* --------------------------------- nombre --------------------------------- */

  protected onNameInput(value: string): void {
    this.name.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const query = value.trim();
    if (query.length < 3) {
      this.results.set([]);
      this.searched.set(false);
      return;
    }
    this.searchTimer = setTimeout(() => void this.searchCover(query), 700);
  }

  protected async searchCover(query = this.name()): Promise<void> {
    if (query.trim().length < 2) return;
    this.searching.set(true);
    try {
      const results = await this.coverArt.search(query);
      this.results.set(results);
      this.searched.set(true);
    } catch {
      this.ui.toast('No se pudo buscar portadas, prueba con una URL', 'error');
    } finally {
      this.searching.set(false);
    }
  }

  /* --------------------------------- portada -------------------------------- */

  protected async chooseCover(candidate: CoverCandidate): Promise<void> {
    this.coverBusy.set(true);
    try {
      const dataUrl = await this.coverArt.toCoverDataUrl(candidate.imageUrl);
      this.cover.set(dataUrl);
      this.ui.toast(`Portada aplicada: ${candidate.title}`, 'ok');
    } finally {
      this.coverBusy.set(false);
    }
  }

  protected async applyCoverUrl(): Promise<void> {
    const url = this.coverUrl().trim();
    if (!/^https?:\/\//.test(url)) {
      this.ui.toast('Escribe una URL que empiece por http', 'error');
      return;
    }
    this.coverBusy.set(true);
    try {
      this.cover.set(await this.coverArt.toCoverDataUrl(url));
      this.coverUrl.set('');
      this.ui.toast('Portada aplicada', 'ok');
    } finally {
      this.coverBusy.set(false);
    }
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.ui.toast('El archivo debe ser una imagen', 'error');
      return;
    }
    this.coverBusy.set(true);
    try {
      this.cover.set(await this.coverArt.fileToCoverDataUrl(file));
      this.ui.toast('Portada cargada desde tu equipo', 'ok');
    } finally {
      this.coverBusy.set(false);
    }
  }

  protected clearCover(): void {
    this.cover.set(undefined);
  }

  /* --------------------------------- presets -------------------------------- */

  protected applyPreset(preset: GamePreset): void {
    this.name.set(preset.name);
    this.accentColor.set(preset.accentColor);
    this.dailyResetTime.set(preset.dailyResetTime);
    this.weeklyResetDay.set(preset.weeklyResetDay);
    this.weeklyResetTime.set(preset.weeklyResetTime);
    this.results.set([]);
    this.searched.set(false);
    void this.searchCover(preset.name);
    this.ui.toast(
      preset.note ? `Ajustado a ${preset.name}. ${preset.note}` : `Ajustado a ${preset.name}`,
      'info',
    );
  }

  /* ---------------------------------- guardar -------------------------------- */

  protected async save(): Promise<void> {
    if (!this.canSave()) {
      this.ui.toast('Ponle un nombre al juego', 'error');
      return;
    }
    this.saving.set(true);
    try {
      const payload = {
        name: this.name(),
        cover: this.cover(),
        accentColor: this.accentColor(),
        timezone: this.timezone(),
        dailyResetTime: this.dailyResetTime(),
        weeklyResetDay: this.weeklyResetDay(),
        weeklyResetTime: this.weeklyResetTime(),
        notes: this.notes(),
      };
      if (this.isEdit()) {
        this.store.updateGame(this.gameId(), payload);
        this.ui.toast('Juego actualizado', 'ok');
        await this.router.navigate(['/games', this.gameId()]);
      } else {
        const game = this.store.addGame(payload);
        this.ui.toast(`«${game.name}» añadido`, 'ok');
        await this.router.navigate(['/games', game.id]);
      }
    } finally {
      this.saving.set(false);
    }
  }
}
