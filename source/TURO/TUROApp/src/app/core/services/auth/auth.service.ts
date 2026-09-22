import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { ModalService } from '../modal/modal.service';

const KEY_JWT = "jwt";

@Service()
export class AuthService {
    private http = inject(HttpClient);
    private modal = inject(ModalService);

    token: string | null = null;
    isConnected: boolean = false;

    constructor(){
        this.token = localStorage.getItem(KEY_JWT);
        this.isConnected = this.token !== null;
    }

    private changeToken(newToken: string | null){
        this.token = newToken;

        if(newToken === null){
            localStorage.removeItem(KEY_JWT);
            this.isConnected = false;
        }else{
            localStorage.setItem(KEY_JWT, newToken);
            this.isConnected = true;
        }
    }

    attemptLogin(login: string, password:string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this.http.post<string>("/api/auth/login", { login, password}).subscribe({
                next: (jwt) => {
                    this.changeToken(jwt);
                    resolve(true);
                    },
                error: (err) => {
                    this.modal.infoModal("Connexion échoué",`Le login ou le mot de passe ne correspond pas. \n ${err}`);
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
