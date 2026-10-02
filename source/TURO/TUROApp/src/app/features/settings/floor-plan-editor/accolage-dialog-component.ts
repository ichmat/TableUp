import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { PlanCombination, PlanTable } from '../../../models';
import { Button } from '../../../shared/components/button/button';
import { Input } from '../../../shared/components/inputs/input/input';
import { NumberInput } from '../../../shared/components/inputs/number-input/number-input';
import { defaultCombinationName } from './logic/accolage';
import { combinationErrors, PlanError, PlanField } from './logic/plan-rules';

/**
 * Deux tables viennent d'être collées (EDIT-13) : on propose d'en faire une table virtuelle. Le système ne déduit rien
 * seul (EDIT-14) : « Non, juste les déplacer » pèse autant que « Créer »
 */
@Component({
  imports: [FormField, Button, Input, NumberInput],
  selector: 'app-accolage-dialog-component',
  templateUrl: './accolage-dialog-component.html',
})
export class AccolageDialogComponent {
  first = input.required<PlanTable>();
  second = input.required<PlanTable>();
  /** Le brouillon : le nom proposé doit rester unique */
  tables = input.required<readonly PlanTable[]>();
  combinations = input.required<readonly PlanCombination[]>();

  create = output<{ name: string, capacity: number }>();
  dismiss = output<void>();

  private _fields = linkedSignal(() => ({
    name: defaultCombinationName(this.first().name, this.second().name),
    capacity: (this.first().capacity + this.second().capacity) as number | null,
  }));
  protected fields = form(this._fields);

  protected title = computed(() => defaultCombinationName(this.first().name, this.second().name));
  protected members = computed(() =>
    [this.first(), this.second()].sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })));

  protected errors = computed(() => {
    const fields = this._fields();
    const candidate: PlanCombination = {
      id: '', name: fields.name, capacity: fields.capacity ?? 0, tableIds: [this.first().id, this.second().id],
    };
    return combinationErrors(candidate, this.tables(), this.combinations());
  });

  protected errorsOf(field: PlanField): PlanError[] {
    return this.errors().filter((error) => error.field === field);
  }

  protected submit() {
    if (this.errors().length > 0) {
      return;
    }
    const fields = this._fields();
    this.create.emit({ name: fields.name.trim(), capacity: fields.capacity ?? 0 });
  }
}
