import { defaultSlot, slotIndexAt, tableMarks, tableStatusAt, zoneCount } from './table-status';
import { occupation, serviceSnapshot, serviceTable, serviceZone, slotsOf, utc } from './testing/service-fixtures';

const at = (time: string) => new Date(utc(time));

describe('tableStatusAt', () => {
  const reserved = serviceTable({ occupations: [occupation()] });

  it('should read a free table outside any occupation, and a reserved one inside it', () => {
    expect(tableStatusAt(reserved, at('19:59'), at('19:00'), false).status).toBe('Free');
    expect(tableStatusAt(reserved, at('20:00'), at('19:00'), false)).toEqual({ status: 'Reserved', late: false, occupation: occupation() });
    // [début, fin) : à 22:00 la table est rendue
    expect(tableStatusAt(reserved, at('22:00'), at('19:00'), false).status).toBe('Free');
  });

  it('should ring a confirmed table once the late grace has passed, whatever hour is looked at', () => {
    expect(tableStatusAt(reserved, at('20:30'), at('20:14'), false).late).toBeFalse();
    expect(tableStatusAt(reserved, at('20:30'), at('20:15'), false).late).toBeTrue();
  });

  it('should read seated and finished meals as occupied, never late', () => {
    const seated = serviceTable({ occupations: [occupation({ status: 'Seated', lateFrom: null })] });
    const finished = serviceTable({ occupations: [occupation({ status: 'Finished', lateFrom: null })] });

    expect(tableStatusAt(seated, at('21:00'), at('21:00'), false)).toEqual(jasmine.objectContaining({ status: 'Occupied', late: false }));
    expect(tableStatusAt(finished, at('21:00'), at('23:30'), false).status).toBe('Occupied');
  });

  it('should show a dirty table to clean on every slot, unless something occupies it, and only when cleaning is tracked', () => {
    const dirty = serviceTable({ needsCleaningSince: utc('19:40'), occupations: [occupation()] });

    expect(tableStatusAt(dirty, at('19:00'), at('20:07'), true).status).toBe('ToClean');
    expect(tableStatusAt(dirty, at('22:30'), at('20:07'), true).status).toBe('ToClean');
    expect(tableStatusAt(dirty, at('20:30'), at('20:07'), true).status).toBe('Reserved');
    expect(tableStatusAt(dirty, at('19:00'), at('20:07'), false).status).toBe('Free');
  });
});

describe('slots', () => {
  const slots = slotsOf(['19:00', '19:30', '20:00']);

  it('should find the slot that contains an instant', () => {
    expect(slotIndexAt(slots, at('19:00'))).toBe(0);
    expect(slotIndexAt(slots, at('19:45'))).toBe(1);
    expect(slotIndexAt(slots, at('23:00'))).toBe(2);
    expect(slotIndexAt(slots, at('18:00'))).toBe(0);
  });

  it('should open a service in progress on the current slot, any other on its first', () => {
    expect(defaultSlot(serviceSnapshot({ now: utc('20:07') }))).toBe(2);
    expect(defaultSlot(serviceSnapshot({ now: utc('20:07'), service: { ...serviceSnapshot().service!, state: 'Upcoming' } }))).toBe(0);
  });
});

describe('zones and marks', () => {
  const zone = serviceZone({
    tables: [
      serviceTable({ id: 't1', name: 'T1', occupations: [occupation({ hasAllergy: true })] }),
      serviceTable({ id: 't2', name: 'T2', occupations: [occupation({ reservationId: 'r2', status: 'Seated', lateFrom: null, guestName: null, start: utc('19:30') })] }),
      serviceTable({ id: 't3', name: 'T3', needsCleaningSince: utc('19:40') }),
    ],
  });

  it('should count the tables held at that hour, a dirty one not being held', () => {
    expect(zoneCount(zone, at('20:30'), at('20:07'), true)).toEqual({ taken: 2, total: 3 });
    expect(zoneCount(zone, at('19:00'), at('20:07'), true)).toEqual({ taken: 0, total: 3 });
  });

  it('should hand the canvas each table status, its guest and time, and the allergy', () => {
    const marks = tableMarks(zone, at('20:30'), at('20:30'), true, 'UTC');

    expect(marks['t1']).toEqual({ status: 'Reserved', late: true, label: 'Moreau · 20:00', allergy: true });
    expect(marks['t2']).toEqual({ status: 'Occupied', late: false, label: 'Client de passage · 19:30', allergy: false });
    expect(marks['t3']).toEqual({ status: 'ToClean', late: false, label: null, allergy: false });
  });
});
