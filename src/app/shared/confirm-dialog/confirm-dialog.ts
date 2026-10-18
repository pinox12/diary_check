import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiService } from '../../core/services/ui.service';

/** Confirmación global; se abre con `UiService.confirm()`. */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'ui.answerConfirm(false)',
  },
  template: `
    @if (ui.confirmRequest(); as request) {
      <div
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        (click)="ui.answerConfirm(false)"
      >
        <div
          class="pop-in w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-soft"
          (click)="$event.stopPropagation()"
          role="alertdialog"
          aria-modal="true"
        >
          <h2 class="text-base font-semibold">{{ request.title }}</h2>
          <p class="mt-2 text-sm text-muted">{{ request.message }}</p>
          <div class="mt-5 flex justify-end gap-2">
            <button type="button" class="btn" (click)="ui.answerConfirm(false)">{{ request.cancelLabel }}</button>
            <button
              type="button"
              class="btn"
              [class.btn-danger]="request.danger"
              [class.btn-primary]="!request.danger"
              (click)="ui.answerConfirm(true)"
            >
              {{ request.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  protected readonly ui = inject(UiService);
}
