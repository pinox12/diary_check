import { Injectable } from '@angular/core';
import { createStorage } from '../storage/storage.factory';
import type {
  AppInfo,
  DataStorage,
  ExportResult,
  ImportResult,
  StorageInfo,
} from '../storage/storage.types';
import type { AppData } from '../models/models';

/**
 * Capa de plataforma: un único punto por el que se habla con el sistema
 * (guardar, exportar, importar, notificar). La UI nunca sabe si corre en
 * Electron o en el navegador.
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly storage: DataStorage = createStorage();

  get info(): StorageInfo {
    return this.storage.info;
  }

  get isElectron(): boolean {
    return this.storage.info.kind === 'electron';
  }

  load(): Promise<unknown | null> {
    return this.storage.load();
  }

  save(data: AppData): Promise<void> {
    return this.storage.save(data);
  }

  exportFile(data: AppData, suggestedName: string): Promise<ExportResult> {
    return this.storage.exportFile(data, suggestedName);
  }

  importFile(): Promise<ImportResult> {
    return this.storage.importFile();
  }

  notify(title: string, body: string): Promise<boolean> {
    return this.storage.notify(title, body);
  }

  requestNotificationPermission(): Promise<boolean> {
    return this.storage.requestNotificationPermission();
  }

  appInfo(): Promise<AppInfo> {
    return this.storage.appInfo();
  }

  /** Solo disponible en Electron: abre la carpeta donde vive data.json. */
  openDataFolder(): Promise<{ ok: boolean }> {
    const storage = this.storage as DataStorage & { openDataFolder?: () => Promise<{ ok: boolean }> };
    return storage.openDataFolder?.() ?? Promise.resolve({ ok: false });
  }
}
