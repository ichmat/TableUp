import { computed, signal } from '@angular/core';
import { FloorPlanDraftContent } from '../../../../models';

export const AUTOSAVE_DELAY_MS = 800;
export const DRAFT_HISTORY_LIMIT = 100;

/** `pending` : une modification attend son enregistrement ; `failed` : le dernier a échoué */
export type SaveState = 'saved' | 'pending' | 'saving' | 'failed';

/**
 * Le brouillon de l'éditeur (EDIT-15, EDIT-16) : son contenu, l'annulation par étapes, et l'enregistrement
 * automatique. L'historique vit dans la page seulement ; le brouillon, lui, est enregistré côté API
 */
export class DraftStore {
  private _content = signal<FloorPlanDraftContent>({ tables: [], decors: [], combinations: [] });
  readonly content = this._content.asReadonly();

  private _undo = signal<FloorPlanDraftContent[]>([]);
  private _redo = signal<FloorPlanDraftContent[]>([]);
  readonly canUndo = computed(() => this._undo().length > 0);
  readonly canRedo = computed(() => this._redo().length > 0);

  private _saveState = signal<SaveState>('saved');
  readonly saveState = this._saveState.asReadonly();
  private _saveError = signal<string | null>(null);
  readonly saveError = this._saveError.asReadonly();

  /** Augmente à chaque modification : un enregistrement terminé ne vaut que pour la version qu'il portait */
  private _version = 0;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _saving: Promise<void> | null = null;

  /** `save` résout `null` en cas de succès, le message d'erreur sinon */
  constructor(
    private readonly _save: (content: FloorPlanDraftContent) => Promise<string | null>,
    private readonly _delayMs = AUTOSAVE_DELAY_MS,
  ) {}

  /** Repart d'un contenu déjà enregistré (ou publié) : ni historique, ni enregistrement en attente */
  reset(content: FloorPlanDraftContent) {
    this.clearTimer();
    this._version++;
    this._content.set(content);
    this._undo.set([]);
    this._redo.set([]);
    this._saveState.set('saved');
    this._saveError.set(null);
  }

  apply(next: FloorPlanDraftContent) {
    const current = this._content();
    if (next === current) {
      return;
    }
    this._undo.update((stack) => [...stack, current].slice(-DRAFT_HISTORY_LIMIT));
    this._redo.set([]);
    this._content.set(next);
    this.schedule();
  }

  undo() {
    const stack = this._undo();
    if (stack.length === 0) {
      return;
    }
    this._redo.update((redo) => [...redo, this._content()]);
    this._undo.set(stack.slice(0, -1));
    this._content.set(stack[stack.length - 1]);
    this.schedule();
  }

  redo() {
    const stack = this._redo();
    if (stack.length === 0) {
      return;
    }
    this._undo.update((undo) => [...undo, this._content()]);
    this._redo.set(stack.slice(0, -1));
    this._content.set(stack[stack.length - 1]);
    this.schedule();
  }

  /** Enregistre tout de suite ce qui attend ; résout `true` si tout est enregistré */
  async flush(): Promise<boolean> {
    this.clearTimer();
    while (this._saving !== null) {
      await this._saving;
    }
    if (this._saveState() === 'saved') {
      return true;
    }
    await this.saveNow();
    return this._saveState() === 'saved';
  }

  /**
   * Annule l'enregistrement en attente et attend celui qui est déjà parti : une suppression du brouillon
   * envoyée ensuite ne peut plus être devancée par lui côté API
   */
  async settle(): Promise<void> {
    this.clearTimer();
    while (this._saving !== null) {
      await this._saving;
    }
  }

  dispose() {
    this.clearTimer();
  }

  private schedule() {
    this._version++;
    this._saveState.set('pending');
    this.clearTimer();
    this._timer = setTimeout(() => {
      this._timer = null;
      void this.flush();
    }, this._delayMs);
  }

  private saveNow(): Promise<void> {
    const version = this._version;
    this._saveState.set('saving');
    this._saving = this._save(this._content()).then((error) => {
      this._saving = null;
      // une modification plus récente a déjà relancé l'attente : cet état ne la concerne pas
      if (version !== this._version) {
        return;
      }
      this._saveError.set(error);
      this._saveState.set(error === null ? 'saved' : 'failed');
    });
    return this._saving;
  }

  private clearTimer() {
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }
}
