/** Heures d'un service, manipulées en minutes depuis minuit. Les chaînes viennent d'un `TimeOnly` de l'API */

const MINUTES_PER_DAY = 24 * 60;

/** `'19:30'` ou `'19:30:00'` → `1170` */
export function toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

/** `1170` → `'19:30'`. Au-delà de minuit, l'heure repart de `00:00` */
export function formatMinutes(minutes: number): string {
    const inDay = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const hours = Math.floor(inDay / 60);
    return `${String(hours).padStart(2, '0')}:${String(inDay % 60).padStart(2, '0')}`;
}

/** `105` → `'1 h 45'`, `120` → `'2 h'`, `45` → `'45 min'` */
export function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) {
        return `${rest} min`;
    }
    return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

/** Durée d'un service en minutes. Un service peut passer minuit : `22:00` → `02:00` dure 4 h */
export function serviceLength(opening: string, closing: string): number {
    const length = (toMinutes(closing) - toMinutes(opening) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return length === 0 ? MINUTES_PER_DAY : length;
}

/**
 * Début de chaque créneau de la frise, en minutes depuis l'ouverture du jour du service.
 * La fermeture n'ouvre pas de créneau : `19:00` → `20:00` au pas de 30 donne `19:00` et `19:30`
 */
export function slotStarts(opening: string, closing: string, step: number): number[] {
    const start = toMinutes(opening);
    const length = serviceLength(opening, closing);
    const starts: number[] = [];
    for (let offset = 0; offset < length; offset += step) {
        starts.push(start + offset);
    }
    return starts;
}

/** L'heure `HH:mm` d'un instant, dans le fuseau du restaurant */
export function timeIn(timeZone: string, instant: Date): string {
    return new Intl.DateTimeFormat('fr-FR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant);
}
