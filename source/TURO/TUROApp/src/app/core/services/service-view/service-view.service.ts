import { computed, DestroyRef, inject, linkedSignal, Service, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { CombinationReminder, CombinationReminderKind, DataScope, LayoutRequest, Placement, ReminderAnswer, ReservationActionResult, ServiceQuery, ServiceSnapshot, ServiceUndoResult, TableCleaned } from '../../../models';
import { AuthService } from '../auth/auth.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ApiResult, toApiResult } from '../api-result';

const SERVICE_URL = '/api/service';

/** Ce qui change l'instantané : un geste, un nettoyage, le plan publié, un réglage, une fermeture */
export const SERVICE_SCOPES: DataScope[] = [DataScope.Service, DataScope.Reservations, DataScope.FloorPlan, DataScope.Restaurant, DataScope.Closures];

/** Ce qui change les rappels : un geste sur une réservation, un collage, un plan publié */
export const REMINDER_SCOPES: DataScope[] = [DataScope.FloorPlan, DataScope.Reservations];
/** Un rappel échu apparaît dans la demi-minute, sans nouvel appel : l'API donne l'heure, le poste la guette */
export const REMINDER_TICK_MS = 30_000;

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

  // Les rappels parlent de la salle maintenant : lus dès la connexion, quel que soit l'écran (le rail les signale)
  private _reminders = httpResource<CombinationReminder[]>(() => (this._auth.isConnected() ? `${SERVICE_URL}/reminders` : undefined));
  // Comme l'instantané : la liste précédente reste pendant un rechargement, même en échec ; déconnecté, il n'y en a plus
  private _reminderList = linkedSignal<CombinationReminder[] | undefined, CombinationReminder[]>({
    source: () => (this._reminders.hasValue() ? this._reminders.value() : this._auth.isConnected() ? undefined : []),
    computation: (value, previous) => value ?? previous?.value ?? [],
  });
  reminders = this._reminderList.asReadonly();
  // L'horloge est relue à chaque nouvelle liste : un rappel déjà échu à l'arrivée s'affiche sans attendre le pas suivant
  private _clock = linkedSignal<CombinationReminder[], number>({ source: () => this.reminders(), computation: () => Date.now() });
  /** Ceux dont l'heure est venue ; aucun n'expire (COMB-06) */
  dueReminders = computed(() => this.reminders().filter((reminder) => Date.parse(reminder.dueAt) <= this._clock()));

  constructor() {
    const realtime = inject(RealtimeService);
    for (const scope of SERVICE_SCOPES) {
      realtime.onDataChanged(scope, () => this.reload());
    }
    for (const scope of REMINDER_SCOPES) {
      realtime.onDataChanged(scope, () => this._reminders.reload());
    }
    const tick = setInterval(() => this._clock.set(Date.now()), REMINDER_TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
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

  /** Les halos d'une réservation (§3.5) : l'API seule juge */
  placement(reservationId: string): Promise<ApiResult<Placement>> {
    return toApiResult(this._http.get<Placement>(`${SERVICE_URL}/placement/${reservationId}`));
  }

  /** WALK-01 : « Asseoir maintenant » */
  seat(tableId: string, covers: number, acceptBookedLater: boolean): Promise<ApiResult<ReservationActionResult>> {
    return this.thenReload(toApiResult(this._http.post<ReservationActionResult>(`${SERVICE_URL}/tables/${tableId}/seat`, { covers, acceptBookedLater })));
  }

  reloadReminders() {
    this._reminders.reload();
  }

  /** COMB-07 : la réponse à un rappel échu */
  answerReminder(combinationId: string, kind: CombinationReminderKind, answer: ReminderAnswer): Promise<ApiResult<ServiceUndoResult>> {
    return this.thenRefresh(toApiResult(this._http.post<ServiceUndoResult>(`${SERVICE_URL}/combinations/${combinationId}/reminder`, { kind, answer })));
  }

  /** Le mode édition : déplacer, coller, séparer */
  layout(request: LayoutRequest): Promise<ApiResult<ServiceUndoResult>> {
    return this.thenRefresh(toApiResult(this._http.post<ServiceUndoResult>(`${SERVICE_URL}/layout`, request)));
  }

  /** Le bandeau « Annuler » d'un geste du service */
  undo(undoId: string): Promise<ApiResult<null>> {
    return this.thenRefresh(toApiResult(this._http.post<null>(`${SERVICE_URL}/undo/${undoId}`, null)));
  }

  /** Un collage change les rappels autant que le plan : les deux se relisent */
  private async thenRefresh<T>(request: Promise<ApiResult<T>>): Promise<ApiResult<T>> {
    const result = await this.thenReload(request);
    if (result.error === null) {
      this._reminders.reload();
    }
    return result;
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
