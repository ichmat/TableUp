import { TableStatus } from '../../../models';

/** §2.3 : le fond, le contour et la craie d'une table selon son statut ; `swatch` pour la légende ; `dashed` = « à nettoyer » */
export const TABLE_STATUS_STYLE: Record<TableStatus, { label: string, shape: string, text: string, swatch: string, dashed: boolean }> = {
  Free: { label: 'Libre', shape: 'fill-plan-free stroke-plan-free-line', text: 'fill-plan-free-text', swatch: 'bg-plan-free border-plan-free-line', dashed: false },
  Reserved: { label: 'Réservée', shape: 'fill-plan-reserved stroke-plan-reserved-line', text: 'fill-plan-reserved-text', swatch: 'bg-plan-reserved border-plan-reserved-line', dashed: false },
  Occupied: { label: 'Occupée', shape: 'fill-plan-occupied stroke-plan-occupied-line', text: 'fill-plan-occupied-text', swatch: 'bg-plan-occupied border-plan-occupied-line', dashed: false },
  ToClean: { label: 'À nettoyer', shape: 'fill-plan-clean stroke-plan-clean-line', text: 'fill-plan-clean-text', swatch: 'bg-plan-clean border-plan-clean-line border-dashed', dashed: true },
};
