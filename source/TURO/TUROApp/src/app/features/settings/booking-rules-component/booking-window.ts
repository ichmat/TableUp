import { addDays, todayIn } from '../../../shared/utils/calendar-date';
import { timeIn } from '../../../shared/utils/time-of-day';
export { timeIn };

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
