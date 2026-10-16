import { Combination, Placement, PlacementApproach, PlacementEntity, ServiceSnapshot } from '../../../models';
import { approachKey } from '../approach-list/approach-list';
import { occupation, serviceSnapshot, serviceTable, serviceZone, utc } from '../testing/service-fixtures';
import { AgendaInput, AgendaRow, agendaAxis, agendaLabel, agendaRows } from './agenda-rows';

const now = Date.parse(utc('20:40'));
const ms = (time: string) => Date.parse(utc(time));
const OVERRUN = '9999-12-31T23:59:59.9999999Z';

function combination(change: Partial<Combination> = {}): Combination {
  return {
    id: 'c1213', zoneId: 'z1', name: '12-13', capacity: 8, tableIds: ['t12', 't13'], isActive: true, activateAt: null, deactivateAt: null,
    ...change,
  };
}

function entity(change: Partial<PlacementEntity> = {}): PlacementEntity {
  return { tableId: null, combinationId: null, zoneId: 'z1', name: 'T1', capacity: 4, level: 'Perfect', reasons: [], next: null, ...change };
}

function approach(change: Partial<PlacementApproach> = {}): PlacementApproach {
  return {
    combinationId: null, tableIds: ['t1', 't2'], zoneId: 'z1', name: '1-2', capacity: 8, level: 'WithReserve', reasons: [], next: null,
    distance: 1, ...change,
  };
}

function placement(change: Partial<Placement> = {}): Placement {
  return {
    reservationId: 'r9', guestName: 'Durand', start: utc('21:00'), end: utc('23:00'), covers: 6, note: null, preferredZoneId: null,
    entities: [], approaches: [], ...change,
  };
}

function rows(snapshot: ServiceSnapshot, change: Partial<AgendaInput> = {}): AgendaRow[] {
  return agendaRows({ snapshot, now, placement: null, toggled: new Map(), ...change });
}

function row<K extends AgendaRow['kind']>(all: AgendaRow[], kind: K, key: string): Extract<AgendaRow, { kind: K }> {
  const found = all.find((r) => r.key === key);
  if (found === undefined) {
    throw new Error(`Aucune ligne ${key}`);
  }
  if (found.kind !== kind) {
    throw new Error(`La ligne ${key} est de type ${found.kind}, pas ${kind}`);
  }
  return found as Extract<AgendaRow, { kind: K }>;
}

/** T12 et T13, collées en 12-13, en salle z1 */
function glued(occupations: { t12?: ReturnType<typeof occupation>[], t13?: ReturnType<typeof occupation>[] } = {},
  change: Partial<Combination> = {}, snapshot: Partial<ServiceSnapshot> = {}): ServiceSnapshot {
  return serviceSnapshot({
    zones: [serviceZone({
      tables: [
        serviceTable({ id: 't12', name: 'T12', occupations: occupations.t12 ?? [] }),
        serviceTable({ id: 't13', name: 'T13', occupations: occupations.t13 ?? [] }),
      ],
      agendaCombinations: [combination(change)],
    })],
    ...snapshot,
  });
}

const ofCombination = (change: Parameters<typeof occupation>[0] = {}) =>
  occupation({ reservationId: 'r5', placeName: '12-13', combinationId: 'c1213', guestName: 'Lefèvre', covers: 7, ...change });

