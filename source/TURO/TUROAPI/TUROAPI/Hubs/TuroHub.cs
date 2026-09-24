using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using TUROAPI.Tools.Logging;

namespace TUROAPI.Hubs
{
    /// <summary>
    /// Canal de notification serveur → client. Le client n'appelle rien : les écritures passent par les contrôleurs.
    /// </summary>
    [Authorize]
    public class TuroHub : Hub<ITuroClient>
    {
        public const string Path = "/api/hubs/turo";

        public static string RestaurantGroup(Guid restaurantId) => $"restaurant:{restaurantId}";

        public override async Task OnConnectedAsync()
        {
            // Chaque écran reçoit les notifications de son restaurant, et uniquement de lui
            var restaurantId = Guid.Parse(Context.User!.FindFirst("restaurant_id")!.Value);
            await Groups.AddToGroupAsync(Context.ConnectionId, RestaurantGroup(restaurantId));
            await base.OnConnectedAsync();
        }

        public override Task OnDisconnectedAsync(Exception? exception)
        {
            // Une fermeture propre (onglet fermé, token expiré) n'a rien d'anormal
            if (exception is not null)
                AppLogger.Log(LogType.Warning, $"SignalR connection {Context.ConnectionId} lost", exception);

            return base.OnDisconnectedAsync(exception);
        }
    }
}
