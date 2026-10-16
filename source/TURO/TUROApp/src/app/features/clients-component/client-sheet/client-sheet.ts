import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { CLIENT_LIMITS, CLIENT_TAG_LABEL, CLIENT_TAGS, ClientDetail, ClientHistoryItem, ClientMergeCandidate, ClientTag } from '../../../models';
import { ClientService } from '../../../core/services/client/client.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { Button } from '../../../shared/components/button/button';
import { RESERVATION_STATUS_STYLE } from '../../../shared/components/constants/reservation-status-style';
import { formatHistoryDate, todayIn } from '../../../shared/utils/calendar-date';
import { timeIn } from '../../../shared/utils/time-of-day';
import { formatPhone } from '../../../shared/utils/phone';
import { clientToRequest, formatCovers, splitHistory } from '../client-display';

interface HistoryRow {
  item: ClientHistoryItem,
  upcoming: boolean,
}

/** La fiche client (§7.5) : elle porte tout le poids, la liste reste mince */
@Component({
  imports: [Button],
  selector: 'app-client-sheet',
  templateUrl: './client-sheet.html',
})
export class ClientSheet {
  private _clients = inject(ClientService);
  private _modal = inject(ModalService);
  private _restaurant = inject(RestaurantService);

  edit = output<void>();
  closed = output<void>();

  protected readonly tagLabel = CLIENT_TAG_LABEL;
  protected readonly statusStyle = RESERVATION_STATUS_STYLE;
  protected readonly formatPhone = formatPhone;
  protected readonly formatCovers = formatCovers;

  client = input<ClientDetail | null>(null);
  failed = input(false);
  /** Hors de l'écran Clients : ni modifier, ni fusionner, ni supprimer ; « Ouvrir dans Clients » */
  readOnly = input(false);
  /** D'où l'on vient (§7.6) : « Réservation de jeudi 20:00 » */
  origin = input<string | null>(null);
  back = output<void>();
  openReservation = output<string>();
  newReservation = output<void>();
  openInClients = output<void>();
  protected isAdmin = inject(AuthService).isAdmin;

  // Chaque fiche s'ouvre sur ses 10 premières réservations et son menu de tags fermé
  private _clientId = computed(() => this.client()?.id ?? null);
  protected showAllHistory = linkedSignal({ source: this._clientId, computation: () => false });
  protected tagMenuOpen = linkedSignal({ source: this._clientId, computation: () => false });
  protected isBusy = signal(false);

  private _timeZone = computed(() => this._restaurant.model()?.timeZone ?? 'Europe/Paris');

  protected missingTags = computed(() => CLIENT_TAGS.filter((tag) => !this.client()?.tags.includes(tag)));

  protected history = computed(() => {
    const client = this.client();
    if (client === null) {
      return null;
    }
    const visible = this.showAllHistory() ? client.history : client.history.slice(0, CLIENT_LIMITS.historyPreview);
    const { upcoming, past } = splitHistory(visible, new Date());
    const rows: HistoryRow[] = [
      ...upcoming.map((item) => ({ item, upcoming: true })),
      ...past.map((item) => ({ item, upcoming: false })),
    ];
    return {
      rows,
      // Le trait ne sépare que s'il y a les deux
      ruleBefore: upcoming.length > 0 && past.length > 0 ? upcoming.length : -1,
      hidden: client.history.length - visible.length,
      total: client.history.length,
    };
  });

  protected historyDate(row: HistoryRow): string {
    const today = todayIn(this._timeZone());
    const date = formatHistoryDate(row.item.serviceDay, row.item.serviceDay.slice(0, 4) !== today.slice(0, 4));
    return row.upcoming ? `${date} · ${timeIn(this._timeZone(), new Date(row.item.start))}` : date;
  }

  protected async addTag(tag: ClientTag) {
    const client = this.client();
    if (client === null) {
      return;
    }
    this.tagMenuOpen.set(false);
    await this.run(() => this._clients.update(client.id, { ...clientToRequest(client), tags: [...client.tags, tag] }));
  }

  protected async merge(candidate: ClientMergeCandidate) {
    const client = this.client();
    if (client === null) {
      return;
    }
    const confirmed = await this._modal.confirmModal('Fusionner les fiches',
      `Les numéros, e-mails, tags, allergies, notes et réservations de ${candidate.name} rejoignent cette fiche. Sa fiche disparaît.`,
      'Fusionner');
    if (confirmed) {
      await this.run(() => this._clients.merge(client.id, candidate.id));
    }
  }

  protected async anonymize() {
    const client = this.client();
    if (client === null) {
      return;
    }
    const confirmed = await this._modal.confirmModal('Supprimer le client',
      'Nom, numéros, e-mails, allergie, notes et tags seront effacés. Ses réservations restent, signées « Client supprimé ».',
      'Supprimer');
    if (!confirmed) {
      return;
    }
    const result = await this.run(() => this._clients.anonymize(client.id));
    if (result?.error === null) {
      this.closed.emit();
    }
  }

  /** Un geste à la fois ; une erreur de l'API s'affiche telle quelle */
  private async run<T extends { error: string | null }>(action: () => Promise<T>): Promise<T | null> {
    if (this.isBusy()) {
      return null;
    }
    this.isBusy.set(true);
    const result = await action();
    this.isBusy.set(false);
    if (result.error !== null) {
      await this._modal.infoModal('Erreur', result.error);
    }
    return result;
  }
}
