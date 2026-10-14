import { boundsOf, boundsOfAll, clampToZone, findFreeSpot, fitsInZone, normalizeRotation, placeCentredAt, snapToGrid } from './geometry';

const ROOM = { width: 8, height: 5.5 };
const WALL = { width: 2, height: 0.15, rotation: 90 };

describe('geometry', () => {
  it('should snap to the 25 cm grid without floating noise', () => {
    expect(snapToGrid(0.1 + 0.2)).toBe(0.25);
    expect(snapToGrid(1.13)).toBe(1.25);
    expect(snapToGrid(-0.1)).toBe(0);
  });

  it('should round rotation to 15 degrees within [0, 360)', () => {
    expect(normalizeRotation(22)).toBe(15);
    expect(normalizeRotation(-15)).toBe(345);
    expect(normalizeRotation(360)).toBe(0);
  });

  it('should keep a table inside the room, flush with the wall it is pushed against', () => {
    expect(clampToZone({ x: 7.9, y: -1 }, { width: 0.7, height: 0.7 }, ROOM)).toEqual({ x: 7.3, y: 0 });
  });

  it('should pin a table larger than its room to the corner instead of failing', () => {
    expect(clampToZone({ x: 3, y: 3 }, { width: 9, height: 1 }, ROOM)).toEqual({ x: 0, y: 3 });
  });

  it('should bound several objects as they are turned', () => {
    const square = { x: 0, y: 0, width: 0.9, height: 0.9 };
    // 1,8 × 0,8 tournée de 90° autour de son centre (1,9 ; 0,4) : elle occupe x 1,5 → 2,3 et y −0,5 → 1,3
    const turned = { x: 1, y: 0, width: 1.8, height: 0.8, rotation: 90 };
    expect(boundsOfAll([square, turned])).toEqual({ x: 0, y: -0.5, width: 2.3, height: 1.8 });
  });

  it('should centre a dropped table under the pointer', () => {
    expect(placeCentredAt({ x: 2, y: 2 }, { width: 0.9, height: 0.9 }, ROOM)).toEqual({ x: 1.5, y: 1.5 });
  });

  it('should measure a rotated item by the place it really takes', () => {
    const bounds = boundsOf({ x: 0, y: 0, ...WALL });
    expect(bounds.width).toBeCloseTo(0.15, 6);
    expect(bounds.height).toBeCloseTo(2, 6);
    expect(bounds.x).toBeCloseTo(0.925, 6);
    expect(bounds.y).toBeCloseTo(-0.925, 6);
  });

  it('should let a wall turned by 90° touch the left wall of the room', () => {
    const position = clampToZone({ x: -3, y: 1 }, WALL, ROOM);
    expect(boundsOf({ ...position, ...WALL }).x).toBeCloseTo(0, 6);
  });

  it('should not let a turned item leave the room', () => {
    const position = clampToZone({ x: 3, y: 0 }, WALL, ROOM);
    expect(boundsOf({ ...position, ...WALL }).y).toBeCloseTo(0, 6);
    expect(fitsInZone({ x: 3, y: 0, ...WALL }, ROOM)).toBeFalse();
    expect(fitsInZone({ ...position, ...WALL }, ROOM)).toBeTrue();
  });

  it('should stick an edge to a neighbour within 10 cm, before the grid', () => {
    const wall = { x: 0, y: 0, width: 2, height: 0.15 };
    // une porte de 15 cm lâchée 7 cm sous le mur : elle s'y colle au lieu de sauter sur la grille
    expect(clampToZone({ x: 0.5, y: 0.22 }, { width: 0.9, height: 0.15 }, ROOM, [wall])).toEqual({ x: 0.5, y: 0.15 });
  });

  it('should follow the grid when no neighbour is close enough', () => {
    const wall = { x: 0, y: 0, width: 2, height: 0.15 };
    expect(clampToZone({ x: 0.5, y: 0.4 }, { width: 0.9, height: 0.15 }, ROOM, [wall])).toEqual({ x: 0.5, y: 0.5 });
  });

  it('should tell whether a table fits in its room', () => {
    expect(fitsInZone({ x: 7.25, y: 0, width: 0.75, height: 0.7 }, ROOM)).toBeTrue();
    expect(fitsInZone({ x: 7.5, y: 0, width: 0.75, height: 0.7 }, ROOM)).toBeFalse();
  });

  it('should find the first free spot to the right, then on the rows below', () => {
    const original = { x: 0, y: 0, width: 0.9, height: 0.9 };
    expect(findFreeSpot(original, ROOM, [original])).toEqual({ x: 1, y: 0 });
    const narrow = { width: 2, height: 2 };
    const left = { x: 0, y: 0, ...narrow };
    expect(findFreeSpot(left, narrow, [left])).toEqual({ x: 0, y: 0 });
  });
});
