import { PlanCombination, PlanTable } from '../../../../models';
import { boundsOf, Placed, Rect } from './geometry';
import { sameTableSet, tableSetKey } from './table-set';

/** Deux bords à 2 cm au plus se touchent ; un contact de moins de 20 cm n'est qu'un coin */
export const CONTACT_GAP = 0.02;
export const MIN_CONTACT = 0.2;

/** Longueur du bord commun à deux objets qui se touchent (jugés tels qu'ils sont tournés), 0 sinon */
export function contactLength(a: Placed, b: Placed): number {
  const boxA: Rect = boundsOf(a);
  const boxB: Rect = boundsOf(b);
  const overlapX = Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x);
  const overlapY = Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y);
  // écart entre les bords les plus proches : positif s'ils sont séparés, négatif s'ils se chevauchent
  const gapX = Math.max(boxB.x - (boxA.x + boxA.width), boxA.x - (boxB.x + boxB.width));
  const gapY = Math.max(boxB.y - (boxA.y + boxA.height), boxA.y - (boxB.y + boxB.height));
  if (Math.abs(gapX) <= CONTACT_GAP && overlapY >= MIN_CONTACT) {
    return overlapY;
  }
  if (Math.abs(gapY) <= CONTACT_GAP && overlapX >= MIN_CONTACT) {
    return overlapX;
  }
  return 0;
}

/** La table de la même salle que `moved` touche le plus longuement (EDIT-13), ou `null` */
export function touchingTable<T extends PlanTable>(moved: T, others: readonly T[]): { table: T, contact: number } | null {
  let best: { table: T, contact: number } | null = null;
  for (const other of others) {
    if (other.id === moved.id || other.zoneId !== moved.zoneId) {
      continue;
    }
    const contact = contactLength(moved, other);
    if (contact > 0 && (best === null || contact > best.contact)) {
      best = { table: other, contact };
    }
  }
  return best;
}

/** « 12-13-14 » : les noms dans l'ordre naturel (RAPP-04), modifiable ensuite */
export function defaultCombinationName(names: readonly string[]): string {
  return names.map((name) => name.trim()).sort((x, y) => x.localeCompare(y, 'fr', { numeric: true })).join('-');
}

/** La combinaison active qui contient cette table : il y en a au plus une (§3.4) */
export function activeCombinationOf(tableId: string, combinations: readonly PlanCombination[]): PlanCombination | null {
  return combinations.find((combination) => combination.isActive && combination.tableIds.includes(tableId)) ?? null;
}

/** Ce que propose un lâcher contre une table (EDIT-13) */
export interface AccolageProposal {
  /** L'ensemble à activer : les tables déplacées, puis celles qu'elles rejoignent */
  tableIds: string[],
  /** La combinaison qui réunit déjà exactement ces tables, inactive : on la réactive au lieu d'en créer une */
  existingId: string | null,
  /** Les combinaisons actives qui partagent une de ces tables : elles se désactivent */
  deactivatedIds: string[],
}

/**
 * `movedIds` (une table, ou toutes celles d'une combinaison glissée par sa pastille) viennent d'être posées, telles que
 * `tables` les montre : elles rejoignent la table qu'elles touchent le plus longuement, avec la combinaison active de
 * celle-ci. `declined` : les ensembles refusés pendant la session (`tableSetKey`)
 */
export function proposeAccolage(
  movedIds: readonly string[], tables: readonly PlanTable[], combinations: readonly PlanCombination[], declined: ReadonlySet<string>,
): AccolageProposal | null {
  const others = tables.filter((table) => !movedIds.includes(table.id));
  let touched: { table: PlanTable, contact: number } | null = null;
  for (const moved of tables.filter((table) => movedIds.includes(table.id))) {
    const found = touchingTable(moved, others);
    if (found !== null && (touched === null || found.contact > touched.contact)) {
      touched = found;
    }
  }
  if (touched === null) {
    return null;
  }
  const joined = activeCombinationOf(touched.table.id, combinations)?.tableIds ?? [touched.table.id];
  const tableIds = [...movedIds, ...joined.filter((id) => !movedIds.includes(id))];
  const existing = combinations.find((combination) => sameTableSet(combination.tableIds, tableIds)) ?? null;
  if (existing?.isActive || declined.has(tableSetKey(tableIds))) {
    return null;
  }
  return {
    tableIds,
    existingId: existing?.id ?? null,
    deactivatedIds: combinations
      .filter((combination) => combination.isActive && combination.tableIds.some((id) => tableIds.includes(id)))
      .map((combination) => combination.id),
  };
}

/** Ce que propose une table écartée de sa combinaison active */
export interface SeparationProposal {
  combinationId: string,
  /** La combinaison qui réunit exactement les tables restées collées : elle redevient active */
  reactivatedId: string | null,
}

/**
 * `before` / `after` : la même table, avant et après le glisser. Elle touchait une autre table de sa combinaison active
 * et n'en touche plus aucune : on propose de séparer. `kept` : les combinaisons gardées pendant la session
 */
export function proposeSeparation(
  before: PlanTable, after: PlanTable, tables: readonly PlanTable[], combinations: readonly PlanCombination[], kept: ReadonlySet<string>,
): SeparationProposal | null {
  const combination = activeCombinationOf(before.id, combinations);
  if (combination === null || kept.has(combination.id)) {
    return null;
  }
  const rest = tables.filter((table) => table.id !== before.id && combination.tableIds.includes(table.id));
  const touchesRest = (table: PlanTable) => rest.some((other) => other.zoneId === table.zoneId && contactLength(table, other) > 0);
  if (!touchesRest(before) || touchesRest(after)) {
    return null;
  }
  const restIds = rest.map((table) => table.id);
  const reactivated = restIds.length < 2
    ? null
    : combinations.find((other) => other.id !== combination.id && sameTableSet(other.tableIds, restIds)) ?? null;
  return { combinationId: combination.id, reactivatedId: reactivated?.id ?? null };
}
