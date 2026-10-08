import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ReservationDetail } from '../../models';
import { ReservationService } from '../../core/services/reservation/reservation.service';
import { ClientService } from '../../core/services/client/client.service';
import { ClientSheet } from '../clients-component/client-sheet/client-sheet';
import { ReservationList } from './reservation-list/reservation-list';
import { ReservationSheet } from './reservation-sheet/reservation-sheet';
import { backTo, openFrom, PanelEntry } from './panel-stack';
import { ReservationActions } from './reservation-actions';
import { ReservationForm } from './reservation-form/reservation-form';
import { ReservationFormMode, ReservationSaved } from './reservation-draft';

/**
 * Réservations (§6) : la liste à gauche, un panneau unique à droite où la fiche réservation et la fiche client
 * se remplacent (§7.6) — profondeur 2, la flèche nomme d'où l'on vient
 */
@Component({
  imports: [ReservationList, ReservationSheet, ClientSheet, ReservationForm],
  selector: 'app-booking-component',
  styleUrl: './booking-component.css',
  templateUrl: './booking-component.html',
})
export class BookingComponent {
  private _reservations = inject(ReservationService);
  private _clients = inject(ClientService);
  private _router = inject(Router);
  private _actions = inject(ReservationActions);

  /** Le formulaire remplace le contenu du panneau (FORM-12) */
  protected form = signal<ReservationFormMode | null>(null);

  protected startCreate() {
    this.form.set({ kind: 'create' });
  }

  protected startEdit(reservation: ReservationDetail) {
    this.form.set({ kind: 'edit', reservation });
  }

  protected onSaved(event: ReservationSaved) {
    this.form.set(null);
    if (event.mode === 'create') {
      this.open(event.result.reservation.id);
    }
    this._actions.saved(event, (mode) => this.form.set(mode));
  }

  protected stack = signal<PanelEntry[]>([]);
  protected top = computed(() => this.stack().at(-1) ?? null);
  protected origin = computed(() => (this.stack().length > 1 ? this.stack()[0].label : null));
  protected selectedId = this._reservations.selectedId;
  protected client = this._reservations.client;
  protected clientFailed = this._reservations.clientFailed;

  protected open(id: string) {
    this.stack.set([{ kind: 'reservation', id, label: '' }]);
    this.show();
  }

  /** Depuis la fiche réservation : la fiche client, « ← Réservation de jeudi 20:00 » */
  protected openClient(event: { id: string, origin: string }) {
    this.go(event.origin, { kind: 'client', id: event.id, label: '' });
  }

  /** Depuis la fiche client : une réservation de son historique, « ← Sophie Marchand » */
  protected openReservation(id: string) {
    this.go(this.client()?.name ?? 'Fiche client', { kind: 'reservation', id, label: '' });
  }

  protected back() {
    this.stack.update(backTo);
    this.show();
  }

  protected close() {
    this.form.set(null);
    this.stack.set([]);
    this._reservations.select(null);
    this._reservations.selectClient(null);
  }

  protected openInClients(id: string) {
    this._clients.select(id);
    void this._router.navigate(['/clients']);
  }

  /** La fiche quittée prend le nom qu'affichera la flèche */
  private go(fromLabel: string, entry: PanelEntry) {
    this.stack.update((stack) => openFrom(stack.map((e, i) => (i === stack.length - 1 ? { ...e, label: fromLabel } : e)), entry));
    this.show();
  }

  private show() {
    const top = this.top();
    if (top?.kind === 'reservation') {
      this._reservations.select(top.id);
    } else if (top?.kind === 'client') {
      this._reservations.selectClient(top.id);
    }
  }
}
