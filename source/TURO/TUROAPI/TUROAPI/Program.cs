using Microsoft.AspNetCore.Authentication.JwtBearer;
using System.Text.Json.Serialization;

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

            builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)

            var app = builder.Build();

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
