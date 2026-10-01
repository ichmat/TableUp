import { computed, inject, Service, } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DataScope, isApiErrorResponse, Restaurant } from '../../../models';
import { RealtimeService } from '../realtime/realtime.service';
import { RestaurantService as ServiceModel } from '../../../models';

@Service()
export class RestaurantService {
    private _authService = inject(AuthService);
    private _http = inject(HttpClient);

    private _restaurant = httpResource<Restaurant>(() =>
        this._authService.isConnected() ? '/api/restaurant' : undefined
    );

    model = computed(() => this._restaurant.value() ?? null);
    isLoading = this._restaurant.isLoading;
    error = this._restaurant.error;

    constructor() {
        // l'API annonce une modification : on refait le GET
        inject(RealtimeService).onDataChanged(DataScope.Restaurant, () => this._restaurant.reload());
    }

    /** Résout `null` en cas de succès, le message d'erreur sinon */
    createService(service: ServiceModel): Promise<string | null> {
        return toResult(this._http.post("/api/restaurant/settings/service", service));
    }

    /** Résout `null` en cas de succès, le message d'erreur sinon */
    updateService(id: string, service: ServiceModel): Promise<string | null> {
        return toResult(this._http.put(`/api/restaurant/settings/service/${id}`, service));
    }

    /** Résout `null` en cas de succès, le message d'erreur sinon */
    deleteService(id: string): Promise<string | null> {
        return toResult(this._http.delete(`/api/restaurant/settings/service/${id}`));
    }
}

function toResult(request: Observable<unknown>): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
        request.subscribe({
            next: () => resolve(null),
            error: (error: unknown) => resolve(
                error instanceof HttpErrorResponse && isApiErrorResponse(error.error)
                    ? error.error.message
                    : "La modification n'a pas été enregistrée."
            ),
        });
    });
}
