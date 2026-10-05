import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { PlanCombination, PlanTable } from '../../../models';
import { Button } from '../../../shared/components/button/button';
import { Input } from '../../../shared/components/inputs/input/input';
import { NumberInput } from '../../../shared/components/inputs/number-input/number-input';
import { defaultCombinationName } from './logic/accolage';
import { combinationErrors, PlanError, PlanField } from './logic/plan-rules';

/**
 * Des tables viennent d'être collées (EDIT-13) : on propose d'en faire une table virtuelle, ou de réactiver celle qui
 * les réunissait déjà. Le système ne déduit rien seul (EDIT-14) : « Non, juste les déplacer » pèse autant que l'autre bouton
 */
@Component({
  imports: [FormField, Button, Input, NumberInput],
  selector: 'app-accolage-dialog-component',
  templateUrl: './accolage-dialog-component.html',
})
export class AccolageDialogComponent {
  /** Les tables à réunir : celles qu'on a déplacées, puis celles qu'elles rejoignent */
  members = input.required<readonly PlanTable[]>();
  /** La combinaison qui réunit déjà ces tables, en sommeil : on la réactive au lieu d'en créer une */
  existing = input<PlanCombination | null>(null);
  /** Les combinaisons actives qui partagent une de ces tables : elles se désactiveront */
  deactivated = input<readonly PlanCombination[]>([]);
  /** Le brouillon : le nom proposé doit rester unique */
  tables = input.required<readonly PlanTable[]>();
  combinations = input.required<readonly PlanCombination[]>();

  create = output<{ name: string, capacity: number }>();
  reactivate = output<void>();
  dismiss = output<void>();

  private _defaultName = computed(() => defaultCombinationName(this.members().map((table) => table.name)));

  private _fields = linkedSignal(() => ({
    name: this._defaultName(),
    capacity: this.members().reduce((sum, table) => sum + table.capacity, 0) as number | null,
  }));
  protected fields = form(this._fields);

  protected title = computed(() => this.existing()?.name ?? this._defaultName());
  protected sortedMembers = computed(() =>
    [...this.members()].sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })));

  /** « 12-13 sera désactivée. » */
  protected deactivationNote = computed(() => {
    const names = this.deactivated().map((combination) => combination.name);
    if (names.length === 0) {
      return null;
    }
    return names.length > 1 ? `${names.join(', ')} seront désactivées.` : `${names[0]} sera désactivée.`;
  });

  protected errors = computed(() => {
    if (this.existing() !== null) {
      return [];
    }
    const fields = this._fields();
    const deactivatedIds = this.deactivated().map((combination) => combination.id);
    // on juge l'état d'après : les combinaisons que la création désactive ne comptent plus comme actives
    const after = this.combinations().map((combination) =>
      deactivatedIds.includes(combination.id) ? { ...combination, isActive: false } : combination);
    const candidate: PlanCombination = {
      id: '', name: fields.name, capacity: fields.capacity ?? 0, tableIds: this.members().map((table) => table.id), isActive: true,
    };
    return combinationErrors(candidate, this.tables(), after);
  });

  protected errorsOf(field: PlanField): PlanError[] {
    return this.errors().filter((error) => error.field === field);
  }

  protected submit() {
    if (this.existing() !== null) {
      this.reactivate.emit();
      return;
    }
    if (this.errors().length > 0) {
      return;
    }
    const fields = this._fields();
    this.create.emit({ name: fields.name.trim(), capacity: fields.capacity ?? 0 });
  }
}
