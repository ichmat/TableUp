import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { FloorPlanZone, PlacementPreviewItem, Restaurant } from '../../../models';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { FloorPlanService } from '../../../core/services/floor-plan/floor-plan.service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { PlacementSettingsComponent } from './placement-settings-component';

const RESTAURANT: Restaurant = {
  id: 'r', name: 'Chez nous', timeZone: 'Europe/Paris', defaultRotation: 105, seatTolerance: 2, lateGrace: 15,
  reminderEnabled: true, reminderDelayHours: 24, autoConfirmation: false, suggestCombinations: true,
  minBookingNoticeMinutes: 60, bookingHorizonDays: 60, zones: [], cancellationConditions: [], users: [],
  services: [{
    id: 's', restaurantId: 'r', day: 'Saturday', opening: '19:00:00', closing: '23:00:00', slotStep: 30,
    occupancyMode: 'Rotation', expectedDuration: 120, maxCadence: null, coverCap: null,
  }],
};

const SALLE: FloorPlanZone = {
  id: 'salle', restaurantId: 'r', name: 'Salle', order: 0, width: 8, height: 5, tables: [], decors: [],
  combinations: [
    { id: 'c1', zoneId: 'salle', name: '12-13', capacity: 8, tableIds: ['a', 'b'], isActive: false, activateAt: null, deactivateAt: null },
    { id: 'c2', zoneId: 'salle', name: '4-5', capacity: 8, tableIds: ['c', 'd'], isActive: true, activateAt: null, deactivateAt: null },
  ],
};

