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
        FloorPlan
    }
}
