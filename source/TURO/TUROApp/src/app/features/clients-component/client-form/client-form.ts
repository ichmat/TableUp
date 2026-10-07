import { Component, computed, inject, input, linkedSignal, output, signal, untracked } from '@angular/core';
import { applyEach, form, FormField, maxLength, required, validate } from '@angular/forms/signals';
import { ApiError, CLIENT_LIMITS, CLIENT_TAG_LABEL, CLIENT_TAGS, ClientDetail, ClientRequest, ClientTag } from '../../../models';
import { ClientService } from '../../../core/services/client/client.service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { Button } from '../../../shared/components/button/button';
import { Input } from '../../../shared/components/inputs/input/input';
import { formatPhone } from '../../../shared/utils/phone';

interface ClientDraft {
  name: string,
  phones: string[],
  emails: string[],
  allergies: string,
  internalNotes: string,
  tags: ClientTag[],
  /** La version de la fiche à l'ouverture du formulaire : un rechargement ne la change pas */
  version: number | null,
}

const L = CLIENT_LIMITS;

function toDraft(client: ClientDetail | null): ClientDraft {
  return {
    name: client?.name ?? '',
    phones: client && client.phones.length > 0 ? client.phones.map(formatPhone) : [''],
    emails: client && client.emails.length > 0 ? [...client.emails] : [''],
    allergies: client?.allergies ?? '',
    internalNotes: client?.internalNotes ?? '',
    tags: [...(client?.tags ?? [])],
    version: client?.version ?? null,
  };
}

function filled(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value !== '');
}

function toRequest(draft: ClientDraft): ClientRequest {
  return {
    name: draft.name.trim(),
    phones: filled(draft.phones),
    emails: filled(draft.emails),
    allergies: draft.allergies.trim() || null,
    internalNotes: draft.internalNotes.trim() || null,
    tags: draft.tags,
    version: draft.version,
  };
}

/** Création et modification d'une fiche, dans le panneau (§7.5). L'API normalise et vérifie l'identité */
@Component({
  imports: [FormField, Input, Button],
  selector: 'app-client-form',
  templateUrl: './client-form.html',
})
export class ClientForm {
  private _clients = inject(ClientService);
  private _modal = inject(ModalService);

  client = input<ClientDetail | null>(null);
  saved = output<ClientDetail>();
  cancelled = output<void>();
  openClient = output<string>();

  protected readonly limits = L;
  protected readonly tags = CLIENT_TAGS;
  protected readonly tagLabel = CLIENT_TAG_LABEL;

  // Repart de la fiche seulement si l'on change de client : un rechargement SignalR n'efface pas la saisie
  private _clientId = computed(() => this.client()?.id ?? null);
  private _draft = linkedSignal<string | null, ClientDraft>({
    source: this._clientId,
    computation: () => untracked(() => toDraft(this.client())),
  });
  protected draft = this._draft.asReadonly();

  protected clientForm = form(this._draft, (schema) => {
    required(schema.name, { message: 'Indiquez le nom' });
    maxLength(schema.name, L.maxName, { message: `Le nom est limité à ${L.maxName} caractères` });
    applyEach(schema.phones, (phone) => {
      maxLength(phone, L.maxPhone, { message: `Un numéro est limité à ${L.maxPhone} caractères` });
    });
    applyEach(schema.emails, (email) => {
      maxLength(email, L.maxEmail, { message: `Un e-mail est limité à ${L.maxEmail} caractères` });
      validate(email, ({ value }) => value().trim() !== '' && (!value().includes('@') || value().includes(';'))
        ? { kind: 'email', message: 'Cet e-mail n\'est pas valide' }
        : undefined);
    });
    // Sans l'un ni l'autre, c'est un client de passage : il ne crée aucune fiche (§7.2)
    validate(schema.phones, ({ value, valueOf }) =>
      filled(value()).some((phone) => /\d/.test(phone)) || filled(valueOf(schema.emails)).length > 0
        ? undefined
        : { kind: 'contact', message: 'Indiquez au moins un téléphone ou un e-mail' });
    // Une fusion peut dépasser la limite (§7.8) : le texte enregistré reste enregistrable, seul ce qui grossit est refusé
    maxLength(schema.allergies, () => Math.max(L.maxAllergies, this.client()?.allergies?.length ?? 0),
      { message: `L'allergie est limitée à ${L.maxAllergies} caractères` });
    maxLength(schema.internalNotes, () => Math.max(L.maxNotes, this.client()?.internalNotes?.length ?? 0),
      { message: `Les notes sont limitées à ${L.maxNotes} caractères` });
  });

  protected isSaving = signal(false);

  protected addPhone() {
    this._draft.update((draft) => ({ ...draft, phones: [...draft.phones, ''] }));
  }

  protected removePhone(index: number) {
    this._draft.update((draft) => ({ ...draft, phones: draft.phones.filter((_, i) => i !== index) }));
  }

  protected addEmail() {
    this._draft.update((draft) => ({ ...draft, emails: [...draft.emails, ''] }));
  }

  protected removeEmail(index: number) {
    this._draft.update((draft) => ({ ...draft, emails: draft.emails.filter((_, i) => i !== index) }));
  }

  /** Les tags gardent l'ordre de référence (VIP, Habitué, À surveiller, Presse) */
  protected toggleTag(tag: ClientTag) {
    this._draft.update((draft) => ({
      ...draft,
      tags: draft.tags.includes(tag)
        ? draft.tags.filter((t) => t !== tag)
        : CLIENT_TAGS.filter((t) => t === tag || draft.tags.includes(t)),
    }));
  }

  async save() {
    if (this.clientForm().errorSummary().length > 0) {
      this.clientForm().markAsTouched();
      return;
    }
    const request = toRequest(this._draft());
    const client = this.client();

    this.isSaving.set(true);
    const result = client === null ? await this._clients.create(request) : await this._clients.update(client.id, request);
    this.isSaving.set(false);

    if (result.error === null) {
      this.saved.emit(result.value);
      return;
    }
    if (result.code === ApiError.ClientChanged) {
      // Enregistrer quand même effacerait ce que l'autre poste vient d'écrire (une allergie, une fusion)
      if (await this._modal.confirmModal('Fiche modifiée sur un autre poste',
        'Cette fiche a changé depuis que vous l\'avez ouverte. Recharger la fiche ? Votre saisie sera perdue.', 'Recharger', 'Garder ma saisie')) {
        this._draft.set(toDraft(this.client()));
      }
      return;
    }
    if (result.code === ApiError.ClientPhoneTaken && await this.offerOwner(request.phones, client?.id ?? null)) {
      return;
    }
    await this._modal.infoModal('Erreur', result.error);
  }

  /** Le numéro est déjà celui d'une autre fiche : on propose de l'ouvrir plutôt que de créer un doublon */
  private async offerOwner(phones: string[], exceptId: string | null): Promise<boolean> {
    for (const phone of phones) {
      const owner = await this._clients.findByPhone(phone, exceptId);
      if (owner !== null) {
        if (await this._modal.confirmModal('Numéro déjà connu', `Ce numéro est déjà celui de ${owner.name}.`, 'Ouvrir sa fiche', 'Fermer')) {
          this.openClient.emit(owner.id);
        }
        return true;
      }
    }
    return false;
  }
}
