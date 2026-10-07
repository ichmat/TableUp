import { formatPhone } from './phone';

describe('formatPhone', () => {
  it('should group a French number by pairs', () => {
    expect(formatPhone('0612345678')).toBe('06 12 34 56 78');
  });

  it('should leave a foreign or short number as stored', () => {
    expect(formatPhone('+442079460958')).toBe('+442079460958');
    expect(formatPhone('3615')).toBe('3615');
  });
});
