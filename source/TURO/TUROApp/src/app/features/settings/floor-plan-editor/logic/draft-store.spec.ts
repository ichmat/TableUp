import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { FloorPlanDraftContent } from '../../../../models';
import { AUTOSAVE_DELAY_MS, DraftStore } from './draft-store';

const content = (name: string): FloorPlanDraftContent => ({
  tables: [{ id: 'a', zoneId: 'z', name, capacity: 2, shape: 'Round', x: 0, y: 0, width: 0.7, height: 0.7, rotation: 0 }],
  decors: [],
  combinations: [],
});

describe('DraftStore', () => {
  let save: jasmine.Spy<(c: FloorPlanDraftContent) => Promise<string | null>>;
  let store: DraftStore;

  beforeEach(() => {
    save = jasmine.createSpy('save').and.resolveTo(null);
    store = new DraftStore(save);
    store.reset(content('T1'));
  });

  afterEach(() => store.dispose());

  it('should save once, after the edits settle', fakeAsync(() => {
    store.apply(content('T2'));
    store.apply(content('T3'));
    expect(store.saveState()).toBe('pending');

    tick(AUTOSAVE_DELAY_MS);
    flushMicrotasks();

    expect(save).toHaveBeenCalledOnceWith(content('T3'));
    expect(store.saveState()).toBe('saved');
  }));

  it('should undo and redo, then save the restored state', fakeAsync(() => {
    store.apply(content('T2'));
    store.undo();
    expect(store.content().tables[0].name).toBe('T1');
    expect(store.canRedo()).toBeTrue();

    store.redo();
    expect(store.content().tables[0].name).toBe('T2');
    tick(AUTOSAVE_DELAY_MS);
    flushMicrotasks();
    expect(save).toHaveBeenCalledOnceWith(content('T2'));
  }));

  it('should forget the redo branch after a new edit', () => {
    store.apply(content('T2'));
    store.undo();
    store.apply(content('T3'));
    expect(store.canRedo()).toBeFalse();
  });

  it('should keep at most 100 undo steps', () => {
    for (let i = 0; i < 150; i++) {
      store.apply(content(`T${i}`));
    }
    let steps = 0;
    while (store.canUndo()) {
      store.undo();
      steps++;
    }
    expect(steps).toBe(100);
  });

  it('should not claim "saved" when an edit arrived during the save', fakeAsync(() => {
    let finish!: (error: string | null) => void;
    save.and.returnValue(new Promise((resolve) => finish = resolve));

    store.apply(content('T2'));
    tick(AUTOSAVE_DELAY_MS);
    expect(store.saveState()).toBe('saving');

    store.apply(content('T3'));
    finish(null);
    flushMicrotasks();
    expect(store.saveState()).toBe('pending');

    save.and.resolveTo(null);
    tick(AUTOSAVE_DELAY_MS);
    flushMicrotasks();
    expect(save).toHaveBeenCalledWith(content('T3'));
    expect(store.saveState()).toBe('saved');
  }));

  it('should report a failed save, and retry on flush', fakeAsync(() => {
    save.and.resolveTo('Brouillon refusé');
    store.apply(content('T2'));
    tick(AUTOSAVE_DELAY_MS);
    flushMicrotasks();
    expect(store.saveState()).toBe('failed');
    expect(store.saveError()).toBe('Brouillon refusé');

    save.and.resolveTo(null);
    let saved: boolean | undefined;
    store.flush().then((result) => saved = result);
    flushMicrotasks();
    expect(saved).toBeTrue();
  }));

  it('should never save a draft that was reset before its delay', fakeAsync(() => {
    store.apply(content('T2'));
    store.reset(content('T1'));
    tick(AUTOSAVE_DELAY_MS * 2);
    flushMicrotasks();
    expect(save).not.toHaveBeenCalled();
    expect(store.canUndo()).toBeFalse();
  }));
});

describe('DraftStore settle', () => {
  it('should wait for the save in flight, so a discard reaches the API after it', fakeAsync(() => {
    let finish!: (error: string | null) => void;
    const store = new DraftStore(() => new Promise((resolve) => finish = resolve));
    store.reset(content('T1'));
    store.apply(content('T2'));
    tick(AUTOSAVE_DELAY_MS);

    let settled = false;
    store.settle().then(() => settled = true);
    flushMicrotasks();
    expect(settled).toBeFalse();

    finish(null);
    flushMicrotasks();
    expect(settled).toBeTrue();
    store.dispose();
  }));
});
