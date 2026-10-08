import {
  CLIENT_TAG_LABEL, EventType, ExceptionalClosure, PendingRequests, ReservationDay, ReservationDetail, ReservationEvent,
  ReservationGesture, ReservationListClient, ReservationListItem, ReservationStatus, RestaurantService,
} from '../../models';
import { addDays, dayOfWeek, formatHistoryDate, formatLongDate, formatWeekday } from '../../shared/utils/calendar-date';
import { timeIn } from '../../shared/utils/time-of-day';

/** Le nom de la fiche, ou « Client de passage » sans fiche (§7.2) */
export function guestName(client: { name: string } | null): string {
  return client?.name ?? 'Client de passage';
}

/** « JEUDI 20 AOÛT — AUJOURD'HUI · 48 couverts · 3 à placer » (§6.1) ; « à placer » se tait à zéro */
export function dayHeader(day: ReservationDay, today: string): string {
  let title = formatLongDate(day.serviceDay, day.serviceDay.slice(0, 4) !== today.slice(0, 4)).toUpperCase();
  if (day.serviceDay === today) {
    title += " — AUJOURD'HUI";
  } else if (day.serviceDay === addDays(today, -1)) {
    title += ' · hier';
  }
  const parts = [title, `${day.covers} couvert${day.covers > 1 ? 's' : ''}`];
  if (day.toPlace > 0) {
    parts.push(`${day.toPlace} à placer`);
  }
  return parts.join(' · ');
}

