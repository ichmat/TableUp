import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ReservationDetail } from '../../../models';
import { ReservationService } from '../../../core/services/reservation/reservation.service';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { ReservationActions } from '../reservation-actions';
import { ReservationSheet } from './reservation-sheet';

const HOUR = 3600_000;
const SHEET = (change: Partial<ReservationDetail> = {}): ReservationDetail => ({
  id: 'r1', start: '2026-08-20T18:30:00Z', serviceDay: '2026-08-20', covers: 4, duration: 105, status: 'Confirmed', source: 'Web',
  note: 'anniversaire', preferredZoneId: 'z1', preferredZoneName: 'Salle', createdAt: '2026-08-14T08:02:00Z', cancelledBy: null, version: 3,
  place: null, placeTooSmall: false, noShowFrom: new Date(Date.now() + HOUR).toISOString(),
  client: { id: 'c1', name: 'Moreau', phone: '0612345678', allergies: 'Fruits à coque', tags: [], visitCount: 12, noShowCount: 1, atRisk: false, lastVisitDay: '2026-06-14' },
  events: [
    { id: 'e0', timestamp: '2026-08-14T08:02:00Z', type: 'Creation', authorLogin: null, details: 'web' },
    { id: 'e1', timestamp: '2026-08-14T08:14:00Z', type: 'Acceptance', authorLogin: 'camille', details: null },
  ],
  ...change,
});

describe('ReservationSheet', () => {
  let fixture: ComponentFixture<ReservationSheet>;
  let actions: jasmine.SpyObj<ReservationActions>;
  const detail = signal<ReservationDetail | null>(SHEET());
  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent!.replace(/\s+/g, ' ');
  // Les boutons du bloc d'actions, dans l'ordre du DOM : leur position est la règle (FICHE-03)
  const buttons = () => Array.from(element().querySelectorAll('[data-block="actions"] button')).map((b) => b.textContent!.trim());
  const button = (label: string) => Array.from(element().querySelectorAll('button')).find((b) => b.textContent!.trim() === label)!;
  const show = (sheet: ReservationDetail) => {
    detail.set(sheet);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    detail.set(SHEET());
    actions = jasmine.createSpyObj<ReservationActions>('ReservationActions', ['run', 'cancel', 'place']);
    actions.run.and.callFake(async () => detail());
    actions.cancel.and.resolveTo(null);
    await TestBed.configureTestingModule({
      imports: [ReservationSheet],
      providers: [
        { provide: ReservationService, useValue: { detail, detailFailed: signal(false) } },
        { provide: RestaurantService, useValue: { model: signal({ timeZone: 'Europe/Paris' }) } },
        { provide: ReservationActions, useValue: actions },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ReservationSheet);
    fixture.detectChanges();
  });

  it('should stack identity, allergy, client, details, journal and actions in that order', () => {
    const blocks = Array.from(element().querySelectorAll('[data-block]')).map((b) => b.getAttribute('data-block'));

    expect(blocks).toEqual(['identity', 'allergy', 'client', 'details', 'journal', 'actions']);
    expect(text()).toContain('4 personnes · jeudi 20 août · 20:30');
    expect(text()).toContain('CONFIRMÉE');
    expect(text()).toContain('Fruits à coque');
    expect(text()).toContain('12 visites · 1 no-show · dernière le 14/06 · 06 12 34 56 78');
    expect(text()).toContain('« anniversaire »');
    expect(text()).toContain('1 h 45');
    expect(text()).toContain('14/08 10:14 · Acceptée · camille');
    expect(text()).toContain('14/08 10:02 · Création · web · système');
  });

  it('should pin no allergy and no client band for a walk-in', () => {
    show(SHEET({ client: null }));

    expect(text()).toContain('Client de passage');
    expect(element().querySelector('[data-block="allergy"]')).toBeNull();
    expect(element().querySelector('[data-block="client"]')).toBeNull();
  });

  it('should keep the three buttons of a request in the same order, the first one orange', () => {
    show(SHEET({ status: 'Pending' }));

    expect(buttons().slice(0, 3)).toEqual(['Accepter et placer à une table', 'Accepter', 'Refuser']);
    expect(button('Accepter et placer à une table').className).toContain('bg-interactive');
  });

  it('should deduce one main action, orange only for what is still to do', () => {
    expect(button('Placer à une table').className).toContain('bg-interactive');

    show(SHEET({ place: { name: '3', capacity: 4 } }));
    expect(button("Marquer l'arrivée").className).not.toContain('bg-interactive');

    show(SHEET({ status: 'Seated', place: { name: '12', capacity: 4 } }));
    expect(button('Libérer la table')).toBeDefined();
    expect(buttons()).not.toContain('Annuler la réservation');

    show(SHEET({ status: 'NoShow' }));
    expect(buttons()).toEqual(['Rouvrir']);
  });

  it('should offer « No-show » only once the late grace has passed', () => {
    expect(buttons()).not.toContain('No-show');

    show(SHEET({ noShowFrom: new Date(Date.now() - 60_000).toISOString() }));
    button('No-show').click();

    expect(actions.run).toHaveBeenCalledOnceWith('r1', 'no-show');
  });

  it('should ask who cancels in place, without a popup', async () => {
    button('Annuler la réservation').click();
    fixture.detectChanges();
    button('Le restaurant annule').click();
    await fixture.whenStable();

    expect(actions.cancel).toHaveBeenCalledOnceWith('r1', 'Restaurant');
  });

  it('should accept then go and place', async () => {
    show(SHEET({ status: 'Pending' }));
    button('Accepter et placer à une table').click();
    await fixture.whenStable();

    expect(actions.run).toHaveBeenCalledOnceWith('r1', 'accept');
    expect(actions.place).toHaveBeenCalledOnceWith('2026-08-20', 'r1');
  });

  it('should keep the table and say it is too small', () => {
    show(SHEET({ covers: 6, place: { name: '12', capacity: 4 }, placeTooSmall: true }));

    expect(text()).toContain('La table 12 ne suffit plus');
  });

  it('should open the client sheet, naming where to come back, and come back by the arrow', () => {
    const opened = jasmine.createSpy('openClient');
    const back = jasmine.createSpy('back');
    fixture.componentInstance.openClient.subscribe(opened);
    fixture.componentInstance.back.subscribe(back);
    fixture.componentRef.setInput('origin', 'Sophie Marchand');
    fixture.detectChanges();

    button('Fiche client').click();
    button('← Sophie Marchand').click();

    expect(opened).toHaveBeenCalledOnceWith({ id: 'c1', origin: 'Réservation de jeudi 20:30' });
    expect(back).toHaveBeenCalled();
  });

  it('should keep the placement buttons where they are, dimmed, until placement exists on the service screen', () => {
    fixture.componentRef.setInput('placementAvailable', false);
    show(SHEET({ status: 'Pending' }));

    expect(buttons().slice(0, 3)).toEqual(['Accepter et placer à une table', 'Accepter', 'Refuser']);
    expect(button('Accepter et placer à une table').disabled).toBeTrue();
    expect(button('Accepter').disabled).toBeFalse();
    expect(element().querySelector('[title="Le placement arrive avec le lot suivant"]')).not.toBeNull();

    show(SHEET({ status: 'Confirmed', place: null }));
    expect(button('Placer à une table').disabled).toBeTrue();
  });
});
