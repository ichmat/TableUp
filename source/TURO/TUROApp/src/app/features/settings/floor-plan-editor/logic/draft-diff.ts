import { Decor, FloorPlanDraftContent, FloorPlanZone, PlanDecor, PlanTable, Table } from '../../../../models';

const EPSILON = 1e-6;

/** La part dessinable d'une table : `needsCleaningSince` et `isActive` ne se dessinent pas */
export function toPlanTable({ id, zoneId, name, capacity, shape, x, y, width, height, rotation }: PlanTable | Table): PlanTable {
  return { id, zoneId, name, capacity, shape, x, y, width, height, rotation };
}

export function toPlanDecor({ id, zoneId, type, label, x, y, width, height, rotation }: PlanDecor | Decor): PlanDecor {
  return { id, zoneId, type, label, x, y, width, height, rotation };
}

export function publishedTables(zones: readonly FloorPlanZone[]): PlanTable[] {
  return zones.flatMap((zone) => zone.tables.filter((table) => table.isActive).map(toPlanTable));
}

/** Le brouillon de départ, quand il n'y en a pas : le plan publié tel quel */
export function draftFromPublished(zones: readonly FloorPlanZone[]): FloorPlanDraftContent {
  return {
    tables: publishedTables(zones),
    decors: zones.flatMap((zone) => zone.decors.map(toPlanDecor)),
  };
}

const sameNumber = (a: number, b: number) => Math.abs(a - b) < EPSILON;

export function sameTable(a: PlanTable, b: PlanTable): boolean {
  return a.zoneId === b.zoneId && a.name === b.name && a.capacity === b.capacity && a.shape === b.shape
    && sameNumber(a.x, b.x) && sameNumber(a.y, b.y)
    && sameNumber(a.width, b.width) && sameNumber(a.height, b.height)
    && sameNumber(a.rotation, b.rotation);
}

export function sameDecor(a: PlanDecor, b: PlanDecor): boolean {
  return a.zoneId === b.zoneId && a.type === b.type && (a.label ?? null) === (b.label ?? null)
    && sameNumber(a.x, b.x) && sameNumber(a.y, b.y)
    && sameNumber(a.width, b.width) && sameNumber(a.height, b.height)
    && sameNumber(a.rotation, b.rotation);
}

/** « Brouillon · N modifications » : tables créées ou modifiées, décors créés, modifiés ou supprimés */
export function countChanges(published: FloorPlanDraftContent, draft: FloorPlanDraftContent): number {
  const tablesById = new Map(published.tables.map((table) => [table.id, table]));
  const changedTables = draft.tables.filter((table) => {
    const before = tablesById.get(table.id);
    return before === undefined || !sameTable(before, table);
  }).length;

  const decorsById = new Map(published.decors.map((decor) => [decor.id, decor]));
  const draftDecorIds = new Set(draft.decors.map((decor) => decor.id));
  const changedDecors = draft.decors.filter((decor) => {
    const before = decorsById.get(decor.id);
    return before === undefined || !sameDecor(before, decor);
  }).length;
  const deletedDecors = published.decors.filter((decor) => !draftDecorIds.has(decor.id)).length;

  return changedTables + changedDecors + deletedDecors;
}
