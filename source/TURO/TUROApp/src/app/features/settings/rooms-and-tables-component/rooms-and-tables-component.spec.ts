import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { FloorPlanZone, Table } from '../../../models';
import { FloorPlanService } from '../../../core/services/floor-plan/floor-plan.service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { RoomsAndTablesComponent } from './rooms-and-tables-component';

const T3: Table = {
  id: 't3', zoneId: 'salle', name: 'T3', capacity: 4, shape: 'Square', x: 0, y: 0, width: 0.9, height: 0.9,
  rotation: 0, needsCleaningSince: null, isActive: true,
};
const SALLE: FloorPlanZone = { id: 'salle', restaurantId: 'r', name: 'Salle', order: 0, width: 8, height: 5.5, tables: [T3], decors: [], combinations: [] };
const TERRASSE: FloorPlanZone = { id: 'terrasse', restaurantId: 'r', name: 'Terrasse', order: 1, width: 6, height: 4, tables: [], decors: [], combinations: [] };

describe('RoomsAndTablesComponent', () => {
  let fixture: ComponentFixture<RoomsAndTablesComponent>;
  let floorPlan: jasmine.SpyObj<FloorPlanService>;
  const zones = signal<FloorPlanZone[]>([SALLE, TERRASSE]);

  async function create() {
    fixture = TestBed.createComponent(RoomsAndTablesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    floorPlan = jasmine.createSpyObj<FloorPlanService>('FloorPlanService',
      ['createZone', 'updateZone', 'reorderZones', 'deleteZone', 'getDraft'],
      { zones, isLoaded: signal(true), loadFailed: signal(false) });
    floorPlan.getDraft.and.resolveTo({ value: null, error: null });

    await TestBed.configureTestingModule({
      imports: [RoomsAndTablesComponent],
      providers: [provideRouter([]), { provide: FloorPlanService, useValue: floorPlan }],
    }).compileComponents();

    await create();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

  it('should list each room with its size, its tables and seats', () => {
    expect(text()).toContain('Salle');
    expect(text()).toContain('8,00 m × 5,50 m');
    expect(text()).toContain('1 table · 4 places');
    expect(text()).toContain('T3 · 4p');
  });

  it('should offer deletion only for a room that never held a table', () => {
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-zone]');
    expect(cards[0].textContent).not.toContain('Supprimer');
    expect(cards[1].textContent).toContain('Supprimer');
  });

  it('should announce an unpublished draft', async () => {
    floorPlan.getDraft.and.resolveTo({
      value: { tables: [{ ...T3, x: 1 }], decors: [], updatedAt: '2026-10-01T10:00:00Z' }, error: null,
    });
    await create();

    expect(text()).toContain('Brouillon en cours · 1 modification, non publié');
  });

  it('should create a room from the modal', async () => {
    const modal = TestBed.inject(ModalService);
    spyOn(modal, 'formModal').and.callFake(async (_title, inputs) => {
      // ce que ferait la modale à la validation
      const set = (index: number, value: unknown) =>
        (inputs[index] as unknown as { setValue: (v: unknown) => void }).setValue(value);
      set(0, 'Étage');
      set(1, 10);
      set(2, 6.5);
      return true;
    });
    floorPlan.createZone.and.resolveTo({ value: null, error: null } as never);

    await fixture.componentInstance.addZone();

    expect(floorPlan.createZone).toHaveBeenCalledOnceWith({ name: 'Étage', width: 10, height: 6.5 });
  });

  it('should move a room one step up', async () => {
    floorPlan.reorderZones.and.resolveTo({ value: [], error: null });
    await fixture.componentInstance.moveZone(TERRASSE, -1);
    expect(floorPlan.reorderZones).toHaveBeenCalledOnceWith(['terrasse', 'salle']);
  });
});
