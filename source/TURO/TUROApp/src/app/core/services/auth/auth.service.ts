import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { ModalService } from '../modal/modal.service';
import { ApiError, isApiErrorResponse } from '../../../models';

const KEY_JWT = "jwt";

@Service()
export class AuthService {
    private http = inject(HttpClient);
    private modal = inject(ModalService);

    private _token = signal<string | null>(localStorage.getItem(KEY_JWT));
    token = this._token.asReadonly();
    isConnected = computed(() => this._token() !== null);

    private changeToken(newToken: string | null){
        this._token.set(newToken);

        if(newToken === null){
            localStorage.removeItem(KEY_JWT);
        }else{
            localStorage.setItem(KEY_JWT, newToken);
        }
    }

    attemptLogin(login: string, password:string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this.http.post<{jwt:string}>("/api/auth/login", { login, password}).subscribe({
                next: (respnse) => {
                    this.changeToken(respnse.jwt);
                    resolve(true);
                    },
                error: (err) => {
                    if(err instanceof HttpErrorResponse && isApiErrorResponse(err.error)){
                        switch(err.error.error){
                            case ApiError.InvalidLoginOrPassword:
                                this.modal.infoModal("Echec du login","Le login ou le mot de passe ne correspond pas.");
                                break;
                            default:
                                this.modal.infoModal("Echec du login","Erreur inconnu, veuillez ressayez");
                                break;
                        }
                    }else{
                        this.modal.infoModal("Echec du login","Erreur inconnu, veuillez ressayez");
                    }
                    console.error("attemptLogin", err);
                    resolve(false);
                }
            })
        })
    }

    logout(){
        return new Promise<boolean>((resolve) => {
            this.http.delete("/api/auth/logout").subscribe({
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
