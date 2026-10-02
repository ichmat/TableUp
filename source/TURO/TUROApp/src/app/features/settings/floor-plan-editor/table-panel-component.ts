import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { DraftTable, PlanTable, TableShape, Zone } from '../../../models';
import { Button } from '../../../shared/components/button/button';
import { Input } from '../../../shared/components/inputs/input/input';
import { NumberInput } from '../../../shared/components/inputs/number-input/number-input';
import { normalizeRotation, ROTATION_STEP } from './logic/geometry';
import { SHAPE_LABELS } from './logic/palette';
import { PlanError, PlanField } from './logic/plan-rules';
import { fromCentimetres, toCentimetres } from './logic/units';

/** Les champs tels qu'on les saisit : dimensions en centimètres, vide = `null` */
interface TableFields {
  name: string,
  capacity: number | null,
  widthCm: number | null,
  heightCm: number | null,
}

const toFields = (table: PlanTable): TableFields => ({
  name: table.name,
  capacity: table.capacity,
  widthCm: toCentimetres(table.width),
  heightCm: toCentimetres(table.height),
});

/**
 * Le panneau de la table sélectionnée (EDIT-04, EDIT-07). Un champ s'applique quand on le quitte, un bouton tout
 * de suite : chaque modification entre ainsi une fois dans l'historique ↶ ↷
 */
@Component({
  imports: [FormField, Button, Input, NumberInput],
  selector: 'app-table-panel-component',
  templateUrl: './table-panel-component.html',
})
export class TablePanelComponent {
  table = input.required<DraftTable>();
  zones = input.required<readonly Zone[]>();
  errors = input<readonly PlanError[]>([]);
  /** Une table publiée ne se retire pas : elle se désactivera (lot 5) */
  isPublished = input(true);

  changed = output<{ id: string, patch: Partial<DraftTable> }>();
  duplicate = output<void>();
  remove = output<void>();

  protected readonly shapes: TableShape[] = ['Round', 'Square', 'Rectangular'];
  protected readonly shapeLabels = SHAPE_LABELS;

  // Repart de la table à chaque modification appliquée (ou annulée) : la saisie en cours, elle, est gardée
  private _fields = linkedSignal(() => toFields(this.table()));
  protected fields = form(this._fields);

  protected isRound = computed(() => this.table().shape === 'Round');

  protected errorsOf(field: PlanField): PlanError[] {
    return this.errors().filter((error) => error.field === field);
  }

  /** Quitter un champ applique ce qui a changé ; l'éditeur l'appelle aussi avant de changer de sélection */
  commitFields() {
    const fields = this._fields();
    const table = this.table();
    const patch: Partial<DraftTable> = {};

    const name = fields.name.trim();
    if (name !== table.name) {
      patch.name = name;
    }
    const capacity = fields.capacity ?? 0;
    if (capacity !== table.capacity) {
      patch.capacity = capacity;
    }
    const width = fromCentimetres(fields.widthCm ?? 0);
    const height = this.isRound() ? width : fromCentimetres(fields.heightCm ?? 0);
    if (width !== table.width) {
      patch.width = width;
    }
    if (height !== table.height) {
      patch.height = height;
    }

    if (Object.keys(patch).length > 0) {
      this.changed.emit({ id: this.table().id, patch });
    }
  }

  /** Une ronde n'a qu'un diamètre : elle prend la largeur */
  protected setShape(shape: TableShape) {
    if (shape === this.table().shape) {
      return;
    }
    this.changed.emit({ id: this.table().id, patch: shape === 'Round' ? { shape, height: this.table().width } : { shape } });
  }

  protected rotate(direction: -1 | 1) {
    this.changed.emit({ id: this.table().id, patch: { rotation: normalizeRotation(this.table().rotation + direction * ROTATION_STEP) } });
  }

  /** L'éditeur peut demander confirmation, et refuser : la liste revient sur la salle actuelle, elle suivra la table */
  protected moveToZone(event: Event) {
    const select = event.target as HTMLSelectElement;
    const zoneId = select.value;
    if (zoneId !== this.table().zoneId) {
      this.changed.emit({ id: this.table().id, patch: { zoneId } });
      select.value = this.table().zoneId;
    }
  }
}
