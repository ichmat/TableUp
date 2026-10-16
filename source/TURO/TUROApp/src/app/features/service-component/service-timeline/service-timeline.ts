import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { twMerge } from 'tailwind-merge';
import { ServiceSlot } from '../../../models';

/** La frise (§5.4) : un créneau par pas ; le créneau actif décide de l'heure que montre le plan */
@Component({
  selector: 'app-service-timeline',
  templateUrl: './service-timeline.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceTimeline {
  slots = input.required<ServiceSlot[]>();
  activeIndex = input.required<number>();
  /** Tables actives du restaurant : le dénominateur de la barre */
  tableCount = input.required<number>();
  picked = output<number>();

  protected time(slot: ServiceSlot): string {
    return slot.time.slice(0, 5);
  }

  protected fill(slot: ServiceSlot): number {
    const total = this.tableCount();
    return total === 0 ? 0 : Math.min(100, Math.round((slot.takenTables / total) * 100));
  }

  protected slotClass(index: number): string {
    return twMerge('relative flex flex-col items-center gap-1 min-w-24 px-3 py-1.5 rounded-lg cursor-pointer text-lg',
      index === this.activeIndex() ? 'bg-interactive text-surface' : 'bg-surface hover:bg-app');
  }
}
