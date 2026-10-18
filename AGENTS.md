# AGENTS.md — Diary Check

App de misiones gacha (**Angular 22** standalone + signals, Tailwind 4) que corre como **web y como
app Electron** con el mismo código y un único JSON de datos. Interfaz, comentarios, README y nombres
de los tests están **en español**: escribe en español todo lo que vea el usuario.

## Comandos

| Comando                                                | Notas                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| `npm test`                                             | Vitest + jsdom (lógica) **y** `node --test electron/` (ventana)             |
| `npm run test:electron`                                | solo `electron/*.test.js`, con el runner de Node, sin Electron ni navegador |
| `npx ng test --watch=false --filter "periodo semanal"` | subconjunto de tests (ver aviso abajo)                                      |
| `npx ng build`                                         | build de **producción** (`defaultConfiguration: production`, con budgets)   |
| `npx ng build --configuration development`             | build sin optimizar, para depurar                                           |
| `npm run electron`                                     | abre Electron con el build existente: **requiere `ng build` antes**         |
| `npm run dist:linux`                                   | build de producción + AppImage y `.deb` en `release/`                       |
| `npm run dist:win`                                     | build de producción + instalador NSIS y `.exe` portable en `release/`       |

- El `--filter` de `ng test` casa contra **nombres de suite/test, no contra rutas de fichero**. Como
  los nombres están en español, `--filter "streak"` no ejecuta nada; usa el nombre real
  (`--filter "periodo diario"`, `--filter "progreso por juego"`).
- **No hay script ni config de lint/typecheck**: el typecheck es `ng build` (con `strict`,
  `strictTemplates`, `noPropertyAccessFromIndexSignature`). Formato: `npx prettier --write .`
  (printWidth 100, comillas simples, parser `angular` para HTML).
- Los tests cubren solo lógica pura (`core/logic/*.spec.ts`, `core/storage/migrate.spec.ts`); no hay
  tests de componentes ni `TestBed`. Añade el spec junto al fichero, no en otra carpeta.
- El código de Electron se prueba **sin arrancar Electron**: `electron/window-state.js` es lógica pura
  y tiene su `*.test.js`. Para probar `main.js` (IPC, guardado) se puede simular el módulo `electron`
  interceptando `Module._load` en un script de Node suelto.

## Arquitectura (lo que no dicen los nombres)

- `DataStore` (`core/state/data.store.ts`) es la **única fuente de verdad**: un signal con todo el
  `AppData` y autoguardado con debounce de 400 ms. Los componentes leen `store.data()` y llaman a sus
  métodos; no crees estado global paralelo.
- `core/platform/platform.service.ts` + `storage/storage.factory.ts` abstraen el entorno: Electron usa
  el puente `window.diary` (preload) y escribir en `data.json`; la web usa `localStorage`
  (`diary-check:data`). La UI no comprueba el entorno salvo con `platform.isElectron`.
- Los cálculos (resets, periodos, rachas, progreso) viven en `core/logic/`, sin Angular y testeados:
  es ahí donde va cualquier lógica nueva de fechas o estadísticas.
- Rutas con `withHashLocation()` **a propósito**: el mismo bundle debe funcionar en `file://` dentro del
  asar. No lo cambies a rutas normales.
- Zoneless (no hay zone.js): el repintado va por signals y por el reloj de `core/state/clock.service.ts`.
  No hace falta `ChangeDetectorRef` ni forzar repintados con `setTimeout`.

## Trampas ya encontradas (no las repitas)

- `withComponentInputBinding()` entrega `undefined` en rutas sin ese parámetro. Los inputs de ruta se
  declaran `input<string | undefined>(undefined)` y se normalizan en un `computed` (`gameId`).
- Un error en tiempo de ejecución dentro de una plantilla **aborta toda la pasada de actualización**:
  la pantalla queda con los elementos estáticos y **sin ningún binding**, y el fallo solo aparece en la
  consola del navegador (el `ErrorHandler` no lo reimprime y `ng build` no lo detecta). Si tocas
  plantillas, verifícalo en un navegador.
