using TUROAPI.Models.Enums;

namespace TUROAPI.Hubs
{
    /// <summary>
    /// Méthodes que le serveur invoque chez le client. Le nom de chaque méthode est l'événement écouté côté front.
    /// </summary>
    public interface ITuroClient
    {
        // Aucune donnée ne transite : le client refait le GET correspondant au scope
        Task DataChanged(DataScope scope);
    }
}
