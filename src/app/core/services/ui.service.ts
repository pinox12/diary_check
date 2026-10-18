import { Injectable, inject, signal } from '@angular/core';
import { uid } from '../models/models';

export type ToastTone = 'info' | 'ok' | 'error';

export interface ToastMessage {
  id: string;
  message: string;
  tone: ToastTone;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface ConfirmRequest extends Required<Omit<ConfirmOptions, 'danger'>> {
  danger: boolean;
  resolve: (value: boolean) => void;
}

/** Avisos flotantes y diálogos de confirmación compartidos por toda la app. */
@Injectable({ providedIn: 'root' })
export class UiService {
  private readonly toastsSignal = signal<ToastMessage[]>([]);
  private readonly confirmSignal = signal<ConfirmRequest | null>(null);

  readonly toasts = this.toastsSignal.asReadonly();
  readonly confirmRequest = this.confirmSignal.asReadonly();

  toast(message: string, tone: ToastTone = 'info', durationMs = 3400): void {
    const toast: ToastMessage = { id: uid(), message, tone };
    this.toastsSignal.update((current) => [...current, toast]);
    setTimeout(() => this.dismiss(toast.id), durationMs);
  }

  dismiss(id: string): void {
    this.toastsSignal.update((current) => current.filter((toast) => toast.id !== id));
  }

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.confirmSignal.set({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirmar',
        cancelLabel: options.cancelLabel ?? 'Cancelar',
        danger: options.danger ?? false,
        resolve,
      });
    });
  }

  answerConfirm(value: boolean): void {
    const request = this.confirmSignal();
    this.confirmSignal.set(null);
    request?.resolve(value);
  }
}
