import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { ApiError, FloorPlanZone, Table } from '../../../models';
import { FloorPlanService } from '../../../core/services/floor-plan/floor-plan.service';
import { FloorPlanCanvasComponent } from '../../../shared/components/floor-plan/floor-plan-canvas-component';
import { FloorPlanEditorComponent } from './floor-plan-editor-component';
import { ModalService } from '../../../core/services/modal/modal.service';
import { AUTOSAVE_DELAY_MS } from './logic/draft-store';
import { DECOR_PALETTE, DEFAULT_TABLE_PALETTE } from './logic/palette';

const T1: Table = {
  id: 't1', zoneId: 'salle', name: 'T1', capacity: 2, shape: 'Round', x: 0, y: 0, width: 0.7, height: 0.7,
  rotation: 0, needsCleaningSince: null, isActive: true,
};
const SALLE: FloorPlanZone = { id: 'salle', restaurantId: 'r', name: 'Salle', order: 0, width: 8, height: 5.5, tables: [T1], decors: [], combinations: [] };

describe('FloorPlanEditorComponent', () => {
  let fixture: ComponentFixture<FloorPlanEditorComponent>;
  let component: FloorPlanEditorComponent;
  let floorPlan: jasmine.SpyObj<FloorPlanService>;
  let zones: WritableSignal<FloorPlanZone[]>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
  const canvas = () => fixture.debugElement.query(By.directive(FloorPlanCanvasComponent)).componentInstance as FloorPlanCanvasComponent;

  async function create() {
    fixture = TestBed.createComponent(FloorPlanEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    zones = signal<FloorPlanZone[]>([SALLE]);
    floorPlan = jasmine.createSpyObj<FloorPlanService>('FloorPlanService',
      ['getDraft', 'saveDraft', 'discardDraft', 'publish', 'reload'],
      { zones, isLoaded: signal(true), loadFailed: signal(false) });
    floorPlan.getDraft.and.resolveTo({ value: null, error: null });
    floorPlan.saveDraft.and.resolveTo({ value: null, error: null } as never);

    await TestBed.configureTestingModule({
      imports: [FloorPlanEditorComponent],
      providers: [provideRouter([]), { provide: FloorPlanService, useValue: floorPlan }],
    }).compileComponents();
    await create();
  });

  afterEach(() => component.store.dispose());

  it('should start from the published plan when there is no draft', () => {
    expect(text()).toContain('Plan publié');
    expect(text()).toContain('Salle : 8,00 m × 5,50 m · grille 25 cm');
    expect(component.store.content().tables.map((t) => t.name)).toEqual(['T1']);
  });

  it('should drop a palette type as T2, centred under the pointer and snapped', () => {
    spyOn(canvas(), 'containsClient').and.returnValue(true);
    spyOn(canvas(), 'toMetres').and.returnValue({ x: 2.1, y: 1.3 });

    expect(component.dropFromPalette(DEFAULT_TABLE_PALETTE[1], 0, 0)).toBeTrue();
    fixture.detectChanges();

    const created = component.store.content().tables[1];
    expect(created).toEqual(jasmine.objectContaining({ name: 'T2', capacity: 4, shape: 'Square', x: 1.75, y: 0.75, zoneId: 'salle' }));
    expect(component.selection()).toEqual({ kind: 'table', id: created.id });
    expect(text()).toContain('Brouillon · 1 modification');
  });

  it('should ignore a palette drop outside the canvas', () => {
    spyOn(canvas(), 'containsClient').and.returnValue(false);
    expect(component.dropFromPalette(DEFAULT_TABLE_PALETTE[0], 0, 0)).toBeFalse();
    expect(component.store.content().tables.length).toBe(1);
  });

  it('should resume the saved draft instead of the published plan', async () => {
    floorPlan.getDraft.and.resolveTo({ value: { tables: [{ ...T1, x: 2 }], decors: [], combinations: [], updatedAt: '2026-10-01T10:00:00Z' }, error: null });
    await create();
    expect(component.store.content().tables[0].x).toBe(2);
    expect(text()).toContain('Brouillon · 1 modification');
  });

  it('should keep the draft when the published plan reloads (SignalR)', () => {
    component.updateTable('t1', { x: 3 });
    zones.set([{ ...SALLE, name: 'Grande salle' }]);
    fixture.detectChanges();
    expect(component.store.content().tables[0].x).toBe(3);
  });

  it('should say the editor is admin only on a 403', async () => {
    floorPlan.getDraft.and.resolveTo({ value: null, error: 'The token does not have admin privileges.', code: ApiError.NotAdmin });
    await create();
    expect(text()).toContain("L'éditeur de plan est réservé à l'administrateur");
  });

  it('should publish after saving, then start again from the published plan', async () => {
    component.updateTable('t1', { x: 3 });
    const published = [{ ...SALLE, tables: [{ ...T1, x: 3 }] }];
    floorPlan.publish.and.callFake(async () => { zones.set(published); return { value: published, error: null }; });

    await component.publish();
    fixture.detectChanges();

    expect(floorPlan.saveDraft).toHaveBeenCalled();
    expect(floorPlan.publish).toHaveBeenCalled();
    expect(text()).toContain('Plan publié');
  });

  it('should duplicate the selected table next to it, with a new name', () => {
    component.selection.set({ kind: 'table', id: 't1' });
    component.duplicateSelected();

    const copy = component.store.content().tables[1];
    expect(copy).toEqual(jasmine.objectContaining({ name: 'T2', x: 0.75, y: 0, capacity: 2 }));
    expect(component.selection()).toEqual({ kind: 'table', id: copy.id });
  });

  it('should follow a table moved to another room', () => {
    const terrasse: FloorPlanZone = { ...SALLE, id: 'terrasse', name: 'Terrasse', order: 1, width: 2, height: 2, tables: [] };
    zones.set([SALLE, terrasse]);
    component.selection.set({ kind: 'table', id: 't1' });
    component.updateTable('t1', { x: 7 });
    component.onPanelChange({ id: 't1', patch: { zoneId: 'terrasse' } });

    expect(component.currentZone()!.id).toBe('terrasse');
    expect(component.store.content().tables[0]).toEqual(jasmine.objectContaining({ zoneId: 'terrasse', x: 1.3 }));
  });

  it('should drop a decor, select it, and count it as a change', () => {
    spyOn(canvas(), 'containsClient').and.returnValue(true);
    spyOn(canvas(), 'toMetres').and.returnValue({ x: 4, y: 0.1 });

    expect(component.dropDecorFromPalette(DECOR_PALETTE[0], 0, 0)).toBeTrue();
    fixture.detectChanges();

    const wall = component.store.content().decors[0];
    expect(wall).toEqual(jasmine.objectContaining({ type: 'Wall', x: 3, y: 0, width: 2, height: 0.15 }));
    expect(component.selection()).toEqual({ kind: 'decor', id: wall.id });
    expect(text()).toContain('Brouillon · 1 modification');
  });

  it('should delete a decor for real', () => {
    spyOn(canvas(), 'containsClient').and.returnValue(true);
    spyOn(canvas(), 'toMetres').and.returnValue({ x: 4, y: 2 });
    component.dropDecorFromPalette(DECOR_PALETTE[4], 0, 0);
    component.removeSelectedDecor();
    expect(component.store.content().decors).toEqual([]);
    expect(component.selection()).toBeNull();
  });

  it('should apply a field being typed to its own table when another table is clicked', async () => {
    const t2: Table = { ...T1, id: 't2', name: 'T2', x: 2 };
    floorPlan.getDraft.and.resolveTo({ value: { tables: [T1, t2], decors: [], combinations: [], updatedAt: '2026-10-01T10:00:00Z' }, error: null });
    await create();
    component.selection.set({ kind: 'table', id: 't1' });
    fixture.detectChanges();
    const name = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[data-field="name"] input')!;
    name.value = 'Fenêtre';
    name.dispatchEvent(new Event('input'));

    // clic sur T2 : la sélection change au pointerdown, avant que le champ ne perde le focus
    component.onTablePointerDown({ item: t2, point: { x: 2.1, y: 0.1 }, event: new PointerEvent('pointerdown', { pointerId: 7 }) });
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 }));
    fixture.detectChanges();
    name.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    fixture.detectChanges();

    expect(component.store.content().tables.map((t) => t.name)).toEqual(['Fenêtre', 'T2']);
  });

  it('should drop the decor of a room deleted elsewhere', () => {
    const terrasse: FloorPlanZone = { ...SALLE, id: 'terrasse', name: 'Terrasse', order: 1, tables: [] };
    zones.set([SALLE, terrasse]);
    component.selectZone('terrasse');
    fixture.detectChanges();
    spyOn(canvas(), 'containsClient').and.returnValue(true);
    spyOn(canvas(), 'toMetres').and.returnValue({ x: 4, y: 2 });
    component.dropDecorFromPalette(DECOR_PALETTE[2], 0, 0);

    zones.set([SALLE]);
    fixture.detectChanges();

    expect(component.store.content().decors).toEqual([]);
  });

  it('should wait for the save in flight before discarding the draft', fakeAsync(() => {
    let finish!: (result: { value: null, error: null }) => void;
    floorPlan.saveDraft.and.returnValue(new Promise((resolve) => finish = resolve) as never);
    floorPlan.discardDraft.and.resolveTo({ value: null, error: null });
    spyOn(TestBed.inject(ModalService), 'confirmModal').and.resolveTo(true);

    component.updateTable('t1', { x: 3 });
    tick(AUTOSAVE_DELAY_MS);
    void component.discard();
    flushMicrotasks();
    expect(floorPlan.discardDraft).not.toHaveBeenCalled();

    finish({ value: null, error: null });
    flushMicrotasks();
    expect(floorPlan.discardDraft).toHaveBeenCalled();
  }));

  it('should send the pending edit when the editor is left another way', () => {
    component.updateTable('t1', { x: 3 });
    fixture.destroy();
    expect(floorPlan.saveDraft).toHaveBeenCalled();
  });

  it('should ask before leaving when the draft could not be saved', async () => {
    floorPlan.saveDraft.and.resolveTo({ value: null, error: 'Brouillon refusé' });
    const confirm = spyOn(TestBed.inject(ModalService), 'confirmModal').and.resolveTo(false);
    component.updateTable('t1', { x: 3 });

    expect(await component.canLeave()).toBeFalse();
    expect(confirm).toHaveBeenCalled();
  });

  it('should warn the browser before closing on an unsaved edit', () => {
    component.updateTable('t1', { x: 3 });
    const unload = new Event('beforeunload', { cancelable: true });
    // pas de dispatch sur window : Karma y écoute beforeunload et croirait à un rechargement de page
    component.onBeforeUnload(unload as BeforeUnloadEvent);
    expect(unload.defaultPrevented).toBeTrue();
  });

  it('should undo with Ctrl+Z even when the key reaches the document itself', () => {
    component.updateTable('t1', { x: 3 });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    expect(component.store.content().tables[0].x).toBe(0);
  });

  it('should publish only once on a double click', async () => {
    component.updateTable('t1', { x: 3 });
    const published = [{ ...SALLE, tables: [{ ...T1, x: 3 }] }];
    floorPlan.publish.and.callFake(async () => ({ value: published, error: null }));

    await Promise.all([component.publish(), component.publish()]);

    expect(floorPlan.publish).toHaveBeenCalledTimes(1);
  });

  describe('accolage', () => {
    const T2: Table = { ...T1, id: 't2', name: 'T2', x: 2 };
    let toMetres: jasmine.Spy;

    beforeEach(async () => {
      floorPlan.getDraft.and.resolveTo({
        value: { tables: [T1, T2], decors: [], combinations: [], updatedAt: '2026-10-01T10:00:00Z' }, error: null,
      });
      await create();
      // un seul espion par canevas : plusieurs glissers dans un même test le réutilisent
      toMetres = spyOn(canvas(), 'toMetres');
    });

    /** Glisse `table` jusqu'au point `to` (en mètres, sur le coin haut-gauche) avec un vrai suivi de pointeur */
    function drag(table: Table, to: { x: number, y: number }) {
      toMetres.and.returnValue({ x: to.x, y: to.y });
      component.onTablePointerDown({ item: table, point: { x: table.x, y: table.y }, event: new PointerEvent('pointerdown', { pointerId: 30, clientX: 0, clientY: 0 }) });
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 30, clientX: 50, clientY: 0 }));
      fixture.detectChanges();
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 30, clientX: 50, clientY: 0 }));
      fixture.detectChanges();
    }

    it('should propose a combination when a table is dropped against another', () => {
      drag(T2, { x: 0.7, y: 0 });
      expect(component.accolage()).toEqual({ firstId: 't2', secondId: 't1' });
      expect(text()).toContain('Créer la table T1-T2 ?');
    });

    it('should not undo behind the open accolage dialog', () => {
      drag(T2, { x: 0.7, y: 0 });
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      fixture.detectChanges();

      expect(component.store.content().tables[1].x).toBe(0.7);
      expect(component.accolage()).toEqual({ firstId: 't2', secondId: 't1' });
    });

    it('should only move the tables on "Non, juste les déplacer", and not ask again for that pair', () => {
      drag(T2, { x: 0.7, y: 0 });
      component.dismissAccolage();
      expect(component.store.content().combinations).toEqual([]);
      expect(component.store.content().tables[1].x).toBe(0.7);

      drag({ ...T2, x: 0.7 }, { x: 0.7, y: 0.25 });
      expect(component.accolage()).toBeNull();
    });

    it('should create the combination, select it, and undo it without undoing the move', () => {
      drag(T2, { x: 0.7, y: 0 });
      component.createCombination({ name: 'T1-T2', capacity: 4 });
      fixture.detectChanges();

      const created = component.store.content().combinations[0];
      expect(created).toEqual(jasmine.objectContaining({ name: 'T1-T2', capacity: 4, tableIds: ['t2', 't1'] }));
      expect(component.selection()).toEqual({ kind: 'combination', id: created.id });
      expect(text()).toContain('Brouillon · 2 modifications');

      component.store.undo();
      expect(component.store.content().combinations).toEqual([]);
      expect(component.store.content().tables[1].x).toBe(0.7);
    });

    it('should not propose anything for a pair already combined', () => {
      component.store.apply({ ...component.store.content(), combinations: [{ id: 'c', name: 'T1-T2', capacity: 4, tableIds: ['t1', 't2'] }] });
      drag(T2, { x: 0.7, y: 0 });
      expect(component.accolage()).toBeNull();
    });

    it('should remove the unpublished combinations of a removed unpublished table', () => {
      const t3 = { ...T1, id: 't3', name: 'T3', x: 4 };
      component.store.apply({
        ...component.store.content(),
        tables: [...component.store.content().tables, t3],
        combinations: [{ id: 'c', name: 'T2-T3', capacity: 4, tableIds: ['t2', 't3'] }],
      });
      component.selection.set({ kind: 'table', id: 't3' });
      component.removeSelected();
      expect(component.store.content().combinations).toEqual([]);
    });

    it('should ask before sending a member to another room, and keep it on refusal', async () => {
      const terrasse: FloorPlanZone = { ...SALLE, id: 'terrasse', name: 'Terrasse', order: 1, tables: [] };
      zones.set([SALLE, terrasse]);
      component.store.apply({ ...component.store.content(), combinations: [{ id: 'c', name: 'T1-T2', capacity: 4, tableIds: ['t1', 't2'] }] });
      const confirm = spyOn(TestBed.inject(ModalService), 'confirmModal').and.resolveTo(false);

      component.onPanelChange({ id: 't2', patch: { zoneId: 'terrasse' } });
      await fixture.whenStable();

      expect(confirm).toHaveBeenCalledWith('Changer de salle', jasmine.stringContaining('La combinaison T1-T2 sera désactivée'), 'Déplacer');
      expect(component.store.content().tables[1].zoneId).toBe('salle');
    });

    it('should show the pill again when a member comes back, without creating anything', () => {
      const terrasse: FloorPlanZone = { ...SALLE, id: 'terrasse', name: 'Terrasse', order: 1, tables: [] };
      zones.set([SALLE, terrasse]);
      component.store.apply({ ...component.store.content(), combinations: [{ id: 'c', name: 'T1-T2', capacity: 4, tableIds: ['t1', 't2'] }] });
      component.updateTable('t2', { zoneId: 'terrasse' });
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-combination-id="c"]')).toBeNull();

      component.updateTable('t2', { zoneId: 'salle' });
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-combination-id="c"]')).not.toBeNull();
      expect(component.store.content().combinations.length).toBe(1);
    });

    it('should rename a combination from its panel and flag a name already used by a table', () => {
      component.store.apply({ ...component.store.content(), combinations: [{ id: 'c', name: 'T1-T2', capacity: 4, tableIds: ['t1', 't2'] }] });
      component.onCombinationPanelChange({ id: 'c', patch: { name: 'T1' } });
      fixture.detectChanges();
      expect(component.store.content().combinations[0].name).toBe('T1');
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-combination-id="c"] rect')!.getAttribute('class')).toContain('stroke-red-700');
    });
  });

  it('should not publish while a table is invalid', async () => {
    component.updateTable('t1', { name: '' });
    await component.publish();
    expect(floorPlan.publish).not.toHaveBeenCalled();
  });
});

describe('FloorPlanEditorComponent when the published plan cannot be loaded', () => {
  it('should say so instead of loading forever', async () => {
    const floorPlan = jasmine.createSpyObj<FloorPlanService>('FloorPlanService', ['getDraft'],
      { zones: signal<FloorPlanZone[]>([]), isLoaded: signal(false), loadFailed: signal(true) });
    floorPlan.getDraft.and.resolveTo({ value: null, error: null });
    await TestBed.configureTestingModule({
      imports: [FloorPlanEditorComponent],
      providers: [provideRouter([]), { provide: FloorPlanService, useValue: floorPlan }],
    }).compileComponents();

    const fixture = TestBed.createComponent(FloorPlanEditorComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain("Le plan n'a pas pu être chargé");
  });
});
