/**
 * Types des ouvertures — §9.3 de `TURO-conception.md`.
 *
 * Règle qui gouverne ce fichier (§6.4 de `TURO-stack-technique.md`) :
 * une heure d'ouverture est une **heure locale du restaurant**, pas un instant.
 * « Le service du soir commence à 19:00 » est vrai à Paris comme à Tokyo.
 * On ne stocke donc jamais un `Date` ici.
 */

/** Heure locale du restaurant, format `"HH:MM"` sur 24 h. Jamais un `Date`. */
export type LocalTime = string;

/** Date civile, format `"AAAA-MM-JJ"`. Jamais un `Date`. */
export type CivilDate = string;

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/** Un service tel qu'il est réglé au §9.3 : un nom et une plage horaire. */
export interface Service {
  readonly name: string;
  readonly start: LocalTime;
  readonly end: LocalTime;
}

/**
 * Les horaires habituels : une semaine type.
 * §9.3 — « une colonne par jour, les services empilés ».
 * Un jour habituellement fermé porte un tableau vide.
 */
export type WeeklySchedule = Readonly<Record<Weekday, readonly Service[]>>;

/**
 * Une exception posée dans le calendrier mensuel du §9.3.
 * Elle porte sur **un seul jour** et remplace entièrement l'habituel.
 */
export type ScheduleException =
  | { readonly date: CivilDate; readonly kind: 'closure' }
  | {
      readonly date: CivilDate;
      readonly kind: 'modified_hours';
      readonly services: readonly Service[];
    };

/**
 * D'où vient le contenu du jour.
 *
 * C'est ce qui permet au calendrier du §9.3 de choisir sa marque :
 * hachures pour une fermeture, pointillé ambre pour des horaires modifiés,
 * et — décision du §9.3 — **aucune marque pour un jour normal**.
 */
export type DayOrigin = 'regular' | 'exceptional_closure' | 'modified_hours';

/** Ce qu'un jour contient réellement, une fois l'habituel et l'exception confrontés. */
export interface ResolvedDay {
  readonly date: CivilDate;
  readonly services: readonly Service[];
  readonly origin: DayOrigin;
}
