import { Component, computed, inject, input, OnDestroy, output, signal } from '@angular/core';
import { twMerge } from 'tailwind-merge';
import { CLIENT_LIMITS, CLIENT_TAG_LABEL, CLIENT_TAGS, ClientListItem, ClientSort, ClientTag } from '../../../models';
import { ClientService } from '../../../core/services/client/client.service';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { Button } from '../../../shared/components/button/button';
import { Input } from '../../../shared/components/inputs/input/input';
import { todayIn } from '../../../shared/utils/calendar-date';
import { formatPhone } from '../../../shared/utils/phone';
import { saveFile } from '../../../shared/utils/download';
import { lastDayLabel, listName } from '../client-display';

const SEARCH_DELAY_MS = 300;

/** La liste mince (§7.3) : on la traverse pour ouvrir une fiche, on n'y lit pas tout */
@Component({
  imports: [Input, Button],
  selector: 'app-client-list',
  templateUrl: './client-list.html',
})
export class ClientList implements OnDestroy {
  private _clients = inject(ClientService);
  private _restaurant = inject(RestaurantService);
  private _modal = inject(ModalService);

  selectedId = input<string | null>(null);
  opened = output<string>();
  create = output<void>();

  protected readonly sorts: { value: ClientSort, label: string }[] = [
    { value: 'Recent', label: 'Récents' },
    { value: 'Name', label: 'A → Z' },
    { value: 'Visits', label: 'Plus fidèles' },
  ];
  protected readonly tags = CLIENT_TAGS;
  protected readonly tagLabel = CLIENT_TAG_LABEL;
  protected readonly listName = listName;
  protected readonly formatPhone = formatPhone;
  /** Au-delà, l'API ne rend pas plus de lignes : la recherche prend le relais */
  protected readonly maxPageSize = CLIENT_LIMITS.maxPageSize;

  protected query = this._clients.query;
  protected page = this._clients.page;
  protected listFailed = this._clients.listFailed;
  protected searchText = signal(this._clients.query().search);
  protected isExporting = signal(false);

  private _today = computed(() => todayIn(this._restaurant.model()?.timeZone ?? 'Europe/Paris'));
  private _searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected lastDay(item: ClientListItem): string {
    return lastDayLabel(item.lastServiceDay, this._today());
  }

  /** Pas une requête par frappe : on attend que la saisie se pose */
  protected onSearch(text: string) {
    this.searchText.set(text);
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this._clients.setQuery({ search: text }), SEARCH_DELAY_MS);
  }

  protected setSort(sort: ClientSort) {
    this._clients.setQuery({ sort });
  }

  protected setTag(value: string) {
    this._clients.setQuery({ tag: value === '' ? null : value as ClientTag });
  }

  protected toggleRisk() {
    this._clients.setQuery({ atRisk: !this.query().atRisk });
  }

  protected showMore() {
    this._clients.showMore();
  }

  protected chipClass(active: boolean): string {
    return twMerge('px-3 py-1 rounded-full border-2 border-border-soft cursor-pointer',
      active ? 'bg-slate text-surface border-slate' : 'bg-surface hover:bg-app');
  }

  protected rowClass(item: ClientListItem): string {
    return twMerge('cursor-pointer border-t border-border-soft hover:bg-app', item.id === this.selectedId() ? 'bg-app' : '');
  }

  /** CLI-05 : le corail plein vient du drapeau de l'API, jamais d'un calcul ici */
  protected ratioClass(item: ClientListItem): string {
    return twMerge('inline-block px-2 rounded font-bold tabular-nums', item.atRisk ? 'bg-coral text-surface' : '');
  }

  protected async exportCsv() {
    this.isExporting.set(true);
    const result = await this._clients.exportCsv();
    this.isExporting.set(false);
    if (result.error !== null) {
      await this._modal.infoModal('Erreur', result.error);
      return;
    }
    saveFile(result.value.blob, result.value.fileName);
  }

  ngOnDestroy() {
    clearTimeout(this._searchTimer);
  }
}
