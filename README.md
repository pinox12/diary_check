# Diary Check

Seguimiento de misiones **diarias** y **semanales** de tus juegos gacha. Cada juego tiene su propio
horario de reinicio (zona horaria, hora del reset diario y día + hora del reset semanal), así que el
panel siempre sabe qué te queda pendiente **de verdad** en cada servidor.

Funciona como **app de escritorio (Electron)** y como **web**, con el mismo código y los mismos datos:
un único archivo JSON.

---

## Funciones

- **Panel «Hoy»**: tarjeta por juego con portada, progreso de diarias y semanales, lista de misiones
  para marcar en un toque, y **cuenta atrás en vivo** al próximo reset de cada tipo.
- **Cada juego con su reset**: zona horaria IANA, hora del reset diario, día de la semana + hora del
  reset semanal. Con vista previa dentro del formulario.
- **Misiones con contador opcional**: casilla simple o progreso `2/3` para las que piden varias
  repeticiones (jefes, runs, tienda…).
- **Historial y rachas**: mapa de calor de los últimos 30/60/90 días, 12 semanas, racha actual y
  mejor racha por misión, y porcentaje de cumplimiento.
- **Recordatorios**: avisos nativos antes del reset (con antelación configurable) y de las semanales,
  más un resumen al abrir la app. Nunca repite el mismo aviso dentro del mismo periodo.
- **Portadas automáticas**: al escribir el nombre se buscan imágenes en App Store (iTunes), AniList y
  Wikipedia; también puedes pegar una URL o subir un archivo. La imagen se comprime (320 px WebP) y se
  guarda dentro de tus datos, así que se ve sin conexión.
- **Reglas predefinidas** para 25 gachas populares (Genshin, HSR, ZZZ, WuWa, Blue Archive, Arknights,
  Nikke, FGO, Umamusume…): un clic y ya tienes el horario configurado (siempre editable).
- **Exportar / importar JSON**, borrado selectivo del historial y aviso del espacio usado.
- **Tema oscuro y claro**, interfaz responsive (escritorio y móvil) y atajos de teclado en Electron.

---

## Requisitos

- Node.js 20.19+, 22.12+ o 24+ (probado con Node 26).
- npm 10+.
- **Windows**: Windows 10 u 11 de 64 bits. No hace falta nada más: los instaladores traen todo lo
  necesario.
- Linux: para empaquetar hacen falta `libgtk-3`, `libnss3`, `libxss1`, `libxtst6`, `libatspi2.0-0` y
  `xdg-utils` (las dependencias declaradas en `electron-builder.yml`).

## Puesta en marcha

```bash
npm install

# Web en el navegador (http://localhost:4200)
npm run dev

# App de escritorio con recarga en caliente
npm run dev:electron

# Tests de la lógica (resets, rachas, migración, estadísticas)
npm test
```

## Compilar y empaquetar

```bash
npm run build          # build web en dist/diary-check
npm run build:web      # build de producción
npm run electron       # abre la app usando el build ya generado
npm run dist           # instaladores para tu sistema
npm run dist:linux     # AppImage + .deb
npm run dist:win       # instalador NSIS + versión portable (.exe)
npm run dist:mac       # .dmg
```

Los instaladores quedan en `release/`:

| Plataforma | Ficheros                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------- |
| Linux      | `Diary Check-0.1.0.AppImage`, `diary-check_0.1.0_amd64.deb`                                   |
| Windows    | `Diary Check Setup 0.1.0.exe` (instalador), `Diary Check 0.1.0 (portable).exe` (sin instalar) |
| macOS      | `Diary Check-0.1.0.dmg`                                                                       |

### En Windows

1. Descarga o compila `Diary Check Setup 0.1.0.exe` y ejecútalo: instala la app en tu carpeta de
   usuario (no pide permisos de administrador) y crea los accesos directos del menú Inicio y del
   escritorio.
