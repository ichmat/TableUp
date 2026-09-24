using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TUROAPI.Context;
using TUROAPI.Controllers.Base;
using TUROAPI.Models;
using TUROAPI.Models.Enums;
using TUROAPI.Models.Requests;
using TUROAPI.Models.Responses;
using TUROAPI.Services;
using TUROAPI.Tools;

namespace TUROAPI.Controllers
{
    [Route("api/auth")]
    public class AuthController : TuroController
    {
        private readonly PasswordHash _passwordHash;
        private readonly TokenService _tokenService;

        public AuthController(PasswordHash passwordHash, TokenService tokenService, TuroDBContext context) : base(context)
        {
            _passwordHash = passwordHash;
            _tokenService = tokenService;
        }

        [Authorize]
        [HttpGet("check")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status401Unauthorized)]
        public IActionResult CheckAuth()
        {
            return Ok();
        }

        [HttpPost("login")]
        [ProducesResponseType<TokenResponse>(StatusCodes.Status200OK)]
        [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> Login(LoginRequest model)
        {
            var user = await context.UserStaffs.FirstOrDefaultAsync(u => u.Login == model.Login);

            if (user == null || _passwordHash.VerifyHashedPassword(user, user.PasswordHash, model.Password) == PasswordVerificationResult.Failed)
            {
                throw new ApiErrorException(ApiError.InvalidLoginOrPassword);
            }

            string JWT = _tokenService.GenerateJWT(user);
            RefreshToken refreshToken = await GenerateAndSaveRefreshToken(user.Id);

            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Strict,
                Path = "/",
                Expires = DateTime.UtcNow.Add(TokenService.RefreshTokenValidity).ToLocalTime(),
            };

            Response.Cookies.Append("refreshToken", refreshToken.Token, cookieOptions);

            return Ok(new TokenResponse() { JWT = JWT});
        }

        [HttpDelete("logout")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        public async Task<IActionResult> Logout()
        {
            if (Request.Cookies.TryGetValue("refreshToken", out string? refreshToken))
            {
                var token = await context.RefreshTokens.FirstOrDefaultAsync(t => t.Token == refreshToken);
                if (token != null)
                {
                    token.DestroyAt = DateTime.UtcNow;
                    await context.SaveChangesAsync();
                }
            }
            Response.Cookies.Delete("refreshToken");
            return Ok();
        }

        [HttpPost("refresh")]
        [ProducesResponseType<TokenResponse>(StatusCodes.Status200OK)]
        [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> RefreshToken()
        {
            if (!Request.Cookies.TryGetValue("refreshToken", out string? refreshToken))
            {
                throw new ApiErrorException(ApiError.NoAuthenticationTokenGiven);
            }

            var token = await context.RefreshTokens.Include(t => t.User).FirstOrDefaultAsync(t => t.Token == refreshToken);
            if (token == null)
            {
                throw new ApiErrorException(ApiError.UnreadableToken);
            }

            if (token.DestroyAt != null || token.UsedAt != null || token.CreatedAt.Add(TokenService.RefreshTokenValidity) < DateTime.UtcNow)
            {
                throw new ApiErrorException(ApiError.TokenExpired);
            }

            token.UsedAt = DateTime.UtcNow;

            RefreshToken newRefreshToken = await GenerateAndSaveRefreshToken(token.UserId);

            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Strict,
                Path = "/",
                Expires = DateTime.UtcNow.Add(TokenService.RefreshTokenValidity).ToLocalTime(),
            };

            Response.Cookies.Delete("refreshToken");
            Response.Cookies.Append("refreshToken", newRefreshToken.Token, cookieOptions);

            string JWT = _tokenService.GenerateJWT(token.User);
            return Ok(new TokenResponse() { JWT = JWT });
        }

        private async Task<RefreshToken> GenerateAndSaveRefreshToken(Guid userId)
        {
            string refreshToken = _tokenService.GenerateRefreshToken();
            var token = new RefreshToken
            {
                Token = refreshToken,
                CreatedAt = DateTime.UtcNow,
                UserId = userId,
            };
            context.RefreshTokens.Add(token);
            await context.SaveChangesAsync();
            return token;
        }
    }
}
