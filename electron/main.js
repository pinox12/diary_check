/**
 * Proceso principal de Electron para Diary Check.
 *
 * Responsabilidades:
 *  - Crear la ventana y cargar la app Angular (dev: localhost, prod: dist/).
 *  - Persistir los datos en un único archivo JSON dentro de userData.
 *  - Exportar / importar JSON mediante diálogos nativos.
 *  - Mostrar notificaciones de escritorio.
 *
 * El renderer nunca toca el sistema de archivos: todo pasa por IPC y por el
 * puente expuesto en electron/preload.js.
 */
const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  dialog,
  ipcMain,
  screen,
  shell,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { resolveWindowState } = require('./window-state');

const isDev = process.argv.includes('--dev');
const DATA_FILE = 'data.json';
const BACKUP_FILE = 'data.backup.json';
const BACKUP_MIN_INTERVAL_MS = 60_000;
/** Errores que en Windows provocan el antivirus o la sincronización de carpetas. */
const TRANSIENT_FS_CODES = new Set(['EPERM', 'EACCES', 'EBUSY', 'EMFILE', 'ENFILE']);

let mainWindow = null;
let saveChain = Promise.resolve();

/* -------------------------------------------------------------------------- */
/* Rutas                                                                      */
/* -------------------------------------------------------------------------- */

const dataDir = () => app.getPath('userData');
const dataPath = () => path.join(dataDir(), DATA_FILE);
const backupPath = () => path.join(dataDir(), BACKUP_FILE);
const windowStatePath = () => path.join(dataDir(), 'window-state.json');
const rendererIndex = () =>
  path.join(__dirname, '..', 'dist', 'diary-check', 'browser', 'index.html');

/* -------------------------------------------------------------------------- */
/* Persistencia JSON                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Reintenta una operación de disco transitoria. En Windows es habitual que otro
 * proceso (antivirus, OneDrive/Dropbox, un editor abierto) tenga el archivo
 * bloqueado justo durante la escritura.
 */
async function withRetries(task, attempts = 4) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (!TRANSIENT_FS_CODES.has(error.code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 60 * (attempt + 1)));
    }
  }
  throw lastError;
}

/** Escritura atómica: escribe en .tmp y renombra para no corromper el archivo. */
async function writeJsonAtomic(target, value) {
  const tmp = `${target}.tmp`;
  const payload = JSON.stringify(value, null, 2);
  await withRetries(async () => {
    await fsp.writeFile(tmp, payload, 'utf8');
    await fsp.rename(tmp, target);
  });
}

async function rotateBackup() {
  const source = dataPath();
  if (!fs.existsSync(source)) return;
  try {
    const stats = await fsp.stat(source);
    if (stats.size === 0) return;
    const backup = backupPath();
    if (fs.existsSync(backup)) {
      const backupStats = await fsp.stat(backup);
      if (Date.now() - backupStats.mtimeMs < BACKUP_MIN_INTERVAL_MS) return;
    }
    await fsp.copyFile(source, backup);
  } catch (error) {
    console.warn('[diary-check] no se pudo rotar el backup:', error.message);
  }
}

async function loadData() {
  const target = dataPath();
  try {
    const raw = await fsp.readFile(target, 'utf8');
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    // Archivo corrupto: intentamos rescatar el backup antes de rendirnos.
    console.error('[diary-check] data.json ilegible, probando backup:', error.message);
    try {
      const raw = await fsp.readFile(backupPath(), 'utf8');
      const rescued = JSON.parse(raw);
      await writeJsonAtomic(target, rescued);
      return rescued;
    } catch {
      return null;
    }
  }
}

async function saveData(data) {
  // Serializamos las escrituras para que nunca se pisen entre sí.
  saveChain = saveChain.then(async () => {
    await fsp.mkdir(dataDir(), { recursive: true });
    await rotateBackup();
    await writeJsonAtomic(dataPath(), data);
  });
  await saveChain;
  return { ok: true, path: dataPath() };
}

/* -------------------------------------------------------------------------- */
/* Estado de ventana                                                          */
/* -------------------------------------------------------------------------- */

