import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ClockService } from '../../core/state/clock.service';
import { formatCountdown, HOUR_MS } from '../../core/logic/time';

/** Cuenta atrás en vivo hasta el próximo reset. */
@Component({
  selector: 'app-countdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-baseline gap-1.5" [class.text-warn]="urgent()">
      @if (label()) {
        <span class="text-[11px] tracking-wide text-muted uppercase">{{ label() }}</span>
      }
      <span class="font-mono text-sm tabular-nums">{{ text() }}</span>
    </span>
  `,
})
export class CountdownComponent {
  private readonly clock = inject(ClockService);

  readonly target = input.required<number>();
  readonly label = input('');

  protected readonly remaining = computed(() => Math.max(0, this.target() - this.clock.now()));
  protected readonly text = computed(() => formatCountdown(this.remaining()));
  protected readonly urgent = computed(() => this.remaining() > 0 && this.remaining() <= HOUR_MS);
}
