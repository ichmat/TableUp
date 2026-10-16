import { PlacementLevel } from '../../../models';
import { AgendaBlockKind, AgendaLinkSegment } from './agenda-rows';
import { TABLE_STATUS_STYLE } from '../../../shared/components/constants/table-status-style';

/** Les blocs de l'Agenda reprennent les couleurs de statut du plan ; « en retard » ajoute l'anneau corail, comme sur le plan */
export const AGENDA_BLOCK_STYLE: Record<AgendaBlockKind, string> = {
  Reserved: `${TABLE_STATUS_STYLE.Reserved.swatch} text-plan-reserved-text`,
  Late: `${TABLE_STATUS_STYLE.Reserved.swatch} text-plan-reserved-text ring-2 ring-plan-late`,
  Occupied: `${TABLE_STATUS_STYLE.Occupied.swatch} text-plan-occupied-text`,
  Finished: `${TABLE_STATUS_STYLE.Free.swatch} text-plan-free-text opacity-60 font-normal`,
};

/** Bande fantôme (AGD-01) : la table est prise via une combinaison */
export const AGENDA_GHOST_STYLE =
  'border border-dashed border-plan-free-line bg-[image:repeating-linear-gradient(45deg,var(--color-plan-free-line)_0_1px,transparent_1px_6px)]';

/** Le halo d'un niveau de placement sur la piste d'une ligne : mêmes teintes que la pastille du libellé, jamais l'orange */
export const AGENDA_TRACK_LEVEL_STYLE: Record<Exclude<PlacementLevel, 'Excluded'>, string> = {
  Perfect: 'bg-place-perfect/10 ring-1 ring-inset ring-place-perfect/50',
  WithReserve: 'bg-place-reserve/10 ring-1 ring-inset ring-place-reserve/50',
  NotAdvised: 'bg-place-advised/10 ring-1 ring-inset ring-place-advised/50',
};

/** Lien physique : vert plein « collées », violet pointillé « ! » pour un rapprochement prévu (jamais l'orange) */
export const AGENDA_LINK_STYLE: Record<AgendaLinkSegment['kind'], string> = {
  Glued: 'bg-agenda-glued border-agenda-glued-line text-agenda-glued-text',
  Planned: 'border-dashed border-agenda-combination text-agenda-combination',
};
