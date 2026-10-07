import { DAYS_OF_WEEK, DayWeek } from '../../models';

/**
 * Jours de calendrier au format `AAAA-MM-JJ` (un `DateOnly` de l'API). Les calculs passent par UTC :
 * un jour de calendrier n'a pas d'heure, aucun fuseau ne doit le décaler
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function toIsoDate(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** `'2026-12-24'` → `{ year: 2026, month: 12, day: 24 }` (mois de 1 à 12) */
export function parseIsoDate(date: string): { year: number, month: number, day: number } {
    const [year, month, day] = date.split('-').map(Number);
    return { year, month, day };
}

function toUtc(date: string): Date {
    const { year, month, day } = parseIsoDate(date);
    return new Date(Date.UTC(year, month - 1, day));
}

function fromUtc(date: Date): string {
    return toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDays(date: string, days: number): string {
    return fromUtc(new Date(toUtc(date).getTime() + days * MS_PER_DAY));
}

/** Nombre de jours de `from` à `to`, les deux inclus */
export function dayCount(from: string, to: string): number {
    return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / MS_PER_DAY) + 1;
}

export function dayOfWeek(date: string): DayWeek {
    // getUTCDay : 0 = dimanche ; DAYS_OF_WEEK commence le lundi
    return DAYS_OF_WEEK[(toUtc(date).getUTCDay() + 6) % 7];
}

/** Les jours affichés pour un mois : semaines complètes du lundi au dimanche, débordant sur les mois voisins */
export function monthGrid(year: number, month: number): string[] {
    const first = toIsoDate(year, month, 1);
    const start = addDays(first, -DAYS_OF_WEEK.indexOf(dayOfWeek(first)));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const end = toIsoDate(year, month, daysInMonth);
    const length = Math.ceil(dayCount(start, end) / 7) * 7;
    return Array.from({ length }, (_, index) => addDays(start, index));
}

/** Le jour courant dans le fuseau du restaurant (`'Europe/Paris'`), seul fuseau qui compte pour lui */
export function todayIn(timeZone: string, now: Date = new Date()): string {
    // en-CA formate en AAAA-MM-JJ
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** `'2026-12-24'` → `'jeudi 24 décembre'` (`withYear` ajoute l'année) */
export function formatLongDate(date: string, withYear = false): string {
    return new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}),
    }).format(toUtc(date));
}

/** `'2026-08-20'` → `'jeudi'` */
export function formatWeekday(date: string): string {
    return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long' }).format(toUtc(date));
}

/** `'2026-08-28'` → `'28 août'` (`withYear` ajoute l'année) */
export function formatShortDate(date: string, withYear = false): string {
    return new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'UTC', day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}),
    }).format(toUtc(date));
}

/** `'2026-08-20'` → `'jeu. 20 août'` (`withYear` ajoute l'année) */
export function formatHistoryDate(date: string, withYear = false): string {
    return new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}),
    }).format(toUtc(date));
}
