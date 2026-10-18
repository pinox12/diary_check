import type { AppData } from '../models/models';

export type StorageKind = 'electron' | 'web';

export interface StorageInfo {
  kind: StorageKind;
  /** "Escritorio (Electron)" o "Navegador (localStorage)". */
  label: string;
  supportsNativeDialogs: boolean;
  supportsNativeNotify: boolean;
  /** Ruta del archivo de datos cuando la conocemos (Electron). */
  dataPath?: string;
}

export interface ExportResult {
  ok: boolean;
  canceled?: boolean;
  path?: string;
  error?: string;
}

export interface ImportResult {
  ok: boolean;
  canceled?: boolean;
  data?: unknown;
  path?: string;
  error?: string;
}

export interface AppInfo {
  version: string;
  platform: string;
  runtime: string;
  dataPath?: string;
}

/**
 * Contrato de persistencia. Hay dos implementaciones: Electron (archivo JSON en
 * userData) y navegador (localStorage, con exportar/importar manual).
 */
export interface DataStorage {
  readonly info: StorageInfo;
  load(): Promise<unknown | null>;
  save(data: AppData): Promise<void>;
  exportFile(data: AppData, suggestedName: string): Promise<ExportResult>;
  importFile(): Promise<ImportResult>;
  notify(title: string, body: string): Promise<boolean>;
  requestNotificationPermission(): Promise<boolean>;
  appInfo(): Promise<AppInfo>;
}
