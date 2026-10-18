import { electronBridge } from './electron-bridge';
import { ElectronStorage } from './electron.storage';
import type { DataStorage } from './storage.types';
import { WebStorage } from './web.storage';
import { APP_VERSION } from './web.storage';

/** Versión visible de la app (misma en web y escritorio). */
export const APP_VERSION_FALLBACK = APP_VERSION;

/** Elige la implementación según el entorno de ejecución. */
export function createStorage(): DataStorage {
  const bridge = electronBridge();
  return bridge ? new ElectronStorage(bridge) : new WebStorage();
}
