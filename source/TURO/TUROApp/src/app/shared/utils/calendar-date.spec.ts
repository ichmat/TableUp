import { addDays, dayCount, dayOfWeek, formatLongDate, monthGrid, todayIn } from './calendar-date';

describe('calendar-date', () => {
  it('should add days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('should count days with both ends included', () => {
    expect(dayCount('2026-08-01', '2026-08-31')).toBe(31);
    expect(dayCount('2026-12-24', '2026-12-24')).toBe(1);
  });

  it('should give the day of week', () => {
    expect(dayOfWeek('2026-10-01')).toBe('Thursday');
    expect(dayOfWeek('2026-10-04')).toBe('Sunday');
  });

  it('should lay out full weeks from Monday to Sunday', () => {
    const grid = monthGrid(2026, 10);
    expect(grid[0]).toBe('2026-09-28');
    expect(grid[grid.length - 1]).toBe('2026-11-01');
    expect(grid.length % 7).toBe(0);
  });

  it('should take today in the restaurant time zone', () => {
    // 23:30 UTC le 31 décembre = déjà le 1er janvier à Paris
    expect(todayIn('Europe/Paris', new Date(Date.UTC(2026, 11, 31, 23, 30)))).toBe('2027-01-01');
  });

  it('should format a long French date', () => {
    expect(formatLongDate('2026-12-24')).toBe('jeudi 24 décembre');
  });
});
