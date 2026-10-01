import { ChangeDetectionStrategy, Component, computed, ElementRef, input, linkedSignal, OnDestroy, output, untracked, viewChild } from '@angular/core';
import { DecorType, PlanDecor, PlanTable, Zone } from '../../../models';
import { fitView, panBy, PlanView, toViewBox, zoomAt, ZOOM_STEP } from './floor-plan-view';

const GRID_STEP = 0.25;

export interface Point { x: number, y: number }

/** Un appui sur un objet du plan, avec sa position en mètres */
export interface PlanPointerEvent<T> {
  item: T,
  point: Point,
  event: PointerEvent,
}

let nextGridId = 0;

/** Le canevas est partagé et ne dépend pas de l'éditeur, d'où ses propres noms de décor */
const DECOR_NAMES: Record<DecorType, string> = {
  Wall: 'Mur', Door: 'Porte', Bar: 'Bar', Pass: 'Passe', Pillar: 'Pilier', Stairs: 'Escalier', Other: 'Autre',
};

/**
 * Le plan d'une salle, à l'échelle : la salle, la grille, les tables. Purement présentationnel :
 * il dessine et annonce les appuis, en mètres ; ceux qui l'utilisent (éditeur, service) décident de leur sens
 */
@Component({
  selector: 'app-floor-plan-canvas',
  templateUrl: './floor-plan-canvas-component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block relative overflow-hidden' },
})
export class FloorPlanCanvasComponent implements OnDestroy {
  zone = input.required<Zone>();
  tables = input<readonly PlanTable[]>([]);
  selectedIds = input<readonly string[]>([]);
  /** Tables à marquer : dans l'éditeur, celles qui empêchent la publication */
  flaggedIds = input<readonly string[]>([]);
  showGrid = input(true);

  /** Les repères de la salle, dessinés sous les tables (EDIT-08) */
  decors = input<readonly PlanDecor[]>([]);

  tablePointerDown = output<PlanPointerEvent<PlanTable>>();
  decorPointerDown = output<PlanPointerEvent<PlanDecor>>();
  backgroundClick = output<Point>();

  private _svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');

  protected readonly gridStep = GRID_STEP;
  protected readonly gridId = `plan-grid-${nextGridId++}`;

  /** Revient à la salle entière quand on change de salle */
  protected view = linkedSignal<string, PlanView>({
    source: () => this.zone().id,
    computation: () => untracked(() => fitView(this.zone())),
  });
  protected viewBox = computed(() => toViewBox(this.view(), this.zone()));

  /** La position en mètres, dans le repère de la salle, d'un point de l'écran */
  toMetres(clientX: number, clientY: number): Point {
    const svg = this._svg().nativeElement;
    const matrix = svg.getScreenCTM();
    if (matrix === null) {
      return { x: 0, y: 0 };
    }
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  /** Le point de l'écran tombe-t-il sur le canevas : un dépôt de palette y est-il possible ? */
  containsClient(clientX: number, clientY: number): boolean {
    const box = this._svg().nativeElement.getBoundingClientRect();
    return clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom;
  }

  /** Deux doigts posés : le parent interrompt le geste qu'il suivait (le déplacement d'une table) */
  pinchStart = output<void>();

  protected readonly zoomStep = ZOOM_STEP;
  protected zoomPercent = computed(() => Math.round(this.view().scale * 100));

  /** Les pointeurs posés sur le canevas, en coordonnées d'écran */
  private _pointers = new Map<number, { x: number, y: number }>();
  /** Un appui dans le vide : clic s'il ne bouge pas, déplacement de la vue sinon */
  private _press: { x: number, y: number, moved: boolean } | null = null;

  zoomBy(factor: number) {
    const view = this.view();
    this.view.set(zoomAt(view, this.zone(), factor, { x: view.centreX, y: view.centreY }));
  }

  protected fit() {
    this.view.set(fitView(this.zone()));
  }

  protected onWheel(event: WheelEvent) {
    event.preventDefault();
    // proportionnel : une molette crantée comme un pavé tactile zooment au même rythme
    const factor = Math.exp(-event.deltaY * 0.0015);
    this.view.set(zoomAt(this.view(), this.zone(), factor, this.toMetres(event.clientX, event.clientY)));
  }

  protected onTablePointerDown(table: PlanTable, event: PointerEvent) {
    event.stopPropagation();
    // le second doigt d'un pincement zoome : il ne prend pas la table sous lui
    if (this.track(event, false) > 1) {
      return;
    }
    this.tablePointerDown.emit({ item: table, point: this.toMetres(event.clientX, event.clientY), event });
  }

  protected onDecorPointerDown(decor: PlanDecor, event: PointerEvent) {
    event.stopPropagation();
    if (this.track(event, false) > 1) {
      return;
    }
    this.decorPointerDown.emit({ item: decor, point: this.toMetres(event.clientX, event.clientY), event });
  }

  /** Le libellé saisi, sinon le nom du type, en capitales */
  protected decorLabel(decor: PlanDecor): string {
    return (decor.label?.trim() || DECOR_NAMES[decor.type]).toUpperCase();
  }

  protected decorStroke(decor: PlanDecor): string {
    if (this.selectedIds().includes(decor.id)) {
      return 'stroke-interactive';
    }
    return this.flaggedIds().includes(decor.id) ? 'stroke-red-700' : 'stroke-slate';
  }

  protected onSvgPointerDown(event: PointerEvent) {
    this.track(event, true);
  }

  /** Résout le nombre de pointeurs posés, celui-ci compris */
  private track(event: PointerEvent, inVoid: boolean): number {
    if (this._pointers.size === 0) {
      window.addEventListener('pointermove', this.onWindowMove);
      window.addEventListener('pointerup', this.onWindowUp);
      window.addEventListener('pointercancel', this.onWindowUp);
    }
    this._pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this._pointers.size === 2) {
      this._press = null;
      this.pinchStart.emit();
    } else if (this._pointers.size === 1 && inVoid) {
      this._press = { x: event.clientX, y: event.clientY, moved: false };
    }
    return this._pointers.size;
  }

