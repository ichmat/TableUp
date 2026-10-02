using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace TUROAPI.Test
{
    /// <summary>JWT court (15 min) dans le corps, refresh token opaque à usage unique en cookie HttpOnly, révocable</summary>
    [TestClass]
    public sealed class AuthTests
    {
        [TestMethod]
        public async Task Login_with_valid_credentials_returns_a_short_jwt_and_a_protected_refresh_cookie()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient client = TestApi.CreateClient();

            HttpResponseMessage response = await LoginAsync(client, restaurant.Admin.Login, TestRestaurant.Password);

            TokenResponse body = await ApiAssert.OkAsync<TokenResponse>(response);
            JwtSecurityToken jwt = new JwtSecurityTokenHandler().ReadJwtToken(body.JWT);
            Assert.AreEqual(restaurant.Admin.Id.ToString(), jwt.Subject);
            Assert.AreEqual(restaurant.Id.ToString(), jwt.Claims.Single(c => c.Type == "restaurant_id").Value);
            Assert.AreEqual("Admin", jwt.Claims.Single(c => c.Type is "role" or ClaimTypes.Role).Value);
            TimeSpan lifetime = jwt.ValidTo - DateTime.UtcNow;
            Assert.IsTrue(lifetime > TimeSpan.FromMinutes(14) && lifetime <= TimeSpan.FromMinutes(15), $"durée de vie {lifetime}");

            string cookie = SetCookieHeader(response);
            foreach (string attribute in new[] { "httponly", "secure", "samesite=strict", "path=/" })
            {
                Assert.IsTrue(cookie.Contains(attribute, StringComparison.OrdinalIgnoreCase), $"{attribute} absent de : {cookie}");
            }
        }

        [TestMethod]
        public async Task Wrong_password_and_unknown_login_get_the_same_refusal()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient client = TestApi.CreateClient();

            ApiErrorBody wrongPassword = await ApiAssert.ErrorAsync(
                await LoginAsync(client, restaurant.Admin.Login, "pas-le-bon"), HttpStatusCode.Unauthorized, "InvalidLoginOrPassword");
            ApiErrorBody unknownLogin = await ApiAssert.ErrorAsync(
                await LoginAsync(client, $"inconnu-{Guid.NewGuid():N}", "pas-le-bon"), HttpStatusCode.Unauthorized, "InvalidLoginOrPassword");

            // Le message ne dit pas lequel des deux est faux
            Assert.AreEqual(wrongPassword.Message, unknownLogin.Message);
            int tokens = await TestApi.WithDbAsync(db => db.RefreshTokens.CountAsync(t => t.UserId == restaurant.Admin.Id));
            Assert.AreEqual(0, tokens);
        }

        [TestMethod]
        public async Task Jwt_from_login_opens_protected_routes()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient anonymous = TestApi.CreateClient();
            TokenResponse token = await ApiAssert.OkAsync<TokenResponse>(
                await LoginAsync(anonymous, restaurant.Staff.Login, TestRestaurant.Password));

            using HttpClient client = TestApi.CreateClient(token.JWT);

            Assert.AreEqual(HttpStatusCode.OK, (await client.GetAsync("api/auth/check")).StatusCode);
        }

        [TestMethod]
        public async Task Refresh_rotates_the_cookie_and_burns_the_previous_one()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient client = TestApi.CreateClient();
            string first = RefreshCookieOf(await LoginAsync(client, restaurant.Admin.Login, TestRestaurant.Password));

            HttpResponseMessage refreshed = await SendWithCookieAsync(client, HttpMethod.Post, "api/auth/refresh", first);

            TokenResponse body = await ApiAssert.OkAsync<TokenResponse>(refreshed);
            string second = RefreshCookieOf(refreshed);
            Assert.AreNotEqual(first, second);
            Assert.AreEqual(restaurant.Admin.Id.ToString(), new JwtSecurityTokenHandler().ReadJwtToken(body.JWT).Subject);
            // Usage unique : rejouer l'ancien cookie est refusé, le nouveau fonctionne
            await ApiAssert.ErrorAsync(
                await SendWithCookieAsync(client, HttpMethod.Post, "api/auth/refresh", first), HttpStatusCode.Forbidden, "TokenExpired");
            await ApiAssert.OkAsync<TokenResponse>(await SendWithCookieAsync(client, HttpMethod.Post, "api/auth/refresh", second));
        }

        [TestMethod]
        public async Task Refresh_without_cookie_is_refused()
        {
            using HttpClient client = TestApi.CreateClient();

            await ApiAssert.ErrorAsync(
                await SendWithCookieAsync(client, HttpMethod.Post, "api/auth/refresh", null), HttpStatusCode.Unauthorized, "NoAuthenticationTokenGiven");
        }

        [TestMethod]
        public async Task Refresh_with_an_unknown_cookie_is_refused()
        {
            using HttpClient client = TestApi.CreateClient();

            await ApiAssert.ErrorAsync(
                await SendWithCookieAsync(client, HttpMethod.Post, "api/auth/refresh", Uri.EscapeDataString($"inconnu-{Guid.NewGuid():N}")),
                HttpStatusCode.Unauthorized, "UnreadableToken");
        }

        [TestMethod]
        public async Task Refresh_token_lives_seven_days()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            string expired = await AddRefreshTokenAsync(restaurant.Admin, DateTime.UtcNow.AddDays(-8));
            string stillValid = await AddRefreshTokenAsync(restaurant.Admin, DateTime.UtcNow.AddDays(-6));
            using HttpClient client = TestApi.CreateClient();

            await ApiAssert.ErrorAsync(
                await SendWithCookieAsync(client, HttpMethod.Post, "api/auth/refresh", Uri.EscapeDataString(expired)),
                HttpStatusCode.Forbidden, "TokenExpired");
            await ApiAssert.OkAsync<TokenResponse>(
                await SendWithCookieAsync(client, HttpMethod.Post, "api/auth/refresh", Uri.EscapeDataString(stillValid)));
        }

        [TestMethod]
        public async Task Logout_revokes_the_refresh_token()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient client = TestApi.CreateClient();
            string cookie = RefreshCookieOf(await LoginAsync(client, restaurant.Admin.Login, TestRestaurant.Password));

            HttpResponseMessage logout = await SendWithCookieAsync(client, HttpMethod.Delete, "api/auth/logout", cookie);

            Assert.AreEqual(HttpStatusCode.OK, logout.StatusCode);
            DateTime? destroyedAt = await TestApi.WithDbAsync(db => db.RefreshTokens
                .Where(t => t.UserId == restaurant.Admin.Id)
                .Select(t => t.DestroyAt)
                .SingleAsync());
            Assert.IsNotNull(destroyedAt);
            await ApiAssert.ErrorAsync(
                await SendWithCookieAsync(client, HttpMethod.Post, "api/auth/refresh", cookie), HttpStatusCode.Forbidden, "TokenExpired");
        }

        [TestMethod]
        public async Task Protected_route_without_token_is_refused()
        {
            using HttpClient client = TestApi.CreateClient();

            await ApiAssert.ErrorAsync(await client.GetAsync("api/restaurant"), HttpStatusCode.Unauthorized, "NoAuthenticationTokenGiven");
        }

        [TestMethod]
        public async Task Malformed_token_is_refused()
        {
            using HttpClient client = TestApi.CreateClient("abc.def");

            await ApiAssert.ErrorAsync(await client.GetAsync("api/restaurant"), HttpStatusCode.Unauthorized, "UnreadableToken");
        }

        [TestMethod]
        public async Task Token_signed_with_another_key_is_refused()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            string forged = ForgeJwt(restaurant.Admin, "une-autre-cle-0123456789-0123456789-0123456789",
                DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddMinutes(10));
            using HttpClient client = TestApi.CreateClient(forged);

            await ApiAssert.ErrorAsync(await client.GetAsync("api/restaurant"), HttpStatusCode.Unauthorized, "UnreadableToken");
        }

        [TestMethod]
        public async Task Expired_jwt_is_refused_as_expired()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            // Contre-épreuve : le même JWT forgé, encore valide, passe ; le refus vient donc bien de l'expiration
            string valid = ForgeJwt(restaurant.Admin, TuroApiFactory.JwtKey, DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddMinutes(10));
            using HttpClient validClient = TestApi.CreateClient(valid);
            Assert.AreEqual(HttpStatusCode.OK, (await validClient.GetAsync("api/restaurant")).StatusCode);

            // Expiré depuis 10 min : au-delà des 5 min de tolérance d'horloge du validateur
            string expired = ForgeJwt(restaurant.Admin, TuroApiFactory.JwtKey, DateTime.UtcNow.AddMinutes(-30), DateTime.UtcNow.AddMinutes(-10));
            using HttpClient client = TestApi.CreateClient(expired);

            await ApiAssert.ErrorAsync(await client.GetAsync("api/restaurant"), HttpStatusCode.Forbidden, "TokenExpired");
        }

        private static Task<HttpResponseMessage> LoginAsync(HttpClient client, string login, string password) =>
            client.PostAsJsonAsync("api/auth/login", new LoginRequest { Login = login, Password = password }, TestJson.Options);

        /// <summary>Le Set-Cookie qui pose le refresh token (le refresh l'efface d'abord, puis le repose)</summary>
        private static string SetCookieHeader(HttpResponseMessage response) =>
            response.Headers.GetValues("Set-Cookie")
                .Last(h => h.StartsWith("refreshToken=", StringComparison.Ordinal) && !h.StartsWith("refreshToken=;", StringComparison.Ordinal));

        /// <summary>La valeur du cookie, encodée, telle que le navigateur la renverrait</summary>
        private static string RefreshCookieOf(HttpResponseMessage response) =>
            SetCookieHeader(response).Split(';')[0]["refreshToken=".Length..];

        private static Task<HttpResponseMessage> SendWithCookieAsync(HttpClient client, HttpMethod method, string url, string? cookie)
        {
            var request = new HttpRequestMessage(method, url);
            if (cookie != null)
            {
                request.Headers.Add("Cookie", $"refreshToken={cookie}");
            }
            return client.SendAsync(request);
        }

        private static async Task<string> AddRefreshTokenAsync(UserStaff user, DateTime createdAt)
        {
            string token = $"jeton-{Guid.NewGuid():N}";
            await TestApi.WithDbAsync(db =>
            {
                db.RefreshTokens.Add(new RefreshToken { Token = token, UserId = user.Id, CreatedAt = createdAt });
                return db.SaveChangesAsync();
            });
            return token;
        }

        private static string ForgeJwt(UserStaff user, string key, DateTime notBefore, DateTime expires)
        {
            IConfiguration config = TestApi.Factory.Services.GetRequiredService<IConfiguration>();
            var credentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256);
            var token = new JwtSecurityToken(
                issuer: config["JWT:Issuer"],
                audience: config["JWT:Audience"],
                claims:
                [
                    new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                    new Claim("restaurant_id", user.RestaurantId.ToString()),
                    new Claim(ClaimTypes.Role, user.Role.ToString()),
                ],
                notBefore: notBefore,
                expires: expires,
                signingCredentials: credentials);
            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
