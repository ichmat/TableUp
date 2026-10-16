import { backTo, openFrom, PanelEntry } from './panel-stack';

const R1: PanelEntry = { kind: 'reservation', id: 'r1', label: 'Réservation de jeudi 20:00' };
const C1: PanelEntry = { kind: 'client', id: 'c1', label: 'Sophie Marchand' };
const R2: PanelEntry = { kind: 'reservation', id: 'r2', label: 'Réservation de samedi 21:00' };

describe('panel stack', () => {
  it('should open a first sheet alone, then stack the second one', () => {
    expect(openFrom([], R1)).toEqual([R1]);
    expect(openFrom([R1], C1)).toEqual([R1, C1]);
  });

  it('should come back to the first sheet instead of stacking it again', () => {
    expect(openFrom([R1, C1], { ...R1, label: '' })).toEqual([R1]);
    expect(backTo([R1, C1])).toEqual([R1]);
  });

  it('should never go three deep: the sheet one leaves becomes the origin', () => {
    expect(openFrom([R1, C1], R2)).toEqual([C1, R2]);
  });

  it('should ignore opening the sheet already shown', () => {
    expect(openFrom([R1, C1], C1)).toEqual([R1, C1]);
  });
});
