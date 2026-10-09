using TUROAPI.Services;
using static TUROAPI.Services.PlacementEngine;

namespace TUROAPI.Test
{
    /// <summary>§3.5 sans base : écartée, ✓, ~✓, !, et chaque raison</summary>
    [TestClass]
    public sealed class PlacementEngineTests
    {
        private static readonly DateTime Eight = new(2026, 10, 10, 18, 0, 0, DateTimeKind.Utc);
        private static readonly Guid Salle = Guid.NewGuid();
        private static readonly Guid Terrasse = Guid.NewGuid();
        private static readonly Settings Default = new(Tolerance: 2, TrackCleaning: true, DefaultRotation: 105);

        private static Candidate TableOf(string name, int capacity, Guid? zone = null, DateTime? dirtySince = null, Glue? glued = null)
        {
            Guid id = Guid.NewGuid();
            return new Candidate(id, null, zone ?? Salle, name, capacity, [id], dirtySince, glued);
        }

        private static Candidate CombinationOf(string name, int capacity, params Candidate[] tables) =>
            new(null, Guid.NewGuid(), Salle, name, capacity, tables.Select(t => t.TableId!.Value).ToList(), null, null);

        private static Request For(int covers, DateTime? start = null, int minutes = 120, Guid? zone = null, string? note = null) =>
            new(Guid.NewGuid(), covers, start ?? Eight, (start ?? Eight).AddMinutes(minutes), zone, zone == Salle ? "Salle" : zone == null ? null : "Terrasse", note);

        private static Occupied On(Candidate table, DateTime start, DateTime end, ReservationStatus status = ReservationStatus.Confirmed, string? guest = "Legrand", Guid? reservation = null) =>
            new(reservation ?? Guid.NewGuid(), table.TableIds[0], start, end, status, guest);

        private static Verdict Single(Request request, Candidate candidate, params Occupied[] occupations) =>
            Judge(request, [candidate], occupations, Default).Single();

        [TestMethod]
        public void A_free_table_of_the_right_size_is_perfect()
        {
            Verdict verdict = Single(For(4), TableOf("5", 4));

            Assert.AreEqual(PlacementLevel.Perfect, verdict.Level);
            Assert.AreEqual(0, verdict.Reasons.Count);
            Assert.IsNull(verdict.Next);
        }

        [TestMethod]
        public void One_empty_seat_stays_perfect()
        {
            Assert.AreEqual(PlacementLevel.Perfect, Single(For(3), TableOf("5", 4)).Level);
        }

        [TestMethod]
        public void A_table_taken_during_the_meal_or_too_small_is_excluded()
        {
            Candidate five = TableOf("5", 4);

            Assert.AreEqual(PlacementLevel.Excluded, Single(For(4), five, On(five, Eight.AddMinutes(90), Eight.AddMinutes(200))).Level);
            Assert.AreEqual(PlacementLevel.Excluded, Single(For(5), five).Level);
            // Bout à bout : la suivante commence à la fin prévue, la table n'est pas prise
            Assert.AreNotEqual(PlacementLevel.Excluded, Single(For(4), five, On(five, Eight.AddMinutes(120), Eight.AddMinutes(240))).Level);
        }

        [TestMethod]
        public void A_combination_is_taken_when_any_of_its_tables_is()
        {
            Candidate twelve = TableOf("12", 4), thirteen = TableOf("13", 4);
            Candidate both = CombinationOf("12-13", 8, twelve, thirteen);

            Verdict verdict = Judge(For(8), [twelve, thirteen, both], [On(thirteen, Eight, Eight.AddMinutes(60))], Default)[2];

            Assert.AreEqual(PlacementLevel.Excluded, verdict.Level);
        }

        [TestMethod]
        public void An_active_combination_can_be_perfect()
        {
            Candidate twelve = TableOf("12", 4), thirteen = TableOf("13", 4);

            Assert.AreEqual(PlacementLevel.Perfect, Judge(For(8), [CombinationOf("12-13", 8, twelve, thirteen)], [], Default).Single().Level);
        }

        [TestMethod]
        public void The_reservation_being_moved_does_not_block_its_own_table()
        {
            Candidate five = TableOf("5", 4);
            Request moving = For(4);

            Assert.AreEqual(PlacementLevel.Perfect, Single(moving, five, On(five, Eight, Eight.AddMinutes(120), reservation: moving.ReservationId)).Level);
        }

        [TestMethod]
        public void Extra_seats_within_tolerance_are_a_reserve_and_say_when_none_of_that_size_is_left()
        {
            Candidate six = TableOf("6", 6);

            Reason alone = Single(For(4), six).Reasons.Single();
            Assert.AreEqual(PlacementReasonKind.ExtraSeats, alone.Kind);
            Assert.AreEqual(2, alone.Count);
            Assert.AreEqual(2, alone.Tolerance);
            Assert.IsTrue(alone.NoneLeftOfCapacity);

            List<Verdict> two = Judge(For(4), [six, TableOf("7", 6)], [], Default);
            Assert.AreEqual(PlacementLevel.WithReserve, two[0].Level);
            Assert.IsFalse(two[0].Reasons.Single().NoneLeftOfCapacity);
        }

