import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TableStatus } from '../../../models';
import { TABLE_STATUS_STYLE } from '../../../shared/components/constants/table-status-style';

/** PLAN-01 : la légende reste sous le plan, pas dans une aide ; « à nettoyer » seulement si le restaurant le suit */
@Component({
  selector: 'app-plan-legend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-row flex-wrap items-center gap-4 rounded-xl bg-slate px-4 py-2 text-sm text-plan-free-text">
      @for (status of statuses(); track status) {
        <span [attr.data-legend]="status" class="flex flex-row items-center gap-2">
          <span [class]="'inline-block size-4 rounded border-2 ' + style[status].swatch"></span>
          {{ style[status].label }}
        </span>
      }
      <span data-legend="Late" class="flex flex-row items-center gap-2">
        <span class="inline-block size-4 rounded border-2 border-plan-reserved-line bg-plan-reserved ring-2 ring-plan-late"></span>
        En retard
      </span>
    </div>
  `,
})
export class PlanLegend {
  trackCleaning = input(false);

  protected readonly style = TABLE_STATUS_STYLE;
  protected statuses = computed<TableStatus[]>(() =>
    this.trackCleaning() ? ['Free', 'Reserved', 'Occupied', 'ToClean'] : ['Free', 'Reserved', 'Occupied']);
}
