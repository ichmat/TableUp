import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ClientDetail, ReservationDetail } from '../../models';
import { ReservationService } from '../../core/services/reservation/reservation.service';
import { ClientService } from '../../core/services/client/client.service';
import { BookingComponent } from './booking-component';
import { ReservationActions } from './reservation-actions';
import { ReservationFormMode, ReservationSaved } from './reservation-draft';

@Component({ selector: 'app-reservation-form', template: 'FORM {{ mode().kind }}' })
class FormStub { mode = input.required<ReservationFormMode>(); saved = output<ReservationSaved>(); cancelled = output<void>(); }

@Component({ selector: 'app-reservation-list', template: 'LIST' })
class ListStub { selectedId = input<string | null>(null); opened = output<string>(); create = output<void>(); }
@Component({ selector: 'app-reservation-sheet', template: 'RESERVATION {{ origin() }}' })
class SheetStub { origin = input<string | null>(null); closed = output<void>(); back = output<void>(); edit = output<unknown>(); openClient = output<{ id: string, origin: string }>(); }
@Component({ selector: 'app-client-sheet', template: 'CLIENT {{ readOnly() }} {{ origin() }}' })
class ClientStub {
  client = input<ClientDetail | null>(null); failed = input(false); readOnly = input(false); origin = input<string | null>(null);
  edit = output<void>(); closed = output<void>(); back = output<void>(); openReservation = output<string>();
  newReservation = output<void>(); openInClients = output<void>();
}

type Page = {
  open(id: string): void, openClient(e: { id: string, origin: string }): void, openReservation(id: string): void,
  back(): void, close(): void, openInClients(id: string): void,
  startCreate(): void, startEdit(r: ReservationDetail): void, onSaved(e: ReservationSaved): void,
};

describe('BookingComponent', () => {
  let fixture: ComponentFixture<BookingComponent>;
  const selectedId = signal<string | null>(null);
  const clientId = signal<string | null>(null);
  const client = signal<ClientDetail | null>({ id: 'c1', name: 'Sophie Marchand' } as ClientDetail);
  const reservations = {
    selectedId, select: (id: string | null) => selectedId.set(id),
    clientId, selectClient: (id: string | null) => clientId.set(id), client, clientFailed: signal(false),
  };
  const clientSelect = jasmine.createSpy('select');
  const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
  const saved = jasmine.createSpy('saved');
  const reopened = signal<ReservationFormMode | null>(null);
  const actions = { saved, reopened, takeReopened: () => { const mode = reopened(); reopened.set(null); return mode; } };
  const text = () => (fixture.nativeElement as HTMLElement).textContent!;
  const page = () => fixture.componentInstance as unknown as Page;

  beforeEach(async () => {
    selectedId.set(null);
    clientId.set(null);
    clientSelect.calls.reset();
    saved.calls.reset();
    reopened.set(null);
    router.navigate.and.resolveTo(true);
    await TestBed.configureTestingModule({
      imports: [BookingComponent],
      providers: [
        { provide: ReservationService, useValue: reservations },
        { provide: ClientService, useValue: { select: clientSelect } },
        { provide: Router, useValue: router },
        { provide: ReservationActions, useValue: actions },
      ],
    }).overrideComponent(BookingComponent, { set: { imports: [ListStub, SheetStub, ClientStub, FormStub] } }).compileComponents();
    fixture = TestBed.createComponent(BookingComponent);
    fixture.detectChanges();
  });

  it('should show the list alone until a line is opened', () => {
    expect(text()).not.toContain('RESERVATION');

    page().open('r1');
    fixture.detectChanges();

    expect(selectedId()).toBe('r1');
    expect(text()).toContain('RESERVATION');
  });

  it('should replace the reservation by its client, read only, with the way back named', () => {
    page().open('r1');
    page().openClient({ id: 'c1', origin: 'Réservation de jeudi 20:00' });
    fixture.detectChanges();

    expect(clientId()).toBe('c1');
    expect(text()).toContain('CLIENT true Réservation de jeudi 20:00');
    expect(text()).not.toContain('RESERVATION');

    page().back();
    fixture.detectChanges();
    expect(text()).toContain('RESERVATION');
  });

  it('should open a reservation of the client history, named after the client', () => {
    page().open('r1');
    page().openClient({ id: 'c1', origin: 'Réservation de jeudi 20:00' });
    page().openReservation('r2');
    fixture.detectChanges();

    expect(selectedId()).toBe('r2');
    expect(text()).toContain('RESERVATION Sophie Marchand');
  });

  it('should hand a client over to the clients screen', () => {
    page().openInClients('c1');

    expect(clientSelect).toHaveBeenCalledOnceWith('c1');
    expect(router.navigate).toHaveBeenCalledOnceWith(['/clients']);
  });

  it('should close the panel', () => {
    page().open('r1');
    page().close();
    fixture.detectChanges();

    expect(selectedId()).toBeNull();
    expect(text()).not.toContain('RESERVATION');
  });
  it('should open the form in the panel, then the sheet of what was created, offering to undo', () => {
    page().open('r1');
    page().startCreate();
    fixture.detectChanges();
    expect(text()).toContain('FORM create');
    expect(text()).not.toContain('RESERVATION');

    const event = { result: { reservation: { id: 'r9' } as ReservationDetail, eventId: 'e1' }, draft: {} as never, mode: 'create', thenPlace: false } as ReservationSaved;
    page().onSaved(event);
    fixture.detectChanges();

    expect(selectedId()).toBe('r9');
    expect(text()).toContain('RESERVATION');
    expect(saved).toHaveBeenCalledOnceWith(event);
  });

  it('should take back the form of an undone creation, without the deleted reservation behind it', () => {
    page().open('r9');
    fixture.detectChanges();

    // « Annuler » dans le bandeau, ici ou depuis le Service d'où l'on revient
    reopened.set({ kind: 'create', draft: { covers: 4 } });
    fixture.detectChanges();

    expect(text()).toContain('FORM create');
    expect(reopened()).toBeNull();
    expect(selectedId()).toBeNull();
    const form = fixture.debugElement.query((d) => d.name === 'app-reservation-form').componentInstance as FormStub;
    form.cancelled.emit();
    fixture.detectChanges();
    expect(text()).not.toContain('RESERVATION');
  });

  it('should modify the open reservation in the same panel', () => {
    page().open('r1');
    page().startEdit({ id: 'r1' } as ReservationDetail);
    fixture.detectChanges();

    expect(text()).toContain('FORM edit');
  });
});
