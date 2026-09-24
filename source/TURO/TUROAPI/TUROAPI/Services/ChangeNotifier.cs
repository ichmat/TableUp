using Microsoft.AspNetCore.SignalR;
using TUROAPI.Hubs;
using TUROAPI.Models.Enums;
using TUROAPI.Tools.Logging;

namespace TUROAPI.Services
{
    /// <summary>
    /// Annonce aux écrans d'un restaurant qu'une donnée a changé. À appeler après le SaveChanges, jamais avant.
    /// </summary>
    public class ChangeNotifier
    {
        private readonly IHubContext<TuroHub, ITuroClient> _hub;

        public ChangeNotifier(IHubContext<TuroHub, ITuroClient> hub)
        {
            _hub = hub;
        }

        public async Task NotifyAsync(Guid restaurantId, DataScope scope)
        {
            try
            {
                // L'auteur du changement est notifié aussi : il refait un GET, c'est sans conséquence
                await _hub.Clients.Group(TuroHub.RestaurantGroup(restaurantId)).DataChanged(scope);
            }
            catch (Exception ex)
            {
                // L'écriture est déjà en base : un échec de notification ne doit pas la transformer en 500
                AppLogger.Log(LogType.Error, $"SignalR notification {scope} failed for restaurant {restaurantId}", ex);
            }
        }
    }
}
