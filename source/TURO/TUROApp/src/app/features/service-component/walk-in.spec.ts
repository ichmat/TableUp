import { ServiceTable, TableOccupation } from '../../models';
import { bookedLater, bookedLaterText } from './walk-in';

const occupation = (start: string, guest: string | null = 'Legrand'): TableOccupation => ({
  reservationId: 'r9', start, end: '2026-10-10T21:00:00Z', status: 'Confirmed', lateFrom: null, placeName: '5', guestName: guest, covers: 4, hasAllergy: false,
});
const table = (...occupations: TableOccupation[]) => ({ id: 't5', occupations } as unknown as ServiceTable);
const now = new Date('2026-10-10T18:00:00Z');

describe('walk-in', () => {
  it('should find the booking that starts during the meal', () => {
    expect(bookedLater(table(occupation('2026-10-10T19:00:00Z')), now, 90)).not.toBeNull();
    expect(bookedLater(table(occupation('2026-10-10T19:30:00Z')), now, 90)).toBeNull();
    expect(bookedLater(table(), now, 90)).toBeNull();
  });

  it('should say when, who, and how long is left', () => {
    expect(bookedLaterText(occupation('2026-10-10T19:00:00Z'), now, 'Europe/Paris')).toBe('Réservée à 21:00 · Legrand · 4 p — 1 h devant vous');
    expect(bookedLaterText(occupation('2026-10-10T18:40:00Z', null), now, 'Europe/Paris')).toBe('Réservée à 20:40 · client de passage · 4 p — 40 min devant vous');
  });
});
