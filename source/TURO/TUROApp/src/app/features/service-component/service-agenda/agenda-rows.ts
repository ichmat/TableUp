import { Placement, PlacementApproach, PlacementLevel, ServiceSnapshot, ServiceTable, ServiceZone, TableOccupation } from '../../../models';
import { approachKey } from '../approach-list/approach-list';
import { guestName } from '../../booking-component/reservation-display';

export type AgendaBlockKind = 'Reserved' | 'Late' | 'Occupied' | 'Finished';

/** Instants en ms epoch */
export interface AgendaBlock {
  reservationId: string,
  start: number,
  end: number,
  kind: AgendaBlockKind,
  label: string,
  allergy: boolean,
  /** Assise qui déborde : bord droit ouvert */
  open: boolean,
}

export interface AgendaGhost {
  reservationId: string,
  start: number,
  end: number,
  /** « via 12-13 » */
  label: string,
}

export interface AgendaLinkSegment { kind: 'Glued' | 'Planned', start: number, end: number }

export interface AgendaAxis {
  start: number,
  end: number,
  /** `null` : maintenant hors de l'axe */
  now: number | null,
  slotStep: number,
}

export type AgendaRow =
  | { kind: 'Zone', key: string, name: string }
  | {
    kind: 'Table', key: string, tableId: string, name: string, capacity: number, nested: boolean, blocks: AgendaBlock[],
    ghosts: AgendaGhost[], level: PlacementLevel | null,
  }
  | {
    kind: 'Combination', key: string, combinationId: string | null, approachKey: string | null, name: string, capacity: number,
    memberCount: number, expanded: boolean, temporary: boolean, blocks: AgendaBlock[], level: PlacementLevel | null,
  }
  | { kind: 'Link', key: string, segments: AgendaLinkSegment[] };

export interface AgendaInput {
  snapshot: ServiceSnapshot,
  now: number,
  placement: Placement | null,
  /** clé de ligne Combination → déplié ou non, choisi à la main */
  toggled: ReadonlyMap<string, boolean>,
}

/** Largeur minimale d'un rapprochement prévu, pour que son `!` se lise */
export const PLANNED_MIN_MINUTES = 10;
/** Rapprochements du moteur montrés en ligne pendant un placement */
export const APPROACH_ROWS = 3;

const MINUTE = 60_000;

/** Une assise qui déborde (`Unreleased`) : sa fin n'est pas une date, on ne la lit jamais */
function overruns(occupation: TableOccupation): boolean {
  return occupation.end.startsWith('9999');
}

/** La fin dessinée : une assise qui déborde s'arrête à `overrunEnd` */
function endOf(occupation: TableOccupation, overrunEnd: number): number {
  return overruns(occupation) ? Math.max(Date.parse(occupation.start), overrunEnd) : Date.parse(occupation.end);
}

/** L'horloge du poste, rattrapée par celle de l'API si le poste retarde (comme `defaultSlot`) */
function presentOf(snapshot: ServiceSnapshot, now: number): number {
  return Math.max(now, Date.parse(snapshot.now));
}

/** Fin prévue du service : le dernier créneau plus un pas ; `null` sans service ni créneau */
function scheduledEnd(snapshot: ServiceSnapshot): number | null {
  if (snapshot.service === null || snapshot.slots.length === 0) {
    return null;
  }
  return Date.parse(snapshot.slots[snapshot.slots.length - 1].at) + snapshot.service.slotStep * MINUTE;
}

/**
 * Où s'arrête une assise qui déborde : au présent pendant le service en cours ; sinon à la fin prévue, pour qu'un service
 * passé ou à venir ne s'étire pas jusqu'à aujourd'hui
 */
function overrunEndOf(snapshot: ServiceSnapshot, present: number): number {
  return snapshot.service?.state === 'InProgress' ? present : scheduledEnd(snapshot) ?? present;
}

function allOccupations(snapshot: ServiceSnapshot): TableOccupation[] {
  return snapshot.zones.flatMap((zone) => zone.tables.flatMap((table) => table.occupations));
}

/** De l'ouverture à la plus tardive des fins, fermeture comprise ; `null` sans service ni créneau */
export function agendaAxis(snapshot: ServiceSnapshot, now: number): AgendaAxis | null {
  const scheduled = scheduledEnd(snapshot);
  if (snapshot.service === null || scheduled === null) {
    return null;
  }
  const present = presentOf(snapshot, now);
  const overrunEnd = overrunEndOf(snapshot, present);
  const occupations = allOccupations(snapshot);
  const start = Math.min(Date.parse(snapshot.slots[0].at), ...occupations.map((o) => Date.parse(o.start)));
  const end = Math.max(scheduled, ...occupations.map((o) => endOf(o, overrunEnd)));
  // Borne de fin incluse : une assise qui déborde, dernière à finir, s'arrête pile au présent
  return { start, end, now: start <= present && present <= end ? present : null, slotStep: snapshot.service.slotStep };
}

