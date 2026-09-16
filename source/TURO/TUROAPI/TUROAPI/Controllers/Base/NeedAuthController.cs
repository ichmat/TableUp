
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TUROAPI.Context;
using TUROAPI.Models;
using TUROAPI.Models.Enums;

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
    }
}
