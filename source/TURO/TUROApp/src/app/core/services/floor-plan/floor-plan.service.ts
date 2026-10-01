import { computed, inject, Service } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { map } from 'rxjs';
import { DataScope, FloorPlanDraft, FloorPlanDraftContent, FloorPlanZone, Zone, ZoneRequest } from '../../../models';
import { AuthService } from '../auth/auth.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ApiResult, toApiResult } from '../api-result';

const FLOOR_PLAN_URL = '/api/restaurant/floor-plan';

/** Salles et plan de salle : le plan publié, les salles, le brouillon de l'éditeur */
@Service()
export class FloorPlanService {
    private _authService = inject(AuthService);
    private _http = inject(HttpClient);

    private _plan = httpResource<FloorPlanZone[]>(() =>
        this._authService.isConnected() ? FLOOR_PLAN_URL : undefined
    );

    // `value()` lève une exception quand la ressource est en erreur : elle figerait tout écran qui la lit
    zones = computed(() => this._plan.hasValue() ? this._plan.value() : []);
    isLoaded = computed(() => this._plan.hasValue());
    loadFailed = computed(() => this._plan.status() === 'error');

    constructor() {
        // l'API annonce une modification : on refait le GET
        inject(RealtimeService).onDataChanged(DataScope.FloorPlan, () => this._plan.reload());
    }

    reload() {
        this._plan.reload();
    }

    createZone(request: ZoneRequest): Promise<ApiResult<Zone>> {
        return this.thenReload(toApiResult(this._http.post<Zone>(`${FLOOR_PLAN_URL}/zones`, request)));
    }

    updateZone(id: string, request: ZoneRequest): Promise<ApiResult<Zone>> {
        return this.thenReload(toApiResult(this._http.put<Zone>(`${FLOOR_PLAN_URL}/zones/${id}`, request)));
    }

    reorderZones(zoneIds: string[]): Promise<ApiResult<FloorPlanZone[]>> {
        return this.thenReload(toApiResult(this._http.put<FloorPlanZone[]>(`${FLOOR_PLAN_URL}/zones/order`, { zoneIds })));
    }

    deleteZone(id: string): Promise<ApiResult<Zone>> {
        return this.thenReload(toApiResult(this._http.delete<Zone>(`${FLOOR_PLAN_URL}/zones/${id}`)));
    }

    /** `null` s'il n'y a pas de brouillon (204) */
    getDraft(): Promise<ApiResult<FloorPlanDraft | null>> {
        return toApiResult(this._http.get<FloorPlanDraft | null>(`${FLOOR_PLAN_URL}/draft`).pipe(
            // un brouillon enregistré avant le décor n'a pas de `decors`
            map((draft) => draft === null ? null : { ...draft, decors: draft.decors ?? [] }),
        ));
    }

    saveDraft(content: FloorPlanDraftContent): Promise<ApiResult<FloorPlanDraft>> {
        return toApiResult(this._http.put<FloorPlanDraft>(`${FLOOR_PLAN_URL}/draft`, content));
    }

    discardDraft(): Promise<ApiResult<null>> {
        return toApiResult(this._http.delete<null>(`${FLOOR_PLAN_URL}/draft`));
    }

    /** Publie le brouillon enregistré ; le plan publié est remplacé par la réponse sans attendre SignalR */
    async publish(): Promise<ApiResult<FloorPlanZone[]>> {
        const result = await toApiResult(this._http.post<FloorPlanZone[]>(`${FLOOR_PLAN_URL}/publish`, null));
        if (result.value !== null) {
            this._plan.set(result.value);
        }
        return result;
    }

    /** Les écrans qui lisent `zones` ne dépendent pas de l'arrivée de la notification SignalR */
    private async thenReload<T>(request: Promise<ApiResult<T>>): Promise<ApiResult<T>> {
        const result = await request;
        if (result.error === null) {
            this._plan.reload();
        }
        return result;
    }
}
