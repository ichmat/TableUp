using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TUROAPI.Context;
using TUROAPI.Controllers.Base;
using TUROAPI.Models;
using TUROAPI.Models.Enums;

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
