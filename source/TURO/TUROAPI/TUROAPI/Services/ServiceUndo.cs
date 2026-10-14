using Microsoft.Extensions.Caching.Memory;
using TUROAPI.Models;

namespace TUROAPI.Services
{
    public sealed record TablePosition(double X, double Y);

    /// <summary>Les champs d'une combinaison qu'un geste du service décide ; les dates, elles, se recalculent</summary>
    public sealed record CombinationFields(bool IsActive, DateTime? SnoozedUntil, Guid? KeepGluedFor, Guid? SeparateAfterNoShowOf)
    {
        public static CombinationFields Of(Combination c) => new(c.IsActive, c.SnoozedUntil, c.KeepGluedFor, c.SeparateAfterNoShowOf);

        public void ApplyTo(Combination c)
        {
            c.IsActive = IsActive;
            c.ActivateAt = null;
            c.DeactivateAt = null;
            c.SnoozedUntil = SnoozedUntil;
            c.KeepGluedFor = KeepGluedFor;
            c.SeparateAfterNoShowOf = SeparateAfterNoShowOf;
        }
    }

    public sealed record AssignmentCopy(Guid Id, Guid ReservationId, Guid? TableId, Guid? CombinationId, Guid? AssignedById, DateTime AssignedAt)
    {
        public static AssignmentCopy Of(Assignment a) => new(a.Id, a.ReservationId, a.TableId, a.CombinationId, a.AssignedById, a.AssignedAt);

        public Assignment ToAssignment() => new()
        {
            Id = Id, ReservationId = ReservationId, TableId = TableId, CombinationId = CombinationId, AssignedById = AssignedById, AssignedAt = AssignedAt,
        };
    }

    /// <summary>Un geste du service (réponse à un rappel, déplacement, collage) : l'état d'avant, et celui d'après pour savoir si rien ne l'a suivi</summary>
    public sealed record ServiceUndoEntry(Guid UserId, Guid RestaurantId)
    {
        public Dictionary<Guid, TablePosition> PositionsBefore { get; init; } = [];
        public Dictionary<Guid, TablePosition> PositionsAfter { get; init; } = [];
        public Dictionary<Guid, CombinationFields> CombinationsBefore { get; init; } = [];
        public Dictionary<Guid, CombinationFields> CombinationsAfter { get; init; } = [];
        /// <summary>« Finalement non » : les affectations retirées, remises telles quelles</summary>
        public List<AssignmentCopy> RemovedAssignments { get; init; } = [];
        /// <summary>Les lignes de journal écrites par le geste, effacées avec lui</summary>
        public List<Guid> EventIds { get; init; } = [];
        /// <summary>La combinaison née du geste (coller des tables qu'aucune ne réunissait)</summary>
        public Guid? CreatedCombinationId { get; init; }
        public bool TouchesReservations { get; init; }
    }

    /// <summary>Comme `ReservationUndo` : en mémoire 30 s (le bandeau en montre 8), pour l'auteur du geste seulement</summary>
    public sealed class ServiceUndo
    {
        private readonly IMemoryCache _cache;

        public ServiceUndo(IMemoryCache cache)
        {
            _cache = cache;
        }

        public void Remember(Guid undoId, ServiceUndoEntry entry) => _cache.Set(Key(undoId), entry, ReservationUndo.Window);

        public ServiceUndoEntry? Find(Guid undoId) => _cache.TryGetValue(Key(undoId), out ServiceUndoEntry? entry) ? entry : null;

        public void Forget(Guid undoId) => _cache.Remove(Key(undoId));

        private static string Key(Guid undoId) => $"service-undo:{undoId}";
    }
}