- `<select>`: Angular aplica el `[value]` del `<select>` **antes** de crear las opciones de un `@for`,
  así que se pierde y el desplegable sale vacío o con la primera opción. Marca la opción con
  `[selected]`; si las opciones son fijas, usa el atributo `value="12"` en el `<option>`.
- Tailwind 4 (`src/styles.css`, comentado allí): los colores de `@theme` deben ser **valores
  literales**, no referencias `var()`, o los modificadores de opacidad (`bg-accent/12`) no generan
  nada. Las sombras usan vars propias `--s-card`/`--s-pop` porque `@apply shadow-*` incrusta el valor
  literal y no seguiría el cambio de tema (el tema claro se hace reasignando `--color-*` en
  `html.theme-light`).
- Cualquier cambio en la forma de `AppData` necesita migración en `core/storage/migrate.ts` + subir
  `APP_DATA_VERSION` (`core/models/models.ts`) + test en `migrate.spec.ts`: el JSON del usuario puede
  venir de versiones anteriores o estar corrupto.
- Si cambias `public/icon.svg`, regenera también `build/icon.png` (1024×1024) con `rsvg-convert`: es el
  icono que usa electron-builder, no el del navegador. Para Windows **no hace falta** un `.ico`:
  electron-builder convierte el PNG (basta que sea ≥256×256) y lo deja en `build/*.ico`, que está
  ignorado.
- Windows: las notificaciones necesitan `app.setAppUserModelId()` con el **mismo `appId`** del
  instalador (`com.diarycheck.app`), y las escrituras de `data.json` pueden fallar con `EPERM`/`EBUSY`
  por culpa del antivirus o de OneDrive (por eso `writeJsonAtomic` reintenta).
- Estado de la ventana: nunca abras la ventana con las coordenadas guardadas sin comprobar que siguen
  en pantalla (`electron/window-state.js`); al desconectar un monitor quedaría invisible.
- `npx prettier --check .` **no** sale limpio: 35 ficheros de `src/` (plantillas HTML incluidas) no
  siguen el formato de `.prettierrc` y `--write .` los reescribe todos. Formatea solo los ficheros que
  toques y no reformatees plantillas sin volver a comprobar el render en un navegador: el espacio en
  blanco dentro de una plantilla puede cambiar lo que se ve.

## Empaquetado

- `electron/main.js` + `electron/preload.js`: contexto aislado, `sandbox: true`, IPC por `window.diary`.
  El modo dev/prod se decide por el flag `--dev`, no por `NODE_ENV`.
- `electron-builder.yml` lista a mano `electron/**/*` y `dist/diary-check/browser/**/*`: si mueves la
  salida del build, actualiza ambas entradas.
- El `.deb` exige `homepage` y `author.email` en `package.json` (hoy tienen valores de ejemplo), y solo
  se pueden generar instaladores de la plataforma en la que compilas.
- Windows tiene dos objetivos: `nsis` (instalador, instala por usuario y no pide administrador) y
  `portable` (un único `.exe` sin instalar). Ambos se pueden compilar desde Linux con **Wine**
  instalado; el `.dmg` de macOS no.
- Los `.exe` no van firmados: SmartScreen avisará la primera vez. Es lo esperado sin un certificado de
  código.

## Estado del repo

- Es un repositorio git con un único commit raíz en la rama `main`; no hay remoto ni CI,
  `.cursor/rules`, `CLAUDE.md` ni `opencode.json`. La doc de producto está en `README.md`.
- `dist/` y `release/` son artefactos ignorados; `release/` ocupa cientos de MB y se puede borrar.
- `build/icon.png` **sí** se versiona (es la fuente del icono de electron-builder); los `.ico`/`.icns`
  derivados no.
