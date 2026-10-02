using System.Text.Json;

namespace TUROAPI.Test.Infrastructure
{
    /// <summary>Le corps d'erreur de l'API, lu tel que le front le lit : Error est le nom de l'ApiError</summary>
    public sealed record ApiErrorBody(int StatusCode, string Message, string Error);

    public static class ApiAssert
    {
        public static async Task<T> OkAsync<T>(HttpResponseMessage response)
        {
            string body = await response.Content.ReadAsStringAsync();
            Assert.AreEqual(HttpStatusCode.OK, response.StatusCode, body);
            return JsonSerializer.Deserialize<T>(body, TestJson.Options)
                ?? throw new AssertFailedException($"Corps vide : {body}");
        }

        public static async Task<ApiErrorBody> ErrorAsync(HttpResponseMessage response, HttpStatusCode status, string error, string? messagePart = null)
        {
            string body = await response.Content.ReadAsStringAsync();
            Assert.AreEqual(status, response.StatusCode, body);
            ApiErrorBody parsed = JsonSerializer.Deserialize<ApiErrorBody>(body, TestJson.Options)
                ?? throw new AssertFailedException($"Corps vide : {body}");
            Assert.AreEqual(error, parsed.Error, body);
            Assert.AreEqual((int)status, parsed.StatusCode, body);
            if (messagePart != null)
            {
                Assert.IsTrue(parsed.Message.Contains(messagePart, StringComparison.Ordinal),
                    $"« {messagePart} » absent de : {parsed.Message}");
            }
            return parsed;
        }
    }
}