describe('PlacementSettingsComponent', () => {
  let fixture: ComponentFixture<PlacementSettingsComponent>;
  let component: PlacementSettingsComponent;
  let restaurants: jasmine.SpyObj<RestaurantService>;
  let modal: jasmine.SpyObj<ModalService>;
  const model = signal<Restaurant | null>(RESTAURANT);
  const text = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

  beforeEach(async () => {
    model.set(RESTAURANT);
    restaurants = jasmine.createSpyObj<RestaurantService>('RestaurantService',
      ['updatePlacement', 'previewPlacement'], { model });
    restaurants.updatePlacement.and.resolveTo({ value: RESTAURANT, error: null });
    restaurants.previewPlacement.and.resolveTo({ value: [], error: null });
    modal = jasmine.createSpyObj<ModalService>('ModalService', ['infoModal']);
    modal.infoModal.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [PlacementSettingsComponent],
      providers: [
        { provide: RestaurantService, useValue: restaurants },
        { provide: FloorPlanService, useValue: { zones: signal([SALLE]) } },
        { provide: ModalService, useValue: modal },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlacementSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should start from the saved settings, without changes', () => {
    expect(component.hasChanges()).toBeFalse();
    expect(text()).toContain('Une réservation à 19:30 libère sa table à 21:15.');
    expect(text()).toContain('Une réservation de 20:00 passe en retard à 20:15');
  });

  it('should name the services that keep their own duration', () => {
    expect(text()).toContain('Samedi 19:00 garde sa durée de 2 h');
  });

  it('should count the sleeping combinations that could be suggested', () => {
    expect(text()).toContain('1 combinaison en sommeil pourra être proposée');
  });

  it('should not promise suggestions once they are turned off', () => {
    component['settingsForm'].suggestCombinations().value.set(false);
    fixture.detectChanges();

    expect(text()).not.toContain('pourra être proposée');
    expect(text()).toContain('1 combinaison en sommeil restera en mémoire, sans être proposée.');
  });

  it('should save the edited settings', async () => {
    component['settingsForm'].defaultRotation().value.set(120);
    component['settingsForm'].suggestCombinations().value.set(false);
    fixture.detectChanges();
    expect(component.hasChanges()).toBeTrue();
    expect(text()).toContain('Une réservation à 19:30 libère sa table à 21:30.');

    await component.save();

    expect(restaurants.updatePlacement).toHaveBeenCalledOnceWith(
      { defaultRotation: 120, seatTolerance: 2, lateGrace: 15, suggestCombinations: false });
  });

  it('should cancel back to the saved settings', () => {
    component['settingsForm'].lateGrace().value.set(30);
    component.cancel();
    expect(component.hasChanges()).toBeFalse();
  });

  it('should refuse a rotation off the 15 minute steps without calling the API', async () => {
    component['settingsForm'].defaultRotation().value.set(100);
    await component.save();

    expect(restaurants.updatePlacement).not.toHaveBeenCalled();
    expect(modal.infoModal).toHaveBeenCalledOnceWith('Erreur', 'La rotation se règle par pas de 15 min');
  });

  it('should show the API message when the save is refused', async () => {
    restaurants.updatePlacement.and.resolveTo({ value: null, error: 'Invalid request : late grace (minutes) must be between 0 and 120.' });
    component['settingsForm'].lateGrace().value.set(20);
    await component.save();

    expect(modal.infoModal).toHaveBeenCalledOnceWith('Erreur', 'Invalid request : late grace (minutes) must be between 0 and 120.');
  });

  it('should fill the draft when the restaurant arrives, and keep an edit when it reloads', () => {
    model.set(null);
    fixture.detectChanges();
    model.set(RESTAURANT);
    fixture.detectChanges();
    expect(component.hasChanges()).toBeFalse();

    component['settingsForm'].lateGrace().value.set(30);
    model.set({ ...RESTAURANT, name: 'Rechargé' });
    fixture.detectChanges();
    expect(component.hasChanges()).toBeTrue();
  });
});

describe('PlacementSettingsComponent preview', () => {
  let fixture: ComponentFixture<PlacementSettingsComponent>;
  let component: PlacementSettingsComponent;
  let restaurants: jasmine.SpyObj<RestaurantService>;
  const PREVIEW: PlacementPreviewItem[] = [
    { id: 't1', name: 'T1', capacity: 2, kind: 'Table', fit: 'TooSmall' },
    { id: 't5', name: 'T5', capacity: 4, kind: 'Table', fit: 'Perfect' },
    { id: 't2', name: 'T2', capacity: 6, kind: 'Table', fit: 'WithinTolerance' },
    { id: 'c', name: '12-13', capacity: 8, kind: 'Combination', fit: 'NotAdvised' },
  ];

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    restaurants = jasmine.createSpyObj<RestaurantService>('RestaurantService',
      ['updatePlacement', 'previewPlacement'], { model: signal<Restaurant | null>(RESTAURANT) });
    restaurants.previewPlacement.and.resolveTo({ value: [...PREVIEW], error: null });

    await TestBed.configureTestingModule({
      imports: [PlacementSettingsComponent],
      providers: [
        { provide: RestaurantService, useValue: restaurants },
        { provide: FloorPlanService, useValue: { zones: signal([]) } },
        { provide: ModalService, useValue: jasmine.createSpyObj<ModalService>('ModalService', ['infoModal']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlacementSettingsComponent);
    component = fixture.componentInstance;
    await settle();
  });

  const chips = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('[data-fit]')]
    .map((chip) => `${chip.getAttribute('data-fit')} ${chip.textContent!.replace(/\s+/g, ' ').trim()}`);

  it('should show the verdict of every active table and combination for 4 people', () => {
    expect(restaurants.previewPlacement).toHaveBeenCalledOnceWith(4, 2);
    expect(chips()).toEqual([
      'TooSmall ✗ T1 · 2 pl.',
      'Perfect ✓ T5 · 4 pl.',
      'WithinTolerance ~✓ T2 · 6 pl.',
      'NotAdvised ! 12-13 · 8 pl.',
    ]);
  });

  it('should ask again with the draft tolerance, once the clicks settle', async () => {
    component['settingsForm'].seatTolerance().value.set(3);
    fixture.detectChanges();
    component['settingsForm'].seatTolerance().value.set(4);
    await settle();

    expect(restaurants.previewPlacement.calls.allArgs()).toEqual([[4, 2], [4, 4]]);
  });

  it('should not ask for a preview while the tolerance is empty or out of bounds', async () => {
    component['settingsForm'].seatTolerance().value.set(null);
    await settle();
    component['settingsForm'].seatTolerance().value.set(21);
    await settle();

    expect(restaurants.previewPlacement).toHaveBeenCalledTimes(1);
  });

  it('should say the reserve level is empty with a tolerance of 1', async () => {
    component['settingsForm'].seatTolerance().value.set(1);
    await settle();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Au-delà, la table reste plaçable mais déconseillée.');
  });

  it('should send to the floor plan editor when no table is active', async () => {
    restaurants.previewPlacement.and.resolveTo({ value: [], error: null });
    component['previewCovers'].set(5);
    await settle();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Aucune table active : posez-en dans l\'éditeur de plan.');
  });
});
