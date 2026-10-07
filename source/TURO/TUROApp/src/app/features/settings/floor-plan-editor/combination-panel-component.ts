import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { DraftCombination } from '../../../models';
import { Button } from '../../../shared/components/button/button';
import { Input } from '../../../shared/components/inputs/input/input';
import { NumberInput } from '../../../shared/components/inputs/number-input/number-input';
import { PlanError, PlanField } from './logic/plan-rules';

/** Le panneau d'une combinaison : nom et places ; ses tables ne changent jamais */
@Component({
  imports: [FormField, Button, Input, NumberInput],
  selector: 'app-combination-panel-component',
  templateUrl: './combination-panel-component.html',
})
export class CombinationPanelComponent {
  combination = input.required<DraftCombination>();
  memberNames = input.required<readonly string[]>();
  errors = input<readonly PlanError[]>([]);
  /** Une combinaison publiée ne se retire jamais : séparée, elle reste en mémoire */
  isPublished = input(true);

  changed = output<{ id: string, patch: Partial<DraftCombination> }>();
  remove = output<void>();
  separate = output<void>();

  private _fields = linkedSignal(() => ({ name: this.combination().name, capacity: this.combination().capacity as number | null }));
  protected fields = form(this._fields);

  /** « 12, 13 et 14 » */
  protected members = computed(() => {
    const names = this.memberNames();
    return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
  });

  protected errorsOf(field: PlanField): PlanError[] {
    return this.errors().filter((error) => error.field === field);
  }

  /** Quitter un champ ou appuyer sur Entrée applique ce qui a changé ; l'éditeur l'appelle aussi avant de changer de sélection */
  commitFields() {
    const fields = this._fields();
    const combination = this.combination();
    const patch: Partial<DraftCombination> = {};
    const name = fields.name.trim();
    if (name !== combination.name) {
      patch.name = name;
    }
    const capacity = fields.capacity ?? 0;
    if (capacity !== combination.capacity) {
      patch.capacity = capacity;
    }
    if (Object.keys(patch).length > 0) {
      this.changed.emit({ id: combination.id, patch });
    }
  }
}
