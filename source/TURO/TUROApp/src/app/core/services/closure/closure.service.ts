import { computed, inject, Service } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { ClosureRequest, DataScope, ExceptionalClosure, ImpactedReservation } from '../../../models';
import { AuthService } from '../auth/auth.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ApiResult, toApiResult } from '../api-result';

const CLOSURES_URL = '/api/restaurant/closures';

/** Horaires exceptionnels : fermetures et horaires modifiés */
@Service()
export class ClosureService {
    private _authService = inject(AuthService);
    private _http = inject(HttpClient);

    private _closures = httpResource<ExceptionalClosure[]>(() =>
        this._authService.isConnected() ? CLOSURES_URL : undefined
    );

    // `value()` lève une exception quand la ressource est en erreur : elle figerait tout écran qui la lit
    closures = computed(() => this._closures.hasValue() ? this._closures.value() : []);
    isLoading = this._closures.isLoading;
    error = this._closures.error;
    loadFailed = computed(() => this._closures.status() === 'error');

    constructor() {
        // l'API annonce une modification : on refait le GET
        inject(RealtimeService).onDataChanged(DataScope.Closures, () => this._closures.reload());
    }

    /** Réservations actives que la fermeture laisserait sans service, à montrer avant d'enregistrer */
    impact(request: ClosureRequest): Promise<ApiResult<ImpactedReservation[]>> {
        return toApiResult(this._http.post<ImpactedReservation[]>(`${CLOSURES_URL}/impact`, request));
    }

    create(request: ClosureRequest): Promise<ApiResult<ExceptionalClosure>> {
        return toApiResult(this._http.post<ExceptionalClosure>(CLOSURES_URL, request));
    }

    update(id: string, request: ClosureRequest): Promise<ApiResult<ExceptionalClosure>> {
        return toApiResult(this._http.put<ExceptionalClosure>(`${CLOSURES_URL}/${id}`, request));
    }

    delete(id: string): Promise<ApiResult<ExceptionalClosure>> {
        return toApiResult(this._http.delete<ExceptionalClosure>(`${CLOSURES_URL}/${id}`));
    }
}
