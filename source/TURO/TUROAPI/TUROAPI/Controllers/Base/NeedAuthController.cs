
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TUROAPI.Context;
using TUROAPI.Models;
using TUROAPI.Models.Enums;
using TUROAPI.Services;

namespace TUROAPI.Controllers.Base
{
    [Authorize]
    public class NeedAuthController : TuroController
    {
        private UserStaff? _currentUser = null;

        public NeedAuthController(TuroDBContext context) : base(context)
        {
        }

        protected Guid CurrentUserId =>
            Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        protected Guid CurrentRestaurantId =>
            Guid.Parse(User.FindFirstValue("restaurant_id")!);

        protected UserRole CurrentRole =>
            Enum.Parse<UserRole>(User.FindFirstValue(ClaimTypes.Role)!);

        protected async Task<UserStaff> GetCurrentUser()
        {
            _currentUser ??= 
                await context.UserStaffs.FirstOrDefaultAsync(x => x.Id == CurrentUserId);
            return _currentUser!;
        }

        /// <summary>
        /// Demande aux écrans du restaurant courant de recharger <paramref name="scope"/>. À appeler après le SaveChanges.
        /// </summary>
        protected Task NotifyChangedAsync(DataScope scope) =>
            HttpContext.RequestServices.GetRequiredService<ChangeNotifier>().NotifyAsync(CurrentRestaurantId, scope);
    }
}
