import { PlanDecor, PlanTable } from '../../../../models';
import { fitsInZone, Size } from './geometry';

/** Mêmes bornes que l'API (FloorPlanController) : la publication reste l'autorité */
export const TABLE_LIMITS = {
  maxNameLength: 20,
  minCapacity: 1,
  maxCapacity: 50,
  minSize: 0.3,
  maxSize: 4,
} as const;

export type PlanField = 'name' | 'capacity' | 'size' | 'position';

export interface PlanError {
  field: PlanField,
  message: string,
}

const normalized = (name: string) => name.trim().toLowerCase();

/**
 * Ce qui empêcherait la publication de cette table. `tables` = toutes les tables du brouillon,
 * elle comprise ; `zone` absente = salle inconnue, on ne juge pas la position
 */
export function tableErrors(table: PlanTable, zone: Size | undefined, tables: readonly PlanTable[]): PlanError[] {
  const errors: PlanError[] = [];
  const name = table.name.trim();

  if (name.length === 0) {
    errors.push({ field: 'name', message: 'Indiquez un nom' });
  } else if (name.length > TABLE_LIMITS.maxNameLength) {
    errors.push({ field: 'name', message: `Le nom est limité à ${TABLE_LIMITS.maxNameLength} caractères` });
  } else if (tables.some((other) => other.id !== table.id && normalized(other.name) === normalized(name))) {
    errors.push({ field: 'name', message: 'Une autre table porte déjà ce nom' });
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
