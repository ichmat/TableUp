/** Grille de 25 cm et rotation par pas de 15° (§12.1, EDIT-02) */
export const GRID_STEP = 0.25;
export const ROTATION_STEP = 15;
/** En deçà, un bord se colle au bord d'un voisin (ou d'un mur de la salle) plutôt qu'à la grille */
export const MAGNET_DISTANCE = 0.1;
const EPSILON = 1e-6;

export interface Point { x: number, y: number }
export interface Size { width: number, height: number }
export type Rect = Point & Size;
/** Un objet du plan : rectangle non tourné, et sa rotation autour du centre */
export type Placed = Rect & { rotation?: number };

/** Évite les 0.30000000000000004 qui fausseraient l'aimantation et la comparaison des brouillons */
const round = (value: number) => Math.round(value * 10000) / 10000;

export function snapToGrid(value: number): number {
  return round(Math.max(0, Math.round(round(value / GRID_STEP)) * GRID_STEP));
}

export function normalizeRotation(degrees: number): number {
  const snapped = Math.round(degrees / ROTATION_STEP) * ROTATION_STEP;
  return ((snapped % 360) + 360) % 360;
}

/** Dimensions de la place réellement occupée par un objet tourné (sa boîte englobante) */
function turnedSize(size: Size, rotation = 0): Size {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    width: round(size.width * cos + size.height * sin),
    height: round(size.width * sin + size.height * cos),
  };
}

/** La place réellement occupée à l'écran : la rotation se fait autour du centre */
export function boundsOf(item: Placed): Rect {
  const turned = turnedSize(item, item.rotation);
  return {
    x: item.x + (item.width - turned.width) / 2,
    y: item.y + (item.height - turned.height) / 2,
    ...turned,
  };
}

/**
 * Position d'un bord sur un axe : collé au bord voisin le plus proche s'il est à moins de `MAGNET_DISTANCE`,
 * sinon sur la grille, puis ramené dans la salle
 */
function placeOnAxis(start: number, length: number, room: number, edges: readonly number[]): number {
  let placed: number | null = null;
  let best = MAGNET_DISTANCE + EPSILON;
  for (const edge of [0, room, ...edges]) {
    // le début ou la fin de l'objet contre ce bord
    for (const candidate of [edge, edge - length]) {
      const distance = Math.abs(candidate - start);
      if (distance < best) {
        best = distance;
        placed = candidate;
      }
    }
  }
  const snapped = placed ?? Math.round(round(start / GRID_STEP)) * GRID_STEP;
  return round(Math.min(Math.max(snapped, 0), Math.max(0, room - length)));
}

/**
 * Aimante la position (rectangle non tourné) et garde l'objet dans la salle. Les deux se jugent sur la place
 * réellement occupée : un mur tourné de 90° se colle au bord, et rien de tourné ne dépasse
 */
export function clampToZone(position: Point, item: Size & { rotation?: number }, zone: Size, neighbours: readonly Rect[] = []): Point {
  const turned = turnedSize(item, item.rotation);
  const offsetX = (item.width - turned.width) / 2;
  const offsetY = (item.height - turned.height) / 2;
  const left = placeOnAxis(position.x + offsetX, turned.width, zone.width, neighbours.flatMap((n) => [n.x, n.x + n.width]));
  const top = placeOnAxis(position.y + offsetY, turned.height, zone.height, neighbours.flatMap((n) => [n.y, n.y + n.height]));
  return { x: round(left - offsetX), y: round(top - offsetY) };
}

/** Une table lâchée naît centrée sous le doigt */
export function placeCentredAt(point: Point, item: Size & { rotation?: number }, zone: Size, neighbours: readonly Rect[] = []): Point {
  return clampToZone({ x: point.x - item.width / 2, y: point.y - item.height / 2 }, item, zone, neighbours);
}

/** L'objet, tel qu'il est tourné, tient-il dans la salle ? */
export function fitsInZone(item: Placed, zone: Size): boolean {
  const bounds = boundsOf(item);
  return bounds.x >= -EPSILON && bounds.y >= -EPSILON
    && bounds.x + bounds.width <= zone.width + EPSILON
    && bounds.y + bounds.height <= zone.height + EPSILON;
}

/** Recouvrement strict : deux tables qui se touchent ne se recouvrent pas */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width - EPSILON && b.x < a.x + a.width - EPSILON
    && a.y < b.y + b.height - EPSILON && b.y < a.y + a.height - EPSILON;
}

/**
 * La place d'une copie de `original` : la première libre à sa droite, puis rangée par rangée vers le bas,
 * en comptant la place réellement occupée. Sans place libre, la copie se pose sur l'original — l'utilisateur la déplacera
 */
export function findFreeSpot(original: Placed, zone: Size, occupied: readonly Placed[]): Point {
  const bounds = boundsOf(original);
  const offsetX = bounds.x - original.x;
  const offsetY = bounds.y - original.y;
  const taken = occupied.map(boundsOf);
  const startX = round(Math.ceil(round((bounds.x + bounds.width) / GRID_STEP)) * GRID_STEP);
  for (let y = bounds.y; y + bounds.height <= zone.height + EPSILON; y = round(y + GRID_STEP)) {
    for (let x = y === bounds.y ? startX : 0; x + bounds.width <= zone.width + EPSILON; x = round(x + GRID_STEP)) {
      const candidate = { x, y, width: bounds.width, height: bounds.height };
      if (!taken.some((other) => overlaps(candidate, other))) {
        return { x: round(x - offsetX), y: round(y - offsetY) };
      }
    }
  }
  return { x: original.x, y: original.y };
}
