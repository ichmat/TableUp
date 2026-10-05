import { PlacementFit } from '../../../models';

/** Pastille d'un verdict de places : la couleur ET la forme le portent, jamais la teinte seule (§2.3) */
export const PLACEMENT_FIT_STYLE: Record<PlacementFit, string> = {
    Perfect: 'bg-fit-soft border-2 border-fit text-fit-ink',
    WithinTolerance: 'bg-fit-reserve-soft border-2 border-fit-reserve text-fit-reserve-ink',
    NotAdvised: 'bg-surface border-2 border-dashed border-coral text-coral-ink',
    TooSmall: 'bg-app border-2 border-border text-text-muted line-through opacity-60',
};

export const PLACEMENT_FIT_SYMBOL: Record<PlacementFit, string> = {
    Perfect: '✓',
    WithinTolerance: '~✓',
    NotAdvised: '!',
    TooSmall: '✗',
};

export const PLACEMENT_FIT_LABEL: Record<PlacementFit, string> = {
    Perfect: 'parfaite',
    WithinTolerance: 'à réserve',
    NotAdvised: 'déconseillée',
    TooSmall: 'trop petite',
};