  private onWindowMove = (event: PointerEvent) => {
    const previous = this._pointers.get(event.pointerId);
    if (previous === undefined) {
      return;
    }
    const current = { x: event.clientX, y: event.clientY };

    if (this._pointers.size === 2) {
      const [other] = [...this._pointers.entries()].filter(([id]) => id !== event.pointerId).map(([, p]) => p);
      const before = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 };
      const after = { x: (current.x + other.x) / 2, y: (current.y + other.y) / 2 };
      const factor = Math.hypot(current.x - other.x, current.y - other.y) / Math.max(1, Math.hypot(previous.x - other.x, previous.y - other.y));
      this._pointers.set(event.pointerId, current);
      const zoomed = zoomAt(this.view(), this.zone(), factor, this.toMetres(after.x, after.y));
      const pixels = this.pixelsPerMetre();
      this.view.set(panBy(zoomed, this.zone(), (after.x - before.x) / pixels, (after.y - before.y) / pixels));
      return;
    }

    this._pointers.set(event.pointerId, current);
    const press = this._press;
    if (press === null) {
      return;
    }
    if (!press.moved && Math.hypot(current.x - press.x, current.y - press.y) < 4) {
      return;
    }
    press.moved = true;
    const pixels = this.pixelsPerMetre();
    this.view.set(panBy(this.view(), this.zone(), (current.x - previous.x) / pixels, (current.y - previous.y) / pixels));
  };

  private onWindowUp = (event: PointerEvent) => {
    if (!this._pointers.delete(event.pointerId)) {
      return;
    }
    const press = this._press;
    if (this._pointers.size === 0) {
      this._press = null;
      this.stopTracking();
      if (press !== null && !press.moved && event.type === 'pointerup') {
        this.backgroundClick.emit(this.toMetres(event.clientX, event.clientY));
      }
    }
  };

  private stopTracking() {
    window.removeEventListener('pointermove', this.onWindowMove);
    window.removeEventListener('pointerup', this.onWindowUp);
    window.removeEventListener('pointercancel', this.onWindowUp);
  }

  ngOnDestroy() {
    this.stopTracking();
  }

  /** Échelle d'affichage actuelle : combien de pixels d'écran pour un mètre */
  private pixelsPerMetre(): number {
    return this._svg().nativeElement.getScreenCTM()?.a || 1;
  }

  protected tableClass(table: PlanTable): string {
    if (this.selectedIds().includes(table.id)) {
      return 'fill-surface stroke-interactive';
    }
    if (this.flaggedIds().includes(table.id)) {
      return 'fill-surface stroke-red-700';
    }
    return 'fill-app stroke-slate';
  }

  protected strokeWidth(table: PlanTable): number {
    return this.selectedIds().includes(table.id) || this.flaggedIds().includes(table.id) ? 3 : 1.5;
  }
}