describe('agendaAxis', () => {
  it('builds the axis from opening to the latest end, with now inside', () => {
    expect(agendaAxis(serviceSnapshot(), now)).toEqual({ start: ms('19:00'), end: ms('23:00'), now, slotStep: 30 });

    const late = serviceSnapshot({ zones: [serviceZone({ tables: [serviceTable({ occupations: [occupation({ end: utc('23:30') })] })] })] });
    expect(agendaAxis(late, now)?.end).toBe(ms('23:30'));
  });

  it('has no axis without a service', () => {
    expect(agendaAxis(serviceSnapshot({ service: null }), now)).toBeNull();
    expect(agendaAxis(serviceSnapshot({ slots: [] }), now)).toBeNull();
  });

  it('leaves now out of a finished service', () => {
    // L'horloge de l'API est déjà au lendemain : elle l'emporte sur celle du poste
    expect(agendaAxis(serviceSnapshot({ now: '2026-10-11T12:00:00Z' }), now)?.now).toBeNull();
  });

  it('keeps now on the axis when an overrunning seated block ends last', () => {
    const late = Date.parse(utc('23:30'));
    const snapshot = serviceSnapshot({
      zones: [serviceZone({ tables: [serviceTable({ occupations: [occupation({ status: 'Seated', lateFrom: null, start: utc('21:00'), end: OVERRUN })] })] })],
    });

    expect(agendaAxis(snapshot, late)).toEqual(jasmine.objectContaining({ end: late, now: late }));
    expect(row(agendaRows({ snapshot, now: late, placement: null, toggled: new Map() }), 'Table', 'table:t1').blocks[0].end).toBe(late);
  });
});

describe('agendaLabel', () => {
  it('names the guest and the covers, a walk-in without a name', () => {
    expect(agendaLabel('Moreau', 4)).toBe('Moreau · 4p');
    expect(agendaLabel(null, 2)).toBe('Client de passage · 2p');
  });
});

