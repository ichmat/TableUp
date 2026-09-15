// Relais du serveur de dev Angular vers l'API .NET.
// En conteneur, API_URL vaut http://api:8080 ; en local, l'API tourne sur le profil « http » de launchSettings.
const target = process.env['API_URL'] ?? 'http://localhost:5247';

export default {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
  },
};
