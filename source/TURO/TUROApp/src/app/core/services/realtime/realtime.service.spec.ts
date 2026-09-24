import { computed, signal } from '@angular/core';
import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpError, HubConnection, HubConnectionState } from '@microsoft/signalr';
import { of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { DataScope } from '../../../models';
import { HUB_CONNECTION_FACTORY, RealtimeService } from './realtime.service';

/** Connexion SignalR simulée : le test joue le rôle du serveur */
class FakeHubConnection {
    state = HubConnectionState.Disconnected;
    startFailures: Error[] = [];

    private _handlers = new Map<string, (...args: unknown[]) => void>();
    private _onclose?: (error?: Error) => void;

    start = jasmine.createSpy('start').and.callFake(async () => {
        const failure = this.startFailures.shift();
        if (failure) throw failure;
        this.state = HubConnectionState.Connected;
    });

    stop = jasmine.createSpy('stop').and.callFake(async () => {
        const wasConnected = this.state !== HubConnectionState.Disconnected;
        this.state = HubConnectionState.Disconnected;
        if (wasConnected) this._onclose?.();
    });

    on(method: string, handler: (...args: unknown[]) => void) { this._handlers.set(method, handler); }
    onclose(callback: (error?: Error) => void) { this._onclose = callback; }

    push(method: string, ...args: unknown[]) { this._handlers.get(method)?.(...args); }
    lose() {
        this.state = HubConnectionState.Disconnected;
        this._onclose?.(new Error('connection lost'));
    }
}

function jwtExpiringIn(ms: number): string {
    const exp = Math.floor((Date.now() + ms) / 1000);
    return `header.${btoa(JSON.stringify({ exp }))}.signature`;
}

describe('RealtimeService', () => {
    let connection: FakeHubConnection;
    let accessTokenFactory: () => Promise<string>;
    let token: ReturnType<typeof signal<string | null>>;
    let refreshToken: jasmine.Spy;

    function createService(): RealtimeService {
        const service = TestBed.inject(RealtimeService);
        TestBed.tick(); // exécute l'effet qui suit l'authentification
        flushMicrotasks();
        return service;
    }

    beforeEach(() => {
        connection = new FakeHubConnection();
        token = signal<string | null>(jwtExpiringIn(15 * 60_000));
        refreshToken = jasmine.createSpy('refreshToken').and.returnValue(of('fresh-jwt'));

        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                {
                    provide: AuthService,
                    useValue: { token, isConnected: computed(() => token() !== null), refreshToken },
                },
                {
                    provide: HUB_CONNECTION_FACTORY,
                    useValue: (factory: () => Promise<string>) => {
                        accessTokenFactory = factory;
                        return connection as unknown as HubConnection;
                    },
                },
            ],
        });
    });

    it('connects once the user is authenticated', fakeAsync(() => {
        const service = createService();

        expect(connection.start).toHaveBeenCalledTimes(1);
        expect(service.status()).toBe('connected');
    }));

    it('does not connect while the user is anonymous', fakeAsync(() => {
        token.set(null);
        const service = createService();

        expect(connection.start).not.toHaveBeenCalled();
        expect(service.status()).toBe('disconnected');
    }));

    it('calls the handlers of the changed scope only', fakeAsync(() => {
        const service = createService();
        const reload = jasmine.createSpy('reload');
        service.onDataChanged(DataScope.Restaurant, reload);

        connection.push('DataChanged', DataScope.Restaurant);
        connection.push('DataChanged', 'UnknownScope');

        expect(reload).toHaveBeenCalledTimes(1);
    }));

    it('stops calling a handler once unsubscribed', fakeAsync(() => {
        const service = createService();
        const reload = jasmine.createSpy('reload');
        const unsubscribe = service.onDataChanged(DataScope.Restaurant, reload);

        unsubscribe();
        connection.push('DataChanged', DataScope.Restaurant);

        expect(reload).not.toHaveBeenCalled();
    }));

    it('disconnects on logout without trying to reconnect', fakeAsync(() => {
        const service = createService();

        token.set(null);
        TestBed.tick();
        flushMicrotasks();
        tick(60_000);

        expect(connection.stop).toHaveBeenCalled();
        expect(connection.start).toHaveBeenCalledTimes(1);
        expect(service.status()).toBe('disconnected');
    }));

    it('reconnects after a loss and reloads every scope', fakeAsync(() => {
        const service = createService();
        const reload = jasmine.createSpy('reload');
        service.onDataChanged(DataScope.Restaurant, reload);

        connection.lose();
        expect(service.status()).toBe('reconnecting');

        tick(0);
        flushMicrotasks();

        expect(connection.start).toHaveBeenCalledTimes(2);
        expect(service.status()).toBe('connected');
        expect(reload).toHaveBeenCalledTimes(1);
    }));

    it('keeps retrying when the first connection fails', fakeAsync(() => {
        connection.startFailures = [new Error('API down'), new Error('API down')];
        const service = createService();
        const reload = jasmine.createSpy('reload');
        service.onDataChanged(DataScope.Restaurant, reload);

        expect(service.status()).toBe('reconnecting');

        tick(0);     // 2e tentative, échoue
        flushMicrotasks();
        tick(2_000); // 3e tentative, réussit
        flushMicrotasks();

        expect(connection.start).toHaveBeenCalledTimes(3);
        expect(service.status()).toBe('connected');
        expect(reload).toHaveBeenCalledTimes(1);
    }));

    it('gives the current JWT while it is still valid', fakeAsync(() => {
        createService();
        let given = '';

        accessTokenFactory().then((jwt) => given = jwt);
        flushMicrotasks();

        expect(given).toBe(token()!);
        expect(refreshToken).not.toHaveBeenCalled();
    }));

    it('refreshes the JWT when it is about to expire', fakeAsync(() => {
        token.set(jwtExpiringIn(10_000));
        createService();
        let given = '';

        accessTokenFactory().then((jwt) => given = jwt);
        flushMicrotasks();

        expect(given).toBe('fresh-jwt');
    }));

    it('forces a refresh after the server rejected the JWT', fakeAsync(() => {
        connection.startFailures = [new HttpError('Unauthorized', 401)];
        createService();
        let given = '';

        accessTokenFactory().then((jwt) => given = jwt);
        flushMicrotasks();

        expect(given).toBe('fresh-jwt');
        tick(0);
    }));
});
