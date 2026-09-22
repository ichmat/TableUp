import { Component, ElementRef, computed, input, model, output, viewChild } from '@angular/core';
import { IconSvgObject, HugeiconsIconComponent } from '@hugeicons/angular';
import { twMerge } from 'tailwind-merge';
import { DEFAULT_INPUT_STYLE, INPUT_DISABLED_STYLE, INPUT_ERROR_STYLE } from '../../constants/input-style';
import { FormValueControl } from '@angular/forms/signals';

@Component({
  imports: [HugeiconsIconComponent],
  selector: 'app-number-input',
  templateUrl: './number-input.html',
  styles: `
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
  }
  input[type=number] {
      -moz-appearance: textfield;
      appearance: textfield;
  }
  `
})
export class NumberInput implements FormValueControl<number | null> {
  /** `null` si le champ est vide */
  value = model<number | null>(null);
  touch = output<void>();

  disabled = input(false);
  readonly = input(false);
  invalid = input(false);
  touched = input(false);
  required = input(false);
  name = input("");
  min = input<number | undefined>(undefined);
  max = input<number | undefined>(undefined);

  step = input<number | 'any'>(1);
  placeholder = input<string>("");
  inputClass = input<string>("");
  icon = input<IconSvgObject>();
  iconClickable = input<boolean>(false);
  /** Il faut d'abord que `iconClickable` soit à `true` */
  onIconClick = output<void>();

  myInput = viewChild.required<ElementRef<HTMLInputElement>>('myInput');

  showError = computed(() => this.invalid() && this.touched());

  wrapperClass = computed(() => twMerge(DEFAULT_INPUT_STYLE,
    this.inputClass(),
    this.showError() ? INPUT_ERROR_STYLE : '',
    this.disabled() ? INPUT_DISABLED_STYLE : '',
  ));

  focus(options?: FocusOptions) {
    if (!this.disabled()) {
      this.myInput().nativeElement.focus(options);
    }
  }

  onInput(event: Event) {
    const target = event.target as HTMLInputElement;
    // Saisie incomplète (ex: "-" ou "1e") : on ne touche pas à la valeur pour ne pas effacer ce que l'utilisateur tape
    if (target.validity.badInput) {
      return;
    }
    this.value.set(target.value === '' ? null : target.valueAsNumber);
  }
}
