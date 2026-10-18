import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface3">
      <div
        class="h-full rounded-full transition-[width] duration-500 ease-out"
        [style.width.%]="percent()"
        [style.background]="color()"
      ></div>
    </div>
  `,
})
export class ProgressBarComponent {
  readonly value = input.required<number>();
  readonly max = input.required<number>();
  readonly color = input('var(--color-accent)');

  protected readonly percent = computed(() => {
    const max = this.max();
    if (max <= 0) return 0;
    return Math.min(100, Math.max(0, (this.value() / max) * 100));
  });
}