function readWindowState() {
  let saved = null;
  try {
    saved = JSON.parse(fs.readFileSync(windowStatePath(), 'utf8'));
  } catch {
    /* primer arranque */
  }
  // `screen` solo existe tras app.whenReady(), y createWindow() se llama desde ahí.
  const workAreas = screen.getAllDisplays().map((display) => display.workArea);
  return resolveWindowState(saved, workAreas);
}

function trackWindowState(win) {
  let timer = null;
  const persist = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
      const bounds = win.getBounds();
      writeJsonAtomic(windowStatePath(), { ...bounds, maximized: win.isMaximized() }).catch(
        () => {},
      );
    }, 500);
  };
  win.on('resize', persist);
  win.on('move', persist);
}

/* -------------------------------------------------------------------------- */
/* Ventana                                                                    */
/* -------------------------------------------------------------------------- */

async function createWindow() {
  const state = readWindowState();
  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: '#0a0c11',
    autoHideMenuBar: false,
    title: 'Diary Check',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  if (state.maximized) mainWindow.maximize();
  trackWindowState(mainWindow);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => (mainWindow = null));

  // Los enlaces externos se abren en el navegador, nunca dentro de la app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    await mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(rendererIndex());
  }
}

/* -------------------------------------------------------------------------- */
/* Menú                                                                       */
/* -------------------------------------------------------------------------- */

function send(command) {
  mainWindow?.webContents.send('menu:command', command);
}

function buildMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        { label: 'Exportar datos…', accelerator: 'CmdOrCtrl+E', click: () => send('export') },
        { label: 'Importar datos…', accelerator: 'CmdOrCtrl+O', click: () => send('import') },
        { type: 'separator' },
        {
          label: 'Abrir carpeta de datos',
          click: () => shell.openPath(dataDir()),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { label: 'Hoy', accelerator: 'CmdOrCtrl+1', click: () => send('go:dashboard') },
        { label: 'Juegos', accelerator: 'CmdOrCtrl+2', click: () => send('go:games') },
        { label: 'Historial', accelerator: 'CmdOrCtrl+3', click: () => send('go:history') },
        { label: 'Ajustes', accelerator: 'CmdOrCtrl+4', click: () => send('go:settings') },
        { type: 'separator' },
        { role: 'reload', label: 'Recargar' },
        { role: 'forceReload', label: 'Forzar recarga' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom original' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de Diary Check',
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Acerca de Diary Check',
              message: `Diary Check ${app.getVersion()}`,
              detail:
                `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}\n\n` +
                `Tus datos se guardan en:\n${dataPath()}`,
              buttons: ['Cerrar'],
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* -------------------------------------------------------------------------- */
/* IPC                                                                        */
/* -------------------------------------------------------------------------- */

function registerIpc() {
  ipcMain.handle('data:load', () => loadData());
  ipcMain.handle('data:save', (_event, data) => saveData(data));

  ipcMain.handle('data:export', async (_event, { data, suggestedName }) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar datos de Diary Check',
      defaultPath: path.join(app.getPath('documents'), suggestedName || 'diary-check.json'),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    await writeJsonAtomic(filePath, data);
    return { ok: true, path: filePath };
  });

  ipcMain.handle('data:import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar datos de Diary Check',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || filePaths.length === 0) return { ok: false, canceled: true };
    try {
      const raw = await fsp.readFile(filePaths[0], 'utf8');
      return { ok: true, data: JSON.parse(raw), path: filePaths[0] };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('notify', (_event, { title, body }) => {
    if (!Notification.isSupported()) return { ok: false };
    const notification = new Notification({ title, body, silent: false });
    notification.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    });
    notification.show();
    return { ok: true };
  });

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    platform: process.platform,
    dataPath: dataPath(),
    packaged: app.isPackaged,
  }));

  ipcMain.handle('app:open-data-folder', async () => {
    await shell.openPath(dataDir());
    return { ok: true };
  });

  ipcMain.handle('app:open-external', async (_event, url) => {
    if (typeof url === 'string' && /^https?:/.test(url)) {
      await shell.openExternal(url);
      return { ok: true };
    }
    return { ok: false };
  });
}

/* -------------------------------------------------------------------------- */
/* Ciclo de vida                                                              */
/* -------------------------------------------------------------------------- */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.diarycheck.app');
    registerIpc();
    buildMenu();
    await createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
