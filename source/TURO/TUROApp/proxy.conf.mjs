// Relais du serveur de dev Angular vers l'API .NET.
// En conteneur, API_URL vaut http://api:8080 ; en local, l'API tourne sur le profil « http » de launchSettings.
const target = process.env['API_URL'] ?? 'https://localhost:7187';

export default {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
    // le hub SignalR (/api/hubs/turo) passe en WebSocket
    ws: true,
  },
};
