import { inject, Service, } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { HttpClient } from '@angular/common/http';

@Service()
export class RestaurantService {
    private _authService = inject(AuthService);
    private _http = inject(HttpClient);
}
