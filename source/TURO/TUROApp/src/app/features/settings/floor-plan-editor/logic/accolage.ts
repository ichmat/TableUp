import { PlanTable } from '../../../../models';
import { boundsOf, Placed, Rect } from './geometry';

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

/** « 12-13 » : les deux noms dans l'ordre naturel (RAPP-04), modifiable ensuite */
export function defaultCombinationName(a: string, b: string): string {
  return [a.trim(), b.trim()].sort((x, y) => x.localeCompare(y, 'fr', { numeric: true })).join('-');
}

/** Clé d'un couple de tables, quel que soit l'ordre */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}
