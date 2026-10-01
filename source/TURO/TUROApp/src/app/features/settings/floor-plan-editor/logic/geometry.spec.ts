import { clampToZone, findFreeSpot, fitsInZone, normalizeRotation, placeCentredAt, snapToGrid } from './geometry';

const ROOM = { width: 8, height: 5.5 };

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

  it('should keep a table inside the room, on the grid', () => {
    expect(clampToZone({ x: 7.9, y: -1 }, { width: 0.7, height: 0.7 }, ROOM)).toEqual({ x: 7.25, y: 0 });
  });

  it('should pin a table larger than its room to the corner instead of failing', () => {
    expect(clampToZone({ x: 3, y: 3 }, { width: 9, height: 1 }, ROOM)).toEqual({ x: 0, y: 3 });
  });

  it('should centre a dropped table under the pointer', () => {
    expect(placeCentredAt({ x: 2, y: 2 }, { width: 0.9, height: 0.9 }, ROOM)).toEqual({ x: 1.5, y: 1.5 });
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
