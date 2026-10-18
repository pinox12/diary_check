import type { AppData } from '../models/models';
import type { DiaryBridge } from './electron-bridge';
import type { AppInfo, DataStorage, ExportResult, ImportResult, StorageInfo } from './storage.types';

/** Persistencia en escritorio: un único data.json dentro de userData. */
export class ElectronStorage implements DataStorage {
  readonly info: StorageInfo = {
    kind: 'electron',
    label: 'Escritorio (archivo JSON)',
    supportsNativeDialogs: true,
    supportsNativeNotify: true,
  };

  constructor(private readonly bridge: DiaryBridge) {}

  async load(): Promise<unknown | null> {
    return this.bridge.load();
  }

  async save(data: AppData): Promise<void> {
    const result = await this.bridge.save(data);
    if (!result?.ok) throw new Error('No se pudo guardar el archivo de datos');
  }

  async exportFile(data: AppData, suggestedName: string): Promise<ExportResult> {
    const result = await this.bridge.exportFile(data, suggestedName);
    return result?.ok ? { ok: true, path: result.path } : { ok: false, canceled: true };
  }

  async importFile(): Promise<ImportResult> {
    return this.bridge.importFile();
  }

  async notify(title: string, body: string): Promise<boolean> {
    const result = await this.bridge.notify(title, body);
    return Boolean(result?.ok);
  }

  async requestNotificationPermission(): Promise<boolean> {
    return true; // Las notificaciones nativas no piden permiso al usuario.
  }

  async appInfo(): Promise<AppInfo> {
    const info = await this.bridge.info();
    return {
      version: info.version,
      platform: info.platform,
      runtime: `Electron ${info.electron}`,
      dataPath: info.dataPath,
    };
  }

  openDataFolder(): Promise<{ ok: boolean }> {
    return this.bridge.openDataFolder();
  }
}
