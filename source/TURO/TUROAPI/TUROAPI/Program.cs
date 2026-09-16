using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json.Serialization;
using TUROAPI.Middleware;
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
                options.UseNpgsql(conf.GetConnectionString("TuroDB")));

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
                });

            builder.Services.AddSingleton<TokenService>();
            builder.Services.AddSingleton<PasswordHash>();

            builder.Logging.ClearProviders();
            builder.Services.AddHttpContextAccessor();
            builder.Services.AddSingleton<ILoggerProvider>(sp => new TuroLoggerProvider(
                conf["Logging:File:Path"] ?? "logs",
                sp.GetRequiredService<IHttpContextAccessor>()));
            

            var app = builder.Build();

            AppLogger.Init(app.Services.GetRequiredService<ILoggerFactory>());

            app.UseMiddleware<RequestLoggingMiddleware>();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
            }

            app.UseHttpsRedirection();

            // Front Angular embarqué dans l'image : fichiers servis depuis wwwroot
            app.UseStaticFiles();

            app.UseAuthorization();

            app.UseAuthentication();


            app.MapControllers();

            // Une URL /api inconnue reste une 404, jamais la page Angular
            app.Map("/api/{**rest}", () => Results.NotFound());

            // Toute autre route qui n'est pas un fichier est une route Angular : on renvoie index.html
            app.MapFallbackToFile("index.html");

            app.Run();
        }
    }
}
