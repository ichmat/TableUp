using Microsoft.AspNetCore.Mvc;
using TUROAPI.Context;
using TUROAPI.Controllers.Filters;

namespace TUROAPI.Controllers.Base
{
    [ApiController]
    [ApiExceptionFilter]
    public abstract class TuroController : ControllerBase
    {
        protected readonly TuroDBContext context;

        public TuroController(TuroDBContext context)
        {
            this.context = context;
        }
    }
}
