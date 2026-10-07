import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { finalize, map, Observable, shareReplay, tap } from 'rxjs';
import { ModalService } from '../modal/modal.service';
import { ApiError, isApiErrorResponse, UserRole } from '../../../models';

const KEY_JWT = "jwt";

@Service()
export class AuthService {
    private _http = inject(HttpClient);
    private _modal = inject(ModalService);

    private _token = signal<string | null>(null);
    token = this._token.asReadonly();
    isConnected = computed(() => this._token() !== null);
    /** Lu dans le JWT, pour l'affichage seulement : c'est l'API qui refuse ce qui n'est pas permis */
    role = computed(() => roleOf(this._token()));
    isAdmin = computed(() => this.role() === 'Admin');

    /** Refresh en cours, partagé par toutes les requêtes tombées en `TokenExpired` en même temps */
    private _refresh$: Observable<string> | null = null;

    constructor(){
        this._token.set(localStorage.getItem(KEY_JWT));
        
        if(this._token() !== null)
            this._http.get("/api/auth/check");
        // le refresh de token est gérée dans :
        // `app\core\interceptors\logging-interceptor.ts`
    }

    private changeToken(newToken: string | null){
        this._token.set(newToken);

        if(newToken === null){
            localStorage.removeItem(KEY_JWT);
        }else{
            localStorage.setItem(KEY_JWT, newToken);
        }
    }

    /** Oublie localement un jeton que l'API ne sait plus lire, sans appeler `/api/auth/logout` */
    clearToken(){
        this.changeToken(null);
    }

    /**
     * Obtient un nouveau JWT grâce au refresh token (cookie HttpOnly).
     * Le refresh token étant à usage unique, les appels simultanés reçoivent la même requête.
     * En cas d'échec, la session est perdue : le jeton est effacé.
     */
    refreshToken(): Observable<string> {
        this._refresh$ ??= this._http.post<{jwt: string}>("/api/auth/refresh", null).pipe(
            map((response) => response.jwt),
            tap({
                next: (jwt) => this.changeToken(jwt),
                error: () => this.changeToken(null),
            }),
            finalize(() => this._refresh$ = null),
            // pas de refCount : une requête annulée ne doit pas interrompre le refresh des autres
            shareReplay({ bufferSize: 1, refCount: false }),
        );
        return this._refresh$;
    }

    attemptLogin(login: string, password:string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this._http.post<{jwt:string}>("/api/auth/login", { login, password}).subscribe({
                next: (respnse) => {
                    this.changeToken(respnse.jwt);
                    resolve(true);
                    },
                error: (err) => {
                    if(err instanceof HttpErrorResponse && isApiErrorResponse(err.error)){
                        switch(err.error.error){
                            case ApiError.InvalidLoginOrPassword:
                                this._modal.infoModal("Echec du login","Le login ou le mot de passe ne correspond pas.");
                                break;
                            default:
                                this._modal.infoModal("Echec du login","Erreur inconnu, veuillez ressayez");
                                break;
                        }
                    }else{
                        this._modal.infoModal("Echec du login","Erreur inconnu, veuillez ressayez");
                    }
                    console.error("attemptLogin", err);
                    resolve(false);
                }
            })
        })
    }

    logout(){
        return new Promise<boolean>((resolve) => {
            this._http.delete("/api/auth/logout").subscribe({
                next: () => {
                    this.changeToken(null);
                    resolve(true)
                    },
                error: (err) => {
                    this.changeToken(null);
                    console.error("attemptLogin", err);
                    resolve(false);
                }
            })
        })
    }
}

const ROLE_CLAIMS = ['role', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];

/** Le rôle porté par un JWT, ou `null` s'il est absent ou illisible */
export function roleOf(token: string | null): UserRole | null {
    if (token === null) {
        return null;
    }
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
        const role = ROLE_CLAIMS.map((claim) => payload[claim]).find((value) => value !== undefined);
        return role === 'Admin' || role === 'Staff' ? role : null;
    } catch {
        return null;
    }
}
