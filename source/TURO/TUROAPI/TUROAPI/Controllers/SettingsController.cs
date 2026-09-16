using Microsoft.AspNetCore.Mvc;
using TUROAPI.Context;
using TUROAPI.Controllers.Base;

namespace TUROAPI.Controllers
{
    [Route("api/restaurant/settings")]
    public class SettingsController : NeedAuthController
    {
        public SettingsController(TuroDBContext context) : base(context)
        {
        }
    }
}
