import {
  afterNextRender, afterRenderEffect, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, output, signal,
  viewChild,
} from '@angular/core';
import { twMerge } from 'tailwind-merge';
import { Placement, ServiceSnapshot } from '../../../models';
import { timeIn, toMinutes } from '../../../shared/utils/time-of-day';
import { guestName } from '../../booking-component/reservation-display';
import { DropTarget } from '../placement-drag';
import { LEVEL_BADGE, levelClass } from '../zone-tabs/zone-tabs';
import { AgendaBlock, AgendaRow, agendaAxis, agendaRows } from './agenda-rows';
import { AGENDA_BLOCK_STYLE, AGENDA_GHOST_STYLE, AGENDA_LINK_STYLE } from './agenda-style';

/** Largeur de la colonne des libellés (`w-32`) */
const LABEL_WIDTH = 128;
/** En deçà, l'axe défile plutôt que de tasser les blocs */
const MIN_PX_PER_MINUTE = 3;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** Place d'un libellé d'heure « 19:00 » à droite de son trait */
const HOUR_LABEL_PX = 40;

type TargetRow = Extract<AgendaRow, { kind: 'Table' | 'Combination' }>;

/** Deux cibles de dépôt comparées par valeur : `PlacementDrag.hovered` émet un nouvel objet à chaque mouvement */
function sameTarget(a: DropTarget | null, b: DropTarget | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return a.tableId === b.tableId && a.combinationId === b.combinationId && a.approachKey === b.approachKey;
}

/** La cible d'une ligne, celle que `PlacementDrag` lit sur ses attributs `data-*` */
function targetOf(row: AgendaRow): DropTarget | null {
  switch (row.kind) {
    case 'Table': return { tableId: row.tableId };
    case 'Combination':
      return row.combinationId !== null ? { combinationId: row.combinationId } : row.approachKey !== null ? { approachKey: row.approachKey } : null;
    default: return null;
  }
}

/**
 * L'Agenda (§4.5) : le service dans le temps, une ligne par table, regroupées par salle. Les règles d'affichage vivent
 * dans `agendaRows` ; le composant ne garde que l'état des chevrons, la mesure de la largeur et le défilement
 */
@Component({
  selector: 'app-service-agenda',
  templateUrl: './service-agenda.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-0 min-w-0' },
})
export class ServiceAgenda {
  snapshot = input.required<ServiceSnapshot>();
  now = input.required<number>();
  placement = input<Placement | null>(null);
  hovered = input<DropTarget | null>(null);
  selectedReservationId = input<string | null>(null);
  timeZone = input.required<string>();

  /** Toucher un bloc ou une bande fantôme : l'id de la réservation à ouvrir */
  opened = output<string>();
  /** Toucher une ligne pendant un placement : le dépôt, comme toucher une table allumée du plan */
  rowPressed = output<DropTarget>();

  protected readonly labelWidth = LABEL_WIDTH;
  protected readonly badge = LEVEL_BADGE;
  protected readonly levelClass = levelClass;
  protected readonly ghostStyle = AGENDA_GHOST_STYLE;
  protected readonly linkStyle = AGENDA_LINK_STYLE;

  /** Chevrons basculés à la main, par clé de ligne : pour la session, sans être mémorisés */
  private toggled = signal<Map<string, boolean>>(new Map());
  /** Largeur visible de la piste, mesurée ; `null` avant le premier rendu */
  private available = signal<number | null>(null);
  private scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  /** Le service déjà centré sur le présent : on ne recentre pas à chaque minute */
  private centeredOn: string | null = null;

  protected axis = computed(() => agendaAxis(this.snapshot(), this.now()));
  protected rows = computed(() => agendaRows({
    snapshot: this.snapshot(), now: this.now(), placement: this.placement(), toggled: this.toggled(),
  }));
  private hoveredTarget = computed(() => this.hovered(), { equal: sameTarget });

  /** Pixels par minute : la largeur disponible, sans descendre sous le minimum lisible */
  private scale = computed(() => {
    const axis = this.axis();
    const minutes = axis === null ? 0 : (axis.end - axis.start) / MINUTE;
    return minutes <= 0 ? MIN_PX_PER_MINUTE : Math.max(MIN_PX_PER_MINUTE, (this.available() ?? 0) / minutes);
  });
  protected trackWidth = computed(() => {
    const axis = this.axis();
    return axis === null ? 0 : this.x(axis.end);
  });

  /** Repères à chaque heure pleine, dans le fuseau du restaurant */
  protected hours = computed(() => {
    const axis = this.axis();
    if (axis === null) {
      return [];
    }
    const minutes = toMinutes(timeIn(this.timeZone(), new Date(axis.start)));
    const hours: { at: number, x: number, label: string, last: boolean }[] = [];
    for (let at = axis.start + ((60 - (minutes % 60)) % 60) * MINUTE; at <= axis.end; at += HOUR) {
      // Trop près de la fin, le libellé passe à gauche de son trait pour ne pas déborder de la piste
      hours.push({ at, x: this.x(at), label: timeIn(this.timeZone(), new Date(at)), last: this.x(axis.end) - this.x(at) < HOUR_LABEL_PX });
    }
    return hours;
  });