function blockOf(occupation: TableOccupation, now: number, overrunEnd: number): AgendaBlock {
  let kind: AgendaBlockKind;
  switch (occupation.status) {
    case 'Seated': kind = 'Occupied'; break;
    case 'Finished': kind = 'Finished'; break;
    default: kind = occupation.lateFrom !== null && now >= Date.parse(occupation.lateFrom) ? 'Late' : 'Reserved';
  }
  return {
    reservationId: occupation.reservationId,
    start: Date.parse(occupation.start),
    end: endOf(occupation, overrunEnd),
    kind,
    label: `${guestName(occupation.guestName === null ? null : { name: occupation.guestName })} · ${occupation.covers}p`,
    allergy: occupation.hasAllergy,
    open: overruns(occupation),
  };
}

/** Une combinaison affichée dans une salle : de l'instantané, ou proposée par le moteur */
interface Shown {
  key: string,
  combinationId: string | null,
  approachKey: string | null,
  name: string,
  capacity: number,
  tableIds: string[],
  temporary: boolean,
  isActive: boolean,
  activateAt: string | null,
  deactivateAt: string | null,
  approachLevel: PlacementLevel | null,
}

function shownOf(zone: ServiceZone, approaches: readonly PlacementApproach[]): Shown[] {
  const shown: Shown[] = zone.agendaCombinations.map((c) => ({
    key: `c:${c.id}`, combinationId: c.id, approachKey: null, name: c.name, capacity: c.capacity, tableIds: c.tableIds,
    temporary: false, isActive: c.isActive, activateAt: c.activateAt, deactivateAt: c.deactivateAt, approachLevel: null,
  }));
  for (const approach of approaches.filter((a) => a.zoneId === zone.id)) {
    const known = approach.combinationId === null ? undefined : shown.find((s) => s.combinationId === approach.combinationId);
    if (known !== undefined) {
      // Le rapprochement d'une combinaison déjà affichée enrichit sa ligne
      known.approachKey = approachKey(approach);
      known.approachLevel = approach.level;
      continue;
    }
    shown.push({
      key: approach.combinationId === null ? `a:${approachKey(approach)}` : `c:${approach.combinationId}`,
      combinationId: approach.combinationId, approachKey: approachKey(approach), name: approach.name, capacity: approach.capacity,
      tableIds: approach.tableIds, temporary: true, isActive: false, activateAt: null, deactivateAt: null, approachLevel: approach.level,
    });
  }
  return shown;
}

