import { computed, inject, linkedSignal, Service, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { DataScope, ServiceQuery, ServiceSnapshot, TableCleaned } from '../../../models';
import { AuthService } from '../auth/auth.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ApiResult, toApiResult } from '../api-result';

const SERVICE_URL = '/api/service';

/** Ce qui change l'instantané : un geste, un nettoyage, le plan publié, un réglage, une fermeture */
export const SERVICE_SCOPES: DataScope[] = [DataScope.Service, DataScope.Reservations, DataScope.FloorPlan, DataScope.Restaurant, DataScope.Closures];

function params(query: ServiceQuery): Record<string, string> {
  return {
    ...(query.day !== null ? { day: query.day } : {}),
    ...(query.opening !== null ? { opening: query.opening } : {}),
    ...(query.focus !== null ? { focus: query.focus } : {}),
  };
}

const sameQuery = (a: ServiceQuery | null, b: ServiceQuery | null) =>
  a === b || (a !== null && b !== null && a.day === b.day && a.opening === b.opening && a.focus === b.focus);

/** L'écran Service (§5) : l'instantané du service affiché, et le geste « Nettoyée » */
@Service()
export class ServiceViewService {
  private _auth = inject(AuthService);
  private _http = inject(HttpClient);

  // `null` : l'écran n'est pas ouvert, rien n'est demandé
  private _query = signal<ServiceQuery | null>(null, { equal: sameQuery });
  query = this._query.asReadonly();

  private _resource = httpResource<ServiceSnapshot>(() => {
    const query = this._query();
    return this._auth.isConnected() && query !== null ? { url: SERVICE_URL, params: params(query) } : undefined;
  });
  // L'instantané précédent reste affiché pendant que le suivant se charge : pas de clignotement
  private _snapshot = linkedSignal<ServiceSnapshot | undefined, ServiceSnapshot | null>({
    source: () => (this._resource.hasValue() ? this._resource.value() : undefined),
    computation: (value, previous) => value ?? previous?.value ?? null,
  });
  snapshot = this._snapshot.asReadonly();
  failed = computed(() => this._resource.status() === 'error');
  /** Le service demandé n'existe plus (une heure d'ouverture déplacée, un jour fermé entre-temps) */
  notFound = computed(() => { const error = this._resource.error(); return error instanceof HttpErrorResponse && error.status === 404; });
  /** Vrai pendant un chargement : l'instantané affiché peut encore être celui d'avant */
  isLoading = this._resource.isLoading;

  constructor() {
    const realtime = inject(RealtimeService);
    for (const scope of SERVICE_SCOPES) {
      realtime.onDataChanged(scope, () => this.reload());
    }
  }

  setQuery(query: ServiceQuery | null) {
    this._query.set(query);
  }

  reload() {
    if (this._query() !== null) {
      this._resource.reload();
    }
  }

  /** Le service par défaut, hors de l'écran : l'atterrissage (§4.6) */
  current(): Promise<ApiResult<ServiceSnapshot>> {
    return toApiResult(this._http.get<ServiceSnapshot>(SERVICE_URL));
  }

  /** Les plages d'un autre jour pour le sélecteur, sans changer l'écran */
  peek(day: string): Promise<ApiResult<ServiceSnapshot>> {
    return toApiResult(this._http.get<ServiceSnapshot>(SERVICE_URL, { params: { day } }));
  }

  calendar(month: string): Promise<ApiResult<string[]>> {
    return toApiResult(this._http.get<string[]>(`${SERVICE_URL}/calendar`, { params: { month } }));
  }

  clean(tableId: string): Promise<ApiResult<TableCleaned>> {
    return this.thenReload(toApiResult(this._http.post<TableCleaned>(`${SERVICE_URL}/tables/${tableId}/clean`, null)));
  }

  undoClean(tableId: string, since: string): Promise<ApiResult<null>> {
    return this.thenReload(toApiResult(this._http.post<null>(`${SERVICE_URL}/tables/${tableId}/clean/undo`, { since })));
  }

  /** L'écran montre le résultat sans attendre la notification SignalR */
  private async thenReload<T>(request: Promise<ApiResult<T>>): Promise<ApiResult<T>> {
    const result = await request;
    if (result.error === null) {
      this.reload();
    }
    return result;
  }
}
