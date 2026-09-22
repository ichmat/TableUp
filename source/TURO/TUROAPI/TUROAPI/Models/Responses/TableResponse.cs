using System.ComponentModel.DataAnnotations.Schema;
using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Responses
{
    public class TableResponse
    {
        public Guid Id { get; set; }

        public Guid ZoneId { get; set; }

        public string Name { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public TableShape Shape { get; set; }

        public double X { get; set; }
        public double Y { get; set; }
        public double Width { get; set; }
        public double Height { get; set; }
        public double Rotation { get; set; }

        public DateTime? NeedsCleaningSince { get; set; }

        public bool IsActive { get; set; } = true;
    }
}
