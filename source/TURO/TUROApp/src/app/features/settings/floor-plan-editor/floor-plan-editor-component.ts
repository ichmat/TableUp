import { Component, computed, effect, inject, OnDestroy, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute, CanDeactivateFn, Router } from '@angular/router';
import { ApiError, DraftDecor, DraftTable, FloorPlanDraft, FloorPlanZone, PlanDecor, PlanTable } from '../../../models';
import { FloorPlanService } from '../../../core/services/floor-plan/floor-plan.service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { Button } from '../../../shared/components/button/button';
import { FloorPlanCanvasComponent, PlanPointerEvent } from '../../../shared/components/floor-plan/floor-plan-canvas-component';
import { DecorPalettePick, TablePaletteComponent, PalettePick } from './table-palette-component';
import { DecorPanelComponent } from './decor-panel-component';
import { TablePanelComponent } from './table-panel-component';
import { countChanges, draftFromPublished } from './logic/draft-diff';
import { DraftStore } from './logic/draft-store';
import { boundsOf, clampToZone, findFreeSpot, placeCentredAt, Point, Rect } from './logic/geometry';
import { buildTablePalette, DECOR_PALETTE, DecorPaletteEntry, TablePaletteEntry } from './logic/palette';
import { decorErrors, tableErrors } from './logic/plan-rules';
import { nextTableName } from './logic/table-naming';
import { trackPointer } from './logic/pointer-tracking';
import { formatMetres } from './logic/units';

/** Ce qui est sélectionné sur le plan : une table, ou un décor */
export interface PlanSelection {
  kind: 'table' | 'decor',
  id: string,
}

/** En dessous, un appui sur une table la sélectionne sans la déplacer */
const DRAG_THRESHOLD_PX = 4;

/**
 * L'éditeur de plan (§12) : plein écran, admin seulement. On modifie un brouillon, enregistré tout seul,
 * puis on publie : le service ne voit jamais les tables bouger (EDIT-15 à EDIT-17)
 */
