import { ReservationActionResult, ReservationDetail, ReservationRequest, ReservationSource } from '../../models';
import { timeIn } from '../../shared/utils/time-of-day';

/** La saisie du formulaire : gardée telle quelle pour le rouvrir après « Annuler » (§6.7) */
export interface ReservationDraft {
  covers: number,
  serviceDay: string,
  /** `HH:mm:ss` : un créneau de la bande ; `null` tant qu'aucun n'est choisi */
  time: string | null,
  phone: string,
  name: string,
  email: string,
  note: string,
  /** `null` : la durée de la plage du créneau choisi */
  duration: number | null,
  preferredZoneId: string | null,
  source: ReservationSource,
}

export type ReservationFormMode =
  | { kind: 'create', draft?: Partial<ReservationDraft> }
  | { kind: 'edit', reservation: ReservationDetail, draft?: Partial<ReservationDraft> };

export interface ReservationSaved {
  result: ReservationActionResult,
  draft: ReservationDraft,
  mode: 'create' | 'edit',
  /** « Créer et placer » : la vue Plan s'ouvre ensuite (§8.6) */
  thenPlace: boolean,
}

export const DEFAULT_COVERS = 2;

/** `'20:00'` → `'20:00:00'` : la forme des créneaux de l'API */
export function slotKey(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

export function initialDraft(mode: ReservationFormMode, today: string, timeZone: string): ReservationDraft {
  if (mode.kind === 'edit') {
    const r = mode.reservation;
    return {
      covers: r.covers, serviceDay: r.serviceDay, time: slotKey(timeIn(timeZone, new Date(r.start))),
      phone: r.client?.phone ?? '', name: r.client?.name ?? '', email: '', note: r.note ?? '',
      duration: r.duration, preferredZoneId: r.preferredZoneId, source: r.source,
      ...mode.draft,
    };
  }
  return {
    covers: DEFAULT_COVERS, serviceDay: today, time: null, phone: '', name: '', email: '', note: '',
    duration: null, preferredZoneId: null, source: 'Phone',
    ...mode.draft,
  };
}

/** En modification, l'API ignore identité et source et exige la version lue à l'ouverture */
export function toRequest(draft: ReservationDraft, version: number | null, knownName: string | null): ReservationRequest {
  const optional = (text: string) => (text.trim() === '' ? null : text.trim());
  return {
    serviceDay: draft.serviceDay,
    time: draft.time ?? '',
    covers: draft.covers,
    duration: draft.duration,
    note: optional(draft.note),
    preferredZoneId: draft.preferredZoneId,
    source: draft.source,
    phone: optional(draft.phone),
    name: knownName ?? optional(draft.name),
    email: optional(draft.email),
    version,
  };
}
