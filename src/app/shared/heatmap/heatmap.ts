import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { DayStat } from '../../core/logic/progress';

/** Mapa de calor de cumplimiento por periodo (días o semanas). */
@Component({
  selector: 'app-heatmap',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap gap-1.5">
      @for (entry of stats(); track entry.key) {
        <div
          class="h-6 w-6 rounded-md border transition hover:scale-110"
          [style.background]="cellColor(entry)"
          [style.border-color]="entry.rate > 0 ? 'transparent' : 'var(--color-line)'"
          [title]="tooltip(entry)"
        ></div>
      }
      @if (stats().length === 0) {
        <p class="text-xs text-muted">Sin datos todavía.</p>
      }
    </div>
    <div class="mt-2 flex items-center gap-2 text-[11px] text-muted">
      <span>0%</span>
      <div class="flex gap-1">
        <span class="h-3 w-3 rounded-sm" style="background: var(--color-surface3)"></span>
        <span class="h-3 w-3 rounded-sm" style="background: color-mix(in srgb, var(--color-accent) 30%, var(--color-surface3))"></span>
        <span class="h-3 w-3 rounded-sm" style="background: color-mix(in srgb, var(--color-accent) 60%, var(--color-surface3))"></span>
        <span class="h-3 w-3 rounded-sm" style="background: var(--color-accent)"></span>
      </div>
      <span>100%</span>
    </div>
  `,
})
export class HeatmapComponent {
  readonly stats = input.required<DayStat[]>();

  protected cellColor(entry: DayStat): string {
    if (entry.total === 0) return 'var(--color-surface3)';
    if (entry.rate <= 0) return 'var(--color-surface3)';
    const strength = Math.max(18, Math.round(entry.rate * 100));
    return `color-mix(in srgb, var(--color-accent) ${strength}%, var(--color-surface3))`;
  }

  protected tooltip(entry: DayStat): string {
    return `${entry.label}: ${entry.done}/${entry.total} completadas`;
  }
}
