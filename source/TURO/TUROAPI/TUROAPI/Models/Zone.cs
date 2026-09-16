using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TUROAPI.Models
{
    public class Zone
    {
        [Key]
        public Guid Id { get; set; }

        [ForeignKey(nameof(Restaurant))]
        public Guid RestaurantId { get; set; }
        public Restaurant Restaurant { get; set; } = null!;

        public string Name { get; set; } = string.Empty;

        // Tab order
        public int Order { get; set; }

        // In meters: rendering converts, the data stays metric
        public double Width { get; set; }
        public double Height { get; set; }

        public List<Table> Tables { get; set; } = [];
        public List<Combination> Combinations { get; set; } = [];
        public List<Decor> Decors { get; set; } = [];
    }
}
