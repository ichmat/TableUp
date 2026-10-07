import { ClientDetail, ClientHistoryItem } from '../../models';
import { clientToRequest, formatCovers, lastDayLabel, listName, splitHistory } from './client-display';

const DETAIL: ClientDetail = {
  id: 'c1', name: 'Sophie Marchand', phones: ['0612345678'], emails: ['s@mail.fr'], allergies: 'Arachide', internalNotes: 'Habituée',
  tags: ['Vip'], visitCount: 41, noShowCount: 2, averageCovers: 3.2, atRisk: false, marketingConsent: false,
  createdAt: '2026-01-01T00:00:00Z', mergeCandidates: [], history: [], version: 3,
};

describe('client display', () => {
  it('should put the last name first in the list', () => {
    expect(listName('Sophie Marchand')).toBe('Marchand, Sophie');
    expect(listName('  Cher ')).toBe('Cher');
  });

  it('should name the weekday within a week, the date beyond, and the year when it differs', () => {
    expect(lastDayLabel('2026-10-08', '2026-10-05')).toBe('jeudi');
    expect(lastDayLabel('2026-09-29', '2026-10-05')).toBe('mardi');
    expect(lastDayLabel('2026-08-28', '2026-10-05')).toBe('28 août');
    expect(lastDayLabel('2025-08-28', '2026-10-05')).toBe('28 août 2025');
    expect(lastDayLabel(null, '2026-10-05')).toBe('—');
  });

  it('should write the average covers with a French decimal', () => {
    expect(formatCovers(3.5)).toBe('3,5');
    expect(formatCovers(4)).toBe('4');
    expect(formatCovers(null)).toBe('—');
  });

  it('should split the history at now, upcoming first', () => {
    const now = new Date('2026-10-05T12:00:00Z');
    const at = (id: string, start: string): ClientHistoryItem =>
      ({ id, start, serviceDay: start.slice(0, 10), covers: 2, status: 'Confirmed', placeName: null });

    const split = splitHistory([at('a', '2026-10-08T18:00:00Z'), at('b', '2026-09-01T18:00:00Z')], now);

    expect(split.upcoming.map((h) => h.id)).toEqual(['a']);
    expect(split.past.map((h) => h.id)).toEqual(['b']);
  });

  it('should rebuild the request of a client', () => {
    expect(clientToRequest(DETAIL)).toEqual({
      name: 'Sophie Marchand', phones: ['0612345678'], emails: ['s@mail.fr'], allergies: 'Arachide', internalNotes: 'Habituée', tags: ['Vip'], version: 3,
    });
  });

});
