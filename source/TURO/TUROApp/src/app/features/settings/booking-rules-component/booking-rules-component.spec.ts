import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Restaurant } from '../../../models';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { BookingRulesComponent } from './booking-rules-component';

// Pas d'import depuis un autre .spec.ts : ses describe seraient enregistrés une seconde fois
const RESTAURANT: Restaurant = {
  id: 'r', name: 'Chez nous', timeZone: 'Europe/Paris', defaultRotation: 105, seatTolerance: 2, lateGrace: 15,
  reminderEnabled: true, reminderDelayHours: 24, autoConfirmation: false, suggestCombinations: true,
  minBookingNoticeMinutes: 60, bookingHorizonDays: 60, zones: [], services: [], cancellationConditions: [], users: [],
};

describe('BookingRulesComponent', () => {
  let fixture: ComponentFixture<BookingRulesComponent>;
  let component: BookingRulesComponent;
  let restaurants: jasmine.SpyObj<RestaurantService>;
  let modal: jasmine.SpyObj<ModalService>;
  const model = signal<Restaurant | null>(RESTAURANT);
  const text = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

  beforeEach(async () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(Date.UTC(2026, 9, 6, 12, 10)));
    model.set(RESTAURANT);
    restaurants = jasmine.createSpyObj<RestaurantService>('RestaurantService', ['updateBookingWindow'], { model });
    restaurants.updateBookingWindow.and.resolveTo({ value: RESTAURANT, error: null });
    modal = jasmine.createSpyObj<ModalService>('ModalService', ['infoModal']);
    modal.infoModal.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [BookingRulesComponent],
      providers: [{ provide: RestaurantService, useValue: restaurants }, { provide: ModalService, useValue: modal }],
    }).compileComponents();

    fixture = TestBed.createComponent(BookingRulesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => jasmine.clock().uninstall());

  it('should say what a customer booking now could choose', () => {
    expect(component.hasChanges()).toBeFalse();
    expect(text()).toContain('Si un client réserve maintenant (14:10), le plus tôt possible est 15:10, le plus tard le samedi 5 décembre.');
    expect(text()).toContain('Le widget de réservation appliquera cette fenêtre.');
  });

  it('should name the day when the earliest booking falls tomorrow', () => {
    component['windowForm'].minNoticeMinutes().value.set(600);
    fixture.detectChanges();

    expect(text()).toContain('le plus tôt possible est 00:10 le mercredi 7 octobre');
  });

  it('should warn that no booking is possible when the notice exceeds the horizon', () => {
    component['windowForm'].minNoticeMinutes().value.set(2880);
    component['windowForm'].horizonDays().value.set(1);
    fixture.detectChanges();

    expect(text()).toContain('Avec ces réglages, aucun client ne peut réserver : le délai minimum dépasse l\'horizon.');
    expect(text()).not.toContain('le plus tôt possible');
  });

  it('should give the year of a last day a year ahead', () => {
    component['windowForm'].horizonDays().value.set(365);
    fixture.detectChanges();

    expect(text()).toContain('le plus tard le mercredi 6 octobre 2027.');
  });

  it('should fill the draft when the restaurant arrives', () => {
    model.set(null);
    fixture.detectChanges();
    expect(text()).toContain('Chargement des réglages');

    model.set(RESTAURANT);
    fixture.detectChanges();
    expect(component.hasChanges()).toBeFalse();
    expect(text()).toContain('le plus tôt possible est 15:10');
  });

  it('should save the edited window', async () => {
    component['windowForm'].horizonDays().value.set(90);
    await component.save();

    expect(restaurants.updateBookingWindow).toHaveBeenCalledOnceWith({ minNoticeMinutes: 60, horizonDays: 90 });
  });

  it('should refuse an horizon beyond a year without calling the API', async () => {
    component['windowForm'].horizonDays().value.set(400);
    await component.save();

    expect(restaurants.updateBookingWindow).not.toHaveBeenCalled();
    expect(modal.infoModal).toHaveBeenCalledOnceWith('Erreur', 'L\'horizon ne peut pas dépasser 365 jours');
  });

  it('should keep an edit when the restaurant reloads, and cancel it on demand', () => {
    component['windowForm'].horizonDays().value.set(90);
    model.set({ ...RESTAURANT, name: 'Rechargé' });
    fixture.detectChanges();
    expect(component.hasChanges()).toBeTrue();

    component.cancel();
    expect(component.hasChanges()).toBeFalse();
  });
});
