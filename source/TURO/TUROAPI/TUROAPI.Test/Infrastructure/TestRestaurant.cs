using Microsoft.Extensions.DependencyInjection;
using TUROAPI.Services;
using TUROAPI.Tools;

namespace TUROAPI.Test.Infrastructure
{
    /// <summary>
    /// Un restaurant neuf par test, avec un administrateur et un serveur : aucun test ne voit les données d'un autre
    /// </summary>
    public sealed class TestRestaurant
    {
        public const string Password = "mot-de-passe-de-test";

        public Guid Id { get; } = Guid.NewGuid();
        public string Name => $"Restaurant {Id:N}";
        public UserStaff Admin { get; private set; } = null!;
        public UserStaff Staff { get; private set; } = null!;

        public static async Task<TestRestaurant> CreateAsync(string timeZone = Dates.TimeZoneId)
        {
            var restaurant = new TestRestaurant();
            var hash = new PasswordHash();
            restaurant.Admin = NewUser(restaurant.Id, UserRole.Admin, hash);
            restaurant.Staff = NewUser(restaurant.Id, UserRole.Staff, hash);

            await TestApi.WithDbAsync(db =>
            {
                db.Restaurants.Add(new Restaurant
                {
                    Id = restaurant.Id,
                    Name = restaurant.Name,
                    TimeZone = timeZone,
                    DefaultRotation = 120,
                    SeatTolerance = 2,
                    LateGrace = 15,
                    ReminderEnabled = true,
                    ReminderDelayHours = 24,
                });
                db.UserStaffs.AddRange(restaurant.Admin, restaurant.Staff);
                return db.SaveChangesAsync();
            });
            return restaurant;
        }

        // Login unique : la connexion cherche le login dans tous les restaurants
        private static UserStaff NewUser(Guid restaurantId, UserRole role, PasswordHash hash)
        {
            var user = new UserStaff
            {
                Id = Guid.NewGuid(),
                RestaurantId = restaurantId,
                Role = role,
                Login = $"{role}-{Guid.NewGuid():N}",
            };
            user.PasswordHash = hash.HashPassword(user, Password);
            return user;
        }

        public string AdminJwt() => Jwt(Admin);
        public string StaffJwt() => Jwt(Staff);
        public HttpClient AdminClient() => TestApi.CreateClient(AdminJwt());
        public HttpClient StaffClient() => TestApi.CreateClient(StaffJwt());

        /// <summary>Le JWT que la connexion émettrait ; la connexion elle-même est testée dans AuthTests</summary>
        private static string Jwt(UserStaff user) =>
            TestApi.Factory.Services.GetRequiredService<TokenService>().GenerateJWT(user);

        /// <summary>Une réservation de <paramref name="serviceDay"/>, à l'heure locale du restaurant (Europe/Paris)</summary>
        /// <param name="startDay">Le jour réel du début, quand le repas commence après minuit (RES-02)</param>
        public async Task<Reservation> AddReservationAsync(DateOnly serviceDay, int hour, int minute = 0, int covers = 2,
            ReservationStatus status = ReservationStatus.Confirmed, string? clientName = "Dupont",
            Guid? preferredZoneId = null, DateOnly? startDay = null, Guid? clientId = null)
        {
            var reservation = new Reservation
            {
                Id = Guid.NewGuid(),
                RestaurantId = Id,
                Start = Dates.ToUtc(startDay ?? serviceDay, new TimeOnly(hour, minute)),
                Duration = 120,
                ServiceDay = serviceDay,
                Covers = covers,
                Status = status,
                Source = ReservationSource.Phone,
                PreferredZoneId = preferredZoneId,
            };
            if (clientId != null)
            {
                reservation.ClientId = clientId;
            }
            else if (clientName != null)
            {
                reservation.Client = new Client { Id = Guid.NewGuid(), RestaurantId = Id, Name = clientName, Phone = "0600000000" };
            }
            await TestApi.WithDbAsync(db =>
            {
                db.Reservations.Add(reservation);
                return db.SaveChangesAsync();
            });
            return reservation;
        }

        public static Task<Reservation> ReservationAsync(Guid id) =>
            TestApi.WithDbAsync(db => db.Reservations.AsNoTracking().SingleAsync(r => r.Id == id));
    }
}
