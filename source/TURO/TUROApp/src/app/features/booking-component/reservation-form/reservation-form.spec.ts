import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ApiError, ClientListItem, ReservationDetail, ServiceWindow } from '../../../models';
import { ReservationService } from '../../../core/services/reservation/reservation.service';
import { ClientService } from '../../../core/services/client/client.service';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { ClosureService } from '../../../core/services/closure/closure.service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { todayIn } from '../../../shared/utils/calendar-date';
import { ReservationFormMode, ReservationSaved } from '../reservation-draft';
import { ReservationForm } from './reservation-form';

const DINNER: ServiceWindow = { opening: '19:00:00', closing: '21:00:00', slotStep: 30, duration: 105, slots: ['19:00:00', '19:30:00', '20:00:00', '20:30:00'] };
const BOOKED = (change: Partial<ReservationDetail> = {}): ReservationDetail => ({
  id: 'r1', start: '2026-08-20T18:00:00Z', serviceDay: '2026-08-20', covers: 4, duration: 105, status: 'Confirmed', source: 'Web',
  note: null, preferredZoneId: null, preferredZoneName: null, createdAt: '2026-08-14T08:00:00Z', cancelledBy: null, version: 7,
  place: null, placeTooSmall: false, noShowFrom: '2026-08-20T18:15:00Z', events: [],
  client: { id: 'c1', name: 'Moreau', phone: '0612345678', allergies: null, tags: [], visitCount: 3, noShowCount: 0, atRisk: false, lastVisitDay: null },
  ...change,
});
const SOPHIE = { id: 'c2', name: 'Sophie Marchand', tags: ['Regular'], allergies: 'Fruits à coque', visitCount: 41, noShowCount: 2, atRisk: false } as ClientListItem;

