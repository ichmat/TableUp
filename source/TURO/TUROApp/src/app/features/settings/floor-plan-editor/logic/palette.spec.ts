import { PlanTable } from '../../../../models';
import { buildTablePalette, DEFAULT_TABLE_PALETTE, paletteDimensions, paletteLabel } from './palette';

const table = (patch: Partial<PlanTable>): PlanTable => ({
  id: 'id', zoneId: 'z', name: 'T1', capacity: 4, shape: 'Square', x: 0, y: 0, width: 0.9, height: 0.9, rotation: 0, ...patch,
});

describe('palette', () => {
  it('should offer the default types on an empty plan', () => {
    expect(buildTablePalette([])).toEqual([...DEFAULT_TABLE_PALETTE]);
  });

  it('should keep every type used in the plan, once, sorted by seats', () => {
    const palette = buildTablePalette([
      table({ shape: 'Round', capacity: 8, width: 1.6, height: 1.6 }),
      table({ shape: 'Square', capacity: 4, width: 0.9, height: 0.9 }),
      table({ shape: 'Round', capacity: 8, width: 1.6, height: 1.6, id: 'other' }),
    ]);
    expect(palette.map(paletteLabel)).toEqual(['Ronde 2', 'Carrée 4', 'Rect. 6', 'Ronde 8']);
  });

  it('should show a diameter for a round table, width × depth otherwise', () => {
    expect(paletteDimensions(DEFAULT_TABLE_PALETTE[0])).toBe('Ø 70');
    expect(paletteDimensions(DEFAULT_TABLE_PALETTE[2])).toBe('180 × 80');
  });
});
