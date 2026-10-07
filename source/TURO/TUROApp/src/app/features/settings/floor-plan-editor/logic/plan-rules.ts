import { PlanCombination, PlanDecor, PlanTable } from '../../../../models';
import { fitsInZone, Size } from './geometry';
import { sameTableSet } from './table-set';

/** Mêmes bornes que l'API (FloorPlanController) : la publication reste l'autorité */
export const TABLE_LIMITS = {
  maxNameLength: 20,
  minCapacity: 1,
  maxCapacity: 50,
  minSize: 0.3,
  maxSize: 4,
} as const;

export type PlanField = 'name' | 'capacity' | 'size' | 'position' | 'members';

export interface PlanError {
  field: PlanField,
  message: string,
}

const normalized = (name: string) => name.trim().toLowerCase();

/**
 * Ce qui empêcherait la publication de cette table. `tables` = toutes les tables du brouillon, elle comprise ;
 * `combinations` : leurs noms comptent pour l'unicité ; `zone` absente = salle inconnue, on ne juge pas la position
 */
export function tableErrors(
  table: PlanTable, zone: Size | undefined, tables: readonly PlanTable[], combinations: readonly PlanCombination[] = [],
): PlanError[] {
  const errors: PlanError[] = [];
  const name = table.name.trim();

  if (name.length === 0) {
    errors.push({ field: 'name', message: 'Indiquez un nom' });
  } else if (name.length > TABLE_LIMITS.maxNameLength) {
    errors.push({ field: 'name', message: `Le nom est limité à ${TABLE_LIMITS.maxNameLength} caractères` });
  } else if (tables.some((other) => other.id !== table.id && normalized(other.name) === normalized(name))
    || combinations.some((combination) => normalized(combination.name) === normalized(name))) {
    errors.push({ field: 'name', message: 'Une table ou une combinaison porte déjà ce nom' });
  }

  if (!Number.isInteger(table.capacity) || table.capacity < TABLE_LIMITS.minCapacity || table.capacity > TABLE_LIMITS.maxCapacity) {
    errors.push({ field: 'capacity', message: `Entre ${TABLE_LIMITS.minCapacity} et ${TABLE_LIMITS.maxCapacity} places` });
  }

  const inRange = (value: number) => value >= TABLE_LIMITS.minSize && value <= TABLE_LIMITS.maxSize;
  if (!inRange(table.width) || !inRange(table.height)) {
    errors.push({ field: 'size', message: 'Les dimensions vont de 30 à 400 cm' });
  } else if (table.shape === 'Round' && Math.abs(table.width - table.height) > 1e-6) {
    errors.push({ field: 'size', message: 'Une table ronde est aussi large que profonde' });
  }

  if (zone !== undefined && !fitsInZone(table, zone)) {
    errors.push({ field: 'position', message: 'La table dépasse de la salle' });
  }

  return errors;
}

/** Mêmes bornes que l'API */
export const DECOR_LIMITS = {
  maxLabelLength: 30,
  minSize: 0.1,
} as const;

/** Ce qui empêcherait la publication de ce décor */
export function decorErrors(decor: PlanDecor, zone: Size | undefined): PlanError[] {
  const errors: PlanError[] = [];
  if ((decor.label?.trim().length ?? 0) > DECOR_LIMITS.maxLabelLength) {
    errors.push({ field: 'name', message: `Le libellé est limité à ${DECOR_LIMITS.maxLabelLength} caractères` });
  }
  const tooSmall = decor.width < DECOR_LIMITS.minSize || decor.height < DECOR_LIMITS.minSize;
  const tooLarge = zone !== undefined && (decor.width > zone.width || decor.height > zone.height);
  if (tooSmall || tooLarge) {
    errors.push({ field: 'size', message: 'Les dimensions vont de 10 cm à la taille de la salle' });
  } else if (zone !== undefined && !fitsInZone(decor, zone)) {
    errors.push({ field: 'position', message: 'Le décor dépasse de la salle' });
  }
  return errors;
}

/** Mêmes bornes que l'API */
export const COMBINATION_LIMITS = {
  maxNameLength: 20,
  minCapacity: 1,
  maxCapacity: 100,
} as const;

/** Ce qui empêcherait la publication de cette combinaison. `combinations` la comprend */
export function combinationErrors(
  combination: PlanCombination, tables: readonly PlanTable[], combinations: readonly PlanCombination[],
): PlanError[] {
  const errors: PlanError[] = [];
  const name = combination.name.trim();
  if (name.length === 0) {
    errors.push({ field: 'name', message: 'Indiquez un nom' });
  } else if (name.length > COMBINATION_LIMITS.maxNameLength) {
    errors.push({ field: 'name', message: `Le nom est limité à ${COMBINATION_LIMITS.maxNameLength} caractères` });
  } else if (tables.some((table) => normalized(table.name) === normalized(name))
    || combinations.some((other) => other.id !== combination.id && normalized(other.name) === normalized(name))) {
    errors.push({ field: 'name', message: 'Une table ou une combinaison porte déjà ce nom' });
  }

  if (!Number.isInteger(combination.capacity)
    || combination.capacity < COMBINATION_LIMITS.minCapacity || combination.capacity > COMBINATION_LIMITS.maxCapacity) {
    errors.push({ field: 'capacity', message: `Entre ${COMBINATION_LIMITS.minCapacity} et ${COMBINATION_LIMITS.maxCapacity} places` });
  }

  const ids = new Set(tables.map((table) => table.id));
  const members = combination.tableIds;
  if (members.length < 2 || new Set(members).size !== members.length || members.some((id) => !ids.has(id))) {
    errors.push({ field: 'members', message: 'Une combinaison réunit au moins deux tables du plan' });
    return errors;
  }
  if (combinations.some((other) => other.id !== combination.id && sameTableSet(other.tableIds, members))) {
    errors.push({ field: 'members', message: 'Ces tables forment déjà une combinaison' });
  }
  // active = collée en ce moment : dans une seule salle, et ses tables dans aucune autre combinaison active (§3.4)
  if (combination.isActive) {
    const zones = new Set(tables.filter((table) => members.includes(table.id)).map((table) => table.zoneId));
    if (zones.size > 1) {
      errors.push({ field: 'members', message: 'Une combinaison active a toutes ses tables dans la même salle' });
    }
    if (combinations.some((other) => other.id !== combination.id && other.isActive && other.tableIds.some((id) => members.includes(id)))) {
      errors.push({ field: 'members', message: 'Une de ces tables est déjà dans une autre combinaison active' });
    }
  }
  return errors;
}
