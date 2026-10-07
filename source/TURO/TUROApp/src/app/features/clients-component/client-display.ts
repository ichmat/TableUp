import { ClientDetail, ClientHistoryItem, ClientRequest } from '../../models';
import { dayCount, formatShortDate, formatWeekday } from '../../shared/utils/calendar-date';

/** `'Sophie Marchand'` → `'Marchand, Sophie'` : la liste se lit par le nom de famille */
export function listName(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) {
        return parts.join(' ');
    }
    const last = parts.pop()!;
    return `${last}, ${parts.join(' ')}`;
}

/** Le jour de la semaine à moins de 7 jours (passé ou à venir), sinon la date, avec l'année si elle diffère */
export function lastDayLabel(day: string | null, today: string): string {
    if (day === null) {
        return '—';
    }
    const distance = Math.abs(dayCount(today, day) - 1);
    if (distance < 7) {
        return formatWeekday(day);
    }
    return formatShortDate(day, day.slice(0, 4) !== today.slice(0, 4));
}

export function formatCovers(average: number | null): string {
    return average === null ? '—' : average.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

/** CLI-08 : l'historique arrive du plus récent au plus ancien ; les réservations à venir passent en haut */
export function splitHistory(items: ClientHistoryItem[], now: Date): { upcoming: ClientHistoryItem[], past: ClientHistoryItem[] } {
    const limit = now.getTime();
    return {
        upcoming: items.filter((item) => new Date(item.start).getTime() > limit),
        past: items.filter((item) => new Date(item.start).getTime() <= limit),
    };
}

export function clientToRequest(client: ClientDetail): ClientRequest {
    return {
        name: client.name,
        phones: [...client.phones],
        emails: [...client.emails],
        allergies: client.allergies,
        internalNotes: client.internalNotes,
        tags: [...client.tags],
        version: client.version,
    };
}

