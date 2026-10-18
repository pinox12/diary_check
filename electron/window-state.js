/**
 * Estado de la ventana principal (tamaño y posición guardados).
 *
 * Es lógica pura para poder probarla con Node sin arrancar Electron:
 * las pantallas disponibles se pasan como lista de áreas de trabajo.
 */

const DEFAULT_BOUNDS = { width: 1240, height: 860 };

/**
 * Decide con qué tamaño y posición abrir la ventana.
 *
 * - Si no hay nada guardado, o está incompleto, usa el tamaño por defecto.
 * - Nunca abre más grande que la pantalla más grande disponible.
 * - Si las coordenadas guardadas ya no caen en ninguna pantalla (por ejemplo al
 *   desconectar el monitor externo, muy habitual en Windows), no se usan: la
 *   ventana se abre centrada en lugar de quedar invisible fuera de pantalla.
 *
 * @param {unknown} saved estado leído de window-state.json
 * @param {{x: number, y: number, width: number, height: number}[]} workAreas
 */
function resolveWindowState(saved, workAreas) {
  if (!saved || typeof saved !== 'object') return { ...DEFAULT_BOUNDS };
  const state = /** @type {{x?: number, y?: number, width?: number, height?: number}} */ (saved);
  if (typeof state.width !== 'number' || typeof state.height !== 'number')
    return { ...DEFAULT_BOUNDS };
  if (workAreas.length === 0) return { ...DEFAULT_BOUNDS };

  const width = Math.min(state.width, Math.max(...workAreas.map((area) => area.width)));
  const height = Math.min(state.height, Math.max(...workAreas.map((area) => area.height)));
  const maximized = state.maximized === true ? { maximized: true } : {};

  const positioned =
    typeof state.x === 'number' &&
    typeof state.y === 'number' &&
    workAreas.some(
      (area) =>
        state.x < area.x + area.width &&
        state.x + Math.min(width, 160) > area.x &&
        state.y < area.y + area.height &&
        state.y + 40 > area.y,
    );

  if (!positioned) return { width, height, ...maximized };
  return { width, height, x: state.x, y: state.y, ...maximized };
}

module.exports = { DEFAULT_BOUNDS, resolveWindowState };
