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
      combinations: [],
    });
  });

  it('should count created and modified tables, and nothing for an untouched draft', () => {
    const published = draftFromPublished(ZONES);
    expect(countChanges(published, published)).toBe(0);

    const moved = { ...published.tables[0], x: 1 };
    const created = { ...published.tables[0], id: 'new', name: 'T2' };
    expect(countChanges(published, { tables: [moved, created], decors: [], combinations: [] })).toBe(2);
  });

  it('should count created, modified and deleted decors', () => {
    const bar = { id: 'bar', zoneId: 'z', type: 'Bar' as const, label: null, x: 0, y: 4, width: 3, height: 0.6, rotation: 0 };
    const zones: FloorPlanZone[] = [{ ...ZONES[0], decors: [bar] }];
    const published = draftFromPublished(zones);
    expect(published.decors).toEqual([bar]);

    const door = { ...bar, id: 'door', type: 'Door' as const };
    expect(countChanges(published, { ...published, decors: [] })).toBe(1);
    expect(countChanges(published, { ...published, decors: [{ ...bar, x: 1 }, door] })).toBe(2);
  });

  it('should start from the published combinations and count created or renamed ones', () => {
    const combination = { id: 'c', zoneId: 'z', name: 'T1-T9', capacity: 4, tableIds: ['t1', 'old'], isActive: false, activateAt: null, deactivateAt: null };
    const published = draftFromPublished([{ ...ZONES[0], combinations: [combination] }]);
    expect(published.combinations).toEqual([{ id: 'c', name: 'T1-T9', capacity: 4, tableIds: ['t1', 'old'] }]);

    expect(countChanges(published, published)).toBe(0);
    const renamed = { ...published.combinations[0], name: 'Fenêtre' };
    const created = { id: 'n', name: 'Nouvelle', capacity: 6, tableIds: ['t1', 'x'] };
    expect(countChanges(published, { ...published, combinations: [renamed, created] })).toBe(2);
  });

  it('should count a table moved back to its place as unchanged', () => {
    const published = draftFromPublished(ZONES);
    const back = { ...published.tables[0], x: 0.1 + 0.2 - 0.3 };
    expect(countChanges(published, { tables: [back], decors: [], combinations: [] })).toBe(0);
  });
});
