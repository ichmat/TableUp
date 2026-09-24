import { Component, computed, inject, input, signal, WritableSignal } from '@angular/core';
import { ModalRequestModel, ModalService } from '../../../../core/services/modal/modal.service';
import { Input } from '../../inputs/input/input';
import { NumberInput } from '../../inputs/number-input/number-input';
import { DateInput } from '../../inputs/date-input/date-input';
import { TimeInput } from '../../inputs/time-input/time-input';

/**
 * `setValue` : appelé à la validation du formulaire, une fois tous les champs vérifiés.
 * `checkValue` : vérifie la valeur du field, renvoyer un string pour afficher un message d'erreur.
 * Les deux reçoivent `null` pour un champ sans valeur, sauf si `required` est à `true`.
 */
type ModalFormInputBase<TValue> = {
  label: string,
  defaultValue?: TValue | null,
} & (
  | {
    /** Valeur nécessaire : vide (`null`, liste vide, case non cochée), le formulaire refuse la validation */
    required: true,
    setValue: (value: TValue) => void,
    checkValue?: (value: TValue) => string | null,
  }
  | {
    required?: false,
    setValue: (value: TValue | null) => void,
    checkValue?: (value: TValue | null) => string | null,
  }
);

/**
 * Vue interne d'un champ, sans distinction sur `required` : un champ requis vide
 * est refusé avant tout appel à `checkValue` / `setValue`, `null` ne les atteint donc jamais
 */
type LooseInputBase<TValue> = {
  label: string,
  required?: boolean,
  setValue: (value: TValue | null) => void,
  checkValue?: (value: TValue | null) => string | null,
};

/** Le type de `setValue` / `defaultValue` / `checkValue` découle de `valueType` */
export type ModalFormInput =
  | ({ valueType: 'select', options: {label: string, value: string}[] } & ModalFormInputBase<string[]>)
  | ({ valueType: 'select-number', options: {label: string, value: number}[] } & ModalFormInputBase<number[]>)
  | ({ valueType: 'radio', options: {label: string, value: string}[] } & ModalFormInputBase<string>)
  | ({ valueType: 'radio-number', options: {label: string, value: number}[] } & ModalFormInputBase<number>)
  | ({ valueType: 'check' } & ModalFormInputBase<boolean>)
  | ({ valueType: 'string' | 'date' | 'time' } & ModalFormInputBase<string>)
  | ({ valueType: 'number' } & ModalFormInputBase<number>);

export interface ModalFormModel extends ModalRequestModel {
  kind: 'form',
  inputs: ModalFormInput[],
  onValidate: () => void,
  onCancel: () => void,
  desc?: string,
}

type ModalFormOption<TValue> = { label: string, value: TValue };

type FieldState = {
  label: string,
  required: boolean,
  check: () => string | null,
  commit: () => void,
} & (
  // Pour les listes d'options, `value` contient les index des options choisies,
  // ce qui permet un seul rendu que les valeurs soient des string ou des number
  | { type: 'select'; options: { label: string }[]; value: WritableSignal<number[]> }
  | { type: 'radio'; options: { label: string }[]; value: WritableSignal<number | null> }
  | { type: 'check'; value: WritableSignal<boolean> }
  | { type: 'string' | 'date' | 'time'; value: WritableSignal<string> }
  | { type: 'number'; value: WritableSignal<number | null> }
);

/**
 * Relie l'état édité du champ (`value`) à ses callbacks `checkValue` / `setValue`,
 * `toValue` convertissant cet état en valeur renvoyée
 */
function bind<TState, TValue>(
  input: ModalFormInputBase<TValue>,
  value: WritableSignal<TState>,
  toValue: (state: TState) => TValue | null,
) {
  const loose = input as unknown as LooseInputBase<TValue>;
  const required = loose.required ?? false;
  return {
    label: input.label,
    required,
    value,
    check: () => {
      const current = toValue(value());
      if (required && isEmpty(current)) {
        return `Le champ « ${input.label} » est obligatoire`;
      }
      return loose.checkValue?.(current) ?? null;
    },
    commit: () => loose.setValue(toValue(value())),
  };
}

const same = <T>(value: T) => value;
const emptyToNull = (value: string) => value === '' ? null : value;
const isEmpty = (value: unknown) => value === null || value === false || (Array.isArray(value) && value.length === 0);

/** Choix multiple : les options de `defaultValue` sont cochées au départ, aucune option cochée donne `[]` */
function bindSelect<TValue>(input: ModalFormInputBase<TValue[]> & { options: ModalFormOption<TValue>[] }): FieldState {
  const selected = signal(input.options.flatMap((option, index) => input.defaultValue?.includes(option.value) ? [index] : []));
  return {
    type: 'select', options: input.options,
    ...bind(input, selected, indexes => indexes.map(index => input.options[index].value)),
  };
}

/** Choix unique : l'option de `defaultValue` est choisie au départ, aucune option choisie donne `null` */
function bindRadio<TValue>(input: ModalFormInputBase<TValue> & { options: ModalFormOption<TValue>[] }): FieldState {
  const defaultIndex = input.options.findIndex(option => option.value === input.defaultValue);
  const selected = signal<number | null>(defaultIndex === -1 ? null : defaultIndex);
  return {
    type: 'radio', options: input.options,
    ...bind(input, selected, index => index === null ? null : input.options[index].value),
  };
}

function toState(input: ModalFormInput): FieldState {
  switch (input.valueType) {
    case 'select':
      return bindSelect(input);
    case 'select-number':
      return bindSelect(input);
    case 'radio':
      return bindRadio(input);
    case 'radio-number':
      return bindRadio(input);
    case 'check':
      return { type: 'check', ...bind(input, signal(input.defaultValue ?? false), same) };
    case 'number':
      return { type: 'number', ...bind(input, signal(input.defaultValue ?? null), same) };
    default:
      // Un champ texte vide est considéré sans valeur
      return { type: input.valueType, ...bind(input, signal(input.defaultValue ?? ''), emptyToNull) };
  }
}

let nextFormId = 0;

@Component({
  imports: [Input, NumberInput, DateInput, TimeInput],
  selector: 'app-modal-form',
  templateUrl: './modal-form.html',
})
export class ModalForm {
  private _modalService = inject(ModalService);
  model = input.required<ModalFormModel>();

  fields = computed(() => this.model().inputs.map(toState));

  /** Préfixe unique des `name` de boutons radio, pour ne pas mélanger deux formulaires empilés */
  protected readonly formId = `modal-form-${nextFormId++}`;

  toggleOption(value: WritableSignal<number[]>, optionIndex: number) {
    value.update(selected => selected.includes(optionIndex)
      ? selected.filter(index => index !== optionIndex)
      : [...selected, optionIndex]);
  }

  validate() {
    for (const field of this.fields()) {
      const message = field.check();
      if (message !== null) {
        this._modalService.infoModal("Erreur", message);
        return;
      }
    }

    // Champs validés, envoi des données
    this.fields().forEach(field => field.commit());
    this.model().onValidate();
  }
}
