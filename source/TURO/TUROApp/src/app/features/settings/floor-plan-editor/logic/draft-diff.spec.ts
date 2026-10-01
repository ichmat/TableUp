import { FloorPlanZone, Table } from '../../../../models';
import { countChanges, draftFromPublished } from './draft-diff';

const T1: Table = {
  id: 't1', zoneId: 'z', name: 'T1', capacity: 2, shape: 'Round', x: 0, y: 0, width: 0.7, height: 0.7,
  rotation: 0, needsCleaningSince: null, isActive: true,
};
const ZONES: FloorPlanZone[] = [{
  id: 'z', restaurantId: 'r', name: 'Salle', order: 0, width: 8, height: 5.5,
  tables: [T1, { ...T1, id: 'old', name: 'T9', isActive: false }], decors: [], combinations: [],
}];

describe('draft-diff', () => {
  it('should start a draft from the active published tables only, without their service state', () => {
    expect(draftFromPublished(ZONES)).toEqual({
      tables: [{ id: 't1', zoneId: 'z', name: 'T1', capacity: 2, shape: 'Round', x: 0, y: 0, width: 0.7, height: 0.7, rotation: 0 }],
      decors: [],
    });
  });

  it('should count created and modified tables, and nothing for an untouched draft', () => {
    const published = draftFromPublished(ZONES);
    expect(countChanges(published, published)).toBe(0);

    const moved = { ...published.tables[0], x: 1 };
    const created = { ...published.tables[0], id: 'new', name: 'T2' };
    expect(countChanges(published, { tables: [moved, created], decors: [] })).toBe(2);
  });

  it('should count created, modified and deleted decors', () => {
    const bar = { id: 'bar', zoneId: 'z', type: 'Bar' as const, label: null, x: 0, y: 4, width: 3, height: 0.6, rotation: 0 };
    const zones: FloorPlanZone[] = [{ ...ZONES[0], decors: [bar] }];
    const published = draftFromPublished(zones);
    expect(published.decors).toEqual([bar]);

    const door = { ...bar, id: 'door', type: 'Door' as const };
    expect(countChanges(published, { tables: published.tables, decors: [] })).toBe(1);
    expect(countChanges(published, { tables: published.tables, decors: [{ ...bar, x: 1 }, door] })).toBe(2);
  });

  it('should count a table moved back to its place as unchanged', () => {
    const published = draftFromPublished(ZONES);
    const back = { ...published.tables[0], x: 0.1 + 0.2 - 0.3 };
    expect(countChanges(published, { tables: [back], decors: [] })).toBe(0);
  });
});
