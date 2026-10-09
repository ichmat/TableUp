import { ServiceSlot, ServiceSnapshot, ServiceTable, ServiceZone, TableMark, TableOccupation, TableStatus } from '../../models';
import { timeIn } from '../../shared/utils/time-of-day';
import { guestName } from '../booking-component/reservation-display';

export interface TableStateAt {
  status: TableStatus,
  late: boolean,
  occupation: TableOccupation | null,
}

/**
 * §3.2 : l'occupation qui couvre l'heure décide ; sinon une table sale reste « à nettoyer » sur tous les créneaux —
 * si le restaurant suit le nettoyage. L'anneau « en retard » dépend de maintenant, pas de l'heure regardée
 */
export function tableStatusAt(table: ServiceTable, at: Date, now: Date, trackCleaning: boolean): TableStateAt {
  const instant = at.getTime();
  const occupation = table.occupations.find((o) => Date.parse(o.start) <= instant && instant < Date.parse(o.end)) ?? null;
  if (occupation !== null) {
    const reserved = occupation.status === 'Confirmed';
    return {
      status: reserved ? 'Reserved' : 'Occupied',
      late: reserved && occupation.lateFrom !== null && now.getTime() >= Date.parse(occupation.lateFrom),
      occupation,
    };
  }
  if (trackCleaning && table.needsCleaningSince !== null) {
    return { status: 'ToClean', late: false, occupation: null };
  }
  return { status: 'Free', late: false, occupation: null };
}

/** Le dernier créneau qui commence avant l'instant ; le premier si l'instant précède le service */
export function slotIndexAt(slots: ServiceSlot[], instant: Date): number {
  let index = 0;
  slots.forEach((slot, i) => {
    if (Date.parse(slot.at) <= instant.getTime()) {
      index = i;
    }
  });
  return index;
}

/**
 * Un service en cours s'ouvre sur maintenant — et le suit, l'écran restant ouvert tout le service —, tout autre sur son
 * premier créneau. `now` : l'horloge du poste ; celle de l'API la rattrape si le poste retarde
 */
export function defaultSlot(snapshot: ServiceSnapshot, now?: Date): number {
  const present = Math.max(now?.getTime() ?? 0, Date.parse(snapshot.now));
  return snapshot.service?.state === 'InProgress' ? slotIndexAt(snapshot.slots, new Date(present)) : 0;
}

/** « Salle 8/12 » : tables réservées ou occupées à cette heure, sur les tables actives */
export function zoneCount(zone: ServiceZone, at: Date, now: Date, trackCleaning: boolean): { taken: number, total: number } {
  const taken = zone.tables
    .map((table) => tableStatusAt(table, at, now, trackCleaning).status)
    .filter((status) => status === 'Reserved' || status === 'Occupied').length;
  return { taken, total: zone.tables.length };
}

/** Ce que le canevas dessine de chaque table : statut, retard, « Moreau · 20:00 », allergie (§5.6) */
export function tableMarks(zone: ServiceZone, at: Date, now: Date, trackCleaning: boolean, timeZone: string): Record<string, TableMark> {
  const marks: Record<string, TableMark> = {};
  for (const table of zone.tables) {
    const state = tableStatusAt(table, at, now, trackCleaning);
    const occupation = state.occupation;
    marks[table.id] = {
      status: state.status,
      late: state.late,
      label: occupation === null
        ? null
        : `${guestName(occupation.guestName === null ? null : { name: occupation.guestName })} · ${timeIn(timeZone, new Date(occupation.start))}`,
      allergy: occupation?.hasAllergy ?? false,
    };
  }
  return marks;
}
