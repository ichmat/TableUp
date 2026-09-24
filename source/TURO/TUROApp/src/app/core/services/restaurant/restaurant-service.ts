import { computed, inject, Service, signal, } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { HttpClient, httpResource } from '@angular/common/http';
import { DataScope, Restaurant } from '../../../models';
import { RealtimeService } from '../realtime/realtime.service';

@Service()
export class RestaurantService {
    private _authService = inject(AuthService);

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
}
