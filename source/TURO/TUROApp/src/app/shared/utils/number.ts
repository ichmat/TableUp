export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/** `7` → `'07'` */
export function twoDigits(value: number): string {
    return value.toString().padStart(2, '0');
}
