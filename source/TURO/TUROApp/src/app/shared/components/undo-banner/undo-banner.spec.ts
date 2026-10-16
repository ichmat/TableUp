import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { UndoBannerState, UndoService } from '../../../core/services/undo/undo.service';
import { UndoBanner } from './undo-banner';

describe('UndoBanner', () => {
  let fixture: ComponentFixture<UndoBanner>;
  const state = signal<UndoBannerState | null>(null);
  const undo = jasmine.createSpy('undo');
  const element = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    state.set(null);
    undo.calls.reset();
    await TestBed.configureTestingModule({
      imports: [UndoBanner],
      providers: [{ provide: UndoService, useValue: { state, undo } }],
    }).compileComponents();
    fixture = TestBed.createComponent(UndoBanner);
    fixture.detectChanges();
  });

  it('should show nothing without an action to undo', () => {
    expect(element().textContent!.trim()).toBe('');
  });

  it('should name the action, count down and offer to undo it', () => {
    state.set({ kind: 'offer', offer: { message: 'No-show noté · 2ᵉ pour ce client', reservationId: 'r1', eventId: 'e1' }, secondsLeft: 6 });
    fixture.detectChanges();

    expect(element().textContent).toContain('No-show noté · 2ᵉ pour ce client');
    expect(element().textContent).toContain('6 s');
    (element().querySelector('[data-undo]') as HTMLButtonElement).click();
    expect(undo).toHaveBeenCalled();
  });

  it('should say when it is too late, without a button', () => {
    state.set({ kind: 'failed', message: 'Trop tard : la réservation a changé entre-temps' });
    fixture.detectChanges();

    expect(element().textContent).toContain('Trop tard');
    expect(element().querySelector('[data-undo]')).toBeNull();
  });
});
