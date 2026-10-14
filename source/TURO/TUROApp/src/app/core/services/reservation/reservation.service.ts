import { computed, inject, linkedSignal, Service, signal } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import {
    CancelledBy, ClientDetail, DataScope, RESERVATION_LIMITS, ReservationActionResult, ReservationDetail, ReservationGesture,
    PlaceTarget, ReservationPage, ReservationQuery, ReservationRequest, ServiceWindow,
} from '../../../models';
import { AuthService } from '../auth/auth.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ApiResult, toApiResult } from '../api-result';

const RESERVATIONS_URL = '/api/reservations';

export const DEFAULT_RESERVATION_QUERY: ReservationQuery = {
    period: 'Upcoming', status: null, source: null, zoneId: null, search: '', days: RESERVATION_LIMITS.days,
};

function listParams(query: ReservationQuery): Record<string, string | number> {
    const search = query.search.trim();
    return {
        period: query.period,
        days: query.days,
        ...(search !== '' ? { search } : {}),
        ...(query.status !== null ? { status: query.status } : {}),
        ...(query.source !== null ? { source: query.source } : {}),
        ...(query.zoneId !== null ? { zoneId: query.zoneId } : {}),
    };
}

/** Réservations (§6) : la liste interrogée, la fiche ouverte, et la fiche client ouverte depuis elle (§7.6) */
@Service()
export class ReservationService {
    private _auth = inject(AuthService);
    private _http = inject(HttpClient);

    private _query = signal<ReservationQuery>(DEFAULT_RESERVATION_QUERY);
    query = this._query.asReadonly();

    private _list = httpResource<ReservationPage>(() =>
        this._auth.isConnected() ? { url: RESERVATIONS_URL, params: listParams(this._query()) } : undefined
    );
    // La page précédente reste affichée pendant qu'un filtre se charge : pas de clignotement
    private _page = linkedSignal<ReservationPage | undefined, ReservationPage | null>({
        source: () => (this._list.hasValue() ? this._list.value() : undefined),
        computation: (value, previous) => value ?? previous?.value ?? null,
    });
    page = this._page.asReadonly();
    listFailed = computed(() => this._list.status() === 'error');

    private _selectedId = signal<string | null>(null);
    selectedId = this._selectedId.asReadonly();
    private _detail = httpResource<ReservationDetail>(() => {
        const id = this._selectedId();
        return this._auth.isConnected() && id !== null ? `${RESERVATIONS_URL}/${id}` : undefined;
    });
    // `value()` lève une exception quand la ressource est en erreur ; la fiche d'une autre réservation ne s'affiche jamais
    detail = computed(() => {
        const value = this._detail.hasValue() ? this._detail.value() : null;
        return value !== null && value.id === this._selectedId() ? value : null;
    });
    detailFailed = computed(() => this._detail.status() === 'error');

    // Une fiche client lue depuis une fiche réservation : la sélection de l'écran Clients n'est pas touchée
    private _clientId = signal<string | null>(null);
    clientId = this._clientId.asReadonly();
    private _client = httpResource<ClientDetail>(() => {
        const id = this._clientId();
        return this._auth.isConnected() && id !== null ? `/api/clients/${id}` : undefined;
    });
    client = computed(() => {
        const value = this._client.hasValue() ? this._client.value() : null;
        return value !== null && value.id === this._clientId() ? value : null;
    });
    clientFailed = computed(() => this._client.status() === 'error');

    constructor() {
        const realtime = inject(RealtimeService);
        // l'API annonce une modification : on refait les GET
        realtime.onDataChanged(DataScope.Reservations, () => {
            this._list.reload();
            if (this._selectedId() !== null) {
                this._detail.reload();
            }
        });
        // Compteurs et allergie du client s'affichent aussi sur la fiche réservation
        realtime.onDataChanged(DataScope.Clients, () => {
            if (this._selectedId() !== null) {
                this._detail.reload();
            }
            if (this._clientId() !== null) {
                this._client.reload();
            }
        });
    }

    /** Période, filtre ou recherche : la liste repart de 14 jours */
    setQuery(change: Partial<Omit<ReservationQuery, 'days'>>) {
        this._query.update((query) => ({ ...query, ...change, days: RESERVATION_LIMITS.days }));
    }

    showMore() {
        this._query.update((query) => ({ ...query, days: Math.min(query.days + RESERVATION_LIMITS.days, RESERVATION_LIMITS.maxDays) }));
    }

    select(id: string | null) {
        this._selectedId.set(id);
    }

    selectClient(id: string | null) {
        this._clientId.set(id);
    }

    slots(day: string): Promise<ApiResult<ServiceWindow[]>> {
        return toApiResult(this._http.get<ServiceWindow[]>(`${RESERVATIONS_URL}/slots`, { params: { day } }));
    }

    create(request: ReservationRequest): Promise<ApiResult<ReservationActionResult>> {
        return this.thenRefresh(toApiResult(this._http.post<ReservationActionResult>(RESERVATIONS_URL, request)));
    }

    update(id: string, request: ReservationRequest): Promise<ApiResult<ReservationActionResult>> {
        return this.thenRefresh(toApiResult(this._http.put<ReservationActionResult>(`${RESERVATIONS_URL}/${id}`, request)));
    }

    act(id: string, gesture: ReservationGesture): Promise<ApiResult<ReservationActionResult>> {
        return this.thenRefresh(toApiResult(this._http.post<ReservationActionResult>(`${RESERVATIONS_URL}/${id}/${gesture}`, null)));
    }

    /** §5.8 : placer, accepter en déposant, changer de table */
    place(id: string, target: PlaceTarget): Promise<ApiResult<ReservationActionResult>> {
        return this.thenRefresh(toApiResult(this._http.post<ReservationActionResult>(`${RESERVATIONS_URL}/${id}/place`, target)));
    }

    cancel(id: string, by: CancelledBy): Promise<ApiResult<ReservationActionResult>> {
        return this.thenRefresh(toApiResult(this._http.post<ReservationActionResult>(`${RESERVATIONS_URL}/${id}/cancel`, { by })));
    }

    /** La réservation rétablie, ou `null` quand c'était une création (supprimée) */
    async undo(id: string, eventId: string): Promise<ApiResult<ReservationDetail | null>> {
        const result = await toApiResult(this._http.post<ReservationDetail | null>(`${RESERVATIONS_URL}/${id}/undo/${eventId}`, null));
        if (result.error === null) {
            this._list.reload();
            if (this._selectedId() === id) {
                if (result.value === null) {
                    this._selectedId.set(null);
                } else {
                    this._detail.set(result.value);
                }
            }
        }
        return result;
    }

    /** La liste se recharge ; la fiche ouverte prend tout de suite la réponse, sans attendre la notification */
    private async thenRefresh(request: Promise<ApiResult<ReservationActionResult>>): Promise<ApiResult<ReservationActionResult>> {
        const result = await request;
        if (result.value !== null) {
            this._list.reload();
            if (result.value.reservation.id === this._selectedId()) {
                this._detail.set(result.value.reservation);
            }
        }
        return result;
    }
}
