import { signal } from '@angular/core';
import { PlanCombination, PlanDecor, PlanTable, TableMove } from '../../models';
import { AccolageProposal, proposeAccolage, proposeSeparation, SeparationProposal } from '../../shared/components/floor-plan/logic/accolage';
import { boundsOf, boundsOfAll, clampToZone, Point, Rect, roundMetres, Size } from '../../shared/components/floor-plan/logic/geometry';
import { trackPointer } from '../../shared/components/floor-plan/logic/pointer-tracking';
import { tableSetKey } from '../../shared/components/floor-plan/logic/table-set';

/** En deçà, un appui ne déplace rien (même seuil que le glisser du placement) */
export const LAYOUT_DRAG_THRESHOLD_PX = 6;

/** Ce que voit le geste : la salle, ses tables et son décor (les aimants), et toutes les combinaisons, en sommeil comprises */
export interface LayoutScene {
  zone: Size & { id: string },
  tables: readonly PlanTable[],
  decors: readonly PlanDecor[],
  combinations: readonly PlanCombination[],
  toMetres: (clientX: number, clientY: number) => Point,
}

/** Un lâcher : les tables déplacées, et ce qu'il propose — l'accolage passe avant la séparation (EDIT-13) */
export interface LayoutDrop {
  moves: TableMove[],
  accolage: AccolageProposal | null,
  separation: SeparationProposal | null,
}

/** « Table 12 déplacée », « 2 tables déplacées » */
export function movedMessage(moves: readonly TableMove[], tables: readonly PlanTable[]): string {
  return moves.length === 1
    ? `Table ${tables.find((table) => table.id === moves[0].tableId)?.name ?? ''} déplacée`
    : `${moves.length} tables déplacées`;
}

/**
 * Le glisser du mode édition (§5.5) : la même aimantation et les mêmes propositions que l'éditeur, sans brouillon — chaque lâcher
 * part à l'API. L'aperçu reste affiché jusqu'au plan relu (`clear`)
 */
export class LayoutEdit {
  readonly preview = signal<ReadonlyMap<string, Point> | null>(null);
  readonly contactIds = signal<readonly string[]>([]);
  /** Un geste est en cours : un plan relu ne doit pas lui retirer son aperçu */
  readonly isDragging = signal(false);
  /** « Non, juste les déplacer » : ces ensembles ne sont plus proposés tant qu'on reste dans le mode */
  private _declined = new Set<string>();
  private _kept = new Set<string>();
  private _cancel: (() => void) | null = null;

  pressTable(event: PointerEvent, point: Point, table: PlanTable, scene: LayoutScene, dropped: (drop: LayoutDrop) => void) {
    this.press(event, point, [table], scene, dropped, (positions) => {
      const after = { ...table, ...positions.get(table.id)! };
      return proposeSeparation(table, after, scene.tables.map((t) => (t.id === table.id ? after : t)), scene.combinations, this._kept);
    });
  }

  /** La pastille est la poignée : toutes les tables bougent ensemble, aucune ne quitte sa combinaison */
  pressCombination(event: PointerEvent, point: Point, combination: PlanCombination, scene: LayoutScene, dropped: (drop: LayoutDrop) => void) {
    const members = scene.tables.filter((table) => combination.tableIds.includes(table.id));
    if (members.length !== combination.tableIds.length) {
      return;
    }
    this.press(event, point, members, scene, dropped, () => null);
  }

  decline(proposal: AccolageProposal) {
    this._declined.add(tableSetKey(proposal.tableIds));
  }

  keep(proposal: SeparationProposal) {
    this._kept.add(proposal.combinationId);
  }

  cancel() {
    this._cancel?.();
    this._cancel = null;
    this.isDragging.set(false);
    this.contactIds.set([]);
  }

  clear() {
    this.preview.set(null);
  }

  /** Quitter le mode : le geste s'arrête, les refus de la session sont oubliés */
  reset() {
    this.cancel();
    this.clear();
    this._declined.clear();
    this._kept.clear();
  }

  private press(event: PointerEvent, point: Point, members: readonly PlanTable[], scene: LayoutScene,
    dropped: (drop: LayoutDrop) => void, separationOf: (positions: ReadonlyMap<string, Point>) => SeparationProposal | null) {
    const ids = members.map((table) => table.id);
    const group = boundsOfAll(members);
    const neighbours: Rect[] = [...scene.tables, ...scene.decors].filter((other) => !ids.includes(other.id)).map(boundsOf);
    let moved = false;
    let proposal: AccolageProposal | null = null;
    // les positions du geste lui appartiennent : l'aperçu affiché peut être effacé par un plan relu avant le lâcher
    let positions: ReadonlyMap<string, Point> | null = null;
    this.cancel();
    this.isDragging.set(true);
    this._cancel = trackPointer(event, {
      move: (e) => {
        if (!moved && Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) < LAYOUT_DRAG_THRESHOLD_PX) {
          return;
        }
        moved = true;
        const pointer = scene.toMetres(e.clientX, e.clientY);
        // un seul rectangle : il reste dans la salle et s'aimante à ce qui n'est pas du groupe ; les tables gardent leurs écarts
        const placed = clampToZone({ x: group.x + pointer.x - point.x, y: group.y + pointer.y - point.y }, group, scene.zone, neighbours);
        const next = new Map(members.map((table) => [table.id, {
          x: roundMetres(table.x + placed.x - group.x),
          y: roundMetres(table.y + placed.y - group.y),
        }]));
        positions = next;
        this.preview.set(next);
        const shown = scene.tables.map((table) => {
          const position = next.get(table.id);
          return position === undefined ? table : { ...table, ...position };
        });
        proposal = proposeAccolage(ids, shown, scene.combinations, this._declined);
        this.contactIds.set(proposal?.tableIds ?? []);
      },
      end: (e) => {
        this._cancel = null;
        this.isDragging.set(false);
        this.contactIds.set([]);
        const final = positions;
        const changed = final !== null && members.some((table) => {
          const position = final.get(table.id);
          return position !== undefined && (position.x !== table.x || position.y !== table.y);
        });
        if (e.type !== 'pointerup' || final === null || !changed) {
          this.preview.set(null);
          return;
        }
        // un plan relu en route a pu effacer l'aperçu : il revient avec le lâcher
        this.preview.set(final);
        dropped({
          moves: members.map((table) => ({ tableId: table.id, ...final.get(table.id)! })),
          accolage: proposal,
          separation: separationOf(final),
        });
      },
    });
  }
}
