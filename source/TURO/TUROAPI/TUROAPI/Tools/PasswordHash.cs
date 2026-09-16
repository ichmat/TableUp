using Microsoft.AspNetCore.Identity;
using TUROAPI.Models;

namespace TUROAPI.Tools
{
    public class PasswordHash
    {
        public string HashPassword(UserStaff user, string password)
        {
            PasswordHasher<UserStaffIdentity> passwordHasher = new PasswordHasher<UserStaffIdentity>();
            return passwordHasher.HashPassword(new UserStaffIdentity
            {
                Id = user.Id.ToString(),
                RestaurantId = user.RestaurantId.ToString(),
                Login = user.Login
            }, password);
        }

        public PasswordVerificationResult VerifyHashedPassword(UserStaff user, string hashedPassword, string providedPassword)
        {
            PasswordHasher<UserStaffIdentity> passwordHasher = new PasswordHasher<UserStaffIdentity>();
            return passwordHasher.VerifyHashedPassword(new UserStaffIdentity
            {
                Id = user.Id.ToString(),
                RestaurantId = user.RestaurantId.ToString(),
                Login = user.Login
            }, hashedPassword, providedPassword);
        }
    }

    public class UserStaffIdentity
    {
        public required string Id { get; set; }
        public required string RestaurantId { get; set; }
        public required string Login { get; set; }
    }
}
