using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using System.Net.Http.Headers;
using Testcontainers.PostgreSql;
using TUROAPI.Context;

namespace TUROAPI.Test.Infrastructure
{
    /// <summary>
    /// Une seule API et une seule base PostgreSQL (conteneur jetable) pour tout l'assembly.
    /// Chaque test crée son propre restaurant : les tests ne se voient pas, même en parallèle
    /// </summary>
    [TestClass]
    public sealed class TestApi
    {
        private static PostgreSqlContainer? _database;
        private static TuroApiFactory? _factory;

        public static TuroApiFactory Factory =>
            _factory ?? throw new InvalidOperationException("L'API de test n'est pas démarrée.");

        [AssemblyInitialize]
        public static async Task StartAsync(TestContext _)
        {
            // Même version que compose.yaml
            _database = new PostgreSqlBuilder("postgres:18").Build();
            await _database.StartAsync();

            string connectionString = _database.GetConnectionString();
            _factory = new TuroApiFactory(connectionString);

            // Garde-fou : un test ne doit jamais écrire dans la base de développement
            string? used = await WithDbAsync(db => Task.FromResult(db.Database.GetConnectionString()));
            if (used != connectionString)
            {
                throw new InvalidOperationException($"L'API de test ne pointe pas sur la base du conteneur : {used}");
            }
        }

        [AssemblyCleanup]
        public static async Task StopAsync()
        {
            if (_factory != null)
            {
                await _factory.DisposeAsync();
            }
            if (_database != null)
            {
                await _database.DisposeAsync();
            }
        }

        /// <summary>
        /// En https, car le cookie de rafraîchissement est Secure. Les cookies ne sont pas gérés automatiquement :
        /// les tests d'authentification les posent eux-mêmes
        /// </summary>
        public static HttpClient CreateClient(string? jwt = null)
        {
            HttpClient client = Factory.CreateClient(new WebApplicationFactoryClientOptions
            {
                BaseAddress = new Uri("https://localhost"),
                AllowAutoRedirect = false,
                HandleCookies = false,
            });
            if (jwt != null)
            {
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
            }
            return client;
        }

        public static async Task<T> WithDbAsync<T>(Func<TuroDBContext, Task<T>> action)
        {
            using IServiceScope scope = Factory.Services.CreateScope();
            return await action(scope.ServiceProvider.GetRequiredService<TuroDBContext>());
        }

        public static async Task WithDbAsync(Func<TuroDBContext, Task> action)
        {
            using IServiceScope scope = Factory.Services.CreateScope();
            await action(scope.ServiceProvider.GetRequiredService<TuroDBContext>());
        }
    }
}
