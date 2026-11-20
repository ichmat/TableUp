import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { twMerge } from 'tailwind-merge';

/** La vue de l'écran Service : le plan d'une salle, ou l'agenda de toutes les tables */
export type ServiceViewKind = 'plan' | 'agenda';

const VIEWS: { kind: ServiceViewKind, label: string }[] = [
  { kind: 'plan', label: 'Plan' },
  { kind: 'agenda', label: 'Agenda' },
];

/** Deux pastilles « Plan » / « Agenda », l'active en orange comme les onglets de salle ; désactivées pendant l'édition du plan */
@Component({
  selector: 'app-view-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-row items-center gap-2">
      @for (view of views; track view.kind) {
        <button type="button" [attr.data-view]="view.kind" [attr.aria-pressed]="view.kind === active()" [disabled]="disabled()"
          [class]="tabClass(view.kind)" (click)="select(view.kind)">{{ view.label }}</button>
      }
    </div>
  `,
})
export class ViewTabs {
  active = input.required<ServiceViewKind>();
  /** Pendant l'édition du plan : on ne quitte pas l'édition par l'onglet */
  disabled = input(false);
  selected = output<ServiceViewKind>();

  protected readonly views = VIEWS;

  protected tabClass(kind: ServiceViewKind): string {
    return twMerge('px-3 py-1 rounded-full border-2 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-default',
      kind === this.active() ? 'bg-interactive text-surface border-interactive' : 'bg-surface border-border-soft enabled:hover:bg-app');
  }

  protected select(kind: ServiceViewKind) {
    if (!this.disabled() && kind !== this.active()) {
      this.selected.emit(kind);
    }
  }
}
