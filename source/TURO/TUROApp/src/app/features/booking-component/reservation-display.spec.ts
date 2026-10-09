import { ExceptionalClosure, ReservationDay, ReservationDetail, ReservationEvent, ReservationListClient, RestaurantService } from '../../models';
import {
  createdMessage, dayHeader, gestureMessage, currentServiceDay, guestName, isBookableDay, isServiceDay, journalLine, marks, modifiedMessage, ordinal, originLabel,
  pendingBanner, placedMessage, primaryAction, quickAction, sheetSubtitle,
} from './reservation-display';

const DAY = (change: Partial<ReservationDay> = {}): ReservationDay => ({ serviceDay: '2026-08-20', covers: 48, toPlace: 3, items: [], ...change });
const CLIENT = (change: Partial<ReservationListClient> = {}): ReservationListClient => ({
  id: 'c1', name: 'Moreau', phone: '0612345678', tags: [], hasAllergy: false, visitCount: 12, noShowCount: 0, atRisk: false, ...change,
});
const DETAIL = (change: Partial<ReservationDetail> = {}): ReservationDetail => ({
  id: 'r1', start: '2026-08-20T18:30:00Z', serviceDay: '2026-08-20', covers: 4, duration: 105, status: 'Confirmed', source: 'Web',
  note: null, preferredZoneId: null, preferredZoneName: null, createdAt: '2026-08-14T08:02:00Z', cancelledBy: null, version: 1,
  place: null, placeTooSmall: false, noShowFrom: '2026-08-20T18:45:00Z', events: [],
  client: { id: 'c1', name: 'Moreau', phone: '0612345678', allergies: null, tags: [], visitCount: 12, noShowCount: 1, atRisk: false, lastVisitDay: null },
  ...change,
});

