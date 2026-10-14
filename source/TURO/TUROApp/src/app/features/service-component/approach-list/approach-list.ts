import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { PlacementApproach, PlacementLevel } from '../../../models';
import { Button } from '../../../shared/components/button/button';
import { tableSetKey } from '../../../shared/components/floor-plan/logic/table-set';
import { nextText } from '../placement-reasons';

export const APPROACHES_SHOWN = 5;

/** Une combinaison en sommeil par son id, une paire inédite par ses tables */
export function approachKey(approach: Pick<PlacementApproach, 'combinationId' | 'tableIds'>): string {
  return approach.combinationId ?? tableSetKey(approach.tableIds);
}

/**
 * RAPP-01 à 03 : les rapprochements possibles, du plus proche au plus loin, sous la fiche. Le plan n'en dessine aucun :
 * deux tables éloignées n'ont pas d'enveloppe qui veuille dire quelque chose
 */
@Component({
  selector: 'app-approach-list',
  imports: [Button],
  templateUrl: './approach-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApproachList {
  approaches = input.required<readonly PlacementApproach[]>();
  selectedKey = input<string | null>(null);
  timeZone = input.required<string>();
  selected = output<PlacementApproach>();
  placed = output<PlacementApproach>();

  protected expanded = signal(false);
  protected shown = computed(() => (this.expanded() ? this.approaches() : this.approaches().slice(0, APPROACHES_SHOWN)));
  protected readonly key = approachKey;

  /** « 12 + 13 » : les tables qu'on poussera */
  protected tablesOf(approach: PlacementApproach): string {
    return (approach.reasons.find((r) => r.kind === 'Approach')?.with ?? []).join(' + ');
  }

  protected next(approach: PlacementApproach): string {
    return approach.next === null ? '' : nextText(approach.next, this.timeZone());
  }

  protected badge(level: PlacementLevel): string {
    return level === 'NotAdvised' ? '!' : '~✓';
  }

  protected levelClass(level: PlacementLevel): string {
    return level === 'NotAdvised' ? 'bg-place-advised' : 'bg-place-reserve';
  }

  protected lineClass(approach: PlacementApproach): string {
    return 'flex flex-row items-center gap-2 rounded-lg border-2 px-2 py-1 cursor-pointer '
      + (approachKey(approach) === this.selectedKey() ? 'border-violet bg-violet-soft' : 'border-border-soft hover:bg-app');
  }
}
