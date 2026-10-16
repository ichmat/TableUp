import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TABLE_STATUS_STYLE } from '../../../shared/components/constants/table-status-style';
import { AGENDA_BLOCK_STYLE, AGENDA_GHOST_STYLE, AGENDA_LINK_STYLE } from '../service-agenda/agenda-style';

const ENTRIES: { key: string, label: string, swatch: string }[] = [
  { key: 'Finished', label: 'Terminée', swatch: AGENDA_BLOCK_STYLE.Finished },
  { key: 'Reserved', label: TABLE_STATUS_STYLE.Reserved.label, swatch: AGENDA_BLOCK_STYLE.Reserved },
  { key: 'Occupied', label: TABLE_STATUS_STYLE.Occupied.label, swatch: AGENDA_BLOCK_STYLE.Occupied },
  { key: 'Late', label: 'En retard', swatch: AGENDA_BLOCK_STYLE.Late },
  { key: 'Ghost', label: 'Prise via une combinaison', swatch: AGENDA_GHOST_STYLE },
  { key: 'Planned', label: 'Rapprochement prévu', swatch: AGENDA_LINK_STYLE.Planned },
  { key: 'Glued', label: 'Collées', swatch: AGENDA_LINK_STYLE.Glued },
];

/** La légende de l'Agenda, sous la frise comme celle du plan ; mêmes classes que les blocs qu'elle décrit */
@Component({
  selector: 'app-agenda-legend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-row flex-wrap items-center gap-4 rounded-xl bg-slate px-4 py-2 text-sm text-plan-free-text">
      @for (entry of entries; track entry.key) {
        <span [attr.data-legend]="entry.key" class="flex flex-row items-center gap-2">
          <span [class]="'inline-block h-3 w-5 rounded border-2 ' + entry.swatch"></span>
          {{ entry.label }}
        </span>
      }
    </div>
  `,
})
export class AgendaLegend {
  /**
   * Reçu comme la légende du plan, sans effet ici : l'Agenda ne dessine pas « à nettoyer », ce statut ne vit que sur le plan
   * (spec, « Choix laissés au builder »)
   */
  trackCleaning = input(false);

  protected readonly entries = ENTRIES;
}
