import type { AppData } from '../models/models';
import type { AppInfo, DataStorage, ExportResult, ImportResult, StorageInfo } from './storage.types';

const STORAGE_KEY = 'diary-check:data';

/**
 * Persistencia en navegador.
 *
 * El navegador no puede escribir en disco, así que los datos viven en
 * localStorage con el mismo esquema JSON que usa Electron. Exportar/importar
 * cubre el resto (mover datos entre equipos o hacer copias de seguridad).
 */
export class WebStorage implements DataStorage {
  readonly info: StorageInfo = {
    kind: 'web',
    label: 'Navegador (almacenamiento local)',
    supportsNativeDialogs: false,
    supportsNativeNotify: typeof globalThis.Notification !== 'undefined',
  };

  /** Respaldo en memoria por si localStorage está bloqueado (modo privado). */
  private readonly memory = new Map<string, string>();

  private readRaw(): string | null {
    try {
      return globalThis.localStorage?.getItem(STORAGE_KEY) ?? this.memory.get(STORAGE_KEY) ?? null;
    } catch {
      return this.memory.get(STORAGE_KEY) ?? null;
    }
  }

  private writeRaw(value: string): void {
    this.memory.set(STORAGE_KEY, value);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, value);
    } catch (error) {
      throw new Error(
        'No se pudo guardar en el navegador (almacenamiento lleno o bloqueado). Exporta tus datos a un archivo JSON.',
        { cause: error },
      );
    }
  }

  async load(): Promise<unknown | null> {
    const raw = this.readRaw();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async save(data: AppData): Promise<void> {
    this.writeRaw(JSON.stringify(data));
  }

  async exportFile(data: AppData, suggestedName: string): Promise<ExportResult> {
    const name = suggestedName || 'diary-check.json';
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true, path: name };
  }

  importFile(): Promise<ImportResult> {
    return new Promise<ImportResult>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.style.display = 'none';
      document.body.append(input);

      const cleanup = () => input.remove();

      input.addEventListener('cancel', () => {
        cleanup();
        resolve({ ok: false, canceled: true });
      });

      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) {
          cleanup();
          resolve({ ok: false, canceled: true });
          return;
        }
        try {
          const text = await file.text();
          cleanup();
          resolve({ ok: true, data: JSON.parse(text), path: file.name });
        } catch (error) {
          cleanup();
          resolve({ ok: false, error: error instanceof Error ? error.message : 'JSON inválido' });
        }
      });

      input.click();
    });
  }

  async notify(title: string, body: string): Promise<boolean> {
    if (typeof globalThis.Notification === 'undefined') return false;
    if (globalThis.Notification.permission !== 'granted') return false;
    try {
      const notification = new Notification(title, { body, icon: 'icon.svg' });
      notification.onclick = () => globalThis.focus();
      return true;
    } catch {
      return false;
    }
  }

  async requestNotificationPermission(): Promise<boolean> {
    if (typeof globalThis.Notification === 'undefined') return false;
    if (globalThis.Notification.permission === 'granted') return true;
    if (globalThis.Notification.permission === 'denied') return false;
    try {
      const permission = await globalThis.Notification.requestPermission();
      return permission === 'granted';
    } catch {
      return false;
    }
  }

  async appInfo(): Promise<AppInfo> {
    return {
      version: APP_VERSION,
      platform: 'web',
      runtime: navigator.userAgent.split(' ').slice(-2).join(' '),
    };
  }
}

/** Se sincroniza con package.json en tiempo de build. */
export const APP_VERSION = '0.1.0';
