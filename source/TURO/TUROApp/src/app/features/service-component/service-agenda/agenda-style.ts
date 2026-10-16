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

/** Lien physique : vert plein « collées », violet pointillé « ! » pour un rapprochement prévu (jamais l'orange) */
export const AGENDA_LINK_STYLE: Record<AgendaLinkSegment['kind'], string> = {
  Glued: 'bg-agenda-glued border-agenda-glued-line text-agenda-glued-text',
  Planned: 'border-dashed border-agenda-combination text-agenda-combination',
};
