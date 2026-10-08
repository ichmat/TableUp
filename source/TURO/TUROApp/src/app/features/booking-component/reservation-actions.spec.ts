import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { ReservationDetail } from '../../models';
import { ReservationService } from '../../core/services/reservation/reservation.service';
import { UndoService } from '../../core/services/undo/undo.service';
import { ModalService } from '../../core/services/modal/modal.service';
import { RestaurantService } from '../../core/services/restaurant/restaurant-service';
import { ReservationActions } from './reservation-actions';

const AFTER = { id: 'r1', status: 'Confirmed', client: { name: 'Moreau' }, place: null } as ReservationDetail;

describe('ReservationActions', () => {
  let actions: ReservationActions;
  let reservations: jasmine.SpyObj<ReservationService>;
  let undo: jasmine.SpyObj<UndoService>;
  let modal: jasmine.SpyObj<ModalService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    reservations = jasmine.createSpyObj<ReservationService>('ReservationService', ['act', 'cancel']);
    undo = jasmine.createSpyObj<UndoService>('UndoService', ['offer']);
    modal = jasmine.createSpyObj<ModalService>('ModalService', ['infoModal']);
    modal.infoModal.and.resolveTo();
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: ReservationService, useValue: reservations },
        { provide: UndoService, useValue: undo },
        { provide: ModalService, useValue: modal },
        { provide: Router, useValue: router },
        { provide: RestaurantService, useValue: { model: signal({ timeZone: 'Europe/Paris' }) } },
      ],
    });
    actions = TestBed.inject(ReservationActions);
  });

  it('should act at once and offer to undo, naming what was done', async () => {
    reservations.act.and.resolveTo({ value: { reservation: AFTER, eventId: 'e1' }, error: null });

    const after = await actions.run('r1', 'accept');

    expect(after).toBe(AFTER);
    expect(reservations.act).toHaveBeenCalledOnceWith('r1', 'accept');
    expect(undo.offer).toHaveBeenCalledOnceWith({ message: 'Moreau acceptée', reservationId: 'r1', eventId: 'e1' });
  });

  it('should show a refusal and offer nothing', async () => {
    reservations.act.and.resolveTo({ value: null, error: 'NoShow is not possible on a Pending reservation.' });

    expect(await actions.run('r1', 'no-show')).toBeNull();
    expect(modal.infoModal).toHaveBeenCalledOnceWith('Action impossible', 'NoShow is not possible on a Pending reservation.');
    expect(undo.offer).not.toHaveBeenCalled();
  });

  it('should cancel for whoever cancels', async () => {
    reservations.cancel.and.resolveTo({ value: { reservation: { ...AFTER, status: 'Cancelled' }, eventId: 'e2' }, error: null });

    await actions.cancel('r1', 'Restaurant');

    expect(reservations.cancel).toHaveBeenCalledOnceWith('r1', 'Restaurant');
    expect(undo.offer).toHaveBeenCalledOnceWith({ message: 'Réservation annulée', reservationId: 'r1', eventId: 'e2' });
  });

  it('should send « Placer » to the floor plan, on the right day', () => {
    actions.place('2026-08-20', 'r1');

    expect(router.navigate).toHaveBeenCalledOnceWith(['/service'], { queryParams: { day: '2026-08-20', place: 'r1' } });
  });
  it('should offer to undo a creation, and reopen the form on its draft when undone', () => {
    const reopen = jasmine.createSpy('reopen');
    const draft = { covers: 4, phone: '0611111111', name: 'Julien' } as never;
    const created = { ...AFTER, start: '2026-08-20T18:30:00Z', serviceDay: '2026-08-20' } as ReservationDetail;

    actions.saved({ result: { reservation: created, eventId: 'e1' }, draft, mode: 'create', thenPlace: true }, reopen);

    const offer = undo.offer.calls.mostRecent().args[0];
    expect(offer.message).toBe('Réservation créée · Moreau, jeu. 20 août 20:30');
    expect(router.navigate).toHaveBeenCalledOnceWith(['/service'], { queryParams: { day: '2026-08-20', place: 'r1' } });
    offer.onUndone!(null);
    expect(reopen).toHaveBeenCalledOnceWith({ kind: 'create', draft });
  });

  it('should reopen a modification on the restored reservation, and offer nothing when nothing changed', () => {
    const reopen = jasmine.createSpy('reopen');
    const restored = { ...AFTER, version: 9 } as ReservationDetail;
    const draft = { covers: 6 } as never;

    actions.saved({ result: { reservation: AFTER, eventId: null }, draft, mode: 'edit', thenPlace: false }, reopen);
    expect(undo.offer).not.toHaveBeenCalled();

    actions.saved({ result: { reservation: { ...AFTER, events: [] }, eventId: 'e3' }, draft, mode: 'edit', thenPlace: false }, reopen);
    undo.offer.calls.mostRecent().args[0].onUndone!(restored);
    expect(reopen).toHaveBeenCalledOnceWith({ kind: 'edit', reservation: restored, draft });
  });
});
