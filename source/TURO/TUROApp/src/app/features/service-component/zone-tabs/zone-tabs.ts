import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { twMerge } from 'tailwind-merge';

/** Un onglet de salle : « Salle 8/12 » à l'heure du plan */
export interface ZoneTab {
  id: string,
  name: string,
  taken: number,
  total: number,
}

/** §5.5 : une pastille par salle, l'active en orange ; « Éditer le plan » poussé à droite, admin seulement */
@Component({
  selector: 'app-zone-tabs',
  imports: [RouterLink],
  templateUrl: './zone-tabs.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZoneTabs {
  tabs = input.required<ZoneTab[]>();
  activeId = input<string | null>(null);
  canEdit = input(false);
  selected = output<string>();

  protected tabClass(id: string): string {
    return twMerge('px-3 py-1 rounded-full border-2 font-bold cursor-pointer',
      id === this.activeId() ? 'bg-interactive text-surface border-interactive' : 'bg-surface border-border-soft hover:bg-app');
  }
}
