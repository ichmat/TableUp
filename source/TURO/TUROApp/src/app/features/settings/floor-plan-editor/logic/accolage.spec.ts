import { PlanCombination, PlanTable } from '../../../../models';
import { activeCombinationOf, contactLength, defaultCombinationName, proposeAccolage, proposeSeparation, touchingTable } from './accolage';
import { tableSetKey } from './table-set';

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

  it('should name a combination in natural order, whatever its length', () => {
    expect(defaultCombinationName(['13', '12'])).toBe('12-13');
    expect(defaultCombinationName(['T10', 'T9'])).toBe('T9-T10');
    expect(defaultCombinationName(['14', ' 12', '13'])).toBe('12-13-14');
  });

  const combination = (patch: Partial<PlanCombination>): PlanCombination =>
    ({ id: 'c', name: 'C', capacity: 8, tableIds: [], isActive: true, ...patch });
  // 12 | 13 | 14 en ligne, bord à bord
  const t12 = table({ id: '12', name: '12' });
  const t13 = table({ id: '13', name: '13', x: 0.9 });
  const t14 = table({ id: '14', name: '14', x: 1.8 });
  const none = new Set<string>();

  it('should find the only active combination of a table', () => {
    const asleep = combination({ id: 'a', tableIds: ['12', '13'], isActive: false });
    const awake = combination({ id: 'b', tableIds: ['12', '13', '14'] });
    expect(activeCombinationOf('13', [asleep, awake])?.id).toBe('b');
    expect(activeCombinationOf('15', [asleep, awake])).toBeNull();
  });

  describe('proposeAccolage', () => {
    it('should propose the pair when the touched table is in no active combination', () => {
      expect(proposeAccolage(['14'], [t13, t14], [], none)).toEqual({ tableIds: ['14', '13'], existingId: null, deactivatedIds: [] });
    });

    it('should join the active combination of the touched table, and deactivate it', () => {
      const pair = combination({ id: 'p', tableIds: ['12', '13'] });
      expect(proposeAccolage(['14'], [t12, t13, t14], [pair], none))
        .toEqual({ tableIds: ['14', '12', '13'], existingId: null, deactivatedIds: ['p'] });
    });

    it('should carry a whole combination dragged by its pill against a table', () => {
      const pair = combination({ id: 'p', tableIds: ['12', '13'] });
      expect(proposeAccolage(['12', '13'], [t12, t13, t14], [pair], none))
        .toEqual({ tableIds: ['12', '13', '14'], existingId: null, deactivatedIds: ['p'] });
    });

    it('should reactivate a known inactive set instead of creating it', () => {
      const pair = combination({ id: 'p', tableIds: ['13', '14'], isActive: false });
      expect(proposeAccolage(['14'], [t13, t14], [pair], none)).toEqual({ tableIds: ['14', '13'], existingId: 'p', deactivatedIds: [] });
    });

    it('should propose nothing for a set already active, a declined set, or without contact', () => {
      expect(proposeAccolage(['14'], [t13, t14], [combination({ id: 'p', tableIds: ['13', '14'] })], none)).toBeNull();
      expect(proposeAccolage(['14'], [t13, t14], [], new Set([tableSetKey(['13', '14'])]))).toBeNull();
      expect(proposeAccolage(['14'], [t13, { ...t14, x: 2 }], [], none)).toBeNull();
    });
  });

  describe('proposeSeparation', () => {
    const chain = combination({ id: 'chain', tableIds: ['12', '13', '14'] });
    const away = { ...t14, x: 3 };

    it('should propose to separate a table pulled away from its combination, and reactivate the known rest', () => {
      const pair = combination({ id: 'p', tableIds: ['12', '13'], isActive: false });
      expect(proposeSeparation(t14, away, [t12, t13, t14], [chain, pair], none)).toEqual({ combinationId: 'chain', reactivatedId: 'p' });
      expect(proposeSeparation(t14, away, [t12, t13, t14], [chain], none)).toEqual({ combinationId: 'chain', reactivatedId: null });
    });

    it('should not propose it while the table still touches its combination, or once kept', () => {
      expect(proposeSeparation(t14, { ...t14, y: 0.3 }, [t12, t13, t14], [chain], none)).toBeNull();
      expect(proposeSeparation(t14, away, [t12, t13, t14], [chain], new Set(['chain']))).toBeNull();
    });

    it('should not propose it for tables already apart, or outside any active combination', () => {
      expect(proposeSeparation(away, { ...away, x: 4 }, [t12, t13, away], [chain], none)).toBeNull();
      expect(proposeSeparation(t14, away, [t12, t13, t14], [{ ...chain, isActive: false }], none)).toBeNull();
    });
  });
});
