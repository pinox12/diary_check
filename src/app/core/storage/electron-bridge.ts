/**
 * Puente con Electron. Solo existe cuando la app corre dentro de Electron;
 * en el navegador `window.diary` es undefined.
 */
import type { AppData } from '../models/models';
import type { ImportResult } from './storage.types';

export interface DiaryBridge {
  kind: 'electron';
  load(): Promise<unknown | null>;
  save(data: AppData): Promise<{ ok: boolean; path?: string }>;
  exportFile(data: AppData, suggestedName: string): Promise<{ ok: boolean; canceled?: boolean; path?: string }>;
  importFile(): Promise<ImportResult>;
  notify(title: string, body: string): Promise<{ ok: boolean }>;
  info(): Promise<{
    version: string;
    electron: string;
    chrome: string;
    platform: string;
    dataPath: string;
    packaged: boolean;
  }>;
  openDataFolder(): Promise<{ ok: boolean }>;
  openExternal(url: string): Promise<{ ok: boolean }>;
  onMenuCommand(callback: (command: string) => void): () => void;
}

declare global {
  interface Window {
    diary?: DiaryBridge;
  }
}

export function electronBridge(): DiaryBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.diary;
}

export function isElectron(): boolean {
  return Boolean(electronBridge()?.kind);
}
