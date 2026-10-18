/**
 * Puente seguro entre el proceso main y la app Angular.
 * Solo se expone lo estrictamente necesario, sin acceso a Node en el renderer.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('diary', {
  kind: 'electron',

  load: () => ipcRenderer.invoke('data:load'),
  save: (data) => ipcRenderer.invoke('data:save', data),
  exportFile: (data, suggestedName) => ipcRenderer.invoke('data:export', { data, suggestedName }),
  importFile: () => ipcRenderer.invoke('data:import'),
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  info: () => ipcRenderer.invoke('app:info'),
  openDataFolder: () => ipcRenderer.invoke('app:open-data-folder'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),

  /** Comandos del menú nativo (exportar, importar, navegación rápida…). */
  onMenuCommand: (callback) => {
    const handler = (_event, command) => callback(command);
    ipcRenderer.on('menu:command', handler);
    return () => ipcRenderer.removeListener('menu:command', handler);
  },
});
