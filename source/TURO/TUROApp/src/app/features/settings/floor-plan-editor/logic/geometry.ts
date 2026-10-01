/** Grille de 25 cm et rotation par pas de 15° (§12.1, EDIT-02) */
export const GRID_STEP = 0.25;
export const ROTATION_STEP = 15;
const EPSILON = 1e-6;

export interface Point { x: number, y: number }
export interface Size { width: number, height: number }
export type Rect = Point & Size;

/** Évite les 0.30000000000000004 qui fausseraient l'aimantation et la comparaison des brouillons */
const round = (value: number) => Math.round(value * 10000) / 10000;

export function snapToGrid(value: number): number {
  return round(Math.max(0, Math.round(round(value / GRID_STEP)) * GRID_STEP));
}

export function normalizeRotation(degrees: number): number {
  const snapped = Math.round(degrees / ROTATION_STEP) * ROTATION_STEP;
  return ((snapped % 360) + 360) % 360;
}

/** Plus grande position sur la grille qui garde l'objet dans la salle ; 0 s'il est plus grand qu'elle */
function maxOnGrid(room: number, size: number): number {
  return Math.max(0, round(Math.floor(round((room - size) / GRID_STEP)) * GRID_STEP));
}

/** Aimante la position et la ramène dans la salle (le rectangle non tourné) */
export function clampToZone(position: Point, size: Size, zone: Size): Point {
  return {
    x: Math.min(snapToGrid(position.x), maxOnGrid(zone.width, size.width)),
    y: Math.min(snapToGrid(position.y), maxOnGrid(zone.height, size.height)),
  };
}

/** Une table lâchée naît centrée sous le doigt */
export function placeCentredAt(point: Point, size: Size, zone: Size): Point {
  return clampToZone({ x: point.x - size.width / 2, y: point.y - size.height / 2 }, size, zone);
}

export function fitsInZone(rect: Rect, zone: Size): boolean {
  return rect.x >= -EPSILON && rect.y >= -EPSILON
    && rect.x + rect.width <= zone.width + EPSILON
    && rect.y + rect.height <= zone.height + EPSILON;
}

/** Recouvrement strict : deux tables qui se touchent ne se recouvrent pas */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width - EPSILON && b.x < a.x + a.width - EPSILON
    && a.y < b.y + b.height - EPSILON && b.y < a.y + a.height - EPSILON;
}

/**
 * La place d'une copie de `original` : la première libre à sa droite, puis rangée par rangée vers le bas.
 * Sans place libre, la copie se pose sur l'original — l'utilisateur la déplacera
 */
export function findFreeSpot(original: Rect, zone: Size, occupied: readonly Rect[]): Point {
  const size = { width: original.width, height: original.height };
  const startX = round(Math.ceil(round((original.x + original.width) / GRID_STEP)) * GRID_STEP);
  for (let y = original.y; y + size.height <= zone.height + EPSILON; y = round(y + GRID_STEP)) {
    for (let x = y === original.y ? startX : 0; x + size.width <= zone.width + EPSILON; x = round(x + GRID_STEP)) {
      const candidate = { x, y, ...size };
      if (!occupied.some((other) => overlaps(candidate, other))) {
        return { x, y };
      }
    }
  }
  return { x: original.x, y: original.y };
}
