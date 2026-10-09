import { Placement, PlacementEntity, PlacementReason } from '../../models';
import { entityId, nextText, reasonsMessage, reasonText, targetOf } from './placement-reasons';

const TZ = 'Europe/Paris';
const context = { guest: 'Moreau', covers: 4, name: '6', capacity: 6, zoneName: 'Terrasse', end: '2026-10-10T19:50:00Z' };
const reason = (r: Partial<PlacementReason> & Pick<PlacementReason, 'kind'>): PlacementReason => r;

describe('placement-reasons', () => {
  it('should say extra seats, and that no table of that size is left', () => {
    expect(reasonText(reason({ kind: 'ExtraSeats', count: 2, tolerance: 2, noneLeftOfCapacity: true }), context, TZ)).toEqual({
      title: '2 places de trop',
      detail: 'table de 6 pour 4 personnes. Il ne te restera plus de table de 6 ce soir.',
    });
    expect(reasonText(reason({ kind: 'ExtraSeats', count: 2, tolerance: 2, noneLeftOfCapacity: false }), context, TZ).detail)
      .toBe('table de 6 pour 4 personnes.');
  });

  it('should say beyond tolerance', () => {
    expect(reasonText(reason({ kind: 'BeyondTolerance', count: 6, tolerance: 2 }), context, TZ))
      .toEqual({ title: '6 places de trop', detail: 'au-delà de la tolérance de 2.' });
  });

  it('should name who left a dirty table, or since when it is dirty', () => {
    expect(reasonText(reason({ kind: 'NeedsCleaning', since: '2026-10-10T18:12:00Z', guest: 'Legrand', leftAt: '2026-10-10T18:12:00Z' }), context, TZ)).toEqual({
      title: 'Table non nettoyée',
      detail: "Legrand est parti à 20:12, elle n'a pas encore été redressée. En plaçant Moreau, elle sera considérée comme nettoyée.",
    });
    expect(reasonText(reason({ kind: 'NeedsCleaning', since: '2026-10-10T18:12:00Z' }), context, TZ).detail)
      .toBe('marquée à nettoyer depuis 20:12. En plaçant Moreau, elle sera considérée comme nettoyée.');
  });

  it('should name the zone asked for, with the note', () => {
    expect(reasonText(reason({ kind: 'OtherZone', requestedZone: 'Salle', note: 'intérieur svp' }), context, TZ))
      .toEqual({ title: 'Terrasse', detail: 'la réservation demandait Salle. (note : « intérieur svp »)' });
  });

  it('should say the next booking, the margin and the usual rotation', () => {
    expect(reasonText(reason({ kind: 'NextSoon', start: '2026-10-10T20:00:00Z', margin: 10, defaultRotation: 105 }), context, TZ)).toEqual({
      title: 'Réservée à 22:00',
      detail: 'elle doit être libre à 21:50, 10 min de marge. La rotation habituelle est de 1 h 45.',
    });
    expect(reasonText(reason({ kind: 'NextSoon', start: '2026-10-10T19:50:00Z', margin: 0, defaultRotation: 105 }), context, TZ).detail)
      .toContain('aucune marge');
  });

  it('should say a glued table must be separated', () => {
    expect(reasonText(reason({ kind: 'Glued', combination: '12-13', with: ['13'] }), { ...context, name: '12' }, TZ))
      .toEqual({ title: 'Table collée', detail: 'la 12 est collée à la 13 (12-13) : il faudra les séparer.' });
  });

  it('should list every reason, one per line', () => {
    const entity = { name: '6', capacity: 6, reasons: [reason({ kind: 'BeyondTolerance', count: 6, tolerance: 2 }), reason({ kind: 'Glued', combination: '6-7', with: ['7'] })] } as PlacementEntity;
    expect(reasonsMessage(entity, context, TZ).split('\n').length).toBe(2);
  });

  it('should say what comes next on a table', () => {
    expect(nextText({ start: '2026-10-10T20:30:00Z', margin: 30, guest: 'Legrand' }, TZ)).toBe('Ensuite 22:30 · marge 30 min');
    expect(nextText({ start: '2026-10-10T20:30:00Z', margin: 90, guest: null }, TZ)).toBe('Ensuite 22:30 · marge 1 h 30');
  });

  it('should target a table or a combination', () => {
    expect(targetOf({ tableId: 't5', combinationId: null } as PlacementEntity)).toEqual({ tableId: 't5' });
    expect(targetOf({ tableId: null, combinationId: 'c1' } as PlacementEntity)).toEqual({ combinationId: 'c1' });
    expect(entityId({ tableId: null, combinationId: 'c1' } as PlacementEntity)).toBe('c1');
  });
});
