import { DecorType, PlanTable, TableShape } from '../../../../models';
import { toCentimetres } from './units';

/** Un type de table qu'on glisse sur le plan (EDIT-04, EDIT-06) */
export interface TablePaletteEntry {
  shape: TableShape,
  capacity: number,
  /** En mètres */
  width: number,
  height: number,
}

export const DEFAULT_TABLE_PALETTE: readonly TablePaletteEntry[] = [
  { shape: 'Round', capacity: 2, width: 0.7, height: 0.7 },
  { shape: 'Square', capacity: 4, width: 0.9, height: 0.9 },
  { shape: 'Rectangular', capacity: 6, width: 1.8, height: 0.8 },
];

export const SHAPE_LABELS: Record<TableShape, string> = {
  Round: 'Ronde',
  Square: 'Carrée',
  Rectangular: 'Rect.',
};

const SHAPE_ORDER: TableShape[] = ['Round', 'Square', 'Rectangular'];

const keyOf = (entry: TablePaletteEntry) =>
  `${entry.shape}|${entry.capacity}|${toCentimetres(entry.width)}|${toCentimetres(entry.height)}`;

/** Les types par défaut, plus chaque type présent dans le plan : la palette se déduit, rien n'est stocké */
export function buildTablePalette(tables: readonly PlanTable[]): TablePaletteEntry[] {
  const entries = new Map<string, TablePaletteEntry>();
  for (const entry of DEFAULT_TABLE_PALETTE) {
    entries.set(keyOf(entry), entry);
  }
  for (const { shape, capacity, width, height } of tables) {
    const entry = { shape, capacity, width, height };
    if (!entries.has(keyOf(entry))) {
      entries.set(keyOf(entry), entry);
    }
  }
  return [...entries.values()].sort((a, b) =>
    a.capacity - b.capacity
    || SHAPE_ORDER.indexOf(a.shape) - SHAPE_ORDER.indexOf(b.shape)
    || a.width - b.width);
}

export function paletteLabel(entry: TablePaletteEntry): string {
  return `${SHAPE_LABELS[entry.shape]} ${entry.capacity}`;
}

export function paletteDimensions(entry: TablePaletteEntry): string {
  return entry.shape === 'Round'
    ? `Ø ${toCentimetres(entry.width)}`
    : `${toCentimetres(entry.width)} × ${toCentimetres(entry.height)}`;
}

/** Un type de décor : des repères d'orientation, pas de la décoration (EDIT-08) */
export interface DecorPaletteEntry {
  type: DecorType,
  /** En mètres */
  width: number,
  height: number,
}

export const DECOR_LABELS: Record<DecorType, string> = {
  Wall: 'Mur',
  Door: 'Porte',
  Bar: 'Bar',
  Pass: 'Passe',
  Pillar: 'Pilier',
  Stairs: 'Escalier',
  Other: 'Autre',
};

export const DECOR_PALETTE: readonly DecorPaletteEntry[] = [
  { type: 'Wall', width: 2, height: 0.15 },
  { type: 'Door', width: 0.9, height: 0.15 },
  { type: 'Bar', width: 3, height: 0.6 },
  { type: 'Pass', width: 1.5, height: 0.4 },
  { type: 'Pillar', width: 0.4, height: 0.4 },
  { type: 'Stairs', width: 1, height: 2 },
  { type: 'Other', width: 1, height: 1 },
];
