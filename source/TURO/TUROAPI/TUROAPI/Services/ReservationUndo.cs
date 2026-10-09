using Microsoft.Extensions.Caching.Memory;
using TUROAPI.Models;
using TUROAPI.Models.Enums;

namespace TUROAPI.Services
{
    public enum UndoKind
    {
        Creation,
        Modification,
        Transition,
        Placement
    }

    /// <summary>Les champs qu'une transition touche</summary>
    public sealed record ReservationState(ReservationStatus Status, DateTime? SeatedAt, DateTime? FinishedAt, bool AutoClosed,
        DateTime? CancelledAt, CancelledBy? CancelledBy)
    {
        public static ReservationState Of(Reservation r) =>
            new(r.Status, r.SeatedAt, r.FinishedAt, r.AutoClosed, r.CancelledAt, r.CancelledBy);

        public void ApplyTo(Reservation r)
        {
            r.Status = Status;
            r.SeatedAt = SeatedAt;
            r.FinishedAt = FinishedAt;
            r.AutoClosed = AutoClosed;
            r.CancelledAt = CancelledAt;
            r.CancelledBy = CancelledBy;
        }
    }

    /// <summary>Les champs qu'une modification touche</summary>
    public sealed record ReservationValues(DateOnly ServiceDay, DateTime Start, int Covers, int Duration, string? Note, Guid? PreferredZoneId)
    {
        public static ReservationValues Of(Reservation r) =>
            new(r.ServiceDay, r.Start, r.Covers, r.Duration, r.Note, r.PreferredZoneId);

        public void ApplyTo(Reservation r)
        {
            r.ServiceDay = ServiceDay;
            r.Start = Start;
            r.Covers = Covers;
            r.Duration = Duration;
            r.Note = Note;
            r.PreferredZoneId = PreferredZoneId;
        }
    }

    /// <summary>Ce qu'il faut pour défaire une écriture : rien de plus, et seulement le temps du bandeau</summary>
    public sealed record UndoEntry(Guid ReservationId, Guid UserId, UndoKind Kind)
    {
        public ReservationState? StateBefore { get; init; }
        /// <summary>`NeedsCleaningSince` de chaque table touchée par « Libérer », avant le geste</summary>
        public Dictionary<Guid, DateTime?> TablesBefore { get; init; } = [];
        public ReservationValues? ValuesBefore { get; init; }
        /// <summary>La fiche née avec la réservation, supprimée avec elle si rien d'autre ne s'y rattache</summary>
        public Guid? CreatedClientId { get; init; }
        /// <summary>L'affectation créée par un placement : défaire la retire, la précédente redevient la plus récente</summary>
        public Guid? AssignmentId { get; init; }
        /// <summary>La ligne « acceptée » d'une demande déposée sur une table, effacée avec celle du placement</summary>
        public Guid? AcceptanceEventId { get; init; }
    }

    /// <summary>
    /// L'état d'avant de chaque écriture, gardé en mémoire 30 s (le bandeau en montre 8) : jamais en base, où il ne servirait plus.
    /// Un redémarrage de l'API l'efface, et l'annulation répond alors « trop tard »
    /// </summary>
    public sealed class ReservationUndo
    {
        public static readonly TimeSpan Window = TimeSpan.FromSeconds(30);

        private readonly IMemoryCache _cache;

        public ReservationUndo(IMemoryCache cache)
        {
            _cache = cache;
        }

        public void Remember(Guid eventId, UndoEntry entry) => _cache.Set(Key(eventId), entry, Window);

        public UndoEntry? Find(Guid eventId) => _cache.TryGetValue(Key(eventId), out UndoEntry? entry) ? entry : null;

        public void Forget(Guid eventId) => _cache.Remove(Key(eventId));

        private static string Key(Guid eventId) => $"reservation-undo:{eventId}";
    }
}
