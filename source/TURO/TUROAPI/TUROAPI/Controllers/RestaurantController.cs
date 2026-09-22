using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TUROAPI.Context;
using TUROAPI.Controllers.Base;
using TUROAPI.Models;
using TUROAPI.Models.Enums;
using TUROAPI.Models.Wrapper;

namespace TUROAPI.Controllers
{
    [Route("api/restaurant")]
    public class RestaurantController : NeedAuthController
    {
        public RestaurantController(TuroDBContext context) : base(context)
        {
        }

        [HttpGet()]
        public async Task<IActionResult> GetFullInfoRestaurant()
        {
            Restaurant restaurant =
                await context.Restaurants
                .Include(r => r.Zones)
                .Include(r => r.Services)
                .Include(r => r.CancellationConditions)
                .Include(r => r.Users)
                .FirstOrDefaultAsync(x => x.Id == CurrentRestaurantId)
                ?? throw new ApiErrorException(ApiError.CriticalDataInternalError, $"Restaurant of user {CurrentUserId} not found");

            return Ok(restaurant.ToResponse());
        }
    }
}
