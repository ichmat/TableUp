using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.Mvc;
using TUROAPI.Context;
using TUROAPI.Controllers.Base;
using TUROAPI.Tools;

namespace TUROAPI.Controllers
{
    [Route("api/auth")]
    public class AuthController : TuroController
    {
        private readonly PasswordHash _passwordHash;

        public AuthController(PasswordHash passwordHash, TuroDBContext context) : base(context)
        {
            _passwordHash = passwordHash;
        }

        [HttpPost("login")]
        public Task<IActionResult> Login(LoginRequest model)
        {

            throw new NotImplementedException();
        }
    }
}
