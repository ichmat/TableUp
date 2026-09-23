import { computed, inject, Service, signal, } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { HttpClient, httpResource } from '@angular/common/http';
import { Restaurant } from '../../../models';

@Service()
export class RestaurantService {
    private _authService = inject(AuthService);

    private _restaurant = httpResource<Restaurant>(() =>
        this._authService.isConnected() ? '/api/restaurant' : undefined
    );

    model = computed(() => this._restaurant.value() ?? null);
    isLoading = this._restaurant.isLoading;
    error = this._restaurant.error;
}
