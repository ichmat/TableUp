using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace TUROAPI.Test.Infrastructure
{
    public sealed class TuroApiFactory(string connectionString) : WebApplicationFactory<Program>
    {
        public const string JwtKey = "turo-integration-tests-0123456789-abcdefghijkl";

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            // « Testing » : ni seed de développement ni OpenAPI ; les migrations s'appliquent au démarrage, comme en production
            builder.UseEnvironment("Testing");
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:TuroDB"] = connectionString,
                ["JWT:Key"] = JwtKey,
                ["Logging:File:Path"] = Path.Combine(Path.GetTempPath(), "turo-api-tests", "logs"),
            }));
        }
    }
}
