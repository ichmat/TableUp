using Microsoft.EntityFrameworkCore;
using TUROAPI.Context;
using TUROAPI.Models;

namespace TUROAPI.Services
{
    /// <summary>Qui devient un client (§7.2) : le téléphone est la clé, l'e-mail la clé de secours</summary>
    public static class ClientIdentity
    {
        /// <summary>Les fiches du restaurant, sans les anonymisées</summary>
        public static IQueryable<Client> ActiveClients(TuroDBContext context, Guid restaurantId) =>
            context.Clients.Where(c => c.RestaurantId == restaurantId && c.AnonymizedAt == null);

        /// <summary>Une valeur exacte de la liste `;` (jamais un morceau de numéro)</summary>
        public static IQueryable<Client> WithPhone(IQueryable<Client> clients, string phone) =>
            clients.Where(c => c.Phone != null && (";" + c.Phone + ";").Contains(";" + phone + ";"));

        public static IQueryable<Client> WithEmail(IQueryable<Client> clients, string email) =>
            clients.Where(c => c.Email != null && (";" + c.Email + ";").Contains(";" + email + ";"));

        /// <summary>
        /// La fiche d'une réservation : rattachée sans rien demander si le numéro est connu, créée silencieusement sinon.
        /// Sans numéro, l'e-mail sert de clé. Sans l'un ni l'autre (client de passage), aucune fiche : `null`.
        /// Une fiche créée est ajoutée au contexte sans être enregistrée : l'appelant enregistre avec sa réservation.
        /// Appelée par le futur lot Réservations
        /// </summary>
        public static async Task<Client?> FindOrCreateAsync(TuroDBContext context, Guid restaurantId, string name, string? phone, string? email)
        {
            string? normalizedPhone = PhoneNumber.Normalize(phone);
            string? normalizedEmail = ContactList.NormalizeEmail(email);
            IQueryable<Client> active = ActiveClients(context, restaurantId);

            Client? known = normalizedPhone != null
                ? await WithPhone(active, normalizedPhone).OrderBy(c => c.CreatedAt).FirstOrDefaultAsync()
                : normalizedEmail != null
                    ? await WithEmail(active, normalizedEmail).OrderBy(c => c.CreatedAt).FirstOrDefaultAsync()
                    : null;
            if (known != null || (normalizedPhone == null && normalizedEmail == null))
            {
                return known;
            }

            var client = new Client
            {
                Id = Guid.NewGuid(),
                RestaurantId = restaurantId,
                Name = name.Trim(),
                Phone = normalizedPhone,
                Email = normalizedEmail,
                CreatedAt = DateTime.UtcNow,
            };
            context.Clients.Add(client);
            return client;
        }
    }
}
