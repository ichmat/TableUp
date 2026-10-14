import { CombinationReminder, ReminderAnswer } from '../../../models';
import { todayIn } from '../../../shared/utils/calendar-date';
import { timeIn } from '../../../shared/utils/time-of-day';
import { guestName } from '../../booking-component/reservation-display';
import { tableList } from '../placement-reasons';

export interface ReminderChoice {
  answer: ReminderAnswer,
  label: string,
}

const guestOf = (reminder: CombinationReminder) =>
  guestName(reminder.reservation?.guestName ? { name: reminder.reservation.guestName } : null);

/** COMB-07 : le titre dit le geste attendu, en salle */
export function reminderTitle(reminder: CombinationReminder): string {
  switch (reminder.kind) {
    case 'Approach':
      return `Rapprocher ${tableList(reminder.tableNames)}`;
    case 'Separate':
      return `Séparer ${tableList(reminder.tableNames)}`;
    case 'AfterNoShow':
      return `${guestOf(reminder)} ne s'est pas présenté.`;
  }
}

/** `now` : l'instant qui dit si la réservation est d'un autre jour de service */
export function reminderDetail(reminder: CombinationReminder, timeZone: string, now: Date = new Date()): string {
  const at = reminder.reservation === null ? '' : timeIn(timeZone, new Date(reminder.reservation.start));
  switch (reminder.kind) {
    case 'Approach': {
      const who = reminder.reservation === null ? '' : `${guestOf(reminder)} · ${reminder.reservation.covers} p · ${at}`;
      const names = reminder.separates;
      const separated = names.length === 0 ? '' : names.length > 1 ? `${names.join(', ')} seront séparées.` : `${names[0]} sera séparée.`;
      return [who, separated].filter((line) => line !== '').join('\n');
    }
    case 'Separate': {
      const reservation = reminder.reservation;
      if (reservation === null) {
        return '';
      }
      const table = reservation.claimedTable === null ? 'Une de ces tables' : `La ${reservation.claimedTable}`;
      // Une réservation d'un autre jour dit sa date : « sam. 18 oct. à 12:00 »
      const day = reservation.serviceDay === todayIn(timeZone, now) ? ''
        : `${new Intl.DateTimeFormat('fr-FR', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(reservation.start))} `;
      return `${table} est attendue seule ${day}à ${at} (${guestOf(reminder)}).`;
    }
    case 'AfterNoShow':
      return `Séparer ${tableList(reminder.tableNames)} ?`;
  }
}

/**
 * Les réponses de §3.4 ; aucune ne se tait : le rappel reste tant qu'on n'a pas répondu.
 * « Finalement non » renvoie une réservation confirmée dans À placer : des clients assis restent
 */
export function answersOf(reminder: CombinationReminder): ReminderChoice[] {
  switch (reminder.kind) {
    case 'Approach':
      return [
        { answer: 'Done', label: "Oui, c'est fait" }, { answer: 'Later', label: 'Pas encore' },
        ...(reminder.reservation?.status === 'Confirmed' ? [{ answer: 'Abandon', label: 'Finalement non' } as const] : []),
      ];
    case 'Separate':
      return [{ answer: 'Separate', label: 'Oui, les séparer' }, { answer: 'KeepTogether', label: 'Non, les laisser ensemble' }];
    case 'AfterNoShow':
      return [{ answer: 'Separate', label: 'Oui' }, { answer: 'KeepTogether', label: 'Non' }];
  }
}

/** Le bandeau qui suit la réponse */
export function answeredMessage(reminder: CombinationReminder, answer: ReminderAnswer): string {
  switch (answer) {
    case 'Done':
      return `${reminder.name} collée`;
    case 'Later':
      return 'Rappel dans 10 min';
    case 'Abandon':
      return `${guestOf(reminder)} retourne dans À placer`;
    case 'Separate':
      return `${reminder.name} séparée`;
    case 'KeepTogether':
      return `${reminder.name} reste collée`;
  }
}
