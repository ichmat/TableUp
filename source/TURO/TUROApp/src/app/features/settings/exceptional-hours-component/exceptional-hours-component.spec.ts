import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ExceptionalClosure, Restaurant } from '../../../models';
import { ClosureService } from '../../../core/services/closure/closure.service';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { ExceptionalHoursComponent } from './exceptional-hours-component';

const CHRISTMAS: ExceptionalClosure = {
  id: 'closure-1', restaurantId: 'r', from: '2026-12-24', to: '2026-12-25', type: 'Closed',
  replacementHours: null, reason: 'PublicHoliday', reasonDetail: null, customerMessage: null,
};

// Un seul service, le mardi midi
const RESTAURANT = {
  timeZone: 'Europe/Paris', name: 'Chez Test',
  services: [{ id: 's', restaurantId: 'r', day: 'Tuesday', opening: '11:00:00', closing: '13:00:00', slotStep: 30, occupancyMode: 'Rotation', expectedDuration: null, maxCadence: null, coverCap: null }],
} as unknown as Restaurant;

describe('ExceptionalHoursComponent', () => {
  let loadFailed: ReturnType<typeof signal<boolean>>;
  let fixture: ComponentFixture<ExceptionalHoursComponent>;
  let buttons: (date: number) => HTMLButtonElement;

  beforeEach(async () => {
    loadFailed = signal(false);
    await TestBed.configureTestingModule({
      imports: [ExceptionalHoursComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: ClosureService, useValue: { closures: signal([CHRISTMAS]), isLoading: signal(false), loadFailed } },
        { provide: RestaurantService, useValue: { model: signal(RESTAURANT), isLoading: signal(false) } },
      ],
    })
      .compileComponents();

    fixture = TestBed.createComponent(ExceptionalHoursComponent);
    fixture.detectChanges();

    // Décembre 2026, mois de la fermeture
    const component = fixture.componentInstance as unknown as { year: { set(v: number): void }, month: { set(v: number): void } };
    component.year.set(2026);
    component.month.set(12);
    fixture.detectChanges();

    buttons = (date) => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.grid button'))
      .filter((button) => !button.className.includes('text-border'))
      .find((button) => button.textContent!.trim() === String(date))!;
  });

  it('should hatch exceptional closures', () => {
    expect(buttons(24).className).toContain('hatch-closed');
    expect(buttons(25).className).toContain('line-through');
  });

  it('should not let a usually closed day be chosen', () => {
    // jeudi 10 décembre : aucun service le jeudi
    expect(buttons(10).className).toContain('hatch-usual-closed');
    expect(buttons(10).disabled).toBeTrue();
  });

  it('should let a day with a usual service be chosen', () => {
    // mardi 8 décembre
    expect(buttons(8).className).not.toContain('hatch');
    expect(buttons(8).disabled).toBeFalse();
  });

  it('should not let anything be planned when the exceptions failed to load', () => {
    loadFailed.set(true);
    fixture.detectChanges();

    expect(buttons(8).disabled).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain("n'ont pas pu être chargés");
  });

  it('should leave a normal day unmarked', () => {
    expect(buttons(24).className).not.toContain('hatch-usual-closed');
  });
});
