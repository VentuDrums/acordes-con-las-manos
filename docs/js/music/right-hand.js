// Qué hace cada gesto de la mano derecha según los ajustes.
import { currentPatMap } from '../settings.js';

// Devuelve { setting, value } con lo que cambia el gesto ('inversion' o 'pattern', este último en
// el compás elegido), o null si el gesto no cambia nada (el puño es el fader y se trata aparte).
export function rightAction(settings, gesture) {
  if (settings.rightMode === 'inversion') {
    const value = settings.invMap[gesture];
    return value ? { setting: 'inversion', value } : null;
  }
  const value = currentPatMap(settings)[gesture];
  return value ? { setting: 'pattern', value } : null;
}
