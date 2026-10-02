namespace TUROAPI.Models.Requests
{
    public class ZoneRequest
    {
        public string Name { get; set; } = string.Empty;
        // En mètres
        public double Width { get; set; }
        public double Height { get; set; }
    }
}
