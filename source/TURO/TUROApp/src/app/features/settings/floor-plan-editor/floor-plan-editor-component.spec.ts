import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { ApiError, DraftCombination, FloorPlanZone, Table } from '../../../models';
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
    const T3: Table = { ...T1, id: 't3', name: 'T3', x: 3 };
    let toMetres: jasmine.Spy;

    function combination(patch: Partial<DraftCombination>): DraftCombination {
      return { id: 'p', name: 'T1-T2', capacity: 4, tableIds: ['t1', 't2'], isActive: true, ...patch };
    }

    /** T1 et T2 collées, T3 à part, plus ces combinaisons */
    function arrange(...combinations: DraftCombination[]) {
      component.store.apply({ tables: [T1, { ...T2, x: 0.7 }, T3], decors: [], combinations });
      fixture.detectChanges();
    }

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
      expect(component.accolage()).toEqual({ tableIds: ['t2', 't1'], existingId: null, deactivatedIds: [] });
      expect(text()).toContain('Créer la table T1-T2 ?');
    });

    it('should not undo behind the open accolage dialog', () => {
      drag(T2, { x: 0.7, y: 0 });
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      fixture.detectChanges();

      expect(component.store.content().tables[1].x).toBe(0.7);
      expect(component.accolage()).toEqual({ tableIds: ['t2', 't1'], existingId: null, deactivatedIds: [] });
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
      expect(created).toEqual(jasmine.objectContaining({ name: 'T1-T2', capacity: 4, tableIds: ['t2', 't1'], isActive: true }));
      expect(component.selection()).toEqual({ kind: 'combination', id: created.id });
      expect(text()).toContain('Brouillon · 2 modifications');

      component.store.undo();
      expect(component.store.content().combinations).toEqual([]);
      expect(component.store.content().tables[1].x).toBe(0.7);
    });

    it('should propose the chain against an active combination, and deactivate it on creation', () => {
      arrange(combination({}));
      drag(T3, { x: 1.4, y: 0 });
      expect(component.accolage()).toEqual({ tableIds: ['t3', 't1', 't2'], existingId: null, deactivatedIds: ['p'] });
      expect(text()).toContain('Créer la table T1-T2-T3 ?');
      expect(text()).toContain('T1-T2 sera désactivée.');

      component.createCombination({ name: 'T1-T2-T3', capacity: 6 });
      fixture.detectChanges();
      const [pair, chain] = component.store.content().combinations;
      expect(pair.isActive).toBeFalse();
      expect(chain).toEqual(jasmine.objectContaining({ name: 'T1-T2-T3', tableIds: ['t3', 't1', 't2'], isActive: true }));
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-combination-id="p"]')).toBeNull();

      component.store.undo();
      expect(component.store.content().combinations).toEqual([combination({})]);
    });

    it('should offer to reactivate a known set instead of creating it', () => {
      arrange(combination({ isActive: false }));
      drag({ ...T2, x: 0.7 }, { x: 0.7, y: 0.25 });
      expect(component.accolage()).toEqual({ tableIds: ['t2', 't1'], existingId: 'p', deactivatedIds: [] });
      expect(text()).toContain('Réactiver la table T1-T2 ?');

      component.reactivateCombination();
      expect(component.store.content().combinations).toEqual([combination({})]);
      expect(component.selection()).toEqual({ kind: 'combination', id: 'p' });
    });

    /** Glisse la pastille de `item` de `from` à `to` (en mètres) avec un vrai suivi de pointeur */
    function dragPill(item: DraftCombination, from: { x: number, y: number }, to: { x: number, y: number }) {
      toMetres.and.returnValue(to);
      component.onCombinationPointerDown({ item, point: from, event: new PointerEvent('pointerdown', { pointerId: 31, clientX: 0, clientY: 0 }) });
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 31, clientX: 50, clientY: 0 }));
      fixture.detectChanges();
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 31, clientX: 50, clientY: 0 }));
      fixture.detectChanges();
    }

    const position = (id: string) => {
      const table = component.store.content().tables.find((t) => t.id === id)!;
      return { x: table.x, y: table.y };
    };

    it('should move all the tables of a combination dragged by its pill, in one undo step', () => {
      arrange(combination({}));
      dragPill(combination({}), { x: 0.7, y: 0.35 }, { x: 2.7, y: 1.35 });

      expect(position('t1')).toEqual({ x: 2, y: 1 });
      expect(position('t2')).toEqual({ x: 2.7, y: 1 });
      expect(component.selection()).toEqual({ kind: 'combination', id: 'p' });

      component.store.undo();
      expect(position('t1')).toEqual({ x: 0, y: 0 });
      expect(position('t2')).toEqual({ x: 0.7, y: 0 });
    });

    it('should keep the whole group inside the room, with the gaps between its tables', () => {
      arrange(combination({}));
      dragPill(combination({}), { x: 0.7, y: 0.35 }, { x: 9, y: 0.35 });
      // la salle fait 8 m : le groupe de 1,4 m s'arrête contre le mur
      expect(position('t1')).toEqual({ x: 6.6, y: 0 });
      expect(position('t2')).toEqual({ x: 7.3, y: 0 });
    });

    it('should propose the chain when a combination is dragged against a table', () => {
      arrange(combination({}));
      // le bord droit du groupe vient contre T3 (x = 3)
      dragPill(combination({}), { x: 0.7, y: 0.35 }, { x: 2.3, y: 0.35 });
      expect(component.accolage()).toEqual({ tableIds: ['t1', 't2', 't3'], existingId: null, deactivatedIds: ['p'] });
    });

    it('should only select the combination on a press without movement', () => {
      arrange(combination({}));
      component.onCombinationPointerDown({ item: combination({}), point: { x: 0.7, y: 0.35 }, event: new PointerEvent('pointerdown', { pointerId: 32 }) });
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 32 }));
      expect(component.selection()).toEqual({ kind: 'combination', id: 'p' });
      expect(position('t1')).toEqual({ x: 0, y: 0 });
      expect(component.accolage()).toBeNull();
    });

    /** T1, T2, T3 en ligne et collées, la chaîne active, la paire T1-T2 en sommeil */
    function arrangeChain() {
      const chain = combination({ id: 'chain', name: 'T1-T2-T3', capacity: 6, tableIds: ['t1', 't2', 't3'] });
      component.store.apply({
        tables: [T1, { ...T2, x: 0.7 }, { ...T3, x: 1.4 }], decors: [],
        combinations: [combination({ isActive: false }), chain],
      });
      fixture.detectChanges();
    }
    const activity = () => Object.fromEntries(component.store.content().combinations.map((c) => [c.id, c.isActive]));

    it('should propose to separate a table pulled away from its active combination, and reactivate the rest it knows', () => {
      arrangeChain();
      drag({ ...T3, x: 1.4 }, { x: 3, y: 2 });
      expect(component.separation()).toEqual({ combinationId: 'chain', reactivatedId: 'p' });
      expect(text()).toContain('Séparer la table T1-T2-T3 ?');
      expect(text()).toContain('T1-T2 redevient active');

      component.separateCombination();
      expect(activity()).toEqual({ p: true, chain: false });

      component.store.undo();
      expect(activity()).toEqual({ p: false, chain: true });
      expect(position('t3')).toEqual({ x: 3, y: 2 });
    });

    it('should keep the combination on "Non, juste la déplacer" and not ask again', () => {
      arrangeChain();
      drag({ ...T3, x: 1.4 }, { x: 3, y: 2 });
      component.dismissSeparation();
      expect(activity()).toEqual({ p: false, chain: true });

      drag({ ...T3, x: 3, y: 2 }, { x: 1.4, y: 0 });
      drag({ ...T3, x: 1.4, y: 0 }, { x: 3, y: 2 });
      expect(component.separation()).toBeNull();
    });

    it('should only open the accolage when the pulled table is glued elsewhere', () => {
      arrangeChain();
      const t4 = { ...T1, id: 't4', name: 'T4', x: 4, y: 2 };
      component.store.apply({ ...component.store.content(), tables: [...component.store.content().tables, t4] });
      drag({ ...T3, x: 1.4 }, { x: 3.3, y: 2 });
      expect(component.separation()).toBeNull();
      expect(component.accolage()).toEqual({ tableIds: ['t3', 't4'], existingId: null, deactivatedIds: ['chain'] });
    });

    /** T3 sortie de la chaîne et collée contre T4 : la fenêtre d'accolage s'ouvre */
    function pullT3AgainstT4() {
      arrangeChain();
      const t4 = { ...T1, id: 't4', name: 'T4', x: 4, y: 2 };
      component.store.apply({ ...component.store.content(), tables: [...component.store.content().tables, t4] });
      drag({ ...T3, x: 1.4 }, { x: 3.3, y: 2 });
    }

    it('should offer to separate once the accolage of a pulled table is declined', () => {
      pullT3AgainstT4();
      component.dismissAccolage();
      expect(component.separation()).toEqual({ combinationId: 'chain', reactivatedId: 'p' });
    });

    it('should not offer to separate once the accolage of a pulled table is accepted', () => {
      pullT3AgainstT4();
      component.createCombination({ name: 'T3-T4', capacity: 4 });
      component.dismissAccolage();
      expect(component.separation()).toBeNull();
      expect(activity()).toEqual(jasmine.objectContaining({ chain: false }));
    });

    it('should separate from the panel without moving the tables, and keep the combination selected', () => {
      arrangeChain();
      component.selection.set({ kind: 'combination', id: 'chain' });
      component.separateSelectedCombination();
      fixture.detectChanges();
      expect(activity()).toEqual({ p: false, chain: false });
      expect(position('t3')).toEqual({ x: 1.4, y: 0 });
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-combination-id="chain"]')).toBeNull();
      // en sommeil, elle reste à portée : on peut encore la retirer si elle n'a jamais été publiée
      expect(component.selection()).toEqual({ kind: 'combination', id: 'chain' });
      expect(text()).toContain('En sommeil');
      expect(text()).toContain('Retirer');
    });

    it('should deactivate the combination of a member sent to another room, in one undo step', async () => {
      const terrasse: FloorPlanZone = { ...SALLE, id: 'terrasse', name: 'Terrasse', order: 1, tables: [] };
      zones.set([SALLE, terrasse]);
      arrange(combination({}));
      spyOn(TestBed.inject(ModalService), 'confirmModal').and.resolveTo(true);

      component.onPanelChange({ id: 't2', patch: { zoneId: 'terrasse' } });
      await fixture.whenStable();
      expect(component.store.content().tables[1].zoneId).toBe('terrasse');
      expect(component.store.content().combinations[0].isActive).toBeFalse();

      component.store.undo();
      expect(component.store.content().tables[1].zoneId).toBe('salle');
      expect(component.store.content().combinations[0].isActive).toBeTrue();
    });

    it('should not ask for an inactive combination when a member changes room', () => {
      const terrasse: FloorPlanZone = { ...SALLE, id: 'terrasse', name: 'Terrasse', order: 1, tables: [] };
      zones.set([SALLE, terrasse]);
      arrange(combination({ isActive: false }));
      const confirm = spyOn(TestBed.inject(ModalService), 'confirmModal');

      component.onPanelChange({ id: 't2', patch: { zoneId: 'terrasse' } });
      expect(confirm).not.toHaveBeenCalled();
      expect(component.store.content().tables[1].zoneId).toBe('terrasse');
    });

    it('should not propose anything for a set already active', () => {
      component.store.apply({ ...component.store.content(), combinations: [{ id: 'c', name: 'T1-T2', capacity: 4, tableIds: ['t1', 't2'], isActive: true }] });
      drag(T2, { x: 0.7, y: 0 });
      expect(component.accolage()).toBeNull();
    });

    it('should remove the unpublished combinations of a removed unpublished table', () => {
      const t3 = { ...T1, id: 't3', name: 'T3', x: 4 };
      component.store.apply({
        ...component.store.content(),
        tables: [...component.store.content().tables, t3],
        combinations: [{ id: 'c', name: 'T2-T3', capacity: 4, tableIds: ['t2', 't3'], isActive: true }],
      });
      component.selection.set({ kind: 'table', id: 't3' });
      component.removeSelected();
      expect(component.store.content().combinations).toEqual([]);
    });

    it('should ask before sending a member to another room, and keep it on refusal', async () => {
      const terrasse: FloorPlanZone = { ...SALLE, id: 'terrasse', name: 'Terrasse', order: 1, tables: [] };
      zones.set([SALLE, terrasse]);
      component.store.apply({ ...component.store.content(), combinations: [{ id: 'c', name: 'T1-T2', capacity: 4, tableIds: ['t1', 't2'], isActive: true }] });
      const confirm = spyOn(TestBed.inject(ModalService), 'confirmModal').and.resolveTo(false);

      component.onPanelChange({ id: 't2', patch: { zoneId: 'terrasse' } });
      await fixture.whenStable();

      expect(confirm).toHaveBeenCalledWith('Changer de salle', jasmine.stringContaining('La combinaison T1-T2 sera désactivée : ses tables ne seront plus dans la même salle.'), 'Déplacer');
      expect(component.store.content().tables[1].zoneId).toBe('salle');
    });

    it('should show the pill again when a member comes back, without creating anything', () => {
      const terrasse: FloorPlanZone = { ...SALLE, id: 'terrasse', name: 'Terrasse', order: 1, tables: [] };
      zones.set([SALLE, terrasse]);
      component.store.apply({ ...component.store.content(), combinations: [{ id: 'c', name: 'T1-T2', capacity: 4, tableIds: ['t1', 't2'], isActive: true }] });
      component.updateTable('t2', { zoneId: 'terrasse' });
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-combination-id="c"]')).toBeNull();

      component.updateTable('t2', { zoneId: 'salle' });
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-combination-id="c"]')).not.toBeNull();
      expect(component.store.content().combinations.length).toBe(1);
    });

    it('should rename a combination from its panel and flag a name already used by a table', () => {
      component.store.apply({ ...component.store.content(), combinations: [{ id: 'c', name: 'T1-T2', capacity: 4, tableIds: ['t1', 't2'], isActive: true }] });
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
