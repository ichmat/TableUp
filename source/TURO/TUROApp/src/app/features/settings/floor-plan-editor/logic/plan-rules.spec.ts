import { PlanCombination, PlanDecor, PlanTable } from '../../../../models';
import { combinationErrors, decorErrors, tableErrors } from './plan-rules';

const ROOM = { width: 8, height: 5.5 };
const table = (patch: Partial<PlanTable>): PlanTable => ({
  id: 'a', zoneId: 'z', name: 'T1', capacity: 4, shape: 'Square', x: 0, y: 0, width: 0.9, height: 0.9, rotation: 0, ...patch,
});
const messages = (t: PlanTable, others: PlanTable[] = []) => tableErrors(t, ROOM, [t, ...others]).map((e) => e.message);

describe('tableErrors', () => {
  it('should accept a valid table', () => {
    expect(messages(table({}))).toEqual([]);
  });

  it('should refuse a name taken by another table, whatever the case or spaces', () => {
    expect(messages(table({ name: 't1 ' }), [table({ id: 'b', name: 'T1' })])).toEqual(['Une table ou une combinaison porte déjà ce nom']);
  });

  it('should refuse an empty or too long name', () => {
    expect(messages(table({ name: '  ' }))).toEqual(['Indiquez un nom']);
    expect(messages(table({ name: 'x'.repeat(21) }))).toEqual(['Le nom est limité à 20 caractères']);
  });

  it('should refuse seats outside 1 to 50', () => {
    expect(messages(table({ capacity: 0 }))).toEqual(['Entre 1 et 50 places']);
    expect(messages(table({ capacity: 2.5 }))).toEqual(['Entre 1 et 50 places']);
  });

  it('should refuse sizes outside 30 to 400 cm, and an oval round table', () => {
    expect(messages(table({ width: 0.2 }))).toEqual(['Les dimensions vont de 30 à 400 cm']);
    expect(messages(table({ shape: 'Round', width: 0.7, height: 0.9 }))).toEqual(['Une table ronde est aussi large que profonde']);
  });

  it('should flag a table that goes beyond its room', () => {
    expect(messages(table({ x: 7.5 }))).toEqual(['La table dépasse de la salle']);
  });

  it('should flag a turned table that pokes out of its room', () => {
    expect(messages(table({ shape: 'Rectangular', width: 1.8, height: 0.8, x: 0, y: 0, rotation: 90 }))).toEqual(['La table dépasse de la salle']);
  });
});

describe('decorErrors', () => {
  const decor = (patch: Partial<PlanDecor>): PlanDecor => ({
    id: 'd', zoneId: 'z', type: 'Wall', label: null, x: 0, y: 0, width: 2, height: 0.15, rotation: 0, ...patch,
  });

  it('should accept a wall along the room', () => {
    expect(decorErrors(decor({ width: 8 }), ROOM)).toEqual([]);
  });

  it('should refuse a tiny decor, a long label, and a decor beyond the room', () => {
    expect(decorErrors(decor({ height: 0.05 }), ROOM).map((e) => e.message)).toEqual(['Les dimensions vont de 10 cm à la taille de la salle']);
    expect(decorErrors(decor({ label: 'x'.repeat(31) }), ROOM).map((e) => e.message)).toEqual(['Le libellé est limité à 30 caractères']);
    expect(decorErrors(decor({ x: 7 }), ROOM).map((e) => e.message)).toEqual(['Le décor dépasse de la salle']);
  });
});

describe('combinationErrors', () => {
  const t1 = table({ id: 't1', name: 'T1' });
  const t2 = table({ id: 't2', name: 'T2', x: 0.9 });
  const t3 = table({ id: 't3', name: 'T3', x: 1.8 });
  const combination = (patch: Partial<PlanCombination>): PlanCombination =>
    ({ id: 'c', name: 'T1-T2', capacity: 8, tableIds: ['t1', 't2'], isActive: true, ...patch });
  const messages = (c: PlanCombination, others: PlanCombination[] = []) =>
    combinationErrors(c, [t1, t2, t3], [c, ...others]).map((e) => e.message);

  it('should accept a valid combination, a chain of three tables, and a pair inside an inactive chain', () => {
    expect(messages(combination({}))).toEqual([]);
    expect(messages(combination({ tableIds: ['t1', 't2', 't3'] }))).toEqual([]);
    expect(messages(combination({}), [combination({ id: 'd', name: 'T1-T2-T3', tableIds: ['t1', 't2', 't3'], isActive: false })])).toEqual([]);
  });

  it('should refuse an empty, long, or already used name, including a table name', () => {
    expect(messages(combination({ name: ' ' }))).toEqual(['Indiquez un nom']);
    expect(messages(combination({ name: 'x'.repeat(21) }))).toEqual(['Le nom est limité à 20 caractères']);
    expect(messages(combination({ name: 't1 ' }))).toEqual(['Une table ou une combinaison porte déjà ce nom']);
  });

  it('should refuse seats outside 1 to 100', () => {
    expect(messages(combination({ capacity: 0 }))).toEqual(['Entre 1 et 100 places']);
    expect(messages(combination({ capacity: 101 }))).toEqual(['Entre 1 et 100 places']);
  });

  it('should refuse fewer than two tables, a table twice, or a missing table', () => {
    const refused = ['Une combinaison réunit au moins deux tables du plan'];
    expect(messages(combination({ tableIds: ['t1'] }))).toEqual(refused);
    expect(messages(combination({ tableIds: ['t1', 't2', 't1'] }))).toEqual(refused);
    expect(messages(combination({ tableIds: ['t1', 'gone'] }))).toEqual(refused);
  });

  it('should refuse the same set of tables in another order', () => {
    expect(messages(combination({ tableIds: ['t1', 't2', 't3'] }), [combination({ id: 'd', name: 'Autre', tableIds: ['t3', 't1', 't2'], isActive: false })]))
      .toEqual(['Ces tables forment déjà une combinaison']);
  });

  it('should refuse an active combination split between two rooms, but not an inactive one', () => {
    const away = table({ id: 't9', name: 'T9', zoneId: 'terrasse' });
    const split = combination({ tableIds: ['t1', 't9'] });
    expect(combinationErrors(split, [t1, away], [split]).map((e) => e.message))
      .toEqual(['Une combinaison active a toutes ses tables dans la même salle']);
    const asleep = { ...split, isActive: false };
    expect(combinationErrors(asleep, [t1, away], [asleep])).toEqual([]);
  });

  it('should refuse a table in two active combinations', () => {
    expect(messages(combination({}), [combination({ id: 'd', name: 'T1-T2-T3', tableIds: ['t1', 't2', 't3'] })]))
      .toEqual(['Une de ces tables est déjà dans une autre combinaison active']);
  });
});

describe('tableErrors and combination names', () => {
  it('should refuse a table named like a combination', () => {
    const t = table({ name: 'T1-T2' });
    const combinations = [{ id: 'c', name: 't1-t2', capacity: 8, tableIds: ['x', 'y'], isActive: false }];
    expect(tableErrors(t, ROOM, [t], combinations).map((e) => e.message)).toEqual(['Une table ou une combinaison porte déjà ce nom']);
  });
});
