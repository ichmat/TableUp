using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json.Serialization;
using TUROAPI.Context;
using TUROAPI.Hubs;
using TUROAPI.Middleware;
using TUROAPI.Models.Enums;
using TUROAPI.Models.Responses;
using TUROAPI.Services;
using TUROAPI.Tools;
using TUROAPI.Tools.Logging;

namespace TUROAPI
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            IConfiguration conf = new ConfigurationBuilder()
                .SetBasePath(builder.Environment.ContentRootPath)
                .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
                .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true)
                .AddEnvironmentVariables()
                .Build();

            // Add services to the container.

            // Les enums partent en chaînes ("Pending"), jamais en nombres : le front les type ainsi
            builder.Services.AddControllers()
                .AddJsonOptions(options =>
                    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
            // Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
            builder.Services.AddOpenApi();

            builder.Services.AddDbContext<Context.TuroDBContext>(options =>
                options.UseNpgsql(conf.GetConnectionString("TuroDB"), o =>
                {
                    // Utilisation des requête splitter dans le cas de multiple `Inlucde` dans une requête
                    // voir : https://learn.microsoft.com/fr-fr/ef/core/querying/single-split-queries
                    o.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
                }));

            builder.Services
                .AddAuthentication()
                .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, option =>
                {
                    option.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = conf["JWT:Issuer"],
                        ValidAudience = conf["JWT:Audience"],
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(conf["JWT:Key"]!)),
                        RequireExpirationTime = true,
                    };
                    option.Events = new JwtBearerEvents
                    {
                        // Un navigateur ne peut pas poser d'en-tête Authorization sur un WebSocket :
                        // le client SignalR passe le JWT en ?access_token, accepté uniquement sur le hub
                        OnMessageReceived = context =>
                        {
                            var token = context.Request.Query["access_token"];
                            if (!string.IsNullOrEmpty(token) && context.HttpContext.Request.Path.StartsWithSegments(TuroHub.Path))
                                context.Token = token;
                            return Task.CompletedTask;
                        },
                        OnChallenge = async context =>
                        {
                            context.HandleResponse(); // supprime le 401 vide par défaut

                            ApiError error = context.AuthenticateFailure switch
                            {
                                SecurityTokenExpiredException => ApiError.TokenExpired,
                                null => ApiError.NoAuthenticationTokenGiven, // aucun en-tête Authorization
                                _ => ApiError.UnreadableToken,               // signature, émetteur, format…
                            };
                            await WriteApiError(context.HttpContext, error);
                        },
                        OnForbidden = context => WriteApiError(context.HttpContext, ApiError.NotAdmin),
                    };
                });

            builder.Services.AddSingleton<TokenService>();
            builder.Services.AddSingleton<PasswordHash>();

            // SignalR a ses propres options JSON, indépendantes de celles de MVC : les enums doivent y partir en chaînes aussi
            builder.Services.AddSignalR()
                .AddJsonProtocol(options =>
                    options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
            builder.Services.AddSingleton<ChangeNotifier>();

            builder.Logging.ClearProviders();
            builder.Services.AddHttpContextAccessor();
            builder.Services.AddSingleton<ILoggerProvider>(sp => new TuroLoggerProvider(
                conf["Logging:File:Path"] ?? "logs",
                sp.GetRequiredService<IHttpContextAccessor>()));
            

            var app = builder.Build();

            AppLogger.Init(app.Services.GetRequiredService<ILoggerFactory>());

            using (var scope = app.Services.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<TuroDBContext>();
                try
                {
                    var pending = dbContext.Database.GetPendingMigrations().ToList();
                    if (pending.Count > 0)
                    {
                        AppLogger.Log(LogType.Info,
                            $"Applying {pending.Count} pending EF migration(s): {string.Join(", ", pending)}");
                        dbContext.Database.Migrate();
                        AppLogger.Log(LogType.Info, "EF migrations applied successfully.");
                    }
                    else
                    {
                        AppLogger.Log(LogType.Info, "No pending EF migrations.");
                    }
                }
                catch (Exception ex)
                {
                    AppLogger.Log(LogType.Error, "Failed to apply EF migrations on startup.", ex);
                    throw;
                }
            }

            app.UseMiddleware<RequestLoggingMiddleware>();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
                SeedDatabase.Seed(app.Services.CreateScope().ServiceProvider.GetRequiredService<TuroDBContext>());
            }

            app.UseHttpsRedirection();

            // Front Angular embarqué dans l'image : fichiers servis depuis wwwroot
            app.UseStaticFiles();

            // l'authentification doit précéder l'autorisation, sinon [Authorize] ne voit jamais d'utilisateur
            app.UseAuthentication();

            app.UseAuthorization();

            app.MapControllers();

            // La connexion est coupée à l'expiration du JWT : le client se reconnecte avec un token rafraîchi
            app.MapHub<TuroHub>(TuroHub.Path, options => options.CloseOnAuthenticationExpiration = true);

            // Une URL /api inconnue reste une 404, jamais la page Angular
            app.Map("/api/{**rest}", () => Results.NotFound());

            // Toute autre route qui n'est pas un fichier est une route Angular : on renvoie index.html
            app.MapFallbackToFile("index.html");

            app.Run();
        }

        private static Task WriteApiError(HttpContext http, ApiError error)
        {
            var response = new ApiErrorResponse(new ApiErrorException(error));
            http.Items[RequestLoggingMiddleware.ErrorKey] = response.Message; // même trace que le filtre
            http.Response.StatusCode = response.StatusCode;

            // les options JSON de MVC, pour garder les enums en chaînes
            var json = http.RequestServices.GetRequiredService<IOptions<Microsoft.AspNetCore.Mvc.JsonOptions>>();
            return http.Response.WriteAsJsonAsync(response, json.Value.JsonSerializerOptions);
        }
    }
}

