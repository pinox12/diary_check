import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiService, type ToastTone } from '../../core/services/ui.service';
import { IconComponent } from '../icon/icon';

@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      @for (toast of ui.toasts(); track toast.id) {
        <button
          type="button"
          class="fade-in pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm shadow-soft"
          [style.border-color]="toneBorder(toast.tone)"
          (click)="ui.dismiss(toast.id)"
        >
          @switch (toast.tone) {
            @case ('ok') {
              <app-icon name="check" [size]="16" class="text-ok" />
            }
            @case ('error') {
              <app-icon name="alert" [size]="16" class="text-danger" />
            }
            @default {
              <app-icon name="info" [size]="16" class="text-accent" />
            }
          }
          <span class="text-left">{{ toast.message }}</span>
        </button>
      }
    </div>
  `,
})
export class ToastsComponent {
  protected readonly ui = inject(UiService);

  protected toneBorder(tone: ToastTone): string {
    if (tone === 'ok') return 'color-mix(in srgb, var(--color-ok) 55%, transparent)';
    if (tone === 'error') return 'color-mix(in srgb, var(--color-danger) 55%, transparent)';
    return 'color-mix(in srgb, var(--color-accent) 45%, transparent)';
  }
}
