import { Component, input, linkedSignal, output } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { DecorType, DraftDecor, PlanDecor, Zone } from '../../../models';
import { Button } from '../../../shared/components/button/button';
import { Input } from '../../../shared/components/inputs/input/input';
import { NumberInput } from '../../../shared/components/inputs/number-input/number-input';
import { normalizeRotation, ROTATION_STEP } from './logic/geometry';
import { DECOR_LABELS } from './logic/palette';
import { PlanError, PlanField } from './logic/plan-rules';
import { fromCentimetres, toCentimetres } from './logic/units';

interface DecorFields {
  label: string,
  widthCm: number | null,
  heightCm: number | null,
}

const toFields = (decor: PlanDecor): DecorFields => ({
  label: decor.label ?? '',
  widthCm: toCentimetres(decor.width),
  heightCm: toCentimetres(decor.height),
});

/** Le panneau du décor sélectionné : comme une table, sans nom ni places, et il se supprime vraiment */
@Component({
  imports: [FormField, Button, Input, NumberInput],
  selector: 'app-decor-panel-component',
  templateUrl: './decor-panel-component.html',
})
export class DecorPanelComponent {
  decor = input.required<DraftDecor>();
  zones = input.required<readonly Zone[]>();
  errors = input<readonly PlanError[]>([]);

  changed = output<{ id: string, patch: Partial<DraftDecor> }>();
  duplicate = output<void>();
  remove = output<void>();

  protected readonly types = Object.keys(DECOR_LABELS) as DecorType[];
  protected readonly typeLabels = DECOR_LABELS;

  private _fields = linkedSignal(() => toFields(this.decor()));
  protected fields = form(this._fields);

  protected errorsOf(field: PlanField): PlanError[] {
    return this.errors().filter((error) => error.field === field);
  }

  /** Applique ce qui a changé ; appelé aussi par l'éditeur avant de changer de sélection */
  commitFields() {
    const fields = this._fields();
    const decor = this.decor();
    const patch: Partial<DraftDecor> = {};
    const label = fields.label.trim() === '' ? null : fields.label.trim();
    if (label !== decor.label) {
      patch.label = label;
    }
    const width = fromCentimetres(fields.widthCm ?? 0);
    const height = fromCentimetres(fields.heightCm ?? 0);
    if (width !== decor.width) {
      patch.width = width;
    }
    if (height !== decor.height) {
      patch.height = height;
    }
    if (Object.keys(patch).length > 0) {
      this.changed.emit({ id: this.decor().id, patch });
    }
  }

  protected setType(event: Event) {
    const type = (event.target as HTMLSelectElement).value as DecorType;
    if (type !== this.decor().type) {
      this.changed.emit({ id: this.decor().id, patch: { type } });
    }
  }

  protected rotate(direction: -1 | 1) {
    this.changed.emit({ id: this.decor().id, patch: { rotation: normalizeRotation(this.decor().rotation + direction * ROTATION_STEP) } });
  }

  protected moveToZone(event: Event) {
    const zoneId = (event.target as HTMLSelectElement).value;
    if (zoneId !== this.decor().zoneId) {
      this.changed.emit({ id: this.decor().id, patch: { zoneId } });
    }
  }
}
