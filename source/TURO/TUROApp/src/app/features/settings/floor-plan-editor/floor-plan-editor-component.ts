import { Component, computed, effect, inject, OnDestroy, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute, CanDeactivateFn, Router } from '@angular/router';
import { ApiError, DraftCombination, DraftDecor, DraftTable, FloorPlanDraft, FloorPlanDraftContent, FloorPlanZone, PlanCombination, PlanDecor, PlanTable } from '../../../models';
import { FloorPlanService } from '../../../core/services/floor-plan/floor-plan.service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { Button } from '../../../shared/components/button/button';
import { FloorPlanCanvasComponent, PlanPointerEvent } from '../../../shared/components/floor-plan/floor-plan-canvas-component';
import { DecorPalettePick, TablePaletteComponent, PalettePick } from './table-palette-component';
import { DecorPanelComponent } from './decor-panel-component';
import { TablePanelComponent } from './table-panel-component';
import { AccolageDialogComponent } from './accolage-dialog-component';
import { CombinationPanelComponent } from './combination-panel-component';
import { SeparationDialogComponent } from './separation-dialog-component';
import { AccolageProposal, proposeAccolage, proposeSeparation, SeparationProposal } from './logic/accolage';
import { tableSetKey } from './logic/table-set';
import { countChanges, draftFromPublished } from './logic/draft-diff';
import { DraftStore } from './logic/draft-store';
import { boundsOf, boundsOfAll, clampToZone, findFreeSpot, placeCentredAt, Point, Rect, roundMetres } from './logic/geometry';
import { buildTablePalette, DECOR_PALETTE, DecorPaletteEntry, TablePaletteEntry } from './logic/palette';
import { combinationErrors, decorErrors, tableErrors } from './logic/plan-rules';
import { nextTableName } from './logic/table-naming';
import { trackPointer } from './logic/pointer-tracking';
import { formatMetres } from './logic/units';

/** Ce qui est sélectionné sur le plan : une table, un décor, ou une combinaison */
export interface PlanSelection {
  kind: 'table' | 'decor' | 'combination',
  id: string,
}

/** En dessous, un appui sur une table la sélectionne sans la déplacer */
const DRAG_THRESHOLD_PX = 4;

/**
 * L'éditeur de plan (§12) : plein écran, admin seulement. On modifie un brouillon, enregistré tout seul,
 * puis on publie : le service ne voit jamais les tables bouger (EDIT-15 à EDIT-17)
 */
