import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { PlacementApproach, PlanCombination, PlanTable } from '../../../models';
import { Button } from '../../../shared/components/button/button';
import { Input } from '../../../shared/components/inputs/input/input';
import { NumberInput } from '../../../shared/components/inputs/number-input/number-input';
import { combinationErrors, PlanError, PlanField } from '../../../shared/components/floor-plan/logic/plan-rules';

/**
 * PLACE-08, RAPP-04 : déposer sur une paire inédite la fait naître. La fenêtre dit toutes les raisons, propose le nom
 * (« 12-13 ») et la somme des places, l'un et l'autre modifiables : deux rondes accolées perdent souvent une place
 */
@Component({
  imports: [FormField, Button, Input, NumberInput],
  selector: 'app-approach-dialog',
  templateUrl: './approach-dialog.html',
})
export class ApproachDialog {
  approach = input.required<PlacementApproach>();
  guest = input.required<string>();
  /** Les couverts du groupe : moins de places finirait sur « Tables prises » */
  covers = input.required<number>();
  /** Les raisons, une par ligne */
  message = input.required<string>();
  /** Le plan publié : le nom doit rester unique */
  tables = input.required<readonly PlanTable[]>();
  combinations = input.required<readonly PlanCombination[]>();

  confirmed = output<{ name: string, capacity: number }>();
  cancelled = output<void>();

  private _fields = linkedSignal(() => ({ name: this.approach().name, capacity: this.approach().capacity as number | null }));
  protected fields = form(this._fields);

  protected tablesLabel = computed(() => (this.approach().reasons.find((r) => r.kind === 'Approach')?.with ?? []).join(' + '));

  protected errors = computed(() => {
    const fields = this._fields();
    const candidate: PlanCombination = {
      id: '', name: fields.name, capacity: fields.capacity ?? 0, tableIds: [...this.approach().tableIds], isActive: false,
    };
    const errors = combinationErrors(candidate, this.tables(), this.combinations());
    const covers = this.covers();
    if (fields.capacity !== null && fields.capacity < covers) {
      errors.push({ field: 'capacity', message: `Au moins ${covers} places pour ce groupe` });
    }
    return errors;
  });

  protected errorsOf(field: PlanField): PlanError[] {
    return this.errors().filter((error) => error.field === field);
  }

  protected submit() {
    if (this.errors().length > 0) {
      return;
    }
    const { name, capacity } = this._fields();
    this.confirmed.emit({ name: name.trim(), capacity: capacity! });
  }
}
