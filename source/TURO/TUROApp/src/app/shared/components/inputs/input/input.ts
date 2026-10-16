import { Component, ElementRef, computed, input, model, output, viewChild } from '@angular/core';
import { IconSvgObject, HugeiconsIconComponent } from '@hugeicons/angular';
import { inputWrapperClass } from '../../constants/input-style';
import { FormValueControl } from '@angular/forms/signals';

@Component({
  imports: [HugeiconsIconComponent],
  selector: 'app-input',
  templateUrl: './input.html',
})
export class Input implements FormValueControl<string> {
  value = model<string>("");
  touch = output<void>();

  disabled = input(false);
  readonly = input(false);
  invalid = input(false);
  touched = input(false);
  required = input(false);
  name = input("");

  placeholder = input<string>("");
  autocomplete = input<string>("");
  type = input<'text' | 'email' | 'password' | 'tel' | 'url'>('text');
  inputClass = input<string>("");
  icon = input<IconSvgObject>();
  iconClickable = input<boolean>(false);
  /** Il faut d'abord que `iconClickable` soit à `true` */
  onIconClick = output<void>();

  myInput = viewChild.required<ElementRef<HTMLInputElement>>('myInput');

  showError = computed(() => this.invalid() && this.touched());

  wrapperClass = computed(() => inputWrapperClass(this.showError(), this.disabled(), this.inputClass()));

  focus(options?: FocusOptions) {
    if (!this.disabled()) {
      this.myInput().nativeElement.focus(options);
    }
  }

  onInput(event: Event) {
    this.value.set((event.target as HTMLInputElement).value);
  }
}
