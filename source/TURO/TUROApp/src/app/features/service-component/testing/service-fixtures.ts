import {
  ServiceReservation, ServiceSlot, ServiceSnapshot, ServiceTable, ServiceZone, TableOccupation,
} from '../../../models';

/** Les tests de l'écran Service se passent le samedi 10 octobre 2026, fuseau UTC : l'heure lue est l'heure écrite */
export const SERVICE_DAY = '2026-10-10';
export const utc = (time: string) => `${SERVICE_DAY}T${time}:00Z`;

export function occupation(change: Partial<TableOccupation> = {}): TableOccupation {
  return {
    reservationId: 'r1', start: utc('20:00'), end: utc('22:00'), status: 'Confirmed', lateFrom: utc('20:15'),
    placeName: 'T1', guestName: 'Moreau', covers: 4, hasAllergy: false, ...change,
  };
}

export function serviceTable(change: Partial<ServiceTable> = {}): ServiceTable {
  return {
    id: 't1', zoneId: 'z1', name: 'T1', capacity: 4, shape: 'Square', x: 1, y: 1, width: 0.8, height: 0.8, rotation: 0,
    needsCleaningSince: null, occupations: [], ...change,
  };
}

export function serviceZone(change: Partial<ServiceZone> = {}): ServiceZone {
  return { id: 'z1', name: 'Salle', width: 8, height: 6, tables: [serviceTable()], decors: [], combinations: [], ...change };
}

export function serviceReservation(change: Partial<ServiceReservation> = {}): ServiceReservation {
  return { id: 'r9', start: utc('20:30'), covers: 4, source: 'Phone', client: null, ...change };
}

export function slotsOf(times: string[]): ServiceSlot[] {
  return times.map((time) => ({ time: `${time}:00`, at: utc(time), covers: 0, takenTables: 0, hasUnplaced: false }));
}

export function serviceSnapshot(change: Partial<ServiceSnapshot> = {}): ServiceSnapshot {
  return {
    day: SERVICE_DAY, now: utc('20:07'), trackTableCleaning: false, lateGrace: 15, isDefault: true,
    service: { opening: '19:00:00', closing: '23:00:00', slotStep: 30, state: 'InProgress', expectedCovers: 32, capacity: 48 },
    windows: [{ opening: '19:00:00', closing: '23:00:00', state: 'InProgress', expectedCovers: 32 }],
    slots: slotsOf(['19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30']),
    zones: [serviceZone()], toPlace: [], pending: [], allergies: [],
    ...change,
  };
}
