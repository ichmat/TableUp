import { addDays, todayIn } from '../../../shared/utils/calendar-date';

/** Ce qu'un client qui réserverait à `now` pourrait choisir, en dates et heures du restaurant */
export interface BookingWindowPreview {
    today: string,
    earliestDay: string,
    earliestTime: string,
    lastDay: string,
}

/** Simple affichage : c'est le widget qui appliquera la fenêtre (PAR-10) */
export function bookingWindow(now: Date, timeZone: string, minNoticeMinutes: number, horizonDays: number): BookingWindowPreview {
    const earliest = new Date(now.getTime() + minNoticeMinutes * 60_000);
    const today = todayIn(timeZone, now);
    return {
        today,
        earliestDay: todayIn(timeZone, earliest),
        earliestTime: timeIn(timeZone, earliest),
        lastDay: addDays(today, horizonDays),
    };
}

export function timeIn(timeZone: string, instant: Date): string {
    return new Intl.DateTimeFormat('fr-FR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant);
}
