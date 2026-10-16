import { computed, linkedSignal, Resource, Signal } from '@angular/core';

/**
 * La valeur d'une ressource, `null` tant qu'elle n'en a pas. `value()` lève une exception quand la ressource
 * est en erreur : lu directement, il figerait tout écran qui le lit
 */
export function valueOrNull<T>(resource: Resource<T | undefined>): T | null {
    return resource.hasValue() ? (resource.value() as T) : null;
}

/** La dernière valeur reçue : elle reste affichée pendant un rechargement, sans clignotement */
export function lastValue<T>(resource: Resource<T | undefined>): Signal<T | null> {
    return linkedSignal<T | undefined, T | null>({
        source: () => valueOrNull(resource) ?? undefined,
        computation: (value, previous) => value ?? previous?.value ?? null,
    }).asReadonly();
}

/** La fiche de la ressource, seulement si c'est celle de l'`id` sélectionné : celle d'un autre ne s'affiche jamais */
export function detailOf<T extends { id: string }>(resource: Resource<T | undefined>, selectedId: () => string | null): Signal<T | null> {
    return computed(() => {
        const value = valueOrNull(resource);
        return value !== null && value.id === selectedId() ? value : null;
    });
}
