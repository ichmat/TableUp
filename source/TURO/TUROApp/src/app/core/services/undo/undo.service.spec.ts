import { TestBed } from '@angular/core/testing';
import { ApiError, ReservationDetail } from '../../../models';
import { ReservationService } from '../reservation/reservation.service';
import { UNDO_TOO_LATE, UndoBannerState, UndoService } from './undo.service';

const RESTORED = { id: 'r1', status: 'Confirmed' } as ReservationDetail;
const seconds = (state: UndoBannerState | null) => (state?.kind === 'offer' ? state.secondsLeft : null);

describe('UndoService', () => {
  let service: UndoService;
  let reservations: jasmine.SpyObj<ReservationService>;

  beforeEach(() => {
    jasmine.clock().install();
    reservations = jasmine.createSpyObj<ReservationService>('ReservationService', ['undo']);
    TestBed.configureTestingModule({ providers: [{ provide: ReservationService, useValue: reservations }] });
    service = TestBed.inject(UndoService);
  });

  afterEach(() => jasmine.clock().uninstall());

  it('should count eight seconds down, then make the action final', () => {
    service.offer({ message: 'Moreau acceptée', reservationId: 'r1', eventId: 'e1' });
    expect(seconds(service.state())).toBe(8);

    jasmine.clock().tick(3000);
    expect(seconds(service.state())).toBe(5);

    jasmine.clock().tick(5000);
    expect(service.state()).toBeNull();
    expect(reservations.undo).not.toHaveBeenCalled();
  });

  it('should replace the banner, the previous action becoming final', () => {
    service.offer({ message: 'Moreau acceptée', reservationId: 'r1', eventId: 'e1' });
    jasmine.clock().tick(5000);

    service.offer({ message: 'Chen refusée', reservationId: 'r2', eventId: 'e2' });

    const state = service.state();
    expect(state?.kind === 'offer' ? state.offer.message : null).toBe('Chen refusée');
    expect(seconds(state)).toBe(8);
    // Un seul compte à rebours : celui du bandeau remplacé s'est arrêté
    jasmine.clock().tick(1000);
    expect(seconds(service.state())).toBe(7);
    jasmine.clock().tick(7000);
    expect(service.state()).toBeNull();
  });

  it('should undo and hand the restored reservation back', async () => {
    reservations.undo.and.resolveTo({ value: RESTORED, error: null });
    const onUndone = jasmine.createSpy('onUndone');
    service.offer({ message: 'Modifiée · 20:00 → 20:30', reservationId: 'r1', eventId: 'e1', onUndone });

    await service.undo();

    expect(reservations.undo).toHaveBeenCalledOnceWith('r1', 'e1');
    expect(onUndone).toHaveBeenCalledOnceWith(RESTORED);
    expect(service.state()).toBeNull();
  });

  it('should say it is too late, then go away', async () => {
    reservations.undo.and.resolveTo({ value: null, error: 'This action can no longer be undone.', code: ApiError.UndoExpired });
    const onUndone = jasmine.createSpy('onUndone');
    service.offer({ message: 'Moreau acceptée', reservationId: 'r1', eventId: 'e1', onUndone });

    await service.undo();

    expect(service.state()).toEqual({ kind: 'failed', message: UNDO_TOO_LATE });
    expect(onUndone).not.toHaveBeenCalled();
    jasmine.clock().tick(4000);
    expect(service.state()).toBeNull();
  });

  it('should undo any action through its own call, and name what changed when it is too late', async () => {
    const run = jasmine.createSpy('run').and.resolveTo({ value: null, error: null });
    service.offer({ message: 'Table 6 nettoyée', run, tooLate: 'Trop tard : la table a changé entre-temps' });

    await service.undo();

    expect(run).toHaveBeenCalledTimes(1);
    expect(reservations.undo).not.toHaveBeenCalled();
    expect(service.state()).toBeNull();

    run.and.resolveTo({ value: null, error: 'This action can no longer be undone.', code: ApiError.UndoExpired });
    service.offer({ message: 'Table 6 nettoyée', run, tooLate: 'Trop tard : la table a changé entre-temps' });
    await service.undo();
    expect(service.state()).toEqual({ kind: 'failed', message: 'Trop tard : la table a changé entre-temps' });
  });
});
