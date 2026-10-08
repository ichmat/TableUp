import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, output, signal } from '@angular/core';
import { ClientDetail, ReservationDetail } from '../../models';
import { ClientService } from '../../core/services/client/client.service';
import { ReservationService } from '../../core/services/reservation/reservation.service';
import { ClientsComponent } from './clients-component';
import { ReservationActions } from '../booking-component/reservation-actions';
import { ReservationFormMode, ReservationSaved } from '../booking-component/reservation-draft';

@Component({ selector: 'app-reservation-form', template: 'FORM {{ mode().kind }}' })
class ReservationFormStub { mode = input.required<ReservationFormMode>(); saved = output<ReservationSaved>(); cancelled = output<void>(); }

@Component({ selector: 'app-client-list', template: '' })
class ListStub { selectedId = input<string | null>(null); opened = output<string>(); create = output<void>(); }
@Component({ selector: 'app-client-sheet', template: 'SHEET' })
class SheetStub {
  client = input<ClientDetail | null>(null); failed = input(false); readOnly = input(false); origin = input<string | null>(null);
  edit = output<void>(); closed = output<void>(); back = output<void>(); openReservation = output<string>();
  newReservation = output<void>(); openInClients = output<void>();
}
@Component({ selector: 'app-reservation-sheet', template: 'RESERVATION {{ origin() }}' })
class ReservationSheetStub { origin = input<string | null>(null); closed = output<void>(); back = output<void>(); edit = output<unknown>(); openClient = output<{ id: string, origin: string }>(); }
@Component({ selector: 'app-client-form', template: 'FORM' })
class FormStub { client = input<ClientDetail | null>(null); saved = output<ClientDetail>(); cancelled = output<void>(); openClient = output<string>(); }

type Page = {
  open(id: string): void, startCreate(): void, startEdit(): void, onSaved(c: ClientDetail): void,
  openReservation(id: string): void, closeReservation(): void,
  startReservation(): void, onReservationSaved(e: ReservationSaved): void,
};

describe('ClientsComponent', () => {
  let fixture: ComponentFixture<ClientsComponent>;
  const selectedId = signal<string | null>(null);
  const detail = signal<ClientDetail | null>(null);
  const clients = { selectedId, detail, detailFailed: signal(false), select: (id: string | null) => selectedId.set(id) };
  const reservationSelect = jasmine.createSpy('select');
  const saved = jasmine.createSpy('saved');
  const text = () => (fixture.nativeElement as HTMLElement).textContent!;
  const page = () => fixture.componentInstance as unknown as Page;

  beforeEach(async () => {
    selectedId.set(null);
    detail.set(null);
    await TestBed.configureTestingModule({
      imports: [ClientsComponent],
      providers: [
        { provide: ClientService, useValue: clients },
        { provide: ReservationService, useValue: { select: reservationSelect } },
        { provide: ReservationActions, useValue: { saved } },
      ],
    }).overrideComponent(ClientsComponent, { set: { imports: [ListStub, SheetStub, FormStub, ReservationSheetStub, ReservationFormStub] } }).compileComponents();

    fixture = TestBed.createComponent(ClientsComponent);
    fixture.detectChanges();
  });

  it('should show the list alone until a client is opened', () => {
    expect(text()).not.toContain('SHEET');

    page().open('c1');
    fixture.detectChanges();

    expect(selectedId()).toBe('c1');
    expect(text()).toContain('SHEET');
  });

  it('should open an empty form for a new client, then its sheet once saved', () => {
    page().open('c1');
    page().startCreate();
    fixture.detectChanges();
    expect(selectedId()).toBeNull();
    expect(text()).toContain('FORM');

    page().onSaved({ id: 'c9' } as ClientDetail);
    fixture.detectChanges();
    expect(selectedId()).toBe('c9');
    expect(text()).toContain('SHEET');
  });

  it('should edit the loaded client in the same panel', () => {
    page().open('c1');
    detail.set({ id: 'c1' } as ClientDetail);
    page().startEdit();
    fixture.detectChanges();

    expect(text()).toContain('FORM');
    expect(text()).not.toContain('SHEET');
  });
  it('should open a reservation of the history in the same panel, and come back to the client', () => {
    page().open('c1');
    detail.set({ id: 'c1', name: 'Sophie Marchand' } as ClientDetail);
    page().openReservation('r1');
    fixture.detectChanges();

    expect(reservationSelect).toHaveBeenCalledWith('r1');
    expect(text()).toContain('RESERVATION Sophie Marchand');
    expect(text()).not.toContain('SHEET');

    page().closeReservation();
    fixture.detectChanges();
    expect(text()).toContain('SHEET');
  });
  it('should start a reservation from the client sheet, with the client already known', () => {
    page().open('c1');
    detail.set({ id: 'c1', name: 'Sophie Marchand', phones: ['0612345678'] } as ClientDetail);
    page().startReservation();
    fixture.detectChanges();

    expect(text()).toContain('FORM create');
    const mode = (fixture.debugElement.query((d) => d.name === 'app-reservation-form').componentInstance as ReservationFormStub).mode();
    expect(mode).toEqual({ kind: 'create', draft: { phone: '06 12 34 56 78', name: 'Sophie Marchand' } });

    page().onReservationSaved({ result: { reservation: { id: 'r9' } as ReservationDetail, eventId: 'e1' }, draft: {} as never, mode: 'create', thenPlace: false });
    fixture.detectChanges();
    expect(reservationSelect).toHaveBeenCalledWith('r9');
    expect(text()).toContain('RESERVATION Sophie Marchand');
  });
});
