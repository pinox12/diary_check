import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon';

/** Diálogo modal reutilizable (hoja inferior en móvil, centrado en escritorio). */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    '(document:keydown.escape)': 'close.emit()',
  },
  template: `
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      (click)="close.emit()"
      role="presentation"
    >
      <div
        class="pop-in flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-soft sm:max-w-xl sm:rounded-2xl"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
      >
        <header class="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            <h2 class="text-sm font-semibold">{{ title() }}</h2>
            @if (subtitle()) {
              <p class="text-xs text-muted">{{ subtitle() }}</p>
            }
          </div>
          <button type="button" class="btn btn-ghost btn-icon" aria-label="Cerrar" (click)="close.emit()">
            <app-icon name="x" />
          </button>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ng-content />
        </div>

        <ng-content select="[modalFooter]" />
      </div>
    </div>
  `,
})
export class ModalComponent {
  readonly title = input('');
  readonly subtitle = input('');
  readonly close = output<void>();

  constructor() {
    const destroyRef = inject(DestroyRef);
    const previous = typeof document === 'undefined' ? '' : document.body.style.overflow;
    effect(() => {
      if (typeof document !== 'undefined') document.body.style.overflow = 'hidden';
    });
    destroyRef.onDestroy(() => {
      if (typeof document !== 'undefined') document.body.style.overflow = previous;
    });
  }
}
