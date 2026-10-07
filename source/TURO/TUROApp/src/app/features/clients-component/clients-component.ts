import { Component, computed, inject, signal } from '@angular/core';
import { ClientDetail } from '../../models';
import { ClientService } from '../../core/services/client/client.service';
import { ClientList } from './client-list/client-list';
import { ClientSheet } from './client-sheet/client-sheet';
import { ClientForm } from './client-form/client-form';

type PanelMode = 'view' | 'create' | 'edit';

/**
 * Clients — le mini-CRM (§7). La liste à gauche ; la fiche, ou son formulaire, dans un panneau unique à droite
 * (maquette 26, option A, sans flèche de retour sur cet écran)
 */
@Component({
  imports: [ClientList, ClientSheet, ClientForm],
  selector: 'app-clients-component',
  styleUrl: './clients-component.css',
  templateUrl: './clients-component.html',
})
export class ClientsComponent {
  private _clients = inject(ClientService);

  protected mode = signal<PanelMode>('view');
  protected selectedId = this._clients.selectedId;
  protected detail = this._clients.detail;
  protected panelOpen = computed(() => this.mode() === 'create' || this.selectedId() !== null);

  protected open(id: string) {
    this._clients.select(id);
    this.mode.set('view');
  }

  protected startCreate() {
    this._clients.select(null);
    this.mode.set('create');
  }

  protected startEdit() {
    this.mode.set('edit');
  }

  protected close() {
    this._clients.select(null);
    this.mode.set('view');
  }

  protected onSaved(client: ClientDetail) {
    this._clients.select(client.id);
    this.mode.set('view');
  }
}
