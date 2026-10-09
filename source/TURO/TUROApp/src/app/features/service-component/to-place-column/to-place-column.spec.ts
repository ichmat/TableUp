import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReservationListClient } from '../../../models';
import { serviceReservation, utc } from '../testing/service-fixtures';
import { ToPlaceColumn } from './to-place-column';

const client = (name: string, change: Partial<ReservationListClient> = {}): ReservationListClient => ({
  id: name, name, phone: null, tags: [], hasAllergy: false, visitCount: 3, noShowCount: 0, atRisk: false, ...change,
});

describe('ToPlaceColumn', () => {
  let fixture: ComponentFixture<ToPlaceColumn>;
  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent!.replace(/\s+/g, ' ');

  beforeEach(() => {
    fixture = TestBed.createComponent(ToPlaceColumn);
    fixture.componentRef.setInput('toPlace', [
      serviceReservation({ id: 'moreau', start: utc('20:30'), covers: 4, client: client('Moreau', { hasAllergy: true }) }),
      serviceReservation({ id: 'chen', start: utc('21:00'), covers: 6, source: 'Web', client: client('Chen', { visitCount: 0 }) }),
    ]);
    fixture.componentRef.setInput('pending', [serviceReservation({ id: 'bouvier', start: utc('20:00'), covers: 7, client: null })]);
    fixture.componentRef.setInput('timeZone', 'UTC');
    fixture.detectChanges();
  });

  it('should keep two groups with their counts, requests bordered in violet', () => {
    expect(element().querySelector('[data-group="to-place"]')!.textContent).toContain('À PLACER · 2');
    expect(element().querySelector('[data-group="pending"]')!.textContent).toContain('EN ATTENTE · 1');
    expect(element().querySelector('[data-pill="bouvier"]')!.getAttribute('class')).toContain('border-violet');
  });

  it('should show name, covers, time, source and the marks that travel with the reservation', () => {
    const moreau = element().querySelector('[data-pill="moreau"]')!.textContent!;
    expect(moreau).toContain('Moreau');
    expect(moreau).toContain('4p · 20:30');
    expect(moreau).toContain('TÉL');
    expect(element().querySelector('[data-pill="moreau"] [data-mark="allergy"]')).not.toBeNull();
    expect(element().querySelector('[data-pill="chen"] [data-mark="first"]')).not.toBeNull();
    expect(element().querySelector('[data-pill="bouvier"]')!.textContent).toContain('Client de passage');
  });

  it('should open the reservation touched', () => {
    const opened = jasmine.createSpy('opened');
    fixture.componentInstance.opened.subscribe(opened);

    (element().querySelector('[data-pill="chen"]') as HTMLButtonElement).click();

    expect(opened).toHaveBeenCalledOnceWith('chen');
  });

  it('should hand a press on a pill to the screen, for a drag, with the name and covers', () => {
    const pressed = jasmine.createSpy('pressed');
    fixture.componentInstance.pressed.subscribe(pressed);
    const down = new PointerEvent('pointerdown', { clientX: 5, clientY: 6 });

    element().querySelector('[data-pill="moreau"]')!.dispatchEvent(down);

    expect(pressed).toHaveBeenCalledOnceWith({ id: 'moreau', label: 'Moreau · 4p', event: down });
  });

  it('should keep the finger on a pill for the drag, not hand it to the column scroll', () => {
    // Sans cela, une tablette lit le geste comme un défilement et annule le glisser (pointercancel)
    expect(element().querySelector('[data-pill="moreau"]')!.getAttribute('class')).toContain('touch-none');
  });

  it('should be wide enough to read a name', () => {
    expect(element().querySelector('aside')!.getAttribute('class')).toContain('w-[189px]');
  });

  it('should fold away and keep the counts in sight', () => {
    (element().querySelector('[data-collapse]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element().querySelector('[data-pill]')).toBeNull();
    expect(text()).toContain('2');
    expect(text()).toContain('1');
  });
});
