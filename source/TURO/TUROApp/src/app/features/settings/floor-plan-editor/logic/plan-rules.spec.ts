import { PlanDecor, PlanTable } from '../../../../models';
import { decorErrors, tableErrors } from './plan-rules';

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
    expect(messages(table({ name: 't1 ' }), [table({ id: 'b', name: 'T1' })])).toEqual(['Une autre table porte déjà ce nom']);
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
