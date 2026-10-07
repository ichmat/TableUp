import { computed, inject, linkedSignal, Service, signal } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { map } from 'rxjs';
import { CLIENT_LIMITS, ClientDetail, ClientListItem, ClientPage, ClientQuery, ClientRequest, DataScope } from '../../../models';
import { AuthService } from '../auth/auth.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ApiResult, toApiResult } from '../api-result';

const CLIENTS_URL = '/api/clients';

export const DEFAULT_CLIENT_QUERY: ClientQuery = { search: '', sort: 'Recent', tag: null, atRisk: false, pageSize: CLIENT_LIMITS.pageSize };

export interface CsvFile {
    blob: Blob,
    fileName: string,
}

/** `attachment; filename=clients-2026-10-05.csv; …` → `clients-2026-10-05.csv` */
export function fileNameOf(disposition: string | null): string | null {
    const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    return match ? decodeURIComponent(match[1]) : null;
}

function listParams(query: ClientQuery): Record<string, string | number | boolean> {
    const search = query.search.trim();
    return {
        sort: query.sort,
        page: 0,
        pageSize: query.pageSize,
        ...(search !== '' ? { search } : {}),
        ...(query.tag !== null ? { tag: query.tag } : {}),
        ...(query.atRisk ? { atRisk: true } : {}),
    };
}

/** Clients — le mini-CRM (§7) : la liste interrogée, et la fiche ouverte */
@Service()
export class ClientService {
    private _auth = inject(AuthService);
    private _http = inject(HttpClient);

    private _query = signal<ClientQuery>(DEFAULT_CLIENT_QUERY);
    query = this._query.asReadonly();

    private _selectedId = signal<string | null>(null);
    selectedId = this._selectedId.asReadonly();

    private _list = httpResource<ClientPage>(() =>
        this._auth.isConnected() ? { url: CLIENTS_URL, params: listParams(this._query()) } : undefined
    );
    // La page précédente reste affichée pendant qu'une recherche se charge : pas de clignotement à chaque frappe
    private _page = linkedSignal<ClientPage | undefined, ClientPage | null>({
        source: () => (this._list.hasValue() ? this._list.value() : undefined),
        computation: (value, previous) => value ?? previous?.value ?? null,
    });
    page = this._page.asReadonly();
    listFailed = computed(() => this._list.status() === 'error');

    private _detail = httpResource<ClientDetail>(() => {
        const id = this._selectedId();
        return this._auth.isConnected() && id !== null ? `${CLIENTS_URL}/${id}` : undefined;
    });
    // `value()` lève une exception quand la ressource est en erreur ; la fiche d'un autre client ne s'affiche jamais
    detail = computed(() => {
        const value = this._detail.hasValue() ? this._detail.value() : null;
        return value !== null && value.id === this._selectedId() ? value : null;
    });
    detailFailed = computed(() => this._detail.status() === 'error');

    constructor() {
        // l'API annonce une modification : on refait les GET
        inject(RealtimeService).onDataChanged(DataScope.Clients, () => {
            this._list.reload();
            if (this._selectedId() !== null) {
                this._detail.reload();
            }
        });
    }

    /** Recherche, tri ou filtre : la liste repart de 50 lignes */
    setQuery(change: Partial<Omit<ClientQuery, 'pageSize'>>) {
        this._query.update((query) => ({ ...query, ...change, pageSize: CLIENT_LIMITS.pageSize }));
    }

    showMore() {
        this._query.update((query) => ({ ...query, pageSize: Math.min(query.pageSize + CLIENT_LIMITS.pageSize, CLIENT_LIMITS.maxPageSize) }));
    }

    select(id: string | null) {
        this._selectedId.set(id);
    }

    create(request: ClientRequest): Promise<ApiResult<ClientDetail>> {
        return this.thenRefresh(toApiResult(this._http.post<ClientDetail>(CLIENTS_URL, request)));
    }

    update(id: string, request: ClientRequest): Promise<ApiResult<ClientDetail>> {
        return this.thenRefresh(toApiResult(this._http.put<ClientDetail>(`${CLIENTS_URL}/${id}`, request)));
    }

    merge(id: string, otherId: string): Promise<ApiResult<ClientDetail>> {
        return this.thenRefresh(toApiResult(this._http.post<ClientDetail>(`${CLIENTS_URL}/${id}/merge/${otherId}`, null)));
    }

    async anonymize(id: string): Promise<ApiResult<null>> {
        const result = await toApiResult(this._http.delete<null>(`${CLIENTS_URL}/${id}`));
        if (result.error === null) {
            if (this._selectedId() === id) {
                this._selectedId.set(null);
            }
            this._list.reload();
        }
        return result;
    }

    /** Le client qui porte déjà ce numéro, pour proposer d'ouvrir sa fiche */
    async findByPhone(phone: string, exceptId: string | null): Promise<ClientListItem | null> {
        const result = await toApiResult(this._http.get<ClientPage>(CLIENTS_URL, { params: { search: phone, pageSize: 5 } }));
        return result.value?.items.find((item) => item.id !== exceptId) ?? null;
    }

    exportCsv(): Promise<ApiResult<CsvFile>> {
        return toApiResult(this._http.get(`${CLIENTS_URL}/export`, { observe: 'response', responseType: 'blob' }).pipe(
            map((response) => ({
                blob: response.body ?? new Blob(),
                fileName: fileNameOf(response.headers.get('Content-Disposition')) ?? 'clients.csv',
            })),
        ));
    }

    /** La liste se recharge ; la fiche ouverte prend tout de suite la réponse, sans attendre la notification */
    private async thenRefresh(request: Promise<ApiResult<ClientDetail>>): Promise<ApiResult<ClientDetail>> {
        const result = await request;
        if (result.value !== null) {
            this._list.reload();
            if (result.value.id === this._selectedId()) {
                this._detail.set(result.value);
            }
        }
        return result;
    }
}