describe('agendaRows', () => {
  it('stops an overrunning seated block at now and marks it open', () => {
    const snapshot = serviceSnapshot({
      zones: [serviceZone({ tables: [serviceTable({ occupations: [occupation({ status: 'Seated', lateFrom: null, start: utc('19:00'), end: OVERRUN })] })] })],
    });

    const block = row(rows(snapshot), 'Table', 'table:t1').blocks[0];
    expect(block.end).toBe(now);
    expect(block.open).toBeTrue();
    expect(Number.isFinite(agendaAxis(snapshot, now)!.end)).toBeTrue();
    expect(agendaAxis(snapshot, now)!.end).toBe(ms('23:00'));
  });

  it('stops an overrun at the scheduled end outside the service in progress', () => {
    const finished = serviceSnapshot().service!;
    const snapshot = serviceSnapshot({
      now: '2026-10-11T12:00:00Z',
      service: { ...finished, state: 'Finished' },
      zones: [serviceZone({ tables: [serviceTable({ occupations: [occupation({ status: 'Seated', lateFrom: null, start: utc('21:00'), end: OVERRUN })] })] })],
    });

    const block = row(rows(snapshot), 'Table', 'table:t1').blocks[0];
    expect(block.end).toBe(ms('23:00'));
    expect(block.open).toBeTrue();
    expect(agendaAxis(snapshot, now)).toEqual(jasmine.objectContaining({ end: ms('23:00'), now: null }));
  });

  it('colours blocks with the plan statuses', () => {
    const kindOf = (change: Parameters<typeof occupation>[0]) => {
      const snapshot = serviceSnapshot({ zones: [serviceZone({ tables: [serviceTable({ occupations: [occupation(change)] })] })] });
      return row(rows(snapshot), 'Table', 'table:t1').blocks[0];
    };

    expect(kindOf({ lateFrom: utc('20:15') }).kind).toBe('Late');
    expect(kindOf({ lateFrom: utc('21:15') }).kind).toBe('Reserved');
    expect(kindOf({ status: 'Seated', lateFrom: null }).kind).toBe('Occupied');
    expect(kindOf({ status: 'Finished', lateFrom: null }).kind).toBe('Finished');
    expect(kindOf({}).label).toBe('Moreau · 4p');
    expect(kindOf({ guestName: null, covers: 2 }).label).toBe('Client de passage · 2p');
    expect(kindOf({ hasAllergy: true })).toEqual(jasmine.objectContaining({ allergy: true, open: false, start: ms('20:00'), end: ms('22:00') }));
  });

  it('hides a combination dormant all service', () => {
    const snapshot = glued();
    snapshot.zones[0].agendaCombinations = [];

    expect(rows(snapshot).map((r) => `${r.kind}:${r.key}`)).toEqual(['Zone:zone:z1', 'Table:table:t12', 'Table:table:t13']);
  });

  it('folds the members of a glued combination with nothing of their own', () => {
    const snapshot = glued({ t12: [ofCombination()], t13: [ofCombination()] });
    const all = rows(snapshot);
    const axis = agendaAxis(snapshot, now)!;

    expect(all.map((r) => r.key)).toEqual(['zone:z1', 'c:c1213', 'c:c1213/link']);
    const group = row(all, 'Combination', 'c:c1213');
    expect(group).toEqual(jasmine.objectContaining({
      combinationId: 'c1213', approachKey: null, name: '12-13', capacity: 8, memberCount: 2, expanded: false, temporary: false, level: null,
    }));
    expect(group.blocks.map((b) => b.label)).toEqual(['Lefèvre · 7p']);
    expect(row(all, 'Link', 'c:c1213/link').segments).toEqual([{ kind: 'Glued', start: axis.start, end: axis.end }]);
  });

  it('does not draw a glued link outside the service in progress', () => {
    const upcoming = serviceSnapshot().service!;
    const snapshot = glued({ t12: [ofCombination()], t13: [ofCombination()] }, {}, { service: { ...upcoming, state: 'Upcoming' } });

    expect(rows(snapshot).some((r) => r.kind === 'Link')).toBeFalse();
  });

  it('unfolds the members when one carries a reservation of its own', () => {
    const alone = occupation({ reservationId: 'r7', start: utc('19:00'), end: utc('20:00'), placeName: 'T12' });
    const all = rows(glued({ t12: [alone, ofCombination()], t13: [ofCombination()] }));

    expect(all.map((r) => r.key)).toEqual(['zone:z1', 'c:c1213', 'c:c1213/link', 'c:c1213/t12', 'c:c1213/t13']);
    expect(row(all, 'Combination', 'c:c1213').expanded).toBeTrue();
    const t12 = row(all, 'Table', 'c:c1213/t12');
    expect(t12).toEqual(jasmine.objectContaining({ tableId: 't12', name: 'T12', nested: true }));
    expect(t12.blocks.map((b) => b.reservationId)).toEqual(['r7']);
    expect(t12.ghosts).toEqual([{ reservationId: 'r5', start: ms('20:00'), end: ms('22:00'), label: 'via 12-13' }]);
    expect(row(all, 'Table', 'c:c1213/t13').blocks).toEqual([]);
    expect(row(all, 'Table', 'c:c1213/t13').ghosts.length).toBe(1);
  });

  it('honours the chevron over the default', () => {
    const folded = glued({ t12: [ofCombination()], t13: [ofCombination()] });
    expect(row(rows(folded, { toggled: new Map([['c:c1213', true]]) }), 'Combination', 'c:c1213').expanded).toBeTrue();

    const alone = occupation({ reservationId: 'r7', start: utc('19:00'), end: utc('20:00') });
    const unfolded = glued({ t12: [alone, ofCombination()], t13: [ofCombination()] });
    const all = rows(unfolded, { toggled: new Map([['c:c1213', false]]) });
    expect(row(all, 'Combination', 'c:c1213').expanded).toBeFalse();
    expect(all.some((r) => r.key === 'c:c1213/t12')).toBeFalse();
  });

  it('draws a planned approach from activateAt to the first reservation', () => {
    const planned = { isActive: false, activateAt: utc('20:45') };
    const withReservation = glued({ t12: [ofCombination({ start: utc('21:00'), end: utc('23:00') })], t13: [] }, planned);
    expect(row(rows(withReservation), 'Link', 'c:c1213/link').segments).toEqual([{ kind: 'Planned', start: ms('20:45'), end: ms('21:00') }]);

    expect(row(rows(glued({}, planned)), 'Link', 'c:c1213/link').segments).toEqual([{ kind: 'Planned', start: ms('20:45'), end: ms('20:55') }]);
  });

  it('clamps link segments to the axis', () => {
    const separated = glued({}, { deactivateAt: utc('21:30') });
    const axis = agendaAxis(separated, now)!;
    expect(row(rows(separated), 'Link', 'c:c1213/link').segments).toEqual([{ kind: 'Glued', start: axis.start, end: ms('21:30') }]);

    // Séparée avant l'ouverture : il ne reste rien du lien sur l'axe
    expect(rows(glued({}, { deactivateAt: utc('18:00') })).some((r) => r.kind === 'Link')).toBeFalse();
  });

  it('keeps row keys unique when the engine repeats an approach', () => {
    const snapshot = serviceSnapshot({ zones: [serviceZone({ tables: ['t1', 't2', 't3'].map((id) => serviceTable({ id, name: id.toUpperCase() })) })] });
    const approaches = [approach(), approach({ tableIds: ['t2', 't1'] }), approach({ tableIds: ['t2', 't3'], name: '2-3' })];

    const all = rows(snapshot, { placement: placement({ approaches }) });
    expect(all.filter((r) => r.kind === 'Combination').map((r) => r.key)).toEqual(['a:t1|t2', 'a:t2|t3']);
    expect(new Set(all.map((r) => r.key)).size).toBe(all.length);
  });

  it('unfolds a combination during a placement when a member can take the reservation', () => {
    const snapshot = glued({ t12: [ofCombination()], t13: [ofCombination()] });
    const can = placement({ entities: [entity({ tableId: 't13', name: 'T13', level: 'WithReserve' })] });
    const cannot = placement({ entities: [entity({ tableId: 't13', name: 'T13', level: 'Excluded' })] });

    expect(row(rows(snapshot, { placement: can }), 'Combination', 'c:c1213').expanded).toBeTrue();
    expect(row(rows(snapshot, { placement: cannot }), 'Combination', 'c:c1213').expanded).toBeFalse();
  });

  it('shows only the first three proposed approaches as rows', () => {
    const tables = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't12', 't13']
      .map((id) => serviceTable({ id, name: id.toUpperCase() }));
    const snapshot = serviceSnapshot({ zones: [serviceZone({ tables, agendaCombinations: [combination({ isActive: false, activateAt: utc('21:30') })] })] });
    const approaches = [
      approach({ tableIds: ['t7', 't8'], name: '7-8', level: 'Excluded' }),
      approach({ tableIds: ['t1', 't2'], name: '1-2' }),
      approach({ combinationId: 'c34', tableIds: ['t3', 't4'], name: '3-4', level: 'NotAdvised' }),
      approach({ tableIds: ['t5', 't6'], name: '5-6' }),
      approach({ tableIds: ['t7', 't8'], name: '7-8 bis' }),
    ];

    const all = rows(snapshot, { placement: placement({ approaches }) });
    const temporary = all.filter((r) => r.kind === 'Combination' && r.temporary) as Extract<AgendaRow, { kind: 'Combination' }>[];
    expect(temporary.map((r) => r.name)).toEqual(['1-2', '3-4', '5-6']);
    expect(temporary.map((r) => r.approachKey)).toEqual(approaches.slice(1, 4).map(approachKey));
    expect(temporary.map((r) => r.key)).toEqual(['a:t1|t2', 'c:c34', 'a:t5|t6']);
    expect(temporary.every((r) => r.expanded)).toBeTrue();
    expect(temporary.map((r) => r.level)).toEqual(['WithReserve', 'NotAdvised', 'WithReserve']);
    expect(all.some((r) => r.kind === 'Link' && r.key.startsWith('a:'))).toBeFalse();
    expect(all.some((r) => r.key === 'c:c34/link')).toBeFalse();
    // Les membres d'une ligne temporaire n'ont plus de ligne de premier niveau
    expect(all.some((r) => r.key === 'table:t1')).toBeFalse();
    expect(row(all, 'Table', 'a:t1|t2/t1').nested).toBeTrue();

    const shown = approach({ combinationId: 'c1213', tableIds: ['t12', 't13'], name: '12-13', level: 'NotAdvised' });
    const enriched = rows(snapshot, { placement: placement({ approaches: [shown] }) });
    expect(enriched.filter((r) => r.kind === 'Combination').length).toBe(1);
    expect(row(enriched, 'Combination', 'c:c1213')).toEqual(jasmine.objectContaining({
      temporary: false, approachKey: 'c1213', level: 'NotAdvised',
    }));
  });

  it('repeats a table shared by two shown combinations with distinct keys', () => {
    const snapshot = serviceSnapshot({
      zones: [serviceZone({
        tables: ['t12', 't13', 't14'].map((id) => serviceTable({ id, name: id.toUpperCase() })),
        agendaCombinations: [combination(), combination({ id: 'c1314', name: '13-14', tableIds: ['t13', 't14'] })],
      })],
    });
    const toggled = new Map([['c:c1213', true], ['c:c1314', true]]);

    const keys = rows(snapshot, { toggled }).map((r) => r.key);
    expect(keys).toEqual([
      'zone:z1',
      'c:c1213', 'c:c1213/link', 'c:c1213/t12', 'c:c1213/t13',
      'c:c1314', 'c:c1314/link', 'c:c1314/t13', 'c:c1314/t14',
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('orders groups before their first member and keeps zones apart', () => {
    const snapshot = serviceSnapshot({
      zones: [
        serviceZone({
          tables: ['t1', 't12', 't13', 't2'].map((id) => serviceTable({ id, name: id.toUpperCase() })),
          agendaCombinations: [combination()],
        }),
        serviceZone({ id: 'z2', name: 'Terrasse', tables: [serviceTable({ id: 't20', zoneId: 'z2', name: 'T20' })] }),
      ],
    });

    const all = rows(snapshot);
    expect(all.map((r) => r.key)).toEqual(['zone:z1', 'table:t1', 'c:c1213', 'c:c1213/link', 'table:t2', 'zone:z2', 'table:t20']);
    expect(row(all, 'Zone', 'zone:z2').name).toBe('Terrasse');
  });

  it('places a combination whose members are all claimed right after the one claiming its first member', () => {
    const snapshot = serviceSnapshot({
      zones: [serviceZone({
        tables: ['t1', 't2', 't3', 't4'].map((id) => serviceTable({ id, name: id.toUpperCase() })),
        agendaCombinations: [
          combination({ id: 'c23', name: '2-3', tableIds: ['t2', 't3'], isActive: false }),
          combination({ id: 'c12', name: '1-2', tableIds: ['t1', 't2'], isActive: false }),
          combination({ id: 'c13', name: '1-3', tableIds: ['t1', 't3'], isActive: false }),
        ],
      })],
    });

    // 1-2 réclame T1 et T2, 1-3 s'ancre sur T3, 2-3 n'a plus de membre libre : elle suit 1-2, qui tient T2
    expect(rows(snapshot).map((r) => r.key)).toEqual(['zone:z1', 'c:c12', 'c:c23', 'c:c13', 'table:t4']);
  });

  it('gives each row its placement level', () => {
    const snapshot = serviceSnapshot({
      zones: [serviceZone({
        tables: ['t1', 't12', 't13'].map((id) => serviceTable({ id, name: id.toUpperCase() })),
        agendaCombinations: [combination()],
      })],
    });
    const levels = placement({
      entities: [entity({ tableId: 't1', level: 'Perfect' }), entity({ combinationId: 'c1213', name: '12-13', level: 'NotAdvised' })],
    });

    const all = rows(snapshot, { placement: levels });
    expect(row(all, 'Table', 'table:t1').level).toBe('Perfect');
    expect(row(all, 'Combination', 'c:c1213').level).toBe('NotAdvised');

    const none = rows(snapshot, { toggled: new Map([['c:c1213', true]]) });
    expect(none.filter((r) => r.kind === 'Table' || r.kind === 'Combination').every((r) => r.level === null)).toBeTrue();
  });
});
