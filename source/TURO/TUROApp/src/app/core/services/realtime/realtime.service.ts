import { effect, inject, InjectionToken, Service, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { HttpError, HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { DataScope } from '../../../models';

const HUB_URL = '/api/hubs/turo';

/** Délais entre deux tentatives de connexion ; le dernier se répète indéfiniment */
const RETRY_DELAYS_MS = [0, 2_000, 5_000, 10_000, 30_000];

/** En deçà, le JWT est rafraîchi avant de (re)connecter : le serveur coupe la connexion à son expiration */
const TOKEN_EXPIRY_MARGIN_MS = 30_000;

export type RealtimeStatus = 'connected' | 'reconnecting' | 'disconnected';

export type HubConnectionFactory = (accessTokenFactory: () => Promise<string>) => HubConnection;

/** Fabrique de la connexion SignalR, remplaçable dans les tests */
export const HUB_CONNECTION_FACTORY = new InjectionToken<HubConnectionFactory>('HUB_CONNECTION_FACTORY', {
    providedIn: 'root',
    factory: () => (accessTokenFactory) => new HubConnectionBuilder()
        .withUrl(HUB_URL, { accessTokenFactory })
        .configureLogging(LogLevel.Warning)
        .build(),
});

/**
 * Canal de notification de l'API. Il ne transporte aucune donnée : un `DataChanged` demande seulement
 * aux services abonnés de refaire leur GET. La connexion suit l'authentification.
 *
 * La reconnexion n'utilise pas `withAutomaticReconnect` : celle-ci ne relance pas un premier `start()` échoué,
 * et rejouerait indéfiniment un JWT refusé. Une seule boucle gère donc les deux cas.
 */
@Service()
export class RealtimeService {
    private _auth = inject(AuthService);
    private _router = inject(Router);
    private _connection = inject(HUB_CONNECTION_FACTORY)(() => this.accessToken());

    private _handlers = new Map<DataScope, Set<() => void>>();

    private _status = signal<RealtimeStatus>('disconnected');
    status = this._status.asReadonly();

    private _retryTimer: ReturnType<typeof setTimeout> | undefined;
    private _attempt = 0;
    /** Des notifications ont pu être perdues : tout recharger à la prochaine connexion */
    private _missedChanges = false;
    /** Le serveur a refusé le JWT : rafraîchir même s'il semble encore valide (horloge du poste décalée) */
    private _forceRefresh = false;

    constructor() {
        this._connection.on('DataChanged', (scope: DataScope) => this.dispatch(scope));

        this._connection.onclose(() => {
            // fermeture volontaire (déconnexion de l'utilisateur)
            if (!this._auth.isConnected()) {
                this._status.set('disconnected');
                return;
            }
            // perte de réseau, redémarrage de l'API ou JWT expiré côté serveur
            this._missedChanges = true;
            this.scheduleRetry();
        });

        effect(() => {
            const isConnected = this._auth.isConnected();
            untracked(() => isConnected ? this.connect() : this.disconnect());
        });
    }

    /**
     * Appelle `reload` à chaque changement de `scope` annoncé par l'API, et après chaque reconnexion.
     * Retourne la fonction de désabonnement.
     */
    onDataChanged(scope: DataScope, reload: () => void): () => void {
        let handlers = this._handlers.get(scope);
        if (handlers === undefined) {
            handlers = new Set();
            this._handlers.set(scope, handlers);
        }
        handlers.add(reload);
        return () => handlers.delete(reload);
    }

    private dispatch(scope: DataScope) {
        this._handlers.get(scope)?.forEach((reload) => reload());
    }

    private reloadAll() {
        this._handlers.forEach((handlers) => handlers.forEach((reload) => reload()));
    }

    private async connect() {
        clearTimeout(this._retryTimer);
        if (!this._auth.isConnected() || this._connection.state !== HubConnectionState.Disconnected)
            return;

        try {
            await this._connection.start();
        } catch (error) {
            if (error instanceof HttpError && error.statusCode === 401)
                this._forceRefresh = true;
            // le premier chargement a sans doute échoué lui aussi
            this._missedChanges = true;
            this.scheduleRetry();
            return;
        }

        this._attempt = 0;
        this._status.set('connected');
        if (this._missedChanges) {
            this._missedChanges = false;
            this.reloadAll();
        }
    }

    private async disconnect() {
        clearTimeout(this._retryTimer);
        this._attempt = 0;
        this._missedChanges = false;
        this._forceRefresh = false;
        await this._connection.stop();
        this._status.set('disconnected');
    }

    private scheduleRetry() {
        if (!this._auth.isConnected()) {
            this._status.set('disconnected');
            return;
        }
        const delay = RETRY_DELAYS_MS[Math.min(this._attempt, RETRY_DELAYS_MS.length - 1)];
        this._attempt++;
        this._status.set('reconnecting');
        this._retryTimer = setTimeout(() => this.connect(), delay);
    }

    /**
     * Appelé par SignalR à chaque (re)connexion. Ses requêtes ne passent pas par l'intercepteur HTTP :
     * le refresh du JWT doit donc être fait ici.
     */
    private async accessToken(): Promise<string> {
        const token = this._auth.token();
        if (token !== null && !this._forceRefresh && !expiresSoon(token))
            return token;

        this._forceRefresh = false;
        try {
            return await firstValueFrom(this._auth.refreshToken());
        } catch (error) {
            // session perdue : `refreshToken` a déjà effacé le jeton, ce qui coupe la connexion
            this._router.navigate(['/login']);
            throw error;
        }
    }
}

/** Lit `exp` dans le JWT. Simple anticipation : l'API reste seule juge de sa validité */
function expiresSoon(token: string): boolean {
    try {
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const { exp } = JSON.parse(atob(payload)) as { exp?: number };
        return exp === undefined || exp * 1000 - Date.now() < TOKEN_EXPIRY_MARGIN_MS;
    } catch {
        return true;
    }
}
