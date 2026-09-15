import { Component, ElementRef, computed, input, model, output, viewChild } from '@angular/core';
import { IconSvgObject, HugeiconsIconComponent } from '@hugeicons/angular';
import { twMerge } from 'tailwind-merge';
import { DEFAULT_INPUT_STYLE } from '../../constants/input-style';

@Component({
  imports: [HugeiconsIconComponent],
  selector: 'app-input',
  templateUrl: './input.html',
})
export class Input {
  placeholder = input<string>("");
  value = model<any>("");
  type = input<'text' | 'number' | 'email' | 'password' | 'tel' | 'url'>('text');
  inputClass = input<string>("");
  icon = input<IconSvgObject>();
  iconClickable = input<boolean>(false);
  /** Il faut d'abord que `iconClickable` soit à `true` */
  onIconClick = output<void>();

  myInput = viewChild.required<ElementRef<HTMLInputElement>>('myInput');

  wrapperClass = computed(() => twMerge(DEFAULT_INPUT_STYLE,
    this.inputClass(),
  ));

  onClickParent(){
    this.myInput().nativeElement.focus();
  }

  onInput(event: Event) {
    const raw = (event.target as HTMLInputElement).value;
    this.value.set(this.type() === 'number' ? Number(raw) : raw);
  }
}
