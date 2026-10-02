using System.Text.Json;
using System.Text.Json.Serialization;

namespace TUROAPI.Test.Infrastructure
{
    public static class TestJson
    {
        // Comme l'API : camelCase, enums par leur nom
        public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
        {
            Converters = { new JsonStringEnumConverter() },
        };
    }
}
