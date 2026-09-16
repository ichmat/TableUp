using Microsoft.AspNetCore.Mvc;
using TUROAPI.Controllers.Filters;

namespace TUROAPI.Controllers.Base
{
    [ApiController]
    [ApiExceptionFilter]
    public abstract class TuroController : ControllerBase
    {
    }
}