/** Toutes les lignes de l'Agenda : par salle, chaque combinaison affichée juste avant le premier de ses membres encore libre */
export function agendaRows(input: AgendaInput): AgendaRow[] {
  const { snapshot, placement, toggled } = input;
  const now = presentOf(snapshot, input.now);
  const overrunEnd = overrunEndOf(snapshot, now);
  const axis = agendaAxis(snapshot, input.now);
  const inProgress = snapshot.service?.state === 'InProgress';
  // Un même rapprochement en double ne doit pas donner deux lignes de même clé
  const approaches = (placement?.approaches ?? [])
    .filter((a) => a.level !== 'Excluded')
    .filter((a, i, all) => all.findIndex((other) => approachKey(other) === approachKey(a)) === i)
    .slice(0, APPROACH_ROWS);

  const tableLevel = (tableId: string) => placement?.entities.find((e) => e.tableId === tableId)?.level ?? null;

  const tableRow = (table: ServiceTable, key: string, nested: boolean): AgendaRow => ({
    kind: 'Table', key, tableId: table.id, name: table.name, capacity: table.capacity, nested,
    blocks: table.occupations.filter((o) => o.combinationId === null).map((o) => blockOf(o, now, overrunEnd)),
    ghosts: table.occupations.filter((o) => o.combinationId !== null).map((o) => ({
      reservationId: o.reservationId, start: Date.parse(o.start), end: endOf(o, overrunEnd), label: `via ${o.placeName}`,
    })),
    level: tableLevel(table.id),
  });

  const rows: AgendaRow[] = [];
  for (const zone of snapshot.zones) {
    rows.push({ kind: 'Zone', key: `zone:${zone.id}`, name: zone.name });

    const index = new Map(zone.tables.map((table, i) => [table.id, i]));
    const membersOf = (s: Shown) => zone.tables.filter((table) => s.tableIds.includes(table.id));
    const firstIndex = (s: Shown) => Math.min(...s.tableIds.map((id) => index.get(id) ?? Infinity));
    const shown = shownOf(zone, approaches)
      .sort((a, b) => firstIndex(a) - firstIndex(b) || a.name.localeCompare(b.name));

    // Chaque table revient à la première combinaison qui la réclame ; une combinaison s'ancre sur son premier membre libre
    const claimedBy = new Map<string, Shown>();
    const anchoredAt = new Map<string, Shown[]>();
    const after = new Map<Shown, Shown[]>();
    const orphans: Shown[] = [];
    for (const s of shown) {
      const members = membersOf(s);
      const anchor = members.find((table) => !claimedBy.has(table.id));
      if (anchor !== undefined) {
        anchoredAt.set(anchor.id, [...(anchoredAt.get(anchor.id) ?? []), s]);
      } else if (members.length > 0) {
        const host = claimedBy.get(members[0].id)!;
        after.set(host, [...(after.get(host) ?? []), s]);
      } else {
        orphans.push(s);
      }
      members.filter((table) => !claimedBy.has(table.id)).forEach((table) => claimedBy.set(table.id, s));
    }

    const pushGroup = (s: Shown) => {
      const members = membersOf(s);
      const occupations = members.flatMap((table) => table.occupations);
      const own = s.combinationId === null ? [] : occupations.filter((o) => o.combinationId === s.combinationId);
      const blocks = own
        .filter((o, i) => own.findIndex((other) => other.reservationId === o.reservationId) === i)
        .map((o) => blockOf(o, now, overrunEnd));
      const byDefault = s.temporary
        || occupations.some((o) => o.combinationId !== s.combinationId)
        || (placement !== null && members.some((table) => {
          const level = tableLevel(table.id);
          return level !== null && level !== 'Excluded';
        }));
      const expanded = toggled.get(s.key) ?? byDefault;
      const entityLevel = s.combinationId === null
        ? null
        : placement?.entities.find((e) => e.combinationId === s.combinationId)?.level ?? null;

      rows.push({
        kind: 'Combination', key: s.key, combinationId: s.combinationId, approachKey: s.approachKey, name: s.name,
        capacity: s.capacity, memberCount: s.tableIds.length, expanded, temporary: s.temporary, blocks,
        level: entityLevel ?? s.approachLevel,
      });

      const segments = s.temporary ? [] : linkOf(s, own, axis, inProgress);
      if (segments.length > 0) {
        rows.push({ kind: 'Link', key: `${s.key}/link`, segments });
      }
      if (expanded) {
        members.forEach((table) => rows.push(tableRow(table, `${s.key}/${table.id}`, true)));
      }
      (after.get(s) ?? []).forEach(pushGroup);
    };

    for (const table of zone.tables) {
      (anchoredAt.get(table.id) ?? []).forEach(pushGroup);
      if (!claimedBy.has(table.id)) {
        rows.push(tableRow(table, `table:${table.id}`, false));
      }
    }
    orphans.forEach(pushGroup);
  }
  return rows;
}

/**
 * Collées : du début de l'axe à la séparation ; prévu : de `activateAt` à la première réservation de la combinaison.
 * Le segment est borné à l'axe, et disparaît s'il n'en reste rien
 */
function linkOf(s: Shown, own: TableOccupation[], axis: AgendaAxis | null, inProgress: boolean): AgendaLinkSegment[] {
  if (axis === null) {
    return [];
  }
  let segment: AgendaLinkSegment;
  if (s.isActive) {
    if (!inProgress) {
      return [];
    }
    segment = { kind: 'Glued', start: axis.start, end: s.deactivateAt === null ? axis.end : Date.parse(s.deactivateAt) };
  } else if (s.activateAt !== null) {
    const start = Date.parse(s.activateAt);
    const firstAfter = Math.min(...own.map((o) => Date.parse(o.start)).filter((t) => t >= start));
    const minimum = start + PLANNED_MIN_MINUTES * MINUTE;
    segment = { kind: 'Planned', start, end: Number.isFinite(firstAfter) ? Math.max(minimum, firstAfter) : minimum };
  } else {
    return [];
  }
  const start = Math.max(segment.start, axis.start);
  const end = Math.min(segment.end, axis.end);
  return start < end ? [{ kind: segment.kind, start, end }] : [];
}
