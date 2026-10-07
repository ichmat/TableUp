import { ReservationStatus } from '../../../models';

/**
 * §6.2 : la teinte dit le cours normal, le plein dit l'anomalie, le gris dit que c'est clos.
 * Lisible en niveaux de gris : le no-show est le seul plein, l'annulée la seule barrée
 */
export const RESERVATION_STATUS_STYLE: Record<ReservationStatus, { label: string, className: string }> = {
    Pending: { label: 'À RÉPONDRE', className: 'bg-violet-soft text-violet' },
    Confirmed: { label: 'CONFIRMÉE', className: 'bg-booked-soft text-booked-ink' },
    Seated: { label: 'ASSISE', className: 'bg-coral-soft text-coral' },
    Finished: { label: 'TERMINÉE', className: 'bg-app text-text-muted' },
    Cancelled: { label: 'ANNULÉE', className: 'bg-app text-text-muted line-through' },
    NoShow: { label: 'NO-SHOW', className: 'bg-coral text-surface' },
};
