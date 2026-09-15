
namespace TUROAPI
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container.

            builder.Services.AddControllers();
            // Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
            builder.Services.AddOpenApi();

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


            app.MapControllers();

            // Une URL /api inconnue reste une 404, jamais la page Angular
            app.Map("/api/{**rest}", () => Results.NotFound());

            // Toute autre route qui n'est pas un fichier est une route Angular : on renvoie index.html
            app.MapFallbackToFile("index.html");

            app.Run();
        }
    }
}
