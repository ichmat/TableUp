import { ReservationDetail } from '../../models';
import { initialDraft, slotKey, toRequest } from './reservation-draft';

const BOOKED = {
  id: 'r1', start: '2026-08-20T18:00:00Z', serviceDay: '2026-08-20', covers: 4, duration: 105, status: 'Confirmed', source: 'Web',
  note: 'anniversaire', preferredZoneId: 'z1', version: 7,
  client: { id: 'c1', name: 'Moreau', phone: '0612345678' },
} as ReservationDetail;

describe('reservation draft', () => {
  it('should start a new reservation today, for two, without a time, by phone', () => {
    expect(initialDraft({ kind: 'create' }, '2026-08-20', 'Europe/Paris')).toEqual({
      covers: 2, serviceDay: '2026-08-20', time: null, phone: '', name: '', email: '', note: '', duration: null, preferredZoneId: null, source: 'Phone',
    });
  });

  it('should take a given draft over the defaults: a client sheet, or an undone creation', () => {
    expect(initialDraft({ kind: 'create', draft: { phone: '06 12 34 56 78', name: 'Sophie' } }, '2026-08-20', 'Europe/Paris').phone).toBe('06 12 34 56 78');
  });

  it('should open a modification on what is booked, in local time', () => {
    const draft = initialDraft({ kind: 'edit', reservation: BOOKED }, '2026-08-01', 'Europe/Paris');

    expect(draft.time).toBe('20:00:00');
    expect(draft.covers).toBe(4);
    expect(draft.duration).toBe(105);
    expect(draft.note).toBe('anniversaire');
    expect(draft.source).toBe('Web');
  });

  it('should write a slot the way the API gives it', () => {
    expect(slotKey('20:00')).toBe('20:00:00');
    expect(slotKey('20:00:00')).toBe('20:00:00');
  });

  it('should send empty texts as nothing, and the name of a recognized client', () => {
    const draft = { ...initialDraft({ kind: 'create' }, '2026-08-20', 'Europe/Paris'), time: '20:00:00', phone: ' 06 12 34 56 78 ', note: '  ' };

    expect(toRequest(draft, null, 'Sophie Marchand')).toEqual({
      serviceDay: '2026-08-20', time: '20:00:00', covers: 2, duration: null, note: null, preferredZoneId: null, source: 'Phone',
      phone: '06 12 34 56 78', name: 'Sophie Marchand', email: null, version: null,
    });
    expect(toRequest({ ...draft, name: ' Julien ' }, 7, null).name).toBe('Julien');
  });
});
