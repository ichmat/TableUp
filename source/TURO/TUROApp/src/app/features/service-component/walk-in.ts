import { ServiceTable, TableOccupation } from '../../models';
import { formatDuration, timeIn } from '../../shared/utils/time-of-day';

/** WALK : la réservation qui arrivera sur cette table pendant le repas d'un walk-in assis maintenant */
export function bookedLater(table: ServiceTable, now: Date, durationMinutes: number): TableOccupation | null {
  const from = now.getTime();
  const until = from + durationMinutes * 60_000;
  return table.occupations
    .filter((o) => Date.parse(o.start) > from && Date.parse(o.start) < until)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0] ?? null;
}

/** « Réservée à 21:00 · Legrand · 4 p — 1 h devant vous » */
export function bookedLaterText(occupation: TableOccupation, now: Date, timeZone: string): string {
  const minutes = Math.round((Date.parse(occupation.start) - now.getTime()) / 60_000);
  return `Réservée à ${timeIn(timeZone, new Date(occupation.start))} · ${occupation.guestName ?? 'client de passage'} · ${occupation.covers} p — ${formatDuration(minutes)} devant vous`;
}