  /** Traits fins à chaque pas de service, calés sur les créneaux ; ceux qui tombent sur une heure sont tracés en plus marqué */
  protected ticks = computed(() => {
    const axis = this.axis();
    const slots = this.snapshot().slots;
    if (axis === null || slots.length === 0) {
      return [];
    }
    const step = axis.slotStep * MINUTE;
    const anchor = Date.parse(slots[0].at);
    const hours = new Set(this.hours().map((h) => h.at));
    const ticks: { at: number, x: number, hour: boolean }[] = [];
    for (let at = anchor - Math.floor((anchor - axis.start) / step) * step; at <= axis.end; at += step) {
      ticks.push({ at, x: this.x(at), hour: hours.has(at) });
    }
    this.hours().filter((h) => !ticks.some((t) => t.at === h.at)).forEach((h) => ticks.push({ at: h.at, x: h.x, hour: true }));
    return ticks;
  });

  /** L'aperçu du dépôt : le bloc de la réservation en cours de placement, à son heure, qui ne bouge jamais */
  protected preview = computed(() => {
    const placement = this.placement();
    if (placement === null) {
      return null;
    }
    const start = Date.parse(placement.start);
    return {
      left: this.x(start),
      width: this.x(Date.parse(placement.end)) - this.x(start),
      label: `${guestName(placement.guestName === null ? null : { name: placement.guestName })} · ${placement.covers}p`,
    };
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const element = this.scroller().nativeElement;
      const measure = () => this.available.set(Math.max(0, element.clientWidth - LABEL_WIDTH));
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      destroyRef.onDestroy(() => observer.disconnect());
    });

    // À l'ouverture d'un service, la vue se centre sur le présent, une seule fois : elle ne saute plus à chaque minute
    afterRenderEffect(() => {
      const axis = this.axis();
      const available = this.available();
      const service = this.snapshot().service;
      if (axis === null || axis.now === null || available === null || service === null) {
        return;
      }
      const key = `${this.snapshot().day}|${service.opening}`;
      if (key === this.centeredOn) {
        return;
      }
      this.centeredOn = key;
      this.scroller().nativeElement.scrollLeft = Math.max(0, this.x(axis.now) - available / 2);
    });
  }

  /** Abscisse d'un instant sur la piste, en px */
  protected x(at: number): number {
    const axis = this.axis();
    return axis === null ? 0 : ((at - axis.start) / MINUTE) * this.scale();
  }

  protected blockClass(block: AgendaBlock): string {
    return twMerge(
      'absolute inset-y-1 flex items-center gap-1 overflow-hidden whitespace-nowrap rounded-md border-[1.5px] px-1.5 font-semibold cursor-pointer',
      AGENDA_BLOCK_STYLE[block.kind],
      block.open ? 'rounded-r-none border-r-0' : '',
      block.reservationId === this.selectedReservationId() ? 'ring-2 ring-interactive' : '',
    );
  }

  protected rowClass(row: TargetRow): string {
    return twMerge('flex h-8 border-b border-plan-free',
      row.kind === 'Combination' && row.temporary ? 'border border-dashed border-agenda-combination' : '',
      this.previewed(row) ? 'bg-plan-free' : '',
      row.level === 'Excluded' ? 'opacity-40' : '');
  }

  protected labelClass(row: TargetRow): string {
    return twMerge('sticky left-0 z-10 flex w-32 shrink-0 items-center gap-1 bg-slate px-2 font-semibold',
      row.kind === 'Combination' ? 'text-agenda-combination' : '',
      row.kind === 'Table' && row.nested ? 'pl-6 font-medium' : '');
  }

  /** La ligne visée pendant un placement porte l'aperçu du dépôt */
  protected previewed(row: AgendaRow): boolean {
    const hovered = this.hoveredTarget();
    return this.placement() !== null && hovered !== null && sameTarget(targetOf(row), hovered);
  }

  protected attr(row: AgendaRow, name: keyof DropTarget): string | null {
    return targetOf(row)?.[name] ?? null;
  }

  protected toggle(event: Event, key: string, expanded: boolean) {
    // Le chevron n'est jamais un dépôt
    event.stopPropagation();
    this.toggled.update((toggled) => new Map(toggled).set(key, !expanded));
  }

  /** Hors placement, toucher un bloc ouvre sa réservation ; pendant un placement, c'est la ligne qui compte */
  protected open(reservationId: string) {
    if (this.placement() === null) {
      this.opened.emit(reservationId);
    }
  }

  protected press(row: AgendaRow) {
    const target = targetOf(row);
    if (this.placement() !== null && target !== null) {
      this.rowPressed.emit(target);
    }
  }
}
