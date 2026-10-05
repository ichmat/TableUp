import { computed, inject, Service, } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { HttpClient, httpResource } from '@angular/common/http';
import { BookingWindowRequest, DataScope, PlacementPreviewItem, PlacementSettingsRequest, Restaurant } from '../../../models';
import { RealtimeService } from '../realtime/realtime.service';
import { RestaurantService as ServiceModel } from '../../../models';
import { ApiResult, toApiResult } from '../api-result';

@Service()
export class RestaurantService {
    private _authService = inject(AuthService);
    private _http = inject(HttpClient);

    private _restaurant = httpResource<Restaurant>(() =>
        this._authService.isConnected() ? '/api/restaurant' : undefined
    );

    // `value()` lève une exception quand la ressource est en erreur : elle figerait tout écran qui la lit
    model = computed(() => this._restaurant.hasValue() ? this._restaurant.value() : null);
    isLoading = this._restaurant.isLoading;
    error = this._restaurant.error;

    constructor() {
        // l'API annonce une modification : on refait le GET
        inject(RealtimeService).onDataChanged(DataScope.Restaurant, () => this._restaurant.reload());
    }

    /** Résout `null` en cas de succès, le message d'erreur sinon */
    async createService(service: ServiceModel): Promise<string | null> {
        return (await toApiResult(this._http.post("/api/restaurant/settings/service", service))).error;
    }

    /** Résout `null` en cas de succès, le message d'erreur sinon */
    async updateService(id: string, service: ServiceModel): Promise<string | null> {
        return (await toApiResult(this._http.put(`/api/restaurant/settings/service/${id}`, service))).error;
    }

    /** Résout `null` en cas de succès, le message d'erreur sinon */
    async deleteService(id: string): Promise<string | null> {
        return (await toApiResult(this._http.delete(`/api/restaurant/settings/service/${id}`))).error;
    }

    updatePlacement(request: PlacementSettingsRequest): Promise<ApiResult<Restaurant>> {
        return this.thenShow(toApiResult(this._http.put<Restaurant>('/api/restaurant/settings/placement', request)));
    }

    updateBookingWindow(request: BookingWindowRequest): Promise<ApiResult<Restaurant>> {
        return this.thenShow(toApiResult(this._http.put<Restaurant>('/api/restaurant/settings/booking-window', request)));
    }

    /** Verdicts calculés par l'API pour une tolérance pas encore enregistrée */
    previewPlacement(covers: number, tolerance: number): Promise<ApiResult<PlacementPreviewItem[]>> {
        return toApiResult(this._http.get<PlacementPreviewItem[]>('/api/restaurant/settings/placement/preview',
            { params: { covers, tolerance } }));
    }

    /** L'écran montre la valeur enregistrée sans attendre la notification SignalR */
    private async thenShow(request: Promise<ApiResult<Restaurant>>): Promise<ApiResult<Restaurant>> {
        const result = await request;
        if (result.error === null) {
            this._restaurant.set(result.value);
        }
        return result;
    }
}
