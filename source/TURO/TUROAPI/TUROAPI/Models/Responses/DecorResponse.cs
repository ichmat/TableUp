using System.ComponentModel.DataAnnotations.Schema;
using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Responses
{
    public class DecorResponse
    {
        public Guid Id { get; set; }

        public Guid ZoneId { get; set; }

        public DecorType Type { get; set; }
        public string? Label { get; set; }

        public double X { get; set; }
        public double Y { get; set; }
        public double Width { get; set; }
        public double Height { get; set; }
        public double Rotation { get; set; }
    }
}
