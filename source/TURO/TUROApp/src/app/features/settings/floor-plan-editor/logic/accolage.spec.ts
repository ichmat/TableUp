import { PlanTable } from '../../../../models';
import { contactLength, defaultCombinationName, touchingTable } from './accolage';

const table = (patch: Partial<PlanTable>): PlanTable => ({
  id: 'a', zoneId: 'z', name: 'T1', capacity: 4, shape: 'Square', x: 0, y: 0, width: 0.9, height: 0.9, rotation: 0, ...patch,
});

describe('accolage', () => {
  it('should measure the contact of two tables side by side', () => {
    expect(contactLength(table({}), table({ id: 'b', x: 0.9 }))).toBeCloseTo(0.9, 6);
    expect(contactLength(table({}), table({ id: 'b', x: 0.9, y: 0.5 }))).toBeCloseTo(0.4, 6);
  });

  it('should not see a contact through a gap of 3 cm, nor on a corner', () => {
    expect(contactLength(table({}), table({ id: 'b', x: 0.93 }))).toBe(0);
    expect(contactLength(table({}), table({ id: 'b', x: 0.9, y: 0.8 }))).toBe(0);
  });

  it('should judge a turned table by the place it really takes', () => {
    const rect = table({ id: 'b', shape: 'Rectangular', width: 1.8, height: 0.8, rotation: 90, x: 0.4, y: 0.5 });
    // tournée de 90°, elle occupe x 0,9 → 1,7 : elle touche la carrée sur toute sa hauteur
    expect(contactLength(table({}), rect)).toBeCloseTo(0.9, 6);
  });

  it('should pick the longest contact when a table touches two others', () => {
    const moved = table({ x: 0.9, y: 0 });
    const left = table({ id: 'left', name: 'T2', x: 0, y: 0.6 });
    const right = table({ id: 'right', name: 'T3', x: 1.8, y: 0 });
    expect(touchingTable(moved, [left, right])?.table.id).toBe('right');
  });

  it('should ignore the moved table itself and tables of other rooms', () => {
    const moved = table({});
    expect(touchingTable(moved, [moved, table({ id: 'b', x: 0.9, zoneId: 'other' })])).toBeNull();
  });

  it('should name a combination in natural order', () => {
    expect(defaultCombinationName('13', '12')).toBe('12-13');
    expect(defaultCombinationName('T10', 'T9')).toBe('T9-T10');
  });
});
