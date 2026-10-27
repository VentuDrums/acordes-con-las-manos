// Marcar el tempo con toques: calcula los pulsos por minuto a partir de los últimos toques.
// Sin dependencias (se prueba con node).

// Si entre dos toques pasa más que esto, se empieza a contar de nuevo.
const RESET_MS = 2000;
// Toques que se tienen en cuenta (los más recientes): el tempo se va afinando y sigue los cambios.
const MAX_TAPS = 8;

export function createTapTempo([min, max]) {
  let taps = [];
  return {
    // Registra un toque (en milisegundos). Devuelve los ppm redondeados, o null si aún falta un toque.
    tap(time) {
      if (taps.length && time - taps.at(-1) > RESET_MS) taps = [];
      taps.push(time);
      if (taps.length > MAX_TAPS) taps.shift();
      if (taps.length < 2) return null;
      const beat = (taps.at(-1) - taps[0]) / (taps.length - 1);
      return Math.min(max, Math.max(min, Math.round(60000 / beat)));
    },
    get count() { return taps.length; },
    reset() { taps = []; },
  };
}
