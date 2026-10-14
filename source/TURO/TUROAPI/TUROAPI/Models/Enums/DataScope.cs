namespace TUROAPI.Models.Enums
{
    /// <summary>
    /// Donnée modifiée, annoncée par SignalR. Chaque valeur correspond à un GET que le front doit refaire.
    /// </summary>
    public enum DataScope
    {
        /// <summary>GET /api/restaurant</summary>
        Restaurant,
        /// <summary>GET /api/restaurant/closures</summary>
        Closures,
        /// <summary>GET /api/restaurant/floor-plan</summary>
        FloorPlan,
        /// <summary>GET /api/clients (liste et fiche)</summary>
        Clients,
        /// <summary>GET /api/reservations (liste et fiche)</summary>
        Reservations,
        /// <summary>GET /api/service (l'écran Service)</summary>
        Service
    }
}