@Component({
  imports: [Button, FloorPlanCanvasComponent, TablePaletteComponent, TablePanelComponent, DecorPanelComponent],
  selector: 'app-floor-plan-editor-component',
  templateUrl: './floor-plan-editor-component.html',
  host: {
    class: 'flex flex-col h-dvh w-dvw bg-app text-text',
    '(document:keydown)': 'onKeydown($event)',
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class FloorPlanEditorComponent implements OnDestroy {
  private _floorPlan = inject(FloorPlanService);
  private _modalService = inject(ModalService);
  private _router = inject(Router);

  readonly store = new DraftStore((content) => this._floorPlan.saveDraft(content).then((result) => result.error));
  protected readonly formatMetres = formatMetres;

  protected zones = this._floorPlan.zones;
  protected loadState = signal<'loading' | 'ready' | 'forbidden' | 'failed'>('loading');
  protected loadError = signal<string | null>(null);
  private _savedDraft = signal<FloorPlanDraft | null | undefined>(undefined);

  private _zoneId = signal<string | null>(inject(ActivatedRoute).snapshot.queryParamMap.get('salle'));
  readonly currentZone = computed(() =>
    this.zones().find((zone) => zone.id === this._zoneId()) ?? this.zones()[0] ?? null);

  readonly selection = signal<PlanSelection | null>(null);
  /** Position d'une table pendant qu'on la glisse : rien n'entre dans l'historique avant le lâcher */
  protected dragPreview = signal<{ id: string, x: number, y: number } | null>(null);
  protected paletteGhost = signal<{ entry: TablePaletteEntry, clientX: number, clientY: number } | null>(null);
  private _cancelGesture: (() => void) | null = null;

  private _canvas = viewChild(FloorPlanCanvasComponent);
  private _tablePanel = viewChild(TablePanelComponent);
  private _decorPanel = viewChild(DecorPanelComponent);
  /** Une publication est en cours : ni seconde publication, ni abandon */
  protected publishing = signal(false);

  protected published = computed(() => draftFromPublished(this.zones()));
  protected changeCount = computed(() => countChanges(this.published(), this.store.content()));
  protected palette = computed(() => buildTablePalette(this.store.content().tables));

  protected zoneTables = computed<PlanTable[]>(() => {
    const zone = this.currentZone();
    const preview = this.dragPreview();
    return this.store.content().tables
      .filter((table) => table.zoneId === zone?.id)
      .map((table) => preview?.id === table.id ? { ...table, x: preview.x, y: preview.y } : table);
  });

  protected selectedIds = computed(() => {
    const selection = this.selection();
    return selection === null ? [] : [selection.id];
  });

  /** Les tables et décors qui empêchent de publier, toutes salles confondues */
  protected invalidIds = computed(() => {
    const zonesById = new Map(this.zones().map((zone) => [zone.id, zone]));
    const { tables, decors } = this.store.content();
    return [
      ...tables.filter((table) => tableErrors(table, zonesById.get(table.zoneId), tables).length > 0).map((t) => t.id),
      ...decors.filter((decor) => decorErrors(decor, zonesById.get(decor.zoneId)).length > 0).map((d) => d.id),
    ];
  });

  // ---- DÉCOR ----

  protected readonly decorPalette = DECOR_PALETTE;
  /** Position d'un décor pendant qu'on le glisse */
  protected decorPreview = signal<{ id: string, x: number, y: number } | null>(null);

  protected zoneDecors = computed<PlanDecor[]>(() => {
    const zone = this.currentZone();
    const preview = this.decorPreview();
    return this.store.content().decors
      .filter((decor) => decor.zoneId === zone?.id)
      .map((decor) => preview?.id === decor.id ? { ...decor, x: preview.x, y: preview.y } : decor);
  });

  protected selectedDecor = computed(() => {
    const selection = this.selection();
    return selection?.kind === 'decor'
      ? this.store.content().decors.find((decor) => decor.id === selection.id) ?? null
      : null;
  });

  protected selectedDecorErrors = computed(() => {
    const decor = this.selectedDecor();
    return decor === null ? [] : decorErrors(decor, this.zones().find((zone) => zone.id === decor.zoneId));
  });

  protected onDecorPalettePick({ entry, event }: DecorPalettePick) {
    this.commitPanels();
    this._cancelGesture?.();
    this._cancelGesture = trackPointer(event, {
      move: () => undefined,
      end: (e) => {
        this._cancelGesture = null;
        if (e.type === 'pointerup') {
          this.dropDecorFromPalette(entry, e.clientX, e.clientY);
        }
      },
    });
  }

  dropDecorFromPalette(entry: DecorPaletteEntry, clientX: number, clientY: number): boolean {
    this.commitPanels();
    const canvas = this._canvas();
    const zone = this.currentZone();
    if (canvas === undefined || zone === null || !canvas.containsClient(clientX, clientY)) {
      return false;
    }
    const decor: DraftDecor = {
      id: crypto.randomUUID(),
      zoneId: zone.id,
      type: entry.type,
      label: null,
      width: entry.width,
      height: entry.height,
      rotation: 0,
      ...placeCentredAt(canvas.toMetres(clientX, clientY), entry, zone, this.neighboursOf(zone.id, null)),
    };
    const content = this.store.content();
    this.store.apply({ ...content, decors: [...content.decors, decor] });
    this.selection.set({ kind: 'decor', id: decor.id });
    return true;
  }

  onDecorPointerDown({ item, point, event }: PlanPointerEvent<PlanDecor>) {
    this.commitPanels();
    this.selection.set({ kind: 'decor', id: item.id });
    const canvas = this._canvas();
    const zone = this.zones().find((z) => z.id === item.zoneId);
    if (canvas === undefined || zone === undefined) {
      return;
    }
    const offset: Point = { x: point.x - item.x, y: point.y - item.y };
    let moved = false;
    this._cancelGesture?.();
    this._cancelGesture = trackPointer(event, {
      move: (e) => {
        if (!moved && Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) < DRAG_THRESHOLD_PX) {
          return;
        }
        moved = true;
        const pointer = canvas.toMetres(e.clientX, e.clientY);
        this.decorPreview.set({ id: item.id, ...clampToZone({ x: pointer.x - offset.x, y: pointer.y - offset.y }, item, zone, this.neighboursOf(zone.id, item.id)) });
      },
      end: (e) => {
        this._cancelGesture = null;
        const preview = this.decorPreview();
        this.decorPreview.set(null);
        if (e.type === 'pointerup' && preview !== null && (preview.x !== item.x || preview.y !== item.y)) {
          this.updateDecor(item.id, { x: preview.x, y: preview.y });
        }
      },
    });
  }

  updateDecor(id: string, patch: Partial<DraftDecor>) {
    const content = this.store.content();
    const decors = content.decors.map((decor) => {
      if (decor.id !== id) {
        return decor;
      }
      const merged = { ...decor, ...patch };
      const zone = this.zones().find((z) => z.id === merged.zoneId);
      return zone === undefined ? merged : { ...merged, ...clampToZone(merged, merged, zone, this.neighboursOf(zone.id, merged.id)) };
    });
    this.store.apply({ ...content, decors });
  }

  /** Le panneau nomme son décor : la sélection a pu changer entre-temps */
  onDecorPanelChange({ id, patch }: { id: string, patch: Partial<DraftDecor> }) {
    this.updateDecor(id, patch);
    if (patch.zoneId !== undefined && this.selection()?.id === id) {
      this._zoneId.set(patch.zoneId);
    }
  }

  duplicateSelectedDecor() {
    const decor = this.selectedDecor();
    const zone = decor === null ? undefined : this.zones().find((z) => z.id === decor.zoneId);
    if (decor === null || zone === undefined) {
      return;
    }
    const occupied = this.store.content().decors.filter((other) => other.zoneId === decor.zoneId);
    const copy: DraftDecor = { ...decor, id: crypto.randomUUID(), ...findFreeSpot(decor, zone, occupied) };
    const content = this.store.content();
    this.store.apply({ ...content, decors: [...content.decors, copy] });
    this.selection.set({ kind: 'decor', id: copy.id });
  }

  /** Le décor se supprime vraiment, sans confirmation : ↶ suffit */
  removeSelectedDecor() {
    const decor = this.selectedDecor();
    if (decor === null) {
      return;
    }
    const content = this.store.content();
    this.store.apply({ ...content, decors: content.decors.filter((other) => other.id !== decor.id) });
    this.selection.set(null);
  }

  constructor() {
    void this.loadDraft();
    // Le brouillon de départ ne se pose qu'une fois : un rechargement du plan publié (SignalR) ne l'écrase pas
    effect(() => {
      if (this.loadState() !== 'loading') {
        return;
      }
      if (this._floorPlan.loadFailed()) {
        untracked(() => {
          this.loadError.set("le plan publié n'a pas pu être lu.");
          this.loadState.set('failed');
        });
        return;
      }
      const draft = this._savedDraft();
      if (draft === undefined || !this._floorPlan.isLoaded()) {
        return;
      }
      untracked(() => {
        this.store.reset(draft ?? draftFromPublished(this.zones()));
        this.loadState.set('ready');
      });
    });

    // Une salle supprimée ailleurs emporte son décor (« son décor part avec elle ») : il n'aurait plus d'onglet
    effect(() => {
      const zoneIds = new Set(this.zones().map((zone) => zone.id));
      if (this.loadState() !== 'ready' || !this._floorPlan.isLoaded()) {
        return;
      }
      untracked(() => {
        const content = this.store.content();
        const decors = content.decors.filter((decor) => zoneIds.has(decor.zoneId));
        if (decors.length !== content.decors.length) {
          this.store.apply({ ...content, decors });
        }
      });
    });
  }

  ngOnDestroy() {
    this._cancelGesture?.();
    // Quitter autrement que par « ‹ Paramètres » (retour du navigateur) envoie quand même la dernière modification
    void this.store.flush();
  }

  /** Avant de changer de sélection : la saisie en cours dans le panneau s'applique à son objet, pas au suivant */
  private commitPanels() {
    this._tablePanel()?.commitFields();
    this._decorPanel()?.commitFields();
  }

  private async loadDraft() {
    const result = await this._floorPlan.getDraft();
    if (result.error !== null) {
      this.loadState.set(result.code === ApiError.NotAdmin ? 'forbidden' : 'failed');
      this.loadError.set(result.error);
      return;
    }
    this._savedDraft.set(result.value);
  }

  selectZone(id: string) {
    this.commitPanels();
    this._zoneId.set(id);
    this.selection.set(null);
  }

  /** Toutes les tables, publiées ou non, actives ou non : un nom automatique ne réutilise jamais un nom d'historique */
  private allNames(): string[] {
    return [
      ...this.store.content().tables.map((table) => table.name),
      ...this.zones().flatMap((zone) => zone.tables.map((table) => table.name)),
    ];
  }

  /** Ce qui peut attirer un objet qu'on place : les autres tables et décors de la salle, tels qu'ils sont tournés */
  private neighboursOf(zoneId: string, exceptId: string | null): Rect[] {
    const { tables, decors } = this.store.content();
    return [...tables, ...decors]
      .filter((other) => other.zoneId === zoneId && other.id !== exceptId)
      .map(boundsOf);
  }

  private zoneOf(table: PlanTable): FloorPlanZone | undefined {
    return this.zones().find((zone) => zone.id === table.zoneId);
  }

  // ---- PALETTE ----

  protected onPalettePick({ entry, event }: PalettePick) {
    this.commitPanels();
    this._cancelGesture?.();
    this.paletteGhost.set({ entry, clientX: event.clientX, clientY: event.clientY });
    this._cancelGesture = trackPointer(event, {
      move: (e) => this.paletteGhost.set({ entry, clientX: e.clientX, clientY: e.clientY }),
      end: (e) => {
        this._cancelGesture = null;
        this.paletteGhost.set(null);
        if (e.type === 'pointerup') {
          this.dropFromPalette(entry, e.clientX, e.clientY);
        }
      },
    });
  }

  /** La table naît là où on l'a lâchée, nommée, aimantée, et sélectionnée (EDIT-04) */
  dropFromPalette(entry: TablePaletteEntry, clientX: number, clientY: number): boolean {
    this.commitPanels();
    const canvas = this._canvas();
    const zone = this.currentZone();
    if (canvas === undefined || zone === null || !canvas.containsClient(clientX, clientY)) {
      return false;
    }
    const position = placeCentredAt(canvas.toMetres(clientX, clientY), entry, zone, this.neighboursOf(zone.id, null));
    const table: DraftTable = {
      id: crypto.randomUUID(),
      zoneId: zone.id,
      name: nextTableName(this.allNames()),
      capacity: entry.capacity,
      shape: entry.shape,
      width: entry.width,
      height: entry.height,
      rotation: 0,
      ...position,
    };
    const content = this.store.content();
    this.store.apply({ ...content, tables: [...content.tables, table] });
    this.selection.set({ kind: 'table', id: table.id });
    return true;
  }

  // ---- DÉPLACER ----

  onTablePointerDown({ item, point, event }: PlanPointerEvent<PlanTable>) {
    this.commitPanels();
    this.selection.set({ kind: 'table', id: item.id });
    const canvas = this._canvas();
    const zone = this.zoneOf(item);
    if (canvas === undefined || zone === undefined) {
      return;
    }
    const offset: Point = { x: point.x - item.x, y: point.y - item.y };
    let moved = false;
    this._cancelGesture?.();
    this._cancelGesture = trackPointer(event, {
      move: (e) => {
        if (!moved && Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) < DRAG_THRESHOLD_PX) {
          return;
        }
        moved = true;
        const pointer = canvas.toMetres(e.clientX, e.clientY);
        this.dragPreview.set({ id: item.id, ...clampToZone({ x: pointer.x - offset.x, y: pointer.y - offset.y }, item, zone, this.neighboursOf(zone.id, item.id)) });
      },
      end: (e) => {
        this._cancelGesture = null;
        const preview = this.dragPreview();
        this.dragPreview.set(null);
        if (e.type === 'pointerup' && preview !== null && (preview.x !== item.x || preview.y !== item.y)) {
          this.updateTable(item.id, { x: preview.x, y: preview.y });
        }
      },
    });
  }

  /** Interrompt un geste en cours sans rien enregistrer (un pincement commence) */
  protected cancelGesture() {
    this._cancelGesture?.();
    this._cancelGesture = null;
    this.dragPreview.set(null);
    this.decorPreview.set(null);
    this.paletteGhost.set(null);
  }

  protected onBackgroundClick() {
    this.commitPanels();
    this.selection.set(null);
  }

  /** Toute modification d'une table la garde aimantée et dans sa salle, quand c'est possible */
  updateTable(id: string, patch: Partial<DraftTable>) {
    const content = this.store.content();
    const tables = content.tables.map((table) => {
      if (table.id !== id) {
        return table;
      }
      const merged = { ...table, ...patch };
      const zone = this.zoneOf(merged);
      return zone === undefined ? merged : { ...merged, ...clampToZone(merged, merged, zone, this.neighboursOf(zone.id, merged.id)) };
    });
    this.store.apply({ ...content, tables });
  }

  // ---- PANNEAU ----

  protected selectedTable = computed(() => {
    const selection = this.selection();
    return selection?.kind === 'table'
      ? this.store.content().tables.find((table) => table.id === selection.id) ?? null
      : null;
  });

  protected selectedTableErrors = computed(() => {
    const table = this.selectedTable();
    return table === null ? [] : tableErrors(table, this.zoneOf(table), this.store.content().tables);
  });

  /** Une table jamais publiée se retire du brouillon ; une table publiée se désactivera (lot 5) */
  protected isPublishedTable = computed(() => {
    const table = this.selectedTable();
    return table !== null && this.published().tables.some((published) => published.id === table.id);
  });

  /** Le panneau nomme sa table : la sélection a pu changer entre-temps */
  onPanelChange({ id, patch }: { id: string, patch: Partial<DraftTable> }) {
    this.updateTable(id, patch);
    // l'éditeur suit la table sur son nouvel onglet
    if (patch.zoneId !== undefined && this.selection()?.id === id) {
      this._zoneId.set(patch.zoneId);
    }
  }

  duplicateSelected() {
    const table = this.selectedTable();
    const zone = table === null ? undefined : this.zoneOf(table);
    if (table === null || zone === undefined) {
      return;
    }
    const occupied = this.store.content().tables.filter((other) => other.zoneId === table.zoneId);
    const copy: DraftTable = {
      ...table,
      id: crypto.randomUUID(),
      name: nextTableName(this.allNames()),
      ...findFreeSpot(table, zone, occupied),
    };
    const content = this.store.content();
    this.store.apply({ ...content, tables: [...content.tables, copy] });
    this.selection.set({ kind: 'table', id: copy.id });
  }

  removeSelected() {
    const table = this.selectedTable();
    if (table === null || this.isPublishedTable()) {
      return;
    }
    const content = this.store.content();
    this.store.apply({ ...content, tables: content.tables.filter((other) => other.id !== table.id) });
    this.selection.set(null);
  }

  // ---- BROUILLON ----

  protected onKeydown(event: KeyboardEvent) {
    // la touche peut viser document lui-même, qui n'est pas un élément
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input, textarea, select') || !(event.ctrlKey || event.metaKey)) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.store.undo();
    } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
      event.preventDefault();
      this.store.redo();
    }
  }

  async publish() {
    this.commitPanels();
    if (this.publishing() || this.invalidIds().length > 0 || this.changeCount() === 0) {
      return;
    }
    this.publishing.set(true);
    try {
      if (!(await this.store.flush())) {
        this._modalService.infoModal('Publication impossible', this.store.saveError() ?? "Le brouillon n'a pas pu être enregistré.");
        return;
      }
      const result = await this._floorPlan.publish();
      if (result.value === null) {
        this._modalService.infoModal('Publication refusée', result.error);
        return;
      }
      this.store.reset(draftFromPublished(result.value));
    } finally {
      this.publishing.set(false);
    }
  }

  async discard() {
    if (this.publishing()) {
      return;
    }
    const confirmed = await this._modalService.confirmModal(
      'Abandonner le brouillon',
      'Toutes les modifications non publiées seront perdues. Le plan publié ne change pas.',
      'Abandonner',
    );
    if (!confirmed) {
      return;
    }
    // un enregistrement déjà parti doit arriver avant la suppression, sinon il ressusciterait le brouillon
    await this.store.settle();
    const result = await this._floorPlan.discardDraft();
    if (result.error !== null) {
      this._modalService.infoModal('Erreur', result.error);
      // le brouillon reste : on reprend l'enregistrement que `settle` a annulé
      void this.store.flush();
      return;
    }
    this.selection.set(null);
    this.store.reset(this.published());
  }

  /** La garde de la route s'occupe d'enregistrer et de demander confirmation */
  leave() {
    this._router.navigate(['/parametres'], { queryParams: { page: 'salles' } });
  }

  /** Quitter l'éditeur, de quelque façon que ce soit : on enregistre, et on demande si ça n'a pas pu se faire */
  async canLeave(): Promise<boolean> {
    if (this.loadState() !== 'ready') {
      return true;
    }
    this.commitPanels();
    if (await this.store.flush()) {
      return true;
    }
    return this._modalService.confirmModal(
      'Brouillon non enregistré',
      'Les dernières modifications n\'ont pas pu être enregistrées. Quitter quand même ?',
      'Quitter',
    );
  }

  /** Fermer l'onglet avant l'enregistrement : le navigateur demande confirmation */
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.loadState() === 'ready' && this.store.saveState() !== 'saved') {
      event.preventDefault();
    }
  }

  protected retrySave() {
    void this.store.flush();
  }

  protected draftLabel(): string {
    const count = this.changeCount();
    return count === 0 ? 'Plan publié' : `Brouillon · ${count} modification${count > 1 ? 's' : ''}`;
  }
}

/** Toute sortie de l'éditeur (lien, retour du navigateur) passe par l'enregistrement du brouillon */
export const confirmFloorPlanLeave: CanDeactivateFn<FloorPlanEditorComponent> = (component) => component.canLeave();