describe('reservation display', () => {
  it('should name a walk-in', () => {
    expect(guestName(null)).toBe('Client de passage');
    expect(guestName({ name: 'Moreau' })).toBe('Moreau');
  });

  it('should head a day with its date, covers and reservations left to place', () => {
    expect(dayHeader(DAY(), '2026-08-20')).toBe("JEUDI 20 AOÛT — AUJOURD'HUI · 48 couverts · 3 à placer");
    expect(dayHeader(DAY({ serviceDay: '2026-08-19', covers: 1, toPlace: 0 }), '2026-08-20')).toBe('MERCREDI 19 AOÛT · hier · 1 couvert');
    expect(dayHeader(DAY({ serviceDay: '2027-01-08', toPlace: 0 }), '2026-08-20')).toBe('VENDREDI 8 JANVIER 2027 · 48 couverts');
  });

  it('should tell how long the oldest request has waited, and nothing when there is none', () => {
    const now = new Date('2026-08-20T14:00:00Z');
    expect(pendingBanner({ count: 0, oldestCreatedAt: null }, now)).toBeNull();
    expect(pendingBanner({ count: 3, oldestCreatedAt: '2026-08-20T10:00:00Z' }, now))
      .toBe('3 demandes attendent une réponse · la plus ancienne depuis 4 h');
    expect(pendingBanner({ count: 1, oldestCreatedAt: '2026-08-20T13:35:00Z' }, now)).toBe('1 demande attend une réponse · depuis 25 min');
    expect(pendingBanner({ count: 2, oldestCreatedAt: '2026-08-17T13:00:00Z' }, now))
      .toBe('2 demandes attendent une réponse · la plus ancienne depuis 3 j');
  });

  it('should offer one quick action per status, and none once closed', () => {
    expect(quickAction({ status: 'Pending', placeName: null })).toBe('answer');
    expect(quickAction({ status: 'Confirmed', placeName: null })).toBe('place');
    expect(quickAction({ status: 'Confirmed', placeName: '12' })).toBe('arrive');
    expect(quickAction({ status: 'Seated', placeName: '12' })).toBe('release');
    for (const status of ['Finished', 'NoShow', 'Cancelled'] as const) {
      expect(quickAction({ status, placeName: '12' })).toBeNull();
    }
  });

  it('should deduce the one main action of a sheet from its state', () => {
    expect(primaryAction(DETAIL({ status: 'Pending' }))).toBe('acceptAndPlace');
    expect(primaryAction(DETAIL())).toBe('place');
    expect(primaryAction(DETAIL({ place: { name: 'T3', capacity: 4 } }))).toBe('arrive');
    expect(primaryAction(DETAIL({ status: 'Seated', place: { name: 'T3', capacity: 4 } }))).toBe('release');
    expect(primaryAction(DETAIL({ status: 'NoShow' }))).toBeNull();
  });

  it('should carry allergy, VIP and regular tags, first visit and no-show history, and nothing for a walk-in', () => {
    expect(marks(null)).toEqual([]);
    expect(marks(CLIENT())).toEqual([]);
    expect(marks(CLIENT({ hasAllergy: true, tags: ['Vip', 'Regular', 'Press'], visitCount: 0, noShowCount: 2, atRisk: true }))).toEqual([
      { kind: 'allergy' }, { kind: 'tag', label: 'VIP' }, { kind: 'tag', label: 'Habitué' }, { kind: 'first' }, { kind: 'risk', label: 'NO-SHOW ×2' },
    ]);
  });

  it('should name what a gesture did and what it costs', () => {
    expect(ordinal(1)).toBe('1ᵉʳ');
    expect(ordinal(2)).toBe('2ᵉ');
    expect(gestureMessage('accept', DETAIL())).toBe('Moreau acceptée');
    expect(gestureMessage('refuse', DETAIL())).toBe('Moreau refusée');
    expect(gestureMessage('arrive', DETAIL())).toBe('Arrivée de Moreau');
    expect(gestureMessage('release', DETAIL({ place: { name: '12', capacity: 4 } }))).toBe('Table 12 libérée');
    expect(gestureMessage('no-show', DETAIL())).toBe('No-show noté · 1ᵉʳ pour ce client');
    expect(gestureMessage('no-show', DETAIL({ client: null }))).toBe('No-show noté');
    expect(gestureMessage('reopen', DETAIL())).toBe('Réservation rouverte');
    expect(gestureMessage('cancel', DETAIL())).toBe('Réservation annulée');
  });

  it('should name a creation by guest and slot, and a modification by what changed', () => {
    expect(createdMessage(DETAIL(), 'Europe/Paris')).toBe('Réservation créée · Moreau, jeu. 20 août 20:30');
    const modification: ReservationEvent = { id: 'e2', timestamp: '2026-08-15T09:00:00Z', type: 'Modification', authorLogin: 'camille', details: '20:00 → 20:30' };
    expect(modifiedMessage(DETAIL({ events: [modification] }))).toBe('Modifiée · 20:00 → 20:30');
  });

  it('should say a placement, an accept-and-place and a move', () => {
    const line = (type: ReservationEvent['type'], details: string): ReservationEvent => ({ id: 'e9', timestamp: '2026-08-20T18:31:00Z', type, authorLogin: 'camille', details });
    const placed = DETAIL({ place: { name: '5', capacity: 4 }, events: [line('Placement', '5')] });

    expect(placedMessage(placed, false)).toBe('Moreau placée · 5');
    expect(placedMessage(placed, true)).toBe('Moreau acceptée et placée · 5');
    expect(placedMessage(DETAIL({ place: { name: '7', capacity: 4 }, events: [line('Move', '5 → 7')] }), false)).toBe('Moreau déplacée · 5 → 7');
  });

  it('should write a journal line with its time, its event and its author, or the system', () => {
    const accepted: ReservationEvent = { id: 'e1', timestamp: '2026-08-14T08:14:00Z', type: 'Acceptance', authorLogin: 'camille', details: null };
    const created: ReservationEvent = { id: 'e0', timestamp: '2026-08-14T08:02:00Z', type: 'Creation', authorLogin: null, details: 'web' };

    expect(journalLine(accepted, 'Europe/Paris')).toBe('14/08 10:14 · Acceptée · camille');
    expect(journalLine(created, 'Europe/Paris')).toBe('14/08 10:02 · Création · web · système');
  });

  it('should present a sheet and name it as the place one comes back to', () => {
    expect(sheetSubtitle(DETAIL(), 'Europe/Paris')).toBe('4 personnes · jeudi 20 août · 20:30');
    expect(sheetSubtitle(DETAIL({ covers: 1 }), 'Europe/Paris')).toBe('1 personne · jeudi 20 août · 20:30');
    expect(originLabel(DETAIL(), 'Europe/Paris')).toBe('Réservation de jeudi 20:30');
  });

  it('should grey past days, closed days and days without service', () => {
    const services = [{ day: 'Thursday' }] as RestaurantService[];
    const closures = [
      { from: '2026-08-27', to: '2026-08-27', type: 'Closed', replacementHours: null },
      { from: '2026-08-21', to: '2026-08-21', type: 'ModifiedHours', replacementHours: [{ opening: '12:00:00', closing: '15:00:00' }] },
    ] as ExceptionalClosure[];

    expect(isBookableDay('2026-08-20', services, closures, '2026-08-20')).toBeTrue();
    expect(isBookableDay('2026-08-13', services, closures, '2026-08-20')).toBeFalse();
    expect(isBookableDay('2026-08-27', services, closures, '2026-08-20')).toBeFalse();
    // Un vendredi sans service, ouvert exceptionnellement
    expect(isBookableDay('2026-08-21', services, closures, '2026-08-20')).toBeTrue();
    expect(isBookableDay('2026-08-22', services, closures, '2026-08-20')).toBeFalse();
  });
});