2. Si prefieres no instalar nada, usa `Diary Check 0.1.0 (portable).exe`: se ejecuta directamente
   desde donde lo tengas (aunque los datos se guardan igualmente en `%APPDATA%\diary-check`).
3. La primera vez, Windows SmartScreen puede avisar de que el programa no está firmado digitalmente
   (**Más información → Ejecutar de todas formas**). Se puede evitar firmando el `.exe` con un
   certificado de código, algo que solo hace falta si vas a distribuirlo públicamente.
4. Desinstalar la app **no borra tu historial**: los datos siguen en `%APPDATA%\diary-check` por si
   vuelves a instalarla. Para eliminarlos, borra esa carpeta a mano.

Para compilar desde aquí:

```bash
npm run dist:win
```

Solo puedes generar instaladores de la plataforma en la que compilas: Linux desde Linux, Windows
desde Windows y macOS desde macOS. Con **Wine** instalado puedes compilar el instalador de Windows
desde Linux o macOS (es como se ha verificado este proyecto), pero el `.dmg` siempre requiere macOS.

> **Antes de generar el `.deb`**: electron-builder exige los campos `homepage` y `author.email` de
> `package.json`. Ahora mismo tienen valores de ejemplo; cámbialos por los tuyos si vas a distribuir
> el paquete.

---

## Cómo se calculan los resets

La regla es simple y está cubierta por tests: se trabaja siempre con **hora de pared** del servidor
del juego, nunca con diferencias fijas de UTC.

1. Se toma la hora actual en la zona horaria del juego.
2. Se le resta la hora de reset configurada (por ejemplo `04:00`).
3. La **fecha** resultante es el periodo: si son las 02:30 y el reset es a las 04:00, esa marca
   pertenece al día anterior.
4. Para las semanales se retrocede hasta el día de reset configurado y se usa la semana ISO como
   identificador (`2026-W42`).

Así, un juego que reinicia el **martes** a las 05:00 y otro que reinicia el **lunes** a las 04:00
conviven sin problemas, y los cambios de horario de verano no descuadran nada.

Cada marca se guarda como `misión + tipo + periodo → progreso`, lo que permite reconstruir rachas y
mapas de calor sin cálculos frágiles.

## Dónde viven tus datos

| Entorno            | Ubicación                                                                        |
| ------------------ | -------------------------------------------------------------------------------- |
| Electron (Linux)   | `~/.config/diary-check/data.json` (más `data.backup.json` y `window-state.json`) |
| Electron (Windows) | `%APPDATA%\diary-check\data.json`                                                |
| Electron (macOS)   | `~/Library/Application Support/diary-check/data.json`                            |
| Web                | `localStorage` del sitio, con exportar/importar para mover los datos             |

Desde **Ajustes → Abrir carpeta de datos** (en escritorio) llegas directamente al archivo. Las
escrituras son atómicas (`tmp` + `rename`), se reintentan si otro programa bloquea el archivo un
instante (antivirus, OneDrive…), se rota una copia de seguridad automáticamente y, si `data.json` se
corrompe, se recupera desde esa copia al abrir. En Electron, el menú **Archivo** también permite
exportar/importar con diálogos nativos.

## Estructura

```
electron/
  main.js                  ventana, menú, IPC, notificaciones, escritura atómica del JSON
  preload.js               puente seguro (window.diary) sin acceso a Node en el renderer
  window-state.js          tamaño/posición de la ventana (lógica pura, con tests)
src/app/
  core/
    models/models.ts       Game, Mission, Completion, Settings, AppData
    logic/                 lógica pura y testeable
      time.ts              zonas horarias, hora de pared, cuentas atrás
      period-keys.ts       periodos diarios/semanales, próximos resets
      streak.ts            rachas consecutivas
      progress.ts          progreso, estadísticas, mapas de calor
      presets.ts           reglas de reset de juegos conocidos
    storage/               persistencia JSON (Electron / navegador) y migración de datos
    state/                 DataStore (signals) y reloj global
    services/              portadas online, notificaciones, avisos y confirmaciones
  features/                dashboard, juegos, detalle, historial, ajustes
  shared/                  iconos, cuentas atrás, portadas, heatmap, modales
```

