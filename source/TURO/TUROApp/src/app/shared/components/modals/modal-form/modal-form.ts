import { Component, computed, inject, input, signal, WritableSignal } from '@angular/core';
import { ModalRequestModel, ModalService } from '../../../../core/services/modal/modal.service';
import { Input } from '../../inputs/input/input';
import { NumberInput } from '../../inputs/number-input/number-input';
import { DateInput } from '../../inputs/date-input/date-input';
import { TimeInput } from '../../inputs/time-input/time-input';

interface ModalFormInputBase<TValue> {
  label: string,
  /** Appelé à la validation du formulaire, une fois tous les champs vérifiés */
  setValue: (value: TValue) => void,
  defaultValue?: TValue,
  /** Vérifie la valeur du field, renvoyer un string pour afficher un message d'erreur */
  checkValue?: (value: TValue) => string | null,
}

/** Le type de `setValue` / `defaultValue` / `checkValue` découle de `valueType` */
export type ModalFormInput =
  | ({ valueType: 'string' | 'date' | 'time' } & ModalFormInputBase<string>)
  | ({ valueType: 'number' } & ModalFormInputBase<number | null>);

export interface ModalFormModel extends ModalRequestModel {
  kind: 'form',
  inputs: ModalFormInput[],
  onValidate: () => void,
  onCancel: () => void,
  desc?: string,
}

type FieldState = {
  label: string,
  check: () => string | null,
  commit: () => void,
} & (
  | { type: 'string' | 'date' | 'time'; value: WritableSignal<string> }
  | { type: 'number'; value: WritableSignal<number | null> }
);

function toState(input: ModalFormInput): FieldState {
  switch (input.valueType) {
    case 'number': {
      const value = signal(input.defaultValue ?? null);
      return {
        type: 'number', label: input.label, value,
        check: () => input.checkValue?.(value()) ?? null,
        commit: () => input.setValue(value()),
      };
    }
    default: {
      const value = signal(input.defaultValue ?? '');
      return {
        type: input.valueType, label: input.label, value,
        check: () => input.checkValue?.(value()) ?? null,
        commit: () => input.setValue(value()),
      };
    }
  }
}

@Component({
  imports: [Input, NumberInput, DateInput, TimeInput],
  selector: 'app-modal-form',
  templateUrl: './modal-form.html',
})
export class ModalForm {
  private _modalService = inject(ModalService);
  model = input.required<ModalFormModel>();

  fields = computed(() => this.model().inputs.map(toState));

  async validate() {
    for (const field of this.fields()) {
      const message = field.check();
      if (message !== null) {
        await this._modalService.infoModal("Erreur", message);
        return;
      }
    }

    // Champs validés, envoi des données
    this.fields().forEach(field => field.commit());
    this.model().onValidate();
  }
}
