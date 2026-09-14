import { Component, computed, input, output } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-button',
  templateUrl: './button.html',
})
export class Button {
  text = input<string>();
  type = input<'Primary' | 'Secondary' | 'Tertiary'>('Primary');

  typeClass = computed(() => {
    switch(this.type()) {
      case 'Primary':
        return 'bg-interactive text-surface';
      case 'Secondary':
        return 'bg-app text-text';
      case 'Tertiary':
        return 'border-4 border-slate text-slate';
    }
  })


}