function waitedFor(since: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 60_000));
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h` : `${Math.floor(hours / 24)} j`;
}

/** Le bandeau violet (§6.1) ; `null` quand la file est vide : il disparaît seul */
export function pendingBanner(pending: PendingRequests, now: Date): string | null {
  if (pending.count === 0) {
    return null;
  }
  const head = pending.count === 1 ? '1 demande attend une réponse' : `${pending.count} demandes attendent une réponse`;
  if (pending.oldestCreatedAt === null) {
    return head;
  }
  const age = waitedFor(new Date(pending.oldestCreatedAt), now);
  return `${head} · ${pending.count === 1 ? 'depuis' : 'la plus ancienne depuis'} ${age}`;
}

export type QuickAction = 'answer' | 'place' | 'arrive' | 'release' | null;

/** §6.4 : une seule action par ligne, sauf une demande où accepter et refuser sont symétriques */
export function quickAction(item: Pick<ReservationListItem, 'status' | 'placeName'>): QuickAction {
  switch (item.status) {
    case 'Pending': return 'answer';
    case 'Confirmed': return item.placeName === null ? 'place' : 'arrive';
    case 'Seated': return 'release';
    default: return null;
  }
}

export type PrimaryAction = 'acceptAndPlace' | 'place' | 'arrive' | 'release' | null;

/** FICHE-01 : une seule action principale, déduite de l'état */
export function primaryAction(reservation: Pick<ReservationDetail, 'status' | 'place'>): PrimaryAction {
  switch (reservation.status) {
    case 'Pending': return 'acceptAndPlace';
    case 'Confirmed': return reservation.place === null ? 'place' : 'arrive';
    case 'Seated': return 'release';
    default: return null;
  }
}

export type Mark =
  | { kind: 'allergy' }
  | { kind: 'tag', label: string }
  | { kind: 'first' }
  | { kind: 'risk', label: string };

/** §5.6 : ce qui qualifie la réservation voyage avec elle. Sans fiche, aucune marque */
export function marks(client: ReservationListClient | null): Mark[] {
  if (client === null) {
    return [];
  }
  const result: Mark[] = [];
  if (client.hasAllergy) {
    result.push({ kind: 'allergy' });
  }
  for (const tag of client.tags) {
    if (tag === 'Vip' || tag === 'Regular') {
      result.push({ kind: 'tag', label: CLIENT_TAG_LABEL[tag] });
    }
  }
  if (client.visitCount === 0) {
    result.push({ kind: 'first' });
  }
  if (client.atRisk) {
    result.push({ kind: 'risk', label: `NO-SHOW ×${client.noShowCount}` });
  }
  return result;
}

export function ordinal(n: number): string {
  return n === 1 ? '1ᵉʳ' : `${n}ᵉ`;
}

/** Le texte du bandeau après un geste : ce qui est fait, et sa conséquence quand elle compte (FICHE-05) */
export function gestureMessage(gesture: ReservationGesture | 'cancel', after: ReservationDetail): string {
  const name = guestName(after.client);
  switch (gesture) {
    case 'accept': return `${name} acceptée`;
    case 'refuse': return `${name} refusée`;
    case 'arrive': return `Arrivée de ${name}`;
    case 'release': return after.place ? `Table ${after.place.name} libérée` : `${name} : table libérée`;
    case 'no-show': return after.client ? `No-show noté · ${ordinal(after.client.noShowCount)} pour ce client` : 'No-show noté';
    case 'reopen': return 'Réservation rouverte';
    case 'cancel': return 'Réservation annulée';
  }
}

/** « Réservation créée · Moreau, jeu. 20 août 20:30 » */
export function createdMessage(after: ReservationDetail, timeZone: string): string {
  return `Réservation créée · ${guestName(after.client)}, ${formatHistoryDate(after.serviceDay)} ${timeIn(timeZone, new Date(after.start))}`;
}

/** « Modifiée · 20:00 → 20:30 » : le détail que l'API a écrit au journal */
export function modifiedMessage(after: ReservationDetail): string {
  const last = [...after.events].reverse().find((event) => event.type === 'Modification');
  return last?.details ? `Modifiée · ${last.details}` : 'Réservation modifiée';
}

export const EVENT_LABEL: Record<EventType, string> = {
  Creation: 'Création',
  Acceptance: 'Acceptée',
  Refusal: 'Refusée',
  Reminder: 'Rappel envoyé',
  ClientConfirmation: 'Confirmée par le client',
  Placement: 'Placement',
  Move: 'Déplacement',
  Arrival: 'Arrivée',
  Release: 'Libération',
  NoShow: 'No-show',
  Cancellation: 'Annulée',
  Modification: 'Modifiée',
  Reopening: 'Rouverte',
};

/** Les libellés des filtres ; les badges gardent leurs majuscules (`RESERVATION_STATUS_STYLE`) */
export const STATUS_FILTER_LABEL: Record<ReservationStatus, string> = {
  Pending: 'À répondre',
  Confirmed: 'Confirmée',
  Seated: 'Assise',
  Finished: 'Terminée',
  NoShow: 'No-show',
  Cancelled: 'Annulée',
};

/** « 14/08 10:14 · Acceptée · camille » ; *système* sans auteur (JRN-01) */
export function journalLine(event: ReservationEvent, timeZone: string): string {
  const instant = new Date(event.timestamp);
  const day = new Intl.DateTimeFormat('fr-FR', { timeZone, day: '2-digit', month: '2-digit' }).format(instant);
  const parts = [`${day} ${timeIn(timeZone, instant)}`, EVENT_LABEL[event.type]];
  if (event.details) {
    parts.push(event.details);
  }
  parts.push(event.authorLogin ?? 'système');
  return parts.join(' · ');
}

/** « 4 personnes · jeudi 20 août · 20:30 » */
export function sheetSubtitle(reservation: ReservationDetail, timeZone: string): string {
  const people = `${reservation.covers} personne${reservation.covers > 1 ? 's' : ''}`;
  return `${people} · ${formatLongDate(reservation.serviceDay)} · ${timeIn(timeZone, new Date(reservation.start))}`;
}

/** La flèche de la fiche client qui ramène ici (§7.6) : « Réservation de jeudi 20:00 » */
export function originLabel(reservation: ReservationDetail, timeZone: string): string {
  return `Réservation de ${formatWeekday(reservation.serviceDay)} ${timeIn(timeZone, new Date(reservation.start))}`;
}

/** Un jour qui a au moins un service : ni fermé, ni sans service. Le sélecteur de l'écran Service garde les jours passés */
export function isServiceDay(day: string, services: RestaurantService[], closures: ExceptionalClosure[]): boolean {
  const closure = closures.find((c) => c.from <= day && day <= c.to);
  if (closure?.type === 'Closed') {
    return false;
  }
  if (closure?.type === 'ModifiedHours') {
    return (closure.replacementHours?.length ?? 0) > 0;
  }
  return services.some((service) => service.day === dayOfWeek(day));
}

/** Le calendrier du formulaire grise un jour passé, fermé, ou sans service. L'API reste juge (`OutsideService`) */
export function isBookableDay(day: string, services: RestaurantService[], closures: ExceptionalClosure[], today: string): boolean {
  return day >= today && isServiceDay(day, services, closures);
}