describe('ReservationForm', () => {
  let fixture: ComponentFixture<ReservationForm>;
  let reservations: { slots: jasmine.Spy, create: jasmine.Spy, update: jasmine.Spy, detail: ReturnType<typeof signal<ReservationDetail | null>> };
  let clients: jasmine.SpyObj<ClientService>;
  let modal: jasmine.SpyObj<ModalService>;
  const today = todayIn('Europe/Paris');
  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent!.replace(/\s+/g, ' ');
  const button = (label: string) => Array.from(element().querySelectorAll('button')).find((b) => b.textContent!.trim() === label)!;
  const type = (field: string, value: string) => {
    const input = element().querySelector(`[data-field="${field}"] input, [data-field="${field}"] textarea`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const click = (selector: string) => {
    (element().querySelector(selector) as HTMLElement).click();
    fixture.detectChanges();
  };
  const open = async (mode: ReservationFormMode) => {
    fixture = TestBed.createComponent(ReservationForm);
    fixture.componentRef.setInput('mode', mode);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    reservations = {
      slots: jasmine.createSpy('slots').and.resolveTo({ value: [DINNER], error: null }),
      create: jasmine.createSpy('create'), update: jasmine.createSpy('update'),
      detail: signal<ReservationDetail | null>(null),
    };
    clients = jasmine.createSpyObj<ClientService>('ClientService', ['findExactPhone']);
    clients.findExactPhone.and.resolveTo(null);
    modal = jasmine.createSpyObj<ModalService>('ModalService', ['infoModal', 'confirmModal']);
    modal.infoModal.and.resolveTo();
    await TestBed.configureTestingModule({
      imports: [ReservationForm],
      providers: [
        { provide: ReservationService, useValue: reservations },
        { provide: ClientService, useValue: clients },
        { provide: RestaurantService, useValue: { model: signal({
          timeZone: 'Europe/Paris', defaultRotation: 120, zones: [{ id: 'z1', name: 'Terrasse' }],
          services: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => ({ day })),
        }) } },
        { provide: ClosureService, useValue: { closures: signal([]) } },
        { provide: ModalService, useValue: modal },
      ],
    }).compileComponents();
  });

  it('should ask in the order of the call: covers, date, time, then who', async () => {
    await open({ kind: 'create' });

    const fields = Array.from(element().querySelectorAll('[data-field]')).map((f) => f.getAttribute('data-field'));
    expect(fields).toEqual(['covers', 'date', 'time', 'phone', 'identity', 'note', 'duration', 'zone', 'source']);
    expect(text()).toContain('Nouvelle réservation');
  });

  it('should band the slots of the day, without colour, and take the duration of their service', async () => {
    await open({ kind: 'create' });

    expect(reservations.slots).toHaveBeenCalledWith(today);
    expect(text()).toContain('19:00 – 21:00');
    const slot = element().querySelector('[data-slot="20:00:00"]') as HTMLButtonElement;
    expect(slot.className).not.toMatch(/fit|amber/);
    slot.click();
    fixture.detectChanges();
    expect(element().querySelector('[data-duration]')!.textContent).toContain('1 h 45');
  });

  it('should say when the restaurant is closed that day', async () => {
    reservations.slots.and.resolveTo({ value: [], error: null });
    await open({ kind: 'create' });

    expect(element().querySelector('[data-closed]')!.textContent).toContain('fermé');
  });

  it('should recognize a whole number and show the allergy and the ratio while on the phone', fakeAsync(() => {
    clients.findExactPhone.and.resolveTo(SOPHIE);
    fixture = TestBed.createComponent(ReservationForm);
    fixture.componentRef.setInput('mode', { kind: 'create' });
    fixture.detectChanges();
    flushMicrotasks();

    type('phone', '06 12 34 56 78');
    tick(300);
    flushMicrotasks();
    fixture.detectChanges();

    expect(clients.findExactPhone).toHaveBeenCalledOnceWith('06 12 34 56 78');
    const card = element().querySelector('[data-known]')!;
    expect(card.textContent).toContain('Sophie Marchand');
    expect(card.textContent).toContain('2 / 41');
    expect(card.textContent).toContain('Fruits à coque');
    expect(element().querySelector('[data-field="identity"] input')).toBeNull();
  }));

  it('should send nothing without a time, a number and, for an unknown caller, a name', async () => {
    await open({ kind: 'create' });

    button('Créer').click();
    fixture.detectChanges();

    expect(reservations.create).not.toHaveBeenCalled();
    expect(text()).toContain('Choisissez une heure');
    expect(text()).toContain('Indiquez le numéro');
    expect(text()).toContain('Indiquez le nom');
  });

  it('should create with the chosen source, then go placing on « Créer et placer »', async () => {
    const result = { reservation: BOOKED(), eventId: 'e1' };
    reservations.create.and.resolveTo({ value: result, error: null });
    await open({ kind: 'create' });
    const saved: ReservationSaved[] = [];
    fixture.componentInstance.saved.subscribe((event) => saved.push(event));

    click('[data-covers="4"]');
    click('[data-slot="20:00:00"]');
    type('phone', '06 11 11 11 11');
    type('identity', 'Julien');
    click('[data-source="WalkIn"]');
    button('Créer et placer').click();
    await fixture.whenStable();

    expect(reservations.create).toHaveBeenCalledOnceWith({
      serviceDay: today, time: '20:00:00', covers: 4, duration: null, note: null, preferredZoneId: null, source: 'WalkIn',
      phone: '06 11 11 11 11', name: 'Julien', email: null, version: null,
    });
    expect(saved[0].result).toBe(result);
    expect(saved[0].mode).toBe('create');
    expect(saved[0].thenPlace).toBeTrue();
    expect(saved[0].draft.name).toBe('Julien');
  });

  it('should modify without identity nor source, sending the version read at opening', async () => {
    reservations.update.and.resolveTo({ value: { reservation: BOOKED({ covers: 6 }), eventId: 'e2' }, error: null });
    await open({ kind: 'edit', reservation: BOOKED() });

    expect(text()).toContain('Modifier la réservation');
    expect(text()).toContain('Moreau');
    expect(element().querySelector('[data-field="source"]')).toBeNull();
    expect(element().querySelector('[data-field="phone"]')).toBeNull();
    click('[data-covers="6"]');
    button('Enregistrer').click();
    await fixture.whenStable();

    expect(reservations.update).toHaveBeenCalledOnceWith('r1', jasmine.objectContaining({ covers: 6, time: '20:00:00', version: 7 }));
  });

  it('should keep the day and the time of a seated table', async () => {
    await open({ kind: 'edit', reservation: BOOKED({ status: 'Seated' }) });

    expect((element().querySelector('[data-slot="19:00:00"]') as HTMLButtonElement).disabled).toBeTrue();
    expect(element().querySelector('[data-field="date"] input')!.hasAttribute('disabled')).toBeTrue();
  });

  it('should offer to reload when another device changed the reservation', async () => {
    reservations.update.and.resolveTo({ value: null, error: 'This reservation was changed on another device.', code: ApiError.ReservationChanged });
    modal.confirmModal.and.resolveTo(true);
    await open({ kind: 'edit', reservation: BOOKED() });
    reservations.detail.set(BOOKED({ covers: 8, version: 9 }));

    button('Enregistrer').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(modal.confirmModal.calls.mostRecent().args[2]).toBe('Recharger');
    reservations.update.and.resolveTo({ value: { reservation: BOOKED({ covers: 8 }), eventId: null }, error: null });
    button('Enregistrer').click();
    await fixture.whenStable();
    expect(reservations.update.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ covers: 8, version: 9 }));
  });

  it('should reopen on the draft it is given, after an undone creation', async () => {
    await open({ kind: 'create', draft: { covers: 5, phone: '07 00 00 00 02', name: 'Léa', time: '19:30:00' } });

    expect(element().querySelector('[data-covers="5"]')!.className).toContain('bg-slate');
    expect(element().querySelector('[data-slot="19:30:00"]')!.className).toContain('bg-slate');
    expect((element().querySelector('[data-field="identity"] input') as HTMLInputElement).value).toBe('Léa');
  });
});
