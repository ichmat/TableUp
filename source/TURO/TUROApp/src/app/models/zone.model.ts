/** Une salle, un étage, une terrasse */
export interface Zone {
    id: string,
    restaurantId: string,
    name: string,
    /** Ordre d'affichage des onglets de zone */
    order: number,
    /** Largeur **en mètres**. Le rendu convertit, la donnée reste métrique */
    width: number,
    /** Hauteur **en mètres**. Le rendu convertit, la donnée reste métrique */
    height: number,
}
