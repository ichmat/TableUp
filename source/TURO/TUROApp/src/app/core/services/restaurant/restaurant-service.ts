import { computed, inject, Service, signal, } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { HttpClient, httpResource } from '@angular/common/http';
import { DataScope, Restaurant } from '../../../models';
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

    createService(service: ServiceModel): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this._http.post("/api/restaurant/settings/service", service).subscribe({
                next: () => {resolve(true)},
                error: () => {resolve(false)}
            })
        })
    }

    updateService(id: string, service: ServiceModel) : Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this._http.put(`/api/restaurant/settings/service/${id}`, service).subscribe({
                next: () => {resolve(true)},
                error: () => {resolve(false)}
            })
        })
    }

    deleteService(id: string) : Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this._http.delete(`/api/restaurant/settings/service/${id}`).subscribe({
                next: () => {resolve(true)},
                error: () => {resolve(false)}
            })
        })
    }
}
