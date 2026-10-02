using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;
using System.Text.Json.Serialization;
using System.Threading.Channels;

namespace TUROAPI.Test.Infrastructure
{
    /// <summary>Un écran du restaurant branché sur le hub : il note chaque DataChanged reçu</summary>
    public sealed class Screen : IAsyncDisposable
    {
        private readonly HubConnection _connection;
        private readonly Channel<DataScope> _received = Channel.CreateUnbounded<DataScope>();

        private Screen(HubConnection connection)
        {
            _connection = connection;
            _connection.On<DataScope>("DataChanged", scope => _received.Writer.TryWrite(scope));
        }

        public static async Task<Screen> ConnectAsync(string? jwt)
        {
            HubConnection connection = new HubConnectionBuilder()
                .WithUrl(new Uri(TestApi.Factory.Server.BaseAddress, "api/hubs/turo"), options =>
                {
                    options.HttpMessageHandlerFactory = _ => TestApi.Factory.Server.CreateHandler();
                    // Le TestServer ne sert pas de WebSocket par ce gestionnaire : long polling, JWT en en-tête
                    options.Transports = HttpTransportType.LongPolling;
                    options.AccessTokenProvider = () => Task.FromResult(jwt);
                })
                .AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
                .Build();
            var screen = new Screen(connection);
            await connection.StartAsync();

            // Barrière : le hub ne traite une invocation qu'après OnConnectedAsync, donc après l'entrée dans le groupe du restaurant
            try
            {
                await connection.InvokeAsync("Barrier");
            }
            catch (HubException)
            {
                // méthode inexistante : attendu
            }
            return screen;
        }

        public async Task<DataScope> NextAsync()
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            return await _received.Reader.ReadAsync(timeout.Token);
        }

        public bool TryNext(out DataScope scope) => _received.Reader.TryRead(out scope);

        public ValueTask DisposeAsync() => _connection.DisposeAsync();
    }
}
