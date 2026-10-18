import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Game } from '../../core/models/models';

/** Portada del juego: banner a pantalla completa o avatar cuadrado. */
@Component({
  selector: 'app-game-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mode() === 'banner') {
      <div class="absolute inset-0 overflow-hidden" [style.background]="gradient()">
        @if (game().cover) {
          <img [src]="game().cover" alt="" class="absolute inset-0 h-full w-full object-cover opacity-55" />
          <div
            class="absolute inset-0"
            style="background: linear-gradient(to bottom, color-mix(in srgb, var(--color-surface) 25%, transparent), var(--color-surface))"
          ></div>
        } @else {
          <div class="absolute -top-10 -right-8 h-40 w-40 rounded-full opacity-30" [style.background]="accent()"></div>
          <div class="absolute -bottom-16 -left-10 h-40 w-40 rounded-full opacity-20" [style.background]="accent()"></div>
        }
      </div>
    } @else {
      <div
        class="relative shrink-0 overflow-hidden rounded-xl border border-line"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.background]="gradient()"
      >
        @if (game().cover) {
          <img [src]="game().cover" alt="" class="h-full w-full object-cover" />
        } @else {
          <span
            class="absolute inset-0 grid place-items-center text-[0.8em] font-bold tracking-wide text-white/90"
            [style.fontSize.px]="size() / 2.6"
          >
            {{ initials() }}
          </span>
        }
      </div>
    }
  `,
})
export class GameCoverComponent {
  readonly game = input.required<Game>();
  readonly mode = input<'banner' | 'avatar'>('banner');
  readonly size = input(56);

  protected readonly accent = computed(() => this.game().accentColor || 'var(--color-accent)');

  protected readonly gradient = computed(() => {
    const color = this.accent();
    return `linear-gradient(135deg, color-mix(in srgb, ${color} 45%, var(--color-surface)), var(--color-surface))`;
  });

  protected readonly initials = computed(() => {
    const words = this.game().name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
    return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  });
}
