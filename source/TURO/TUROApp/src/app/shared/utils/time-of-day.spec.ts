import { formatDuration, formatMinutes, serviceLength, slotStarts, toMinutes } from './time-of-day';

describe('time-of-day', () => {
  it('should parse API times with or without seconds', () => {
    expect(toMinutes('19:30:00')).toBe(1170);
    expect(toMinutes('07:05')).toBe(425);
  });

  it('should format minutes and wrap after midnight', () => {
    expect(formatMinutes(1170)).toBe('19:30');
    expect(formatMinutes(25 * 60 + 15)).toBe('01:15');
  });

  it('should format a duration in hours and minutes', () => {
    expect(formatDuration(105)).toBe('1 h 45');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(65)).toBe('1 h 05');
  });

  it('should measure a service crossing midnight', () => {
    expect(serviceLength('19:00:00', '22:30:00')).toBe(210);
    expect(serviceLength('22:00:00', '02:00:00')).toBe(240);
  });

  it('should open one slot per step, closing time excluded', () => {
    expect(slotStarts('19:00:00', '20:00:00', 30).map(formatMinutes)).toEqual(['19:00', '19:30']);
    expect(slotStarts('19:00:00', '20:00:00', 15).length).toBe(4);
  });

  it('should keep a partial last slot', () => {
    expect(slotStarts('11:30:00', '14:00:00', 30).length).toBe(5);
    expect(slotStarts('11:45:00', '12:30:00', 30).map(formatMinutes)).toEqual(['11:45', '12:15']);
  });
});
