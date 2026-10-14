using TUROAPI.Services;
using static TUROAPI.Services.CombinationSchedule;

namespace TUROAPI.Test
{
    /// <summary>§3.4 sans base : quand rapprocher, quand séparer, et ce que retiennent les réponses</summary>
    [TestClass]
    public sealed class CombinationScheduleTests
    {
        private static readonly DateTime Now = new(2026, 10, 10, 18, 0, 0, DateTimeKind.Utc);
        private static readonly DateOnly Day = new(2026, 10, 10);
        private static readonly Guid T12 = Guid.NewGuid();
        private static readonly Guid T13 = Guid.NewGuid();
        private static readonly Guid T14 = Guid.NewGuid();
        private static readonly Guid Combination = Guid.NewGuid();

        private static State Dormant() => new(Combination, false, [T12, T13], null, null, false);
        private static State Glued(Guid? keep = null, Guid? noShow = null, bool noShowStands = true) =>
            new(Combination, true, [T12, T13], keep, noShow, noShowStands);

        private static Hold OnCombination(int fromMinutes, int toMinutes, Guid? reservation = null) =>
            new(reservation ?? Guid.NewGuid(), Day, Combination, [T12, T13], Now.AddMinutes(fromMinutes), Now.AddMinutes(toMinutes), "Nguyen", 8);

        private static Hold OnTable(Guid table, int fromMinutes, int toMinutes, Guid? reservation = null, Guid? viaCombination = null) =>
            new(reservation ?? Guid.NewGuid(), Day, viaCombination, viaCombination == null ? [table] : [table, T14],
                Now.AddMinutes(fromMinutes), Now.AddMinutes(toMinutes), "Moreau", 4);

        [TestMethod]
        public void A_dormant_combination_without_reservation_has_nothing_planned()
        {
            Assert.AreEqual(new Planned(null, null, null, null), Of(Dormant(), [OnTable(T12, 30, 150)], Now));
        }

        [TestMethod]
        public void A_dormant_combination_is_planned_for_its_next_reservation()
        {
            Planned planned = Of(Dormant(), [OnCombination(-180, -60), OnCombination(210, 330), OnCombination(90, 210)], Now);

            Assert.AreEqual(Now.AddMinutes(90), planned.ActivateAt);
            Assert.IsNull(planned.DeactivateAt);
        }

        [TestMethod]
        public void A_reservation_already_started_gives_an_immediate_approach()
        {
            Assert.AreEqual(Now.AddMinutes(-20), Of(Dormant(), [OnCombination(-20, 100)], Now).ActivateAt);
        }

        [TestMethod]
        public void Glued_tables_nobody_claims_stay_glued()
        {
            Assert.AreEqual(new Planned(null, null, null, null), Of(Glued(), [OnCombination(30, 150)], Now));
        }

        [TestMethod]
        public void A_member_table_booked_alone_asks_to_separate_after_the_series()
        {
            Planned planned = Of(Glued(), [OnCombination(0, 90), OnCombination(90, 210), OnTable(T12, 240, 360), OnCombination(400, 500)], Now);

            Assert.AreEqual(Now.AddMinutes(210), planned.DeactivateAt);
            Assert.IsNull(planned.ActivateAt);
        }

        [TestMethod]
        public void A_claim_through_another_combination_counts()
        {
            Planned planned = Of(Glued(), [OnTable(T13, 60, 180, viaCombination: Guid.NewGuid())], Now);

            Assert.AreEqual(Now, planned.DeactivateAt);
        }

        [TestMethod]
        public void Without_a_series_before_the_claim_the_separation_is_due_now()
        {
            Assert.AreEqual(Now, Of(Glued(), [OnTable(T12, 120, 240)], Now).DeactivateAt);
        }

        [TestMethod]
        public void The_claim_kept_together_is_ignored_until_another_claims()
        {
            Guid moreau = Guid.NewGuid();
            Hold kept = OnTable(T12, 120, 240, reservation: moreau);

            Planned quiet = Of(Glued(keep: moreau), [kept], Now);
            Assert.IsNull(quiet.DeactivateAt);
            Assert.AreEqual(moreau, quiet.KeepGluedFor);

            Planned again = Of(Glued(keep: moreau), [kept, OnTable(T13, 150, 270)], Now);
            Assert.AreEqual(Now, again.DeactivateAt);
            Assert.AreEqual(moreau, again.KeepGluedFor);
        }

        [TestMethod]
        public void The_kept_claim_is_forgotten_once_it_no_longer_claims()
        {
            Assert.IsNull(Of(Glued(keep: Guid.NewGuid()), [], Now).KeepGluedFor);
        }

        [TestMethod]
        public void The_no_show_question_holds_only_while_the_no_show_stands()
        {
            Guid nguyen = Guid.NewGuid();

            Assert.AreEqual(nguyen, Of(Glued(noShow: nguyen), [], Now).SeparateAfterNoShowOf);
            Assert.IsNull(Of(Glued(noShow: nguyen, noShowStands: false), [], Now).SeparateAfterNoShowOf);
        }

        [TestMethod]
        public void A_dormant_combination_forgets_the_answers_of_glued_tables()
        {
            Planned planned = Of(Dormant() with { KeepGluedFor = Guid.NewGuid(), SeparateAfterNoShowOf = Guid.NewGuid(), NoShowStands = true }, [], Now);

            Assert.IsNull(planned.KeepGluedFor);
            Assert.IsNull(planned.SeparateAfterNoShowOf);
        }

        [TestMethod]
        public void The_claim_and_the_next_reservation_are_named_for_the_reminders()
        {
            Hold next = OnCombination(30, 150);
            Hold claim = OnTable(T12, 200, 300);

            Assert.AreEqual(next, NextOn(Dormant(), [OnCombination(200, 300), next], Now));
            Assert.AreEqual(claim, ClaimOf(Glued(), [OnTable(T13, 400, 500), claim], Now));
        }
    }
}
