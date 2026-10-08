import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ClientDetail, ReservationDetail } from '../../models';
import { ClientService } from '../../core/services/client/client.service';
import { ClientList } from './client-list/client-list';
import { ClientSheet } from './client-sheet/client-sheet';
import { ClientForm } from './client-form/client-form';
import { ReservationService } from '../../core/services/reservation/reservation.service';
import { ReservationSheet } from '../booking-component/reservation-sheet/reservation-sheet';
import { formatPhone } from '../../shared/utils/phone';
import { ReservationActions } from '../booking-component/reservation-actions';
import { ReservationForm } from '../booking-component/reservation-form/reservation-form';
import { ReservationFormMode, ReservationSaved } from '../booking-component/reservation-draft';

type PanelMode = 'view' | 'create' | 'edit';

/**
 * Clients — le mini-CRM (§7). La liste à gauche ; la fiche, ou son formulaire, dans un panneau unique à droite
 * (maquette 26, option A, sans flèche de retour sur cet écran)
 */
@Component({
  imports: [ClientList, ClientSheet, ClientForm, ReservationSheet, ReservationForm],
  selector: 'app-clients-component',
  styleUrl: './clients-component.css',
  templateUrl: './clients-component.html',
})
export class ClientsComponent {
  private _clients = inject(ClientService);
  private _reservations = inject(ReservationService);
  private _actions = inject(ReservationActions);

  /** Le « + » depuis une fiche client : l'identité est connue, déjà remplie (§8.1) */
  protected reservationForm = signal<ReservationFormMode | null>(null);

  protected startReservation() {
    const client = this.detail();
    this.reservationForm.set({
      kind: 'create',
      draft: { phone: client?.phones[0] ? formatPhone(client.phones[0]) : '', name: client?.name ?? '' },
    });
  }

  protected startReservationEdit(reservation: ReservationDetail) {
    this.reservationForm.set({ kind: 'edit', reservation });
  }

  protected onReservationSaved(event: ReservationSaved) {
    this.reservationForm.set(null);
    this.openReservation(event.result.reservation.id);
    this._actions.saved(event);
  }

  constructor() {
    // « Annuler » dans le bandeau : le formulaire revient ; une création défaite n'a plus de fiche derrière lui
    effect(() => {
      if (this._actions.reopened() === null) {
        return;
      }
      untracked(() => {
        const mode = this._actions.takeReopened()!;
        if (mode.kind === 'create') {
          this.closeReservation();
          this._reservations.select(null);
        }
        this.reservationForm.set(mode);
      });
    });
  }

  protected mode = signal<PanelMode>('view');
  protected selectedId = this._clients.selectedId;
  protected detail = this._clients.detail;
  protected detailFailed = this._clients.detailFailed;
  /** Une réservation ouverte depuis l'historique : elle remplace la fiche, « ← Sophie Marchand » (§7.6) */
  protected reservationId = signal<string | null>(null);
  protected panelOpen = computed(() => this.mode() === 'create' || this.selectedId() !== null);

  protected open(id: string) {
    this.reservationForm.set(null);
    this.reservationId.set(null);
    this._clients.select(id);
    this.mode.set('view');
  }

  protected startCreate() {
    this.reservationForm.set(null);
    this.reservationId.set(null);
    this._clients.select(null);
    this.mode.set('create');
  }

  protected startEdit() {
    this.mode.set('edit');
  }

  protected close() {
    this.reservationForm.set(null);
    this.reservationId.set(null);
    this._clients.select(null);
    this.mode.set('view');
  }

  protected openReservation(id: string) {
    this._reservations.select(id);
    this.reservationId.set(id);
  }

  protected closeReservation() {
    this.reservationId.set(null);
  }

  protected onSaved(client: ClientDetail) {
    this._clients.select(client.id);
    this.mode.set('view');
  }
}
