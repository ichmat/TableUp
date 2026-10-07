using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TUROAPI.Context;
using TUROAPI.Controllers.Base;
using TUROAPI.Models;
using TUROAPI.Models.Enums;
using TUROAPI.Models.Requests;
using TUROAPI.Models.Responses;
using TUROAPI.Models.Wrapper;
using TUROAPI.Services;

namespace TUROAPI.Controllers
{
    /// <summary>
    /// Clients — le mini-CRM (§7). Lisible et modifiable par les deux rôles (CLI-07) ;
    /// la fusion et la suppression, qui ne se défont pas, sont réservées à l'administrateur
    /// </summary>
    [Route("api/clients")]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status401Unauthorized)]
    public class ClientsController : NeedAuthController
    {
        public const int MaxNameLength = 100;
        public const int MaxPhoneLength = 30;
        public const int MaxEmailLength = 254;
        public const int MaxAllergiesLength = 500;
        public const int MaxNotesLength = 2000;
        public const int MaxContacts = 5;

        public ClientsController(TuroDBContext context) : base(context)
        {
        }

        private IQueryable<Client> Active => ClientIdentity.ActiveClients(context, CurrentRestaurantId);

        public const int MaxPageSize = 500;

        /// <summary>
        /// Une fiche et sa réservation la plus récente, à venir comprise. Propriétés `init` (pas un `record` positionnel) :
        /// EF ne sait trier que sur des membres initialisés par nom
        /// </summary>
        public sealed class ClientRow
        {
            public Client Client { get; init; } = null!;
            public DateTime? LastStart { get; init; }
            public DateOnly? LastServiceDay { get; init; }
        }

        [HttpGet]
        [ProducesResponseType<ClientPageResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> GetClients([FromQuery] ClientListQuery query)
        {
            if (query.Page < 0)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, "page must be 0 or more.");
            }
            if (query.PageSize < 1 || query.PageSize > MaxPageSize)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, $"page size must be between 1 and {MaxPageSize}.");
            }

            IQueryable<Client> clients = Active;
            string search = query.Search?.Trim() ?? string.Empty;
            if (search.Any(char.IsAsciiDigit))
            {
                // Quand le téléphone sonne, on a le numéro avant le nom : n'importe quel morceau de n'importe quel numéro
                string key = PhoneNumber.SearchKey(search);
                clients = clients.Where(c => c.Phone != null && c.Phone.Contains(key));
            }
            else if (search.Length > 0)
            {
                string pattern = "%" + search.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
                clients = clients.Where(c => EF.Functions.ILike(c.Name, pattern));
            }
            if (query.Tag is ClientTag tag)
            {
                clients = clients.Where(c => c.Tags.Contains(tag));
            }
            if (query.AtRisk)
            {
                clients = clients.Where(ClientCounters.AtRisk);
            }

            int total = await clients.CountAsync();
            List<ClientRow> rows = await OrderedRows(clients, query.Sort)
                .Skip(query.Page * query.PageSize)
                .Take(query.PageSize)
                .ToListAsync();

            return Ok(new ClientPageResponse
            {
                Items = rows.Select(r => r.Client.ToListItem(r.LastServiceDay)).ToList(),
                Total = total,
                Page = query.Page,
                PageSize = query.PageSize,
            });
        }

        /// <summary>CLI-02 : récents par défaut — la réservation la plus récente, sinon la création de la fiche</summary>
        public static IQueryable<ClientRow> OrderedRows(IQueryable<Client> clients, ClientSort sort)
        {
            IQueryable<ClientRow> rows = clients.Select(c => new ClientRow
            {
                Client = c,
                LastStart = c.Reservations.Max(r => (DateTime?)r.Start),
                LastServiceDay = c.Reservations.OrderByDescending(r => r.Start).Select(r => (DateOnly?)r.ServiceDay).FirstOrDefault(),
            });

            return sort switch
            {
                ClientSort.Name => rows.OrderBy(r => r.Client.Name.ToLower()).ThenBy(r => r.Client.Id),
                ClientSort.Visits => rows.OrderByDescending(r => r.Client.VisitCount)
                    .ThenByDescending(r => r.LastStart ?? r.Client.CreatedAt).ThenBy(r => r.Client.Id),
                _ => rows.OrderByDescending(r => r.LastStart ?? r.Client.CreatedAt).ThenBy(r => r.Client.Id),
            };
        }

        public static readonly string[] CsvHeader =
            ["Nom", "Téléphones", "E-mails", "Tags", "Visites", "No-shows", "Dernière", "Consentement marketing"];

        private static readonly Dictionary<ClientTag, string> TagLabels = new()
        {
            [ClientTag.Vip] = "VIP",
            [ClientTag.Regular] = "Habitué",
            [ClientTag.Watch] = "À surveiller",
            [ClientTag.Press] = "Presse",
        };

        /// <summary>Toutes les fiches actives, dans l'ordre Récents. Ni allergies ni notes internes : elles ne sortent jamais</summary>
        [HttpGet("export")]
        public async Task<IActionResult> Export()
        {
            List<ClientRow> rows = await OrderedRows(Active, ClientSort.Recent).ToListAsync();
            IEnumerable<string[]> lines = rows.Select(r => new[]
            {
                r.Client.Name,
                // Par paires : Excel garde « 06 12 34 56 78 » en texte, et perdrait le zéro de « 0612345678 »
                string.Join(", ", ContactList.Split(r.Client.Phone).Select(PhoneNumber.Format)),
                string.Join(", ", ContactList.Split(r.Client.Email)),
                string.Join(", ", r.Client.Tags.Select(t => TagLabels[t])),
                r.Client.VisitCount.ToString(),
                r.Client.NoShowCount.ToString(),
                r.LastServiceDay?.ToString("yyyy-MM-dd") ?? string.Empty,
                r.Client.MarketingConsent ? "oui" : "non",
            });

            DateOnly today = ReservationImpact.Today(await ReservationImpact.GetTimeZoneAsync(context, CurrentRestaurantId));
            return File(ClientCsv.Build(lines.Prepend(CsvHeader)), "text/csv; charset=utf-8", $"clients-{today:yyyy-MM-dd}.csv");
        }

        [HttpGet("{id:guid}")]
        [ProducesResponseType<ClientResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> GetClient([FromRoute] Guid id)
        {
            return Ok(await DetailAsync(await LoadActiveAsync(id)));
        }

        [HttpPost]
        [ProducesResponseType<ClientResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> AddClient(ClientRequest request)
        {
            var client = new Client
            {
                Id = Guid.NewGuid(),
                RestaurantId = CurrentRestaurantId,
                CreatedAt = DateTime.UtcNow,
            };
            await ApplyAsync(client, request);

            context.Clients.Add(client);
            await context.SaveChangesAsync();
            await NotifyChangedAsync(DataScope.Clients);
            return Ok(await DetailAsync(client));
        }

        [HttpPut("{id:guid}")]
        [ProducesResponseType<ClientResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> UpdateClient([FromRoute] Guid id, [FromBody] ClientRequest request)
        {
            await using var transaction = await context.Database.BeginTransactionAsync();
            await LockAsync(id);
            Client client = await LoadActiveAsync(id);
            // Le formulaire renvoie toute la fiche : enregistré sur une version périmée, il effacerait
            // ce qu'un autre poste vient d'écrire (une allergie, une fusion)
            if (request.Version is null)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, "the version read with the client is required.");
            }
            if (request.Version != client.Version)
            {
                throw new ApiErrorException(ApiError.ClientChanged);
            }
            await ApplyAsync(client, request);

            await context.SaveChangesAsync();
            await transaction.CommitAsync();
            await NotifyChangedAsync(DataScope.Clients);
            return Ok(await DetailAsync(client));
        }

        /// <summary>CLI-11, CLI-12 : <paramref name="id"/> absorbe <paramref name="otherId"/>, qui disparaît</summary>
        [HttpPost("{id:guid}/merge/{otherId:guid}")]
        [Authorize(Roles = "Admin")]
        [ProducesResponseType<ClientResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> Merge([FromRoute] Guid id, [FromRoute] Guid otherId)
        {
            if (id == otherId)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, "a client cannot be merged with itself.");
            }

            await using var transaction = await context.Database.BeginTransactionAsync();
            await LockAsync(id, otherId);
            Client kept = await LoadActiveAsync(id);
            Client other = await LoadActiveAsync(otherId);
            if (!ClientRecords.ShareAKey(kept, other))
            {
                // Jamais sur le nom : deux homonymes fusionnés mélangeraient leurs allergies
                throw new ApiErrorException(ApiError.InvalidRequest, "these clients share no phone number or e-mail.");
            }

            ClientRecords.Absorb(kept, other);
            await context.Reservations
                .Where(r => r.ClientId == other.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.ClientId, kept.Id));
            context.Clients.Remove(other);
            await context.SaveChangesAsync();
            await transaction.CommitAsync();

            await NotifyChangedAsync(DataScope.Clients);
            return Ok(await DetailAsync(kept));
        }

        /// <summary>CLI-13, CLI-14 : supprimer un client, c'est l'anonymiser ; ses réservations restent</summary>
        [HttpDelete("{id:guid}")]
        [Authorize(Roles = "Admin")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        public async Task<IActionResult> Anonymize([FromRoute] Guid id)
        {
            await using var transaction = await context.Database.BeginTransactionAsync();
            await LockAsync(id);
            Client client = await LoadActiveAsync(id);
            ClientRecords.Anonymize(client, DateTime.UtcNow);

            await context.SaveChangesAsync();
            await transaction.CommitAsync();
            await NotifyChangedAsync(DataScope.Clients);
            return NoContent();
        }

        /// <summary>
        /// Verrouille des fiches jusqu'à la fin de la transaction en cours, à appeler avant de les lire.
        /// Deux écritures qui touchent la même fiche passent l'une après l'autre, et la seconde relit ce qu'a laissé
        /// la première. L'ordre des identifiants est le même pour tous : deux fusions croisées ne s'interbloquent pas
        /// </summary>
        private Task LockAsync(params Guid[] ids) =>
            context.Database.ExecuteSqlAsync(
                $"SELECT 1 FROM \"Clients\" WHERE \"Id\" = ANY({ids}) ORDER BY \"Id\" FOR UPDATE");

        /// <summary>Une fiche active du restaurant courant ; une fiche anonymisée n'existe plus pour l'écran</summary>
        private async Task<Client> LoadActiveAsync(Guid id) =>
            await Active.FirstOrDefaultAsync(c => c.Id == id)
                ?? throw new ApiErrorException(ApiError.NotFound, "Client not found.");

        /// <summary>Recharge la fiche avec son historique, et cherche les fusions proposables</summary>
        private async Task<ClientResponse> DetailAsync(Client client)
        {
            await context.Entry(client).Collection(c => c.Reservations).Query()
                .Include(r => r.Assignments).ThenInclude(a => a.Table)
                .Include(r => r.Assignments).ThenInclude(a => a.Combination)
                .LoadAsync();

            var candidates = new Dictionary<Guid, ClientMergeCandidateResponse>();
            IQueryable<Client> others = Active.Where(c => c.Id != client.Id);
            foreach (string phone in ContactList.Split(client.Phone))
            {
                foreach (Client other in await ClientIdentity.WithPhone(others, phone).ToListAsync())
                {
                    candidates.TryAdd(other.Id, Candidate(other, ClientSharedKey.Phone));
                }
            }
            foreach (string email in ContactList.Split(client.Email))
            {
                foreach (Client other in await ClientIdentity.WithEmail(others, email).ToListAsync())
                {
                    candidates.TryAdd(other.Id, Candidate(other, ClientSharedKey.Email));
                }
            }
            return client.ToResponse(candidates.Values.OrderBy(c => c.Name).ToList());
        }

        private static ClientMergeCandidateResponse Candidate(Client other, ClientSharedKey key) => new()
        {
            Id = other.Id,
            Name = other.Name,
            Phone = ContactList.Split(other.Phone).FirstOrDefault(),
            SharedKey = key,
        };

        /// <summary>Valide et recopie la requête ; un numéro déjà porté par une autre fiche active est refusé (§7.2)</summary>
        private async Task ApplyAsync(Client client, ClientRequest request)
        {
            string name = request.Name?.Trim() ?? string.Empty;
            if (name.Length == 0)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, "name is required.");
            }
            CheckLength(name, MaxNameLength, "name");
            // Une fusion peut dépasser les limites (§7.8) : ce qui est déjà enregistré reste enregistrable, seul ce qui grossit est refusé
            int maxPhones = Math.Max(MaxContacts, ContactList.Split(client.Phone).Count);
            int maxEmails = Math.Max(MaxContacts, ContactList.Split(client.Email).Count);
            if (request.Phones.Count > maxPhones)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, $"at most {maxPhones} phone numbers.");
            }
            if (request.Emails.Count > maxEmails)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, $"at most {maxEmails} e-mails.");
            }
            foreach (string phone in request.Phones)
            {
                CheckLength(phone, MaxPhoneLength, "phone number");
            }
            foreach (string email in request.Emails.Where(e => !string.IsNullOrWhiteSpace(e)))
            {
                CheckLength(email.Trim(), MaxEmailLength, "e-mail");
                if (!email.Contains('@') || email.Contains(ContactList.Separator))
                {
                    throw new ApiErrorException(ApiError.InvalidRequest, $"« {email.Trim()} » is not a valid e-mail.");
                }
            }
            string? allergies = Optional(request.Allergies);
            string? notes = Optional(request.InternalNotes);
            CheckLength(allergies, Math.Max(MaxAllergiesLength, client.Allergies?.Length ?? 0), "allergies");
            CheckLength(notes, Math.Max(MaxNotesLength, client.InternalNotes?.Length ?? 0), "internal notes");

            List<string> phones = ContactList.Phones(request.Phones);
            List<string> emails = ContactList.Emails(request.Emails);
            if (phones.Count == 0 && emails.Count == 0)
            {
                // Sans l'un ni l'autre, c'est un client de passage : il ne crée aucune fiche
                throw new ApiErrorException(ApiError.InvalidRequest, "a client needs a phone number or an e-mail.");
            }
            foreach (string phone in phones)
            {
                Client? owner = await ClientIdentity.WithPhone(Active.Where(c => c.Id != client.Id), phone).FirstOrDefaultAsync();
                if (owner != null)
                {
                    throw new ApiErrorException(ApiError.ClientPhoneTaken, owner.Name);
                }
            }

            client.Name = name;
            client.Phone = ContactList.Join(phones);
            client.Email = ContactList.Join(emails);
            client.Allergies = allergies;
            client.InternalNotes = notes;
            client.Tags = request.Tags.Distinct().ToList();
        }

        private static string? Optional(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();

        private static void CheckLength(string? text, int max, string field)
        {
            if (text != null && text.Length > max)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, $"{field} is longer than {max} characters.");
            }
        }
    }
}
