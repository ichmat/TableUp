using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TUROAPI.Context;
using TUROAPI.Controllers.Base;

namespace TUROAPI.Controllers
{
    [Route("api/restaurant/settings")]
    [Authorize(Roles = "Admin")]
    public class SettingsController : NeedAuthController
    {
        public SettingsController(TuroDBContext context) : base(context)
        {
        }
    }
}