@Component({
  imports: [Button, FloorPlanCanvasComponent, TablePaletteComponent, TablePanelComponent, DecorPanelComponent, AccolageDialogComponent, SeparationDialogComponent, CombinationPanelComponent],
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
  /** Position des tables pendant qu'on les glisse : rien n'entre dans l'historique avant le lâcher */
  protected dragPreview = signal<ReadonlyMap<string, Point> | null>(null);
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
      .map((table) => {
        const position = preview?.get(table.id);
        return position === undefined ? table : { ...table, ...position };
      });
  });

  protected selectedIds = computed(() => {
    const selection = this.selection();
    return selection === null ? [] : [selection.id];
  });

  /** Les tables, décors et combinaisons qui empêchent de publier, toutes salles confondues */
  protected invalidIds = computed(() => {
    const zonesById = new Map(this.zones().map((zone) => [zone.id, zone]));
    const { tables, decors, combinations } = this.store.content();
    return [
      ...tables.filter((table) => tableErrors(table, zonesById.get(table.zoneId), tables, combinations).length > 0).map((t) => t.id),
      ...decors.filter((decor) => decorErrors(decor, zonesById.get(decor.zoneId)).length > 0).map((d) => d.id),
      ...combinations.filter((c) => combinationErrors(c, tables, combinations).length > 0).map((c) => c.id),
    ];
  });

  // ---- COMBINAISONS (EDIT-03, EDIT-13, EDIT-14) ----

  /** Les tables d'un glisser qui en rejoignent d'autres : le canevas les encadre */
  protected contactIds = signal<readonly string[]>([]);
  /** La fenêtre d'accolage ouverte après un lâcher contre une table */
  readonly accolage = signal<AccolageProposal | null>(null);
  /** « Non, juste les déplacer » : cet ensemble de tables n'est plus proposé pendant cette session de l'éditeur */
  private _declinedSets = new Set<string>();
  private _combinationPanel = viewChild(CombinationPanelComponent);

  protected accolageView = computed(() => {
    const proposal = this.accolage();
    if (proposal === null) {
      return null;
    }
    const { tables, combinations } = this.store.content();
    const members = proposal.tableIds
      .map((id) => tables.find((table) => table.id === id))
      .filter((table): table is DraftTable => table !== undefined);
    return members.length !== proposal.tableIds.length ? null : {
      members,
      existing: combinations.find((combination) => combination.id === proposal.existingId) ?? null,
      deactivated: combinations.filter((combination) => proposal.deactivatedIds.includes(combination.id)),
    };
  });

  protected selectedCombination = computed(() => {
    const selection = this.selection();
    return selection?.kind === 'combination'
      ? this.store.content().combinations.find((combination) => combination.id === selection.id) ?? null
      : null;
  });

  protected selectedCombinationErrors = computed(() => {
    const combination = this.selectedCombination();
    const { tables, combinations } = this.store.content();
    return combination === null ? [] : combinationErrors(combination, tables, combinations);
  });

  protected selectedCombinationMembers = computed(() => {
    const combination = this.selectedCombination();
    const tables = this.store.content().tables;
    return combination === null ? [] : combination.tableIds.map((id) => tables.find((table) => table.id === id)?.name ?? '?');
  });

  protected isPublishedCombination = computed(() => {
    const combination = this.selectedCombination();
    return combination !== null && this.published().combinations.some((published) => published.id === combination.id);
  });

  /** Ce que proposerait le lâcher de ces tables à ces positions (EDIT-13) */
  private accolageFor(movedIds: readonly string[], positions: ReadonlyMap<string, Point>): AccolageProposal | null {
    const { tables, combinations } = this.store.content();
    const placed = tables.map((table) => {
      const position = positions.get(table.id);
      return position === undefined ? table : { ...table, ...position };
    });
    return proposeAccolage(movedIds, placed, combinations, this._declinedSets);
  }

  /** Une table n'est que dans une combinaison active (§3.4) : en activer une désactive celles qui partagent ses tables */
  private withActivity(combinations: readonly DraftCombination[], activatedId: string | null, deactivatedIds: readonly string[]): DraftCombination[] {
    return combinations.map((combination) => {
      if (combination.id === activatedId) {
        return { ...combination, isActive: true };
      }
      return deactivatedIds.includes(combination.id) ? { ...combination, isActive: false } : combination;
    });
  }

  /** Une seconde étape d'historique, après le déplacement : ↶ défait l'activation sans défaire le geste */
  private activate(combination: DraftCombination, deactivatedIds: readonly string[]) {
    const content = this.store.content();
    const isNew = !content.combinations.some((other) => other.id === combination.id);
    const combinations = this.withActivity(isNew ? [...content.combinations, combination] : content.combinations, combination.id, deactivatedIds);
    this.store.apply({ ...content, combinations });
    this.accolage.set(null);
    // l'activation désactive déjà l'ancienne combinaison de la table : plus rien à séparer
    this._separationAfterAccolage = null;
    this.selection.set({ kind: 'combination', id: combination.id });
  }

  /** La pastille est la poignée de la combinaison : un appui la sélectionne, un glisser emporte toutes ses tables */
  onCombinationPointerDown({ item, point, event }: PlanPointerEvent<PlanCombination>) {
    this.commitPanels();
    this.selection.set({ kind: 'combination', id: item.id });
    const canvas = this._canvas();
    const zone = this.currentZone();
    const members = this.store.content().tables.filter((table) => item.tableIds.includes(table.id));
    if (canvas === undefined || zone === null || members.length !== item.tableIds.length || members.some((table) => table.zoneId !== zone.id)) {
      return;
    }
    const group = boundsOfAll(members);
    const neighbours = this.neighboursOf(zone.id, item.tableIds);
    let moved = false;
    let proposal: AccolageProposal | null = null;
    this._cancelGesture?.();
    this._cancelGesture = trackPointer(event, {
      move: (e) => {
        if (!moved && Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) < DRAG_THRESHOLD_PX) {
          return;
        }
        moved = true;
        const pointer = canvas.toMetres(e.clientX, e.clientY);
        // un seul rectangle : il reste dans la salle et s'aimante à ce qui n'est pas du groupe ; les tables gardent leurs écarts
        const placed = clampToZone({ x: group.x + pointer.x - point.x, y: group.y + pointer.y - point.y }, group, zone, neighbours);
        const positions = new Map(members.map((table) => [table.id, {
          x: roundMetres(table.x + placed.x - group.x),
          y: roundMetres(table.y + placed.y - group.y),
        }]));
        this.dragPreview.set(positions);
        proposal = this.accolageFor(item.tableIds, positions);
        this.contactIds.set(proposal?.tableIds ?? []);
      },
      end: (e) => {
        this._cancelGesture = null;
        const positions = this.dragPreview();
        this.dragPreview.set(null);
        this.contactIds.set([]);
        const changed = positions !== null && members.some((table) => {
          const position = positions.get(table.id);
          return position !== undefined && (position.x !== table.x || position.y !== table.y);
        });
        if (e.type === 'pointerup' && positions !== null && changed) {
          this.moveTables(positions);
          if (proposal !== null) {
            this.accolage.set(proposal);
            // le groupe bouge entier : aucune de ses tables ne quitte sa combinaison
            this._separationAfterAccolage = null;
          }
        }
      },
    });
  }

  /** Des tables déplacées d'un bloc : une seule étape d'historique, sans les réaimanter une à une */
  private moveTables(positions: ReadonlyMap<string, Point>) {
    const content = this.store.content();
    this.store.apply({
      ...content,
      tables: content.tables.map((table) => {
        const position = positions.get(table.id);
        return position === undefined ? table : { ...table, ...position };
      }),
    });
  }

  createCombination({ name, capacity }: { name: string, capacity: number }) {
    const proposal = this.accolage();
    if (proposal === null) {
      return;
    }
    this.activate({ id: crypto.randomUUID(), name, capacity, tableIds: [...proposal.tableIds], isActive: true }, proposal.deactivatedIds);
  }

  /** L'ensemble existait déjà, en sommeil : on le réveille plutôt que d'en créer un second */
  reactivateCombination() {
    const proposal = this.accolage();
    const existing = this.store.content().combinations.find((combination) => combination.id === proposal?.existingId);
    if (proposal === null || existing === undefined) {
      return;
    }
    this.activate(existing, proposal.deactivatedIds);
  }

  dismissAccolage() {
    const proposal = this.accolage();
    if (proposal !== null) {
      this._declinedSets.add(tableSetKey(proposal.tableIds));
    }
    this.accolage.set(null);
    // la table a quand même quitté sa combinaison : refuser la nouvelle ne doit pas laisser l'ancienne réservable
    this.separation.set(this._separationAfterAccolage);
    this._separationAfterAccolage = null;
  }

  /** La fenêtre de séparation, ouverte quand on écarte une table de sa combinaison active */
  readonly separation = signal<SeparationProposal | null>(null);
  /** « Non, juste la déplacer » : ces combinaisons ne sont plus proposées à la séparation pendant cette session */
  private _keptCombinations = new Set<string>();
  /** La séparation qu'un lâcher aurait proposée : elle s'ouvre si l'on refuse la fenêtre d'accolage qui passe avant */
  private _separationAfterAccolage: SeparationProposal | null = null;

  protected separationView = computed(() => {
    const proposal = this.separation();
    const combinations = this.store.content().combinations;
    const combination = combinations.find((other) => other.id === proposal?.combinationId);
    return combination === undefined ? null : {
      combination,
      reactivated: combinations.find((other) => other.id === proposal?.reactivatedId) ?? null,
    };
  });

  /** La combinaison passe en sommeil ; les tables restées collées retrouvent la leur, si elle existe */
  separateCombination() {
    const proposal = this.separation();
    if (proposal === null) {
      return;
    }
    const content = this.store.content();
    this.store.apply({ ...content, combinations: this.withActivity(content.combinations, proposal.reactivatedId, [proposal.combinationId]) });
    this.separation.set(null);
  }

  dismissSeparation() {
    const proposal = this.separation();
    if (proposal !== null) {
      this._keptCombinations.add(proposal.combinationId);
    }
    this.separation.set(null);
  }

  /** « Séparer » dans le panneau : les tables ne bougent pas, la combinaison passe en sommeil */
  separateSelectedCombination() {
    const combination = this.selectedCombination();
    if (combination === null || !combination.isActive) {
      return;
    }
    const content = this.store.content();
    this.store.apply({ ...content, combinations: this.withActivity(content.combinations, null, [combination.id]) });
    // la sélection reste : le panneau montre « En sommeil », et « Retirer » si elle n'a jamais été publiée
  }

  updateCombination(id: string, patch: Partial<DraftCombination>) {
    const content = this.store.content();
    this.store.apply({
      ...content,
      combinations: content.combinations.map((combination) => combination.id === id ? { ...combination, ...patch } : combination),
    });
  }

  onCombinationPanelChange({ id, patch }: { id: string, patch: Partial<DraftCombination> }) {
    this.updateCombination(id, patch);
  }

  /** Une combinaison jamais publiée se retire ; publiée, elle reste */
  removeSelectedCombination() {
    const combination = this.selectedCombination();
    if (combination === null || this.isPublishedCombination()) {
      return;
    }
    const content = this.store.content();
    this.store.apply({ ...content, combinations: content.combinations.filter((other) => other.id !== combination.id) });
    this.selection.set(null);
  }

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
      ...placeCentredAt(canvas.toMetres(clientX, clientY), entry, zone, this.neighboursOf(zone.id)),
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
        this.decorPreview.set({ id: item.id, ...clampToZone({ x: pointer.x - offset.x, y: pointer.y - offset.y }, item, zone, this.neighboursOf(zone.id, [item.id])) });
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
      return zone === undefined ? merged : { ...merged, ...clampToZone(merged, merged, zone, this.neighboursOf(zone.id, [merged.id])) };
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
    this._combinationPanel()?.commitFields();
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
  private neighboursOf(zoneId: string, except: readonly string[] = []): Rect[] {
    const { tables, decors } = this.store.content();
    return [...tables, ...decors]
      .filter((other) => other.zoneId === zoneId && !except.includes(other.id))
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
    const position = placeCentredAt(canvas.toMetres(clientX, clientY), entry, zone, this.neighboursOf(zone.id));
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
    let proposal: AccolageProposal | null = null;
    this._cancelGesture?.();
    this._cancelGesture = trackPointer(event, {
      move: (e) => {
        if (!moved && Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) < DRAG_THRESHOLD_PX) {
          return;
        }
        moved = true;
        const pointer = canvas.toMetres(e.clientX, e.clientY);
        const position = clampToZone({ x: pointer.x - offset.x, y: pointer.y - offset.y }, item, zone, this.neighboursOf(zone.id, [item.id]));
        this.dragPreview.set(new Map([[item.id, position]]));
        // collée contre d'autres tables : le cadre orange annonce la proposition (EDIT-13)
        proposal = this.accolageFor([item.id], new Map([[item.id, position]]));
        this.contactIds.set(proposal?.tableIds ?? []);
      },
      end: (e) => {
        this._cancelGesture = null;
        const preview = this.dragPreview()?.get(item.id) ?? null;
        this.dragPreview.set(null);
        this.contactIds.set([]);
        if (e.type === 'pointerup' && preview !== null && (preview.x !== item.x || preview.y !== item.y)) {
          this.updateTable(item.id, { x: preview.x, y: preview.y });
          // écartée de sa combinaison active : on demande avant de séparer ; une fenêtre d'accolage passe avant
          const { tables, combinations } = this.store.content();
          const after = tables.find((table) => table.id === item.id) ?? item;
          const separation = proposeSeparation(item, after, tables, combinations, this._keptCombinations);
          if (proposal !== null) {
            this.accolage.set(proposal);
            this._separationAfterAccolage = separation;
          } else {
            this.separation.set(separation);
          }
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
    this.contactIds.set([]);
    this.paletteGhost.set(null);
  }

  protected onBackgroundClick() {
    this.commitPanels();
    this.selection.set(null);
  }

  /** Toute modification d'une table la garde aimantée et dans sa salle, quand c'est possible */
  updateTable(id: string, patch: Partial<DraftTable>) {
    this.store.apply(this.withTablePatch(id, patch));
  }

  private withTablePatch(id: string, patch: Partial<DraftTable>): FloorPlanDraftContent {
    const content = this.store.content();
    const tables = content.tables.map((table) => {
      if (table.id !== id) {
        return table;
      }
      const merged = { ...table, ...patch };
      const zone = this.zoneOf(merged);
      return zone === undefined ? merged : { ...merged, ...clampToZone(merged, merged, zone, this.neighboursOf(zone.id, [merged.id])) };
    });
    return { ...content, tables };
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
    const { tables, combinations } = this.store.content();
    return table === null ? [] : tableErrors(table, this.zoneOf(table), tables, combinations);
  });

  /** Une table jamais publiée se retire du brouillon ; une table publiée se désactivera (lot 5) */
  protected isPublishedTable = computed(() => {
    const table = this.selectedTable();
    return table !== null && this.published().tables.some((published) => published.id === table.id);
  });

  /** Le panneau nomme sa table : la sélection a pu changer entre-temps */
  onPanelChange(change: { id: string, patch: Partial<DraftTable> }) {
    const broken = change.patch.zoneId === undefined ? [] : this.combinationsBrokenBy(change.id, change.patch.zoneId);
    if (broken.length === 0) {
      this.applyTableChange(change);
      return;
    }
    void this.confirmZoneChange(change, broken);
  }

  /** Le déplacement et la désactivation de ses combinaisons font une seule étape d'historique */
  private applyTableChange({ id, patch }: { id: string, patch: Partial<DraftTable> }, deactivatedIds: readonly string[] = []) {
    const content = this.withTablePatch(id, patch);
    this.store.apply({ ...content, combinations: this.withActivity(content.combinations, null, deactivatedIds) });
    // l'éditeur suit la table sur son nouvel onglet
    if (patch.zoneId !== undefined && this.selection()?.id === id) {
      this._zoneId.set(patch.zoneId);
    }
  }

  /** Les combinaisons actives de cette table dont une autre table ne sera pas dans la salle d'arrivée */
  private combinationsBrokenBy(tableId: string, zoneId: string): PlanCombination[] {
    const { tables, combinations } = this.store.content();
    return combinations.filter((combination) => combination.isActive && combination.tableIds.includes(tableId)
      && combination.tableIds.some((id) => id !== tableId && tables.find((table) => table.id === id)?.zoneId !== zoneId));
  }

  /** Une table qui change de salle désactive ses combinaisons : on le dit avant (décision utilisateur) */
  private async confirmZoneChange(change: { id: string, patch: Partial<DraftTable> }, broken: PlanCombination[]) {
    const table = this.store.content().tables.find((t) => t.id === change.id);
    const zone = this.zones().find((z) => z.id === change.patch.zoneId);
    const names = broken.map((combination) => combination.name).join(', ');
    const consequence = broken.length > 1
      ? `Les combinaisons ${names} seront désactivées : leurs tables ne seront plus dans la même salle.`
      : `La combinaison ${names} sera désactivée : ses tables ne seront plus dans la même salle.`;
    const confirmed = await this._modalService.confirmModal(
      'Changer de salle', `${table?.name} part en ${zone?.name}. ${consequence}`, 'Déplacer');
    if (confirmed) {
      this.applyTableChange(change, broken.map((combination) => combination.id));
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
    this.store.apply({
      ...content,
      tables: content.tables.filter((other) => other.id !== table.id),
      // une table jamais publiée n'appartient qu'à des combinaisons jamais publiées : elles partent avec elle
      combinations: content.combinations.filter((combination) => !combination.tableIds.includes(table.id)),
    });
    this.selection.set(null);
  }

  // ---- BROUILLON ----

  protected onKeydown(event: KeyboardEvent) {
    // la touche peut viser document lui-même, qui n'est pas un élément
    const target = event.target instanceof Element ? event.target : null;
    // les fenêtres d'accolage et de séparation sont modales : rien ne bouge derrière elles
    if (target?.closest('input, textarea, select') || !(event.ctrlKey || event.metaKey) || this.accolage() !== null || this.separation() !== null) {
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
