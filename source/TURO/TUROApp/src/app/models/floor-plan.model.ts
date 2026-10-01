import { Combination } from './combination.model';
import { Decor, DecorType } from './decor.model';
import { Table, TableShape } from './table.model';
import { Zone } from './zone.model';

/** Une salle du plan publié, avec ce qu'elle porte (GET /api/restaurant/floor-plan) */
export interface FloorPlanZone extends Zone {
    tables: Table[],
    decors: Decor[],
    combinations: Combination[],
}

/**
 * Ce que le canevas sait dessiner d'une table, publiée ou en brouillon. En mètres :
 * `x` / `y` = coin haut-gauche du rectangle non tourné, la rotation se fait autour du centre
 */
export interface PlanTable {
    id: string,
    zoneId: string,
    name: string,
    capacity: number,
    shape: TableShape,
    x: number,
    y: number,
    width: number,
    height: number,
    /** Degrés, multiple de 15 dans [0, 360) */
    rotation: number,
}

/** Une table du brouillon : l'`id` d'une table nouvelle est généré par le front */
export type DraftTable = PlanTable;

/** Ce que le canevas sait dessiner d'un décor, même géométrie qu'une table */
export interface PlanDecor {
    id: string,
    zoneId: string,
    type: DecorType,
    label: string | null,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number,
}

export type DraftDecor = PlanDecor;

/** L'état complet du plan à publier, toutes salles confondues */
export interface FloorPlanDraftContent {
    tables: DraftTable[],
    decors: DraftDecor[],
}

export interface FloorPlanDraft extends FloorPlanDraftContent {
    /** Horodatage ISO 8601 du dernier enregistrement */
    updatedAt: string,
}

export interface ZoneRequest {
    name: string,
    /** En mètres */
    width: number,
    height: number,
}
