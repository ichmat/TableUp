using TUROAPI.Context;
using TUROAPI.Extensions;
using TUROAPI.Models;
using TUROAPI.Models.Enums;

namespace TUROAPI.Tools
{
    public class SeedDatabase
    {
        public static void Seed(TuroDBContext db)
        {
            PasswordHash hash = new PasswordHash();

            Guid guidRestaurant = Guid.Parse("11111111-1111-1111-1111-111111111111");

            db.Restaurants.AddRangeIfNotExists(x => x.Id == guidRestaurant,
                new Restaurant()
                {
                    Id = guidRestaurant,
                    Name = "Test Restaurant",
                    TimeZone = "Europe/Paris",
                    DefaultRotation = 120,
                    SeatTolerance = 2,
                    LateGrace = 15,
                    ReminderEnabled = true,
                    ReminderDelayHours = 24,
                    AutoConfirmation = false,
                });

            Guid guidAdmin = Guid.Parse("11111111-1111-1111-1111-A11111111111");
            string passwordAdmin = "admin";

            var admin = new UserStaff
            {
                Id = guidAdmin,
                Login = "Admin",
                Role = UserRole.Admin,
                PasswordHash = string.Empty,
                RestaurantId = guidRestaurant
            };

            admin.PasswordHash = hash.HashPassword(admin, passwordAdmin);

            db.UserStaffs.AddRangeIfNotExists(x => x.Id == guidAdmin, admin);

            db.SaveChanges();
        }
    }
}
