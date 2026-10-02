import { formatMetres, fromCentimetres, toCentimetres } from './units';

describe('units', () => {
  it('should format metres the French way', () => {
    expect(formatMetres(8)).toBe('8,00 m');
    expect(formatMetres(5.5)).toBe('5,50 m');
  });

  it('should convert centimetres without floating noise', () => {
    expect(toCentimetres(0.7)).toBe(70);
    expect(fromCentimetres(70)).toBe(0.7);
  });
});
