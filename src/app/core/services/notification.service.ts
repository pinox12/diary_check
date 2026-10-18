import { Injectable, inject, signal } from '@angular/core';
import { allProgress, countPending } from '../logic/progress';
import { formatDuration } from '../logic/time';
import { PlatformService } from '../platform/platform.service';
import { DataStore } from '../state/data.store';
import { UiService } from './ui.service';

export type NotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported';

const CHECK_INTERVAL_MS = 30_000;
/** Aviso de semanales: como mínimo 12 h antes del reset. */
const WEEKLY_LEAD_MIN_MS = 12 * 60 * 60 * 1000;
/** Máximo de avisos por ronda para no saturar. */
const MAX_NOTIFICATIONS_PER_ROUND = 3;

/**
 * Recordatorios de misiones pendientes.
 *
 * Se revisa cada 30 s: si queda poco para el reset y hay misiones sin marcar,
 * se lanza un aviso (nativo en Electron, del navegador en la web). Cada aviso
 * se registra en los ajustes para no repetirlo dentro del mismo periodo.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly platform = inject(PlatformService);
  private readonly store = inject(DataStore);
  private readonly ui = inject(UiService);

  private readonly permissionSignal = signal<NotificationPermission>(this.detectPermission());
  private lastCheckMs = 0;
  private checking = false;

  readonly permission = this.permissionSignal.asReadonly();
  readonly supported = this.platform.info.supportsNativeNotify;

  private detectPermission(): NotificationPermission {
    if (this.platform.info.supportsNativeNotify && this.platform.info.kind === 'electron') return 'granted';
    if (typeof globalThis.Notification === 'undefined') return 'unsupported';
    return globalThis.Notification.permission as NotificationPermission;
  }

  async requestPermission(): Promise<boolean> {
    const granted = await this.platform.requestNotificationPermission();
    this.permissionSignal.set(this.detectPermission());
    return granted;
  }

  async send(title: string, body: string): Promise<boolean> {
    return this.platform.notify(title, body);
  }

  async test(): Promise<void> {
    const granted = this.permission() === 'granted' || (await this.requestPermission());
    if (!granted) {
      this.ui.toast('El navegador bloqueó las notificaciones', 'error');
      return;
    }
    const sent = await this.send('Diary Check', 'Así se verán tus recordatorios de misiones 🔔');
    this.ui.toast(sent ? 'Notificación de prueba enviada' : 'No se pudo enviar la notificación', sent ? 'ok' : 'error');
  }

  /** Registra el efecto periódico del reloj. Es barato: se autolimita a 30 s. */
  async check(nowMs: number): Promise<void> {
    if (this.checking || nowMs - this.lastCheckMs < CHECK_INTERVAL_MS) return;
    this.checking = true;
    this.lastCheckMs = nowMs;
    try {
      await this.runCheck(nowMs);
    } finally {
      this.checking = false;
    }
  }

  private async runCheck(nowMs: number): Promise<void> {
    const data = this.store.data();
    const settings = data.settings;
    if (!settings.notifyEnabled) return;

    const leadMs = settings.notifyLeadMinutes * 60_000;
    const weeklyLeadMs = Math.max(leadMs, WEEKLY_LEAD_MIN_MS);
    const alreadyNotified = new Set(settings.notifiedKeys);
    const pending: { key: string; title: string; body: string }[] = [];

    for (const entry of allProgress(data, nowMs)) {
      const remainingDaily = entry.dailyTotal - entry.dailyDone;
      const remainingWeekly = entry.weeklyTotal - entry.weeklyDone;
      const dailyMs = entry.nextDaily - nowMs;
      const weeklyMs = entry.nextWeekly - nowMs;

      if (remainingDaily > 0 && dailyMs > 0 && dailyMs <= leadMs) {
        const key = `daily:${entry.game.id}:${entry.dailyKey}`;
        if (!alreadyNotified.has(key)) {
          pending.push({
            key,
            title: `${entry.game.name} · diarias pendientes`,
            body: `Te quedan ${remainingDaily} de ${entry.dailyTotal} diarias. Reinician en ${formatDuration(dailyMs)}.`,
          });
        }
      }

      if (settings.notifyWeekly && remainingWeekly > 0 && weeklyMs > 0 && weeklyMs <= weeklyLeadMs) {
        const key = `weekly:${entry.game.id}:${entry.weeklyKey}`;
        if (!alreadyNotified.has(key)) {
          pending.push({
            key,
            title: `${entry.game.name} · semanales pendientes`,
            body: `Te quedan ${remainingWeekly} de ${entry.weeklyTotal} semanales. Reinician en ${formatDuration(weeklyMs)}.`,
          });
        }
      }
    }

    if (pending.length === 0) return;

    const batch = pending.slice(0, MAX_NOTIFICATIONS_PER_ROUND);
    for (const item of batch) {
      await this.send(item.title, item.body);
    }
    this.store.markNotified(pending.map((item) => item.key));
  }

  /** Resumen al abrir la app (una vez al día). */
  async sendSummary(nowMs: number): Promise<void> {
    const data = this.store.data();
    const settings = data.settings;
    if (!settings.notifyEnabled || !settings.notifySummaryOnOpen) return;

    const summary = countPending(data, nowMs);
    if (summary.missions === 0) return;

    const key = `summary:${new Date(nowMs).toISOString().slice(0, 10)}`;
    if (settings.notifiedKeys.includes(key)) return;

    const granted = this.permission() === 'granted' || (await this.requestPermission());
    if (!granted) return;

    await this.send(
      'Diary Check · misiones de hoy',
      `Tienes ${summary.missions} misiones pendientes (${summary.daily} diarias · ${summary.weekly} semanales) en ${summary.games} juegos.`,
    );
    this.store.markNotified([key]);
  }
}