        [TestMethod]
        public void Beyond_tolerance_is_not_advised_but_never_excluded()
        {
            Verdict verdict = Single(For(2), TableOf("10", 8));

            Assert.AreEqual(PlacementLevel.NotAdvised, verdict.Level);
            Assert.AreEqual(PlacementReasonKind.BeyondTolerance, verdict.Reasons.Single().Kind);
            Assert.AreEqual(6, verdict.Reasons.Single().Count);
        }

        [TestMethod]
        public void A_dirty_table_names_who_left_it_and_only_when_cleaning_is_tracked()
        {
            DateTime left = Eight.AddMinutes(-48);
            Candidate five = TableOf("5", 4, dirtySince: left);
            Occupied legrand = On(five, Eight.AddMinutes(-150), left, ReservationStatus.Finished);

            Reason reason = Single(For(4), five, legrand).Reasons.Single();
            Assert.AreEqual(PlacementReasonKind.NeedsCleaning, reason.Kind);
            Assert.AreEqual(left, reason.Since);
            Assert.AreEqual("Legrand", reason.Guest);
            Assert.AreEqual(left, reason.LeftAt);

            Assert.AreEqual(PlacementLevel.Perfect, Judge(For(4), [five], [legrand], Default with { TrackCleaning = false }).Single().Level);
        }

        [TestMethod]
        public void Another_zone_than_the_one_asked_is_a_reserve_carrying_the_note()
        {
            Reason reason = Single(For(4, zone: Salle, note: "intérieur svp"), TableOf("T1", 4, zone: Terrasse)).Reasons.Single();

            Assert.AreEqual(PlacementReasonKind.OtherZone, reason.Kind);
            Assert.AreEqual("Salle", reason.RequestedZone);
            Assert.AreEqual("intérieur svp", reason.Note);
            Assert.AreEqual(PlacementLevel.Perfect, Single(For(4, zone: Salle), TableOf("5", 4, zone: Salle)).Level);
        }

        [TestMethod]
        public void Less_than_fifteen_minutes_before_the_next_booking_is_a_reserve()
        {
            Candidate five = TableOf("5", 4);
            DateTime end = Eight.AddMinutes(120);

            Verdict tight = Single(For(4), five, On(five, end.AddMinutes(14), end.AddMinutes(134)));
            Assert.AreEqual(PlacementLevel.WithReserve, tight.Level);
            Reason reason = tight.Reasons.Single();
            Assert.AreEqual(PlacementReasonKind.NextSoon, reason.Kind);
            Assert.AreEqual(14, reason.Margin);
            Assert.AreEqual(105, reason.DefaultRotation);
            Assert.AreEqual("Legrand", reason.Guest);

            Verdict roomy = Single(For(4), five, On(five, end.AddMinutes(15), end.AddMinutes(135)));
            Assert.AreEqual(PlacementLevel.Perfect, roomy.Level);
            Assert.AreEqual(new NextBooking(end.AddMinutes(15), 15, "Legrand"), roomy.Next);
        }

        [TestMethod]
        public void A_table_glued_in_an_active_combination_must_be_separated()
        {
            Candidate twelve = TableOf("12", 4, glued: new Glue("12-13", ["13"]));

            Reason reason = Single(For(4), twelve).Reasons.Single();

            Assert.AreEqual(PlacementReasonKind.Glued, reason.Kind);
            Assert.AreEqual("12-13", reason.Combination);
            CollectionAssert.AreEqual(new[] { "13" }, reason.With!.ToArray());
        }

        [TestMethod]
        public void Reasons_add_up_and_beyond_tolerance_wins_the_level()
        {
            Candidate ten = TableOf("10", 8, zone: Terrasse, dirtySince: Eight.AddMinutes(-10));

            Verdict verdict = Single(For(2, zone: Salle), ten);

            Assert.AreEqual(PlacementLevel.NotAdvised, verdict.Level);
            CollectionAssert.AreEquivalent(
                new[] { PlacementReasonKind.BeyondTolerance, PlacementReasonKind.NeedsCleaning, PlacementReasonKind.OtherZone },
                verdict.Reasons.Select(r => r.Kind).ToArray());
        }

        [TestMethod]
        public void The_tested_interval_starts_now_once_the_start_has_passed()
        {
            DateTime now = Eight.AddMinutes(30);

            Assert.AreEqual((Eight.AddMinutes(60), Eight.AddMinutes(180)), IntervalOf(Eight.AddMinutes(60), 120, now));
            // Commencée il y a 30 min : le passé ne compte plus
            Assert.AreEqual((now, Eight.AddMinutes(120)), IntervalOf(Eight, 120, now));
            // Une table assise qui déborde déjà se cherche pour le quart d'heure à venir
            Assert.AreEqual((Eight.AddMinutes(200), Eight.AddMinutes(215)), IntervalOf(Eight, 120, Eight.AddMinutes(200)));
        }
    }
}
