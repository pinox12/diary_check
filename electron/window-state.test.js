/**
 * Pruebas de `electron/window-state.js` con el runner de Node (sin navegador ni
 * Electron): `npm run test:electron`.
 *
 * Cubren el caso que más se rompe en Windows: el estado guardado apunta a un
 * monitor que ya no existe y la ventana se abriría fuera de pantalla.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { DEFAULT_BOUNDS, resolveWindowState } = require('./window-state');

const FULL_HD = { x: 0, y: 0, width: 1920, height: 1040 };
const LAPTOP = { x: 0, y: 0, width: 1366, height: 728 };
const SECOND = { x: 1920, y: 0, width: 1920, height: 1040 };

/** ¿Caería la ventana dentro de alguna de las pantallas? */
function isVisible(state, workAreas) {
  if (state.x === undefined || state.y === undefined) return true;
  const width = Math.min(state.width, 160);
  return workAreas.some(
    (area) =>
      state.x < area.x + area.width &&
      state.x + width > area.x &&
      state.y < area.y + area.height &&
      state.y + 40 > area.y,
  );
}

test('usa el tamaño por defecto si no hay estado guardado', () => {
  assert.deepEqual(resolveWindowState(null, [FULL_HD]), { ...DEFAULT_BOUNDS });
  assert.deepEqual(resolveWindowState(undefined, [FULL_HD]), { ...DEFAULT_BOUNDS });
});

test('ignora un estado corrupto o incompleto', () => {
  assert.deepEqual(resolveWindowState('texto', [FULL_HD]), { ...DEFAULT_BOUNDS });
  assert.deepEqual(resolveWindowState({ width: 1000 }, [FULL_HD]), { ...DEFAULT_BOUNDS });
  assert.deepEqual(resolveWindowState({ x: 10, y: 10 }, [FULL_HD]), { ...DEFAULT_BOUNDS });
});

test('respeta posición y tamaño si siguen en pantalla', () => {
  const state = { x: 100, y: 80, width: 1200, height: 800 };
  assert.deepEqual(resolveWindowState(state, [FULL_HD]), state);
});

test('mantiene la posición si el monitor secundario sigue conectado', () => {
  const state = { x: 2600, y: 200, width: 1200, height: 800 };
  assert.deepEqual(resolveWindowState(state, [FULL_HD, SECOND]), state);
});

test('centra la ventana si el monitor guardado ya no está', () => {
  const state = { x: 2600, y: 200, width: 1200, height: 800 };
  const result = resolveWindowState(state, [FULL_HD]);
  assert.equal(result.x, undefined);
  assert.equal(result.y, undefined);
  assert.equal(result.width, 1200);
  assert.equal(result.height, 800);
});

test('centra la ventana si se guardó con un monitor a la izquierda ya ausente', () => {
  const result = resolveWindowState({ x: -1600, y: 100, width: 1200, height: 800 }, [FULL_HD]);
  assert.equal(result.x, undefined);
  assert.equal(result.y, undefined);
});

test('recorta el tamaño a la pantalla disponible', () => {
  const result = resolveWindowState({ x: 10, y: 10, width: 3000, height: 2000 }, [LAPTOP]);
  assert.equal(result.width, LAPTOP.width);
  assert.equal(result.height, LAPTOP.height);
  assert.equal(result.x, 10);
  assert.equal(result.y, 10);
});

test('conserva el estado maximizado aunque cambie de pantalla', () => {
  const positioned = resolveWindowState(
    { x: 100, y: 80, width: 1200, height: 800, maximized: true },
    [FULL_HD],
  );
  assert.equal(positioned.maximized, true);

  const orphaned = resolveWindowState(
    { x: 2600, y: 200, width: 1200, height: 800, maximized: true },
    [FULL_HD],
  );
  assert.equal(orphaned.maximized, true);
  assert.equal(orphaned.x, undefined);
});

test('sin información de pantallas vuelve a los valores por defecto', () => {
  assert.deepEqual(resolveWindowState({ x: 1, y: 1, width: 900, height: 700 }, []), {
    ...DEFAULT_BOUNDS,
  });
});

test('nunca devuelve una ventana invisible en pantallas habituales', () => {
  const pantallas = [
    LAPTOP,
    FULL_HD,
    SECOND,
    [{ x: -1920, y: 0, width: 1920, height: 1040 }],
  ].flat();
  const candidatos = [
    null,
    'texto',
    { width: 3000, height: 2200 },
    { x: 2600, y: 200, width: 1200, height: 800 },
    { x: -3000, y: -2000, width: 1200, height: 800 },
    { x: 0, y: 0, width: 300, height: 200 },
    { x: 1900, y: 1000, width: 1200, height: 800 },
  ];
  for (const [index, candidate] of candidatos.entries()) {
    const result = resolveWindowState(candidate, [pantallas[index % pantallas.length]]);
    assert.ok(
      isVisible(result, [pantallas[index % pantallas.length]]),
      `estado invisible para ${JSON.stringify(candidate)}`,
    );
    assert.ok(result.width > 0 && result.height > 0, 'tamaño no válido');
  }
});
