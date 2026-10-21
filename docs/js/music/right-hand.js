// Qué hace cada gesto de la mano derecha según los ajustes.

// Devuelve { setting, value } con el ajuste que cambia el gesto ('inversion' o 'pattern'),
// o null si el gesto no cambia nada (el puño es el fader de volumen y se trata aparte).
export function rightAction(settings, gesture) {
  if (settings.rightMode === 'inversion') {
    const value = settings.invMap[gesture];
    return value ? { setting: 'inversion', value } : null;
  }
  const value = settings.patMap[gesture];
  return value ? { setting: 'pattern', value } : null;
}
