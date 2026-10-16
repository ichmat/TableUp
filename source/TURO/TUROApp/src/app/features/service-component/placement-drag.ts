import { signal } from '@angular/core';

/** En deçà, c'est un toucher : il ouvre la fiche comme avant */
export const DRAG_THRESHOLD_PX = 6;

/** Le fantôme qui suit le doigt : nom et couverts */
export interface DragGhost { label: string, x: number, y: number }

export type DropTarget = { tableId?: string, combinationId?: string };

interface Handlers {
  onStart: () => void,
  onDrop: (target: DropTarget | null) => void,
}

/**
 * Le glisser du placement (§5.8). Un appui ne devient un glisser qu'au-delà du seuil ; pendant le glisser, le rail
 * est inerte (§5.2) ; au lâcher, la table ou la combinaison sous le pointeur est la cible
 */
export class PlacementDrag {
  private _ghost = signal<DragGhost | null>(null);
  ghost = this._ghost.asReadonly();

  private _press: { pointerId: number, x: number, y: number, label: string, handlers: Handlers, dragging: boolean } | null = null;

  constructor(private _hitTest: (x: number, y: number) => Element | null = (x, y) => document.elementFromPoint(x, y)) {}

  press(event: PointerEvent, label: string, handlers: Handlers) {
    this.cancel();
    this._press = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, label, handlers, dragging: false };
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onCancel);
  }

  cancel() {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onCancel);
    document.body.classList.remove('placement-dragging');
    this._ghost.set(null);
    this._press = null;
  }

  private onMove = (event: PointerEvent) => {
    const press = this._press;
    if (press === null || event.pointerId !== press.pointerId) {
      return;
    }
    if (!press.dragging) {
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_THRESHOLD_PX) {
        return;
      }
      press.dragging = true;
      document.body.classList.add('placement-dragging');
      press.handlers.onStart();
    }
    this._ghost.set({ label: press.label, x: event.clientX, y: event.clientY });
  };

  private onUp = (event: PointerEvent) => {
    const press = this._press;
    if (press === null || event.pointerId !== press.pointerId) {
      return;
    }
    const dragging = press.dragging;
    this.cancel();
    if (!dragging) {
      return;
    }
    // Le clic qui suit un glisser ne doit pas rouvrir la pastille d'où l'on est parti
    const swallow = (click: Event) => click.stopPropagation();
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }));
    press.handlers.onDrop(targetAt(this._hitTest(event.clientX, event.clientY)));
  };

  private onCancel = () => this.cancel();
}

function targetAt(element: Element | null): DropTarget | null {
  const holder = element?.closest('[data-table-id], [data-combination-id]') ?? null;
  if (holder === null) {
    return null;
  }
  const tableId = holder.getAttribute('data-table-id');
  return tableId !== null ? { tableId } : { combinationId: holder.getAttribute('data-combination-id')! };
}
