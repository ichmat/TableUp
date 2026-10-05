import { bookingWindow } from './booking-window';

describe('bookingWindow', () => {
  it('should open one hour from now and close sixty days later, in the restaurant time zone', () => {
    // 12:10 UTC = 14:10 à Paris
    expect(bookingWindow(new Date(Date.UTC(2026, 9, 6, 12, 10)), 'Europe/Paris', 60, 60)).toEqual({
      today: '2026-10-06', earliestDay: '2026-10-06', earliestTime: '15:10', lastDay: '2026-12-05',
    });
  });

  it('should move the earliest booking to the next day past midnight', () => {
    // 21:30 UTC = 23:30 à Paris
    expect(bookingWindow(new Date(Date.UTC(2026, 9, 6, 21, 30)), 'Europe/Paris', 60, 1)).toEqual({
      today: '2026-10-06', earliestDay: '2026-10-07', earliestTime: '00:30', lastDay: '2026-10-07',
    });
  });

  it('should read the time and the date in the restaurant time zone, wherever the browser is', () => {
    // 12:10 UTC = 08:10 à New York, et déjà 01:10 le 7 à Auckland
    const now = new Date(Date.UTC(2026, 9, 6, 12, 10));
    expect(bookingWindow(now, 'America/New_York', 60, 1)).toEqual({
      today: '2026-10-06', earliestDay: '2026-10-06', earliestTime: '09:10', lastDay: '2026-10-07',
    });
    expect(bookingWindow(now, 'Pacific/Auckland', 60, 1)).toEqual({
      today: '2026-10-07', earliestDay: '2026-10-07', earliestTime: '02:10', lastDay: '2026-10-08',
    });
  });

  it('should take the date of the restaurant, not of the browser', () => {
    // 23:30 UTC le 6 = déjà le 7 à Paris
    expect(bookingWindow(new Date(Date.UTC(2026, 9, 6, 23, 30)), 'Europe/Paris', 0, 30).today).toBe('2026-10-07');
  });
});
