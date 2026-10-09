import { PlacementEntity, PlacementNext, PlacementReason, PlaceTarget } from '../../models';
import { formatDuration, timeIn } from '../../shared/utils/time-of-day';

/** Ce que les raisons citent : la réservation placée et l'entité visée */
export interface ReasonContext {
  /** « Moreau », ou « ce client » pour un passage */
  guest: string,
  covers: number,
  name: string,
  capacity: number,
  /** La salle de l'entité */
  zoneName: string,
  /** La fin de l'intervalle testé (ISO 8601) : « elle doit être libre à 21:50 » */
  end: string,
}

const hhmm = (iso: string | null | undefined, timeZone: string) => (iso ? timeIn(timeZone, new Date(iso)) : '');
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
const margin = (minutes: number) => (minutes < 60 ? `${minutes} min` : formatDuration(minutes));

/** Le catalogue du §3.5 : un titre court en gras, puis ce qu'on ne voit pas sur le plan */
export function reasonText(reason: PlacementReason, context: ReasonContext, timeZone: string): { title: string, detail: string } {
  switch (reason.kind) {
    case 'ExtraSeats':
      return {
        title: `${plural(reason.count ?? 0, 'place')} de trop`,
        detail: `table de ${context.capacity} pour ${plural(context.covers, 'personne')}.`
          + (reason.noneLeftOfCapacity ? ` Il ne te restera plus de table de ${context.capacity} ce soir.` : ''),
      };
    case 'BeyondTolerance':
      return { title: `${plural(reason.count ?? 0, 'place')} de trop`, detail: `au-delà de la tolérance de ${reason.tolerance ?? 0}.` };
    case 'NeedsCleaning':
      return {
        title: 'Table non nettoyée',
        detail: (reason.guest && reason.leftAt
          ? `${reason.guest} est parti à ${hhmm(reason.leftAt, timeZone)}, elle n'a pas encore été redressée.`
          : `marquée à nettoyer depuis ${hhmm(reason.since, timeZone)}.`)
          + ` En plaçant ${context.guest}, elle sera considérée comme nettoyée.`,
      };
    case 'OtherZone':
      return {
        title: context.zoneName,
        detail: `la réservation demandait ${reason.requestedZone ?? 'une autre salle'}.` + (reason.note ? ` (note : « ${reason.note} »)` : ''),
      };
    case 'NextSoon': {
      const left = reason.margin === 0 ? 'aucune marge' : `${margin(reason.margin ?? 0)} de marge`;
      return {
        title: `Réservée à ${hhmm(reason.start, timeZone)}`,
        detail: `elle doit être libre à ${hhmm(context.end, timeZone)}, ${left}.`
          + (reason.defaultRotation ? ` La rotation habituelle est de ${formatDuration(reason.defaultRotation)}.` : ''),
      };
    }
    case 'Glued':
      return {
        title: 'Table collée',
        detail: `la ${context.name} est collée à la ${(reason.with ?? []).join(' et la ')} (${reason.combination}) : il faudra les séparer.`,
      };
  }
}

/** PLACE-07 : toutes les raisons, une par ligne (la modale garde les retours à la ligne) */
export function reasonsMessage(entity: Pick<PlacementEntity, 'reasons'>, context: ReasonContext, timeZone: string): string {
  return entity.reasons.map((reason) => {
    const text = reasonText(reason, context, timeZone);
    return `${text.title} — ${text.detail}`;
  }).join('\n');
}

/** La ligne à la craie sous une table compatible */
export function nextText(next: PlacementNext, timeZone: string): string {
  return `Ensuite ${hhmm(next.start, timeZone)} · marge ${margin(next.margin)}`;
}

export function targetOf(entity: Pick<PlacementEntity, 'tableId' | 'combinationId'>): PlaceTarget {
  return entity.tableId !== null ? { tableId: entity.tableId } : { combinationId: entity.combinationId! };
}

/** La clé de l'entité sur le canevas : l'id de la table ou de la combinaison */
export function entityId(entity: Pick<PlacementEntity, 'tableId' | 'combinationId'>): string {
  return entity.tableId ?? entity.combinationId!;
}
