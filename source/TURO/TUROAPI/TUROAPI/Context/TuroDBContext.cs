using Microsoft.EntityFrameworkCore;
using TUROAPI.Models;

namespace TUROAPI.Context
{
    public class TuroDBContext : DbContext
    {
        public TuroDBContext(DbContextOptions<TuroDBContext> options) : base(options)
        {
        }

        public DbSet<Assignment> Assignments { get; set; }
        public DbSet<CancellationConditions> CancellationConditions { get; set; }
        public DbSet<Client> Clients { get; set; }
        public DbSet<Closure> Closures { get; set; }
        public DbSet<Combination> Combinations { get; set; }
        public DbSet<Decor> Decors { get; set; }
        public DbSet<EventLog> EventLogs { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<Reservation> Reservations { get; set; }
        public DbSet<Restaurant> Restaurants { get; set; }
        public DbSet<Service> Services { get; set; }
        public DbSet<Table> Tables { get; set; }
        public DbSet<UserStaff> UserStaffs { get; set; }
        public DbSet<Zone> Zones { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Closure>()
                .OwnsMany(c => c.ReplacementHours)
                .ToJson(); // Store ReplacementHours as JSON in the database
        }
    }
}
