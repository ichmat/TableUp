import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { twMerge } from 'tailwind-merge';
import { PlacementLevel } from '../../../models';

const RANK: Record<PlacementLevel, number> = { Perfect: 3, WithReserve: 2, NotAdvised: 1, Excluded: 0 };

/** §5.5 : un onglet porte le meilleur niveau qu'il contient ; `null` s'il n'a rien de compatible */
export function bestLevel(levels: PlacementLevel[]): PlacementLevel | null {
  const best = levels.reduce<PlacementLevel>((a, b) => (RANK[b] > RANK[a] ? b : a), 'Excluded');
  return best === 'Excluded' ? null : best;
}

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
  /** Pendant un placement : le meilleur niveau de chaque salle, `null` si rien n'y convient. `null` : aucun placement */
  levels = input<Readonly<Record<string, PlacementLevel | null>> | null>(null);

  protected readonly badge: Record<PlacementLevel, string> = { Perfect: '✓', WithReserve: '~✓', NotAdvised: '!', Excluded: '' };

  protected tabClass(id: string): string {
    const levels = this.levels();
    return twMerge('px-3 py-1 rounded-full border-2 font-bold cursor-pointer',
      id === this.activeId() ? 'bg-interactive text-surface border-interactive' : 'bg-surface border-border-soft hover:bg-app',
      levels !== null && levels[id] == null ? 'opacity-40' : '');
  }

  protected levelClass(level: PlacementLevel): string {
    return level === 'Perfect' ? 'bg-place-perfect' : level === 'WithReserve' ? 'bg-place-reserve' : 'bg-place-advised';
  }
}