describe('isServiceDay', () => {
  const services = [{ day: 'Saturday' } as RestaurantService];

  it('should keep a past service day, unlike the booking form', () => {
    expect(isServiceDay('2020-01-04', services, [])).toBeTrue();
    expect(isBookableDay('2020-01-04', services, [], '2026-10-08')).toBeFalse();
  });

  it('should refuse a day without service or closed', () => {
    expect(isServiceDay('2026-10-12', services, [])).toBeFalse();
    expect(isServiceDay('2026-10-10', services, [{ from: '2026-10-10', to: '2026-10-10', type: 'Closed' } as ExceptionalClosure])).toBeFalse();
  });
});

describe('currentServiceDay', () => {
  // Samedi 10 octobre 2026, Paris (UTC+2) : un dîner 19:00 – 01:00
  const lateSaturday = [{ day: 'Saturday', opening: '19:00:00', closing: '01:00:00' } as RestaurantService];
  const at = (iso: string) => new Date(iso);

  it('should stay on the evening before while its service runs past midnight', () => {
    expect(currentServiceDay('Europe/Paris', lateSaturday, [], at('2026-10-10T22:20:00Z'))).toBe('2026-10-10');
    expect(currentServiceDay('Europe/Paris', lateSaturday, [], at('2026-10-10T23:05:00Z'))).toBe('2026-10-11');
  });

  it('should follow the calendar when the evening before closes before midnight, or was closed', () => {
    const early = [{ day: 'Saturday', opening: '19:00:00', closing: '23:00:00' } as RestaurantService];
    expect(currentServiceDay('Europe/Paris', early, [], at('2026-10-10T22:20:00Z'))).toBe('2026-10-11');
    const closed = [{ from: '2026-10-10', to: '2026-10-10', type: 'Closed' } as ExceptionalClosure];
    expect(currentServiceDay('Europe/Paris', lateSaturday, closed, at('2026-10-10T22:20:00Z'))).toBe('2026-10-11');
  });

  it('should read the replacement hours of a modified evening', () => {
    const modified = [{ from: '2026-10-10', to: '2026-10-10', type: 'ModifiedHours', replacementHours: [{ opening: '20:00:00', closing: '02:00:00' }] } as ExceptionalClosure];
    expect(currentServiceDay('Europe/Paris', [], modified, at('2026-10-10T23:30:00Z'))).toBe('2026-10-10');
  });
});
