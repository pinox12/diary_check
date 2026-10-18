import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Mission } from '../../core/models/models';
import { IconComponent } from '../icon/icon';

/**
 * Fila de misión con casilla de progreso.
 * Es puramente presentacional: el padre decide qué hacer con cada acción.
 */
@Component({
  selector: 'app-mission-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div
      class="group flex items-center gap-2.5 rounded-xl border border-transparent px-2 py-1.5 transition hover:border-line hover:bg-surface2"
    >
      <button
        type="button"
        class="grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[11px] font-semibold transition"
        [class.border-ok]="done()"
        [class.bg-ok]="done()"
        [class.text-white]="done()"
        [class.border-line]="!done()"
        [class.text-muted]="!done()"
        [attr.aria-pressed]="done()"
        [attr.aria-label]="done() ? 'Marcar como pendiente' : 'Marcar como completada'"
        (click)="toggle.emit()"
      >
        @if (done()) {
          <app-icon name="check" [size]="14" [strokeWidth]="2.6" />
        } @else if (mission().target > 1) {
          {{ count() }}
        }
      </button>

      <div class="min-w-0 flex-1">
        <p
          class="truncate text-sm leading-tight transition"
          [class.text-muted]="done()"
          [class.line-through]="done()"
        >
          {{ mission().title }}
        </p>
        @if (mission().description) {
          <p class="truncate text-xs text-muted/80">{{ mission().description }}</p>
        }
      </div>

      @if (mission().target > 1) {
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="btn btn-ghost btn-sm px-1.5"
            aria-label="Restar progreso"
            (click)="setCount.emit(count() - 1)"
          >
            −
          </button>
          <span class="w-10 text-center font-mono text-xs tabular-nums text-muted">{{ count() }}/{{ mission().target }}</span>
          <button
            type="button"
            class="btn btn-ghost btn-sm px-1.5"
            aria-label="Sumar progreso"
            (click)="setCount.emit(count() + 1)"
          >
            +
          </button>
        </div>
      }

      @if (streak() > 1) {
        <span class="chip chip-ok shrink-0" [title]="'Racha: ' + streak() + ' periodos seguidos'">
          <app-icon name="fire" [size]="12" />
          {{ streak() }}
        </span>
      }

      @if (editable()) {
        <div class="flex shrink-0 items-center gap-0.5 opacity-45 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <button type="button" class="btn btn-ghost btn-icon" aria-label="Subir" (click)="moveUp.emit()">
            <app-icon name="chevron-up" [size]="14" />
          </button>
          <button type="button" class="btn btn-ghost btn-icon" aria-label="Bajar" (click)="moveDown.emit()">
            <app-icon name="chevron-down" [size]="14" />
          </button>
          <button type="button" class="btn btn-ghost btn-icon" aria-label="Editar" (click)="edit.emit()">
            <app-icon name="pencil" [size]="14" />
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-icon text-danger/80 hover:text-danger"
            aria-label="Eliminar"
            (click)="remove.emit()"
          >
            <app-icon name="trash" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
})
export class MissionRowComponent {
  readonly mission = input.required<Mission>();
  readonly count = input(0);
  readonly done = input(false);
  readonly streak = input(0);
  readonly editable = input(false);

  readonly toggle = output<void>();
  readonly setCount = output<number>();
  readonly edit = output<void>();
  readonly remove = output<void>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
}
