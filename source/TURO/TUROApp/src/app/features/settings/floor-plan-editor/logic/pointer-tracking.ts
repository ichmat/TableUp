export interface PointerHandlers {
  move: (event: PointerEvent) => void,
  /** Doigt levé ou geste interrompu par le navigateur */
  end: (event: PointerEvent) => void,
}

/**
 * Suit un geste commencé par `start` sur toute la fenêtre : le doigt peut sortir de l'élément touché.
 * Renvoie de quoi l'interrompre (par exemple quand un pincement commence)
 */
export function trackPointer(start: PointerEvent, handlers: PointerHandlers): () => void {
  const id = start.pointerId;
  const move = (event: PointerEvent) => {
    if (event.pointerId === id) {
      handlers.move(event);
    }
  };
  const end = (event: PointerEvent) => {
    if (event.pointerId === id) {
      stop();
      handlers.end(event);
    }
  };
  const stop = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  return stop;
}
