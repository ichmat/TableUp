import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { twMerge } from 'tailwind-merge';

@Component({
  imports: [],
  selector: 'app-button',
  templateUrl: './button.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Button {
  text = input<string>();
  type = input<'Primary' | 'Secondary' | 'Tertiary'>('Primary');
  buttonClass = input<string>("");

  typeClass = computed(() => {
    let typeCSS = "";
    switch(this.type()) {
      case 'Primary':
        typeCSS = 'bg-interactive text-surface';
        break;
      case 'Secondary':
        typeCSS = 'bg-app text-text';
        break;
      case 'Tertiary':
        typeCSS = 'border-4 border-text-muted text-text-muted';
        break;
    }
    return twMerge(
      "rounded-lg font-bold cursor-pointer hover:brightness-110 min-w-24 h-12",
      typeCSS, 
      this.buttonClass())
  })


}