## Decisiones técnicas

- **Angular 22** con componentes standalone, **signals** y detección de cambios sin Zone.js: la app
  se repinta solo cuando cambia un dato o cuando el reloj avanza.
- **Tailwind CSS 4** con la paleta declarada en `@theme`; el tema claro reasigna las mismas variables,
  así que los modificadores de opacidad siguen funcionando.
- **Rutas con hash** para que el mismo bundle funcione en el servidor web y en `file://` dentro del
  asar de Electron.
- **Electron aislado**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` y una API
  mínima expuesta por el preload.
- Las portadas se buscan con APIs públicas **sin claves** (iTunes Search, AniList GraphQL y Wikipedia),
  todas con CORS abierto, así que la misma búsqueda funciona en la web y en escritorio.
- Los `<select>` que se rellenan con `@for` marcan la opción con `[selected]`, no con `[value]` en el
  `<select>`: Angular aplica el `[value]` del `select` antes de crear las opciones, así que se perdería
  y el desplegable aparecería vacío. En los desplegables con opciones fijas, el valor va como atributo
  (`<option value="12">`).
- Los inputs que llegan por la ruta (`id` en `/games/:id`) se declaran como `string | undefined`
  porque el router puede asignar `undefined` en rutas sin ese parámetro.
- En Windows las notificaciones necesitan un **AppUserModelID** que coincida con el del acceso
  directo; se fija al arrancar con el mismo `appId` que usa electron-builder.
- El estado de la ventana (`window-state.json`) se valida contra las pantallas disponibles antes de
  abrirla: si guardaste la ventana en un monitor que ya no está conectado, se abre centrada en lugar
  de quedar invisible fuera de pantalla.

## Verificado

- `npm test`: 41 tests de la lógica de periodos, rachas, estadísticas y migración, más 10 del estado
  de la ventana de Electron.
- Proceso principal de Electron ejecutado con el módulo `electron` simulado: escritura del JSON,
  rotación del backup, reintento tras un bloqueo transitorio (`EBUSY`) y recuperación de un
  `data.json` corrupto desde el backup.
- Render real de todas las pantallas (Hoy, Juegos, Detalle, Nuevo/Editar juego, Historial, Ajustes) en
  tema oscuro y claro, con datos de ejemplo: barras de progreso, cuentas atrás, heatmaps y rachas.
- Prueba funcional en navegador: completar las diarias de un juego y desmarcar una misión se refleja en
  la pantalla y se guarda en el JSON; el cambio de tema se aplica y se persiste.
- Empaquetado en Linux: `release/Diary Check-0.1.0.AppImage` y `release/diary-check_0.1.0_amd64.deb`
  (con su `.desktop` y `StartupWMClass`), y `app.asar` con el build y el código de Electron dentro.
- Empaquetado de Windows desde Linux (con Wine): `Diary Check Setup 0.1.0.exe` y
  `Diary Check 0.1.0 (portable).exe`, con `app.asar` completo y los metadatos de versión y el icono
  incrustados en el `.exe`. Arrancar la app gráficamente en Windows no se puede comprobar desde aquí.

## Tests

```bash
npm test              # lógica de la app (Vitest) + estado de ventana (runner de Node)
npm run test:electron # solo electron/window-state.test.js
```

Cubren el cálculo de periodos (resets antes/después de la hora, zonas horarias, cambio de horario de
verano, semanas ISO a caballo de año), las rachas, las estadísticas, la normalización/migración de
datos corruptos o de versiones anteriores y la posición de la ventana al cambiar de monitor.

## Licencia

MIT.
