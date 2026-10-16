import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Combination, Placement, PlacementApproach, PlacementEntity, ServiceSnapshot } from '../../../models';
import { approachKey } from '../approach-list/approach-list';
import { DropTarget } from '../placement-drag';
import { occupation, serviceSnapshot, serviceTable, serviceZone, utc } from '../testing/service-fixtures';
import { ServiceAgenda } from './service-agenda';

const now = Date.parse(utc('20:40'));

function combination(change: Partial<Combination> = {}): Combination {
  return {
    id: 'c1213', zoneId: 'z1', name: '12-13', capacity: 8, tableIds: ['t12', 't13'], isActive: true, activateAt: null, deactivateAt: null,
    ...change,
  };
}

function approach(change: Partial<PlacementApproach> = {}): PlacementApproach {
  return {
    combinationId: null, tableIds: ['t1', 't2'], zoneId: 'z1', name: '1-2', capacity: 8, level: 'WithReserve', reasons: [], next: null,
    distance: 1, ...change,
  };
}

function placement(change: Partial<Placement> = {}): Placement {
  return {
    reservationId: 'r9', guestName: 'Durand', start: utc('21:00'), end: utc('23:00'), covers: 2, note: null, preferredZoneId: null,
    entities: [], approaches: [], ...change,
  };
}

