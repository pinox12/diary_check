import { Injectable, signal } from '@angular/core';

/**
 * Reloj global. Un único intervalo alimenta todas las cuentas atrás de la app
 * (con detección de cambios sin zonas, cada signal tick repinta lo necesario).
 */
@Injectable({ providedIn: 'root' })
export class ClockService {
  private readonly tickSignal = signal(Date.now());
  /** Se actualiza cada 30 s: para cálculos caros que no cambian cada segundo. */
  private readonly slowTickSignal = signal(Date.now());

  /** Milisegundos actuales (se actualiza cada segundo). */
  readonly now = this.tickSignal.asReadonly();
  /** Milisegundos actuales con granularidad de 30 s. */
  readonly slowNow = this.slowTickSignal.asReadonly();

  constructor() {
    if (typeof window === 'undefined') return;
    let slowBucket = Math.floor(Date.now() / 30_000);
    const interval = window.setInterval(() => {
      const timestamp = Date.now();
      this.tickSignal.set(timestamp);
      const bucket = Math.floor(timestamp / 30_000);
      if (bucket !== slowBucket) {
        slowBucket = bucket;
        this.slowTickSignal.set(timestamp);
      }
    }, 1000);
    window.addEventListener('pagehide', () => window.clearInterval(interval));
  }

  /** Fuerza una actualización inmediata (por ejemplo al volver a la pestaña). */
  refresh(): void {
    const timestamp = Date.now();
    this.tickSignal.set(timestamp);
    this.slowTickSignal.set(timestamp);
  }
}