describe('ServiceAgenda', () => {
  let fixture: ComponentFixture<ServiceAgenda>;
  const element = () => fixture.nativeElement as HTMLElement;
  const all = (selector: string) => Array.from(element().querySelectorAll<HTMLElement>(selector));

  function render(snapshot: ServiceSnapshot, inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(ServiceAgenda);
    fixture.componentRef.setInput('snapshot', snapshot);
    fixture.componentRef.setInput('now', now);
    fixture.componentRef.setInput('timeZone', 'UTC');
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.detectChanges();
  }

  it('draws one row per table grouped by zone', () => {
    render(serviceSnapshot({
      zones: [
        serviceZone({ id: 'z1', name: 'Salle', tables: [serviceTable({ id: 't1', name: 'T1' }), serviceTable({ id: 't2', name: 'T2' })] }),
        serviceZone({ id: 'z2', name: 'Terrasse', tables: [serviceTable({ id: 't20', name: 'T20' }), serviceTable({ id: 't21', name: 'T21' })] }),
        serviceZone({ id: 'z3', name: 'Cave', tables: [] }),
      ],
    }));

    const order = all('[data-zone-row], [data-table-id]').map((e) => e.getAttribute('data-zone-row') ?? e.getAttribute('data-table-id'));
    expect(order).toEqual(['Salle', 't1', 't2', 'Terrasse', 't20', 't21', 'Cave']);
    expect(element().querySelector('[data-table-id="t1"]')!.textContent).toContain('T1 · 4p');
  });

  it('places a block at its time and width', () => {
    render(serviceSnapshot({ zones: [serviceZone({ tables: [serviceTable({ occupations: [occupation()] })] })] }));

    const block = element().querySelector<HTMLElement>('[data-block]')!;
    const left = parseFloat(block.style.left);
    const width = parseFloat(block.style.width);
    // 20:00 → 22:00 sur un axe 19:00 → 23:00 : une heure d'écart, deux heures de large, au moins 3 px par minute
    expect(block.style.left).toMatch(/px$/);
    expect(block.style.width).toMatch(/px$/);
    expect(left).toBeGreaterThanOrEqual(60 * 3);
    expect(width).toBeCloseTo(2 * left, 3);
    expect(block.textContent).toContain('Moreau · 4p');
    expect(all('[data-hour]').map((e) => e.textContent!.trim())).toEqual(['19:00', '20:00', '21:00', '22:00', '23:00']);
  });

  it('draws the now line only inside the axis', () => {
    render(serviceSnapshot());
    expect(element().querySelector('[data-now]')).not.toBeNull();

    const base = serviceSnapshot();
    render(serviceSnapshot({ now: '2026-10-11T12:00:00Z', service: { ...base.service!, state: 'Finished' } }));
    expect(element().querySelector('[data-now]')).toBeNull();
  });

  it('toggles a combination with its chevron', () => {
    render(serviceSnapshot({
      zones: [serviceZone({
        tables: [serviceTable({ id: 't12', name: 'T12' }), serviceTable({ id: 't13', name: 'T13' })],
        agendaCombinations: [combination()],
      })],
    }));
    const chevron = () => element().querySelector<HTMLButtonElement>('[data-chevron]')!;
    expect(chevron().getAttribute('aria-expanded')).toBe('false');
    expect(element().querySelector('[data-table-id="t12"]')).toBeNull();
    expect(element().querySelector('[data-combination-id="c1213"]')!.textContent).toContain('2 tables');

    chevron().click();
    fixture.detectChanges();

    expect(chevron().getAttribute('aria-expanded')).toBe('true');
    expect(all('[data-table-id]').map((e) => e.getAttribute('data-table-id'))).toEqual(['t12', 't13']);
  });

  it('opens a reservation from its block', () => {
    render(serviceSnapshot({ zones: [serviceZone({ tables: [serviceTable({ occupations: [occupation({ reservationId: 'r1' })] })] })] }));
    const opened = jasmine.createSpy('opened');
    const pressed = jasmine.createSpy('rowPressed');
    fixture.componentInstance.opened.subscribe(opened);
    fixture.componentInstance.rowPressed.subscribe(pressed);

    element().querySelector<HTMLElement>('[data-block]')!.click();
    expect(opened).toHaveBeenCalledOnceWith('r1');
    expect(pressed).not.toHaveBeenCalled();

    // Pendant un placement, toucher une ligne la choisit, comme toucher une table allumée du plan
    fixture.componentRef.setInput('placement', placement());
    fixture.detectChanges();
    element().querySelector<HTMLElement>('[data-table-id="t1"] [data-track]')!.click();

    expect(pressed).toHaveBeenCalledOnceWith({ tableId: 't1' });

    // Le bloc aussi : pendant un placement, c'est la ligne qui compte, la fiche ne s'ouvre pas
    element().querySelector<HTMLElement>('[data-block]')!.click();
    expect(pressed).toHaveBeenCalledTimes(2);
    expect(pressed.calls.mostRecent().args).toEqual([{ tableId: 't1' }]);
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('carries the placement halo on the label and the track', () => {
    const entity = (tableId: string, level: PlacementEntity['level']): PlacementEntity =>
      ({ tableId, combinationId: null, zoneId: 'z1', name: tableId, capacity: 4, level, reasons: [], next: null });
    render(serviceSnapshot({
      zones: [serviceZone({ tables: [serviceTable({ id: 't1', name: 'T1' }), serviceTable({ id: 't2', name: 'T2' })] })],
    }), { placement: placement({ entities: [entity('t1', 'Perfect'), entity('t2', 'Excluded')] }) });

    const perfect = element().querySelector<HTMLElement>('[data-table-id="t1"]')!;
    expect(perfect.querySelector('[data-level]')!.getAttribute('class')).toContain('bg-place-perfect');
    expect(perfect.querySelector('[data-track]')!.getAttribute('class')).toContain('ring-place-perfect');
    expect(perfect.getAttribute('class')).not.toContain('opacity-40');

    const excluded = element().querySelector<HTMLElement>('[data-table-id="t2"]')!;
    expect(excluded.getAttribute('class')).toContain('opacity-40');
    expect(excluded.querySelector('[data-level]')).toBeNull();
    expect(excluded.querySelector('[data-track]')!.getAttribute('class')).not.toContain('place-');
  });

  it('opens the real reservation from a ghost band', () => {
    const viaCombination = occupation({ reservationId: 'r5', placeName: '12-13', combinationId: 'c1213', guestName: 'Lefèvre', covers: 7 });
    render(serviceSnapshot({
      zones: [serviceZone({
        tables: [
          // La 12 a eu une réservation seule : la combinaison est dépliée d'office
          serviceTable({ id: 't12', name: 'T12', occupations: [occupation({ reservationId: 'r6', start: utc('19:00'), end: utc('19:45') }), viaCombination] }),
          serviceTable({ id: 't13', name: 'T13', occupations: [viaCombination] }),
        ],
        agendaCombinations: [combination()],
      })],
    }));
    const opened = jasmine.createSpy('opened');
    fixture.componentInstance.opened.subscribe(opened);

    const ghost = element().querySelector<HTMLElement>('[data-table-id="t13"] [data-ghost]')!;
    expect(ghost.textContent).toContain('via 12-13');
    ghost.click();

    expect(opened).toHaveBeenCalledOnceWith('r5');
  });

  it('exposes drop targets', () => {
    const consoleWarn = spyOn(console, 'warn').and.callThrough();
    const consoleError = spyOn(console, 'error').and.callThrough();
    const solo = (id: string) => occupation({ reservationId: id, start: utc('19:00'), end: utc('19:45') });
    const proposed = approach();
    render(serviceSnapshot({
      zones: [serviceZone({
        tables: [
          serviceTable({ id: 't1', name: 'T1' }),
          serviceTable({ id: 't2', name: 'T2' }),
          serviceTable({ id: 't12', name: 'T12', occupations: [solo('r12')] }),
          serviceTable({ id: 't13', name: 'T13' }),
          serviceTable({ id: 't14', name: 'T14', occupations: [solo('r14')] }),
        ],
        agendaCombinations: [combination(), combination({ id: 'c1314', name: '13-14', tableIds: ['t13', 't14'] })],
      })],
    }), { placement: placement({ approaches: [proposed] }) });

    expect(element().querySelector('[data-combination-id="c1213"]')).not.toBeNull();
    expect(element().querySelector('[data-combination-id="c1314"]')).not.toBeNull();
    const temporary = element().querySelector(`[data-approach-key="${approachKey(proposed)}"]`)!;
    expect(temporary).not.toBeNull();
    expect(temporary.hasAttribute('data-combination-id')).toBeFalse();
    // Un contour pointillé, pas une bordure qui décalerait la piste
    expect(temporary.getAttribute('class')).toContain('outline-dashed');
    expect(temporary.getAttribute('class')).not.toContain('border-dashed');
    // La 13 appartient aux deux combinaisons dépliées : sa ligne apparaît sous chacune
    expect(all('[data-table-id="t13"]').length).toBe(2);
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('previews the drop on the hovered row', () => {
    render(serviceSnapshot({
      zones: [serviceZone({ tables: [serviceTable({ id: 't20', name: 'T20' }), serviceTable({ id: 't21', name: 'T21' })] })],
    }), { placement: placement() });

    const hovered: DropTarget = { tableId: 't21' };
    fixture.componentRef.setInput('hovered', hovered);
    fixture.detectChanges();

    const preview = element().querySelector<HTMLElement>('[data-table-id="t21"] [data-drop-preview]');
    expect(preview).not.toBeNull();
    expect(preview!.textContent).toContain('Durand · 2p');
    expect(element().querySelector('[data-table-id="t20"] [data-drop-preview]')).toBeNull();

    // Un nouvel objet de même valeur ne change rien ; sans placement, pas d'aperçu
    fixture.componentRef.setInput('hovered', { tableId: 't21' });
    fixture.detectChanges();
    expect(all('[data-drop-preview]').length).toBe(1);
    fixture.componentRef.setInput('placement', null);
    fixture.detectChanges();
    expect(element().querySelector('[data-drop-preview]')).toBeNull();
  });

  it('says so when there is no service', () => {
    render(serviceSnapshot({ service: null }));

    expect(element().textContent).toContain('Aucun service à afficher pour ce jour.');
    expect(element().querySelector('[data-table-id]')).toBeNull();
  });

  it('isolates its stacking context so the sticky axis stays under outside overlays', () => {
    render(serviceSnapshot());

    expect(element().querySelector('[data-agenda]')!.classList).toContain('isolate');
  });

  it('shows the plan message when the service has no room at all', () => {
    render(serviceSnapshot({ zones: [] }));

    expect(element().querySelector('[data-no-zone]')!.textContent)
      .toContain("Aucune salle pour l'instant : le plan se dessine dans Paramètres › Plan de salle.");
    expect(element().querySelector('[data-hour]')).toBeNull();
  });

  it('resets the scroll on another service without a present, and re-centres on one seen again', async () => {
    fixture = TestBed.createComponent(ServiceAgenda);
    const host = element();
    host.style.width = '300px';
    host.style.height = '200px';
    document.body.appendChild(host);
    try {
      fixture.componentRef.setInput('snapshot', serviceSnapshot());
      fixture.componentRef.setInput('now', now);
      fixture.componentRef.setInput('timeZone', 'UTC');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const scroller = host.querySelector<HTMLElement>('[data-agenda]')!;
      expect(scroller.scrollLeft).toBeGreaterThan(0);

      const base = serviceSnapshot();
      const finished = serviceSnapshot({ day: '2026-10-12', now: '2026-10-12T12:00:00Z', service: { ...base.service!, state: 'Finished' } });
      fixture.componentRef.setInput('snapshot', finished);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(scroller.scrollLeft).toBe(0);

      scroller.scrollLeft = 0;
      fixture.componentRef.setInput('snapshot', serviceSnapshot());
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(scroller.scrollLeft).toBeGreaterThan(0);
    } finally {
      host.remove();
    }
  });
});
