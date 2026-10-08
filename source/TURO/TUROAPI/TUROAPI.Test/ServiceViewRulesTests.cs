using TUROAPI.Services;
using static TUROAPI.Services.ReservationClock;
using static TUROAPI.Services.ServiceView;

namespace TUROAPI.Test
{
    /// <summary>Règles pures de l'écran Service : quel service montrer, son état, ce qu'occupe une réservation, les chiffres des créneaux</summary>
    [TestClass]
    public sealed class ServiceViewRulesTests
    {
        private static readonly TimeZoneInfo Paris = TimeZoneInfo.FindSystemTimeZoneById("Europe/Paris");
        private static readonly DateOnly Saturday = new(2026, 10, 10);
        private static readonly Window Lunch = new(new TimeOnly(12, 0), new TimeOnly(14, 30), 30, 90);
        private static readonly Window Dinner = new(new TimeOnly(19, 0), new TimeOnly(23, 0), 30, 120);
        private static readonly Window LateDinner = new(new TimeOnly(19, 0), new TimeOnly(1, 0), 30, 120);

        private static DateTime At(DateOnly day, int hour, int minute = 0) =>
            TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(new TimeOnly(hour, minute)), Paris);

        /// <summary>Déjeuner et dîner tous les jours</summary>
        private static List<Window> EveryDay(DateOnly _) => [Lunch, Dinner];

        private static Reservation Booked(ReservationStatus status, DateTime start, int duration = 120,
            DateTime? seatedAt = null, DateTime? finishedAt = null, int covers = 2) => new()
        {
            Id = Guid.NewGuid(), Start = start, Duration = duration, Status = status, Covers = covers,
            SeatedAt = seatedAt, FinishedAt = finishedAt, ServiceDay = Saturday,
        };

        [TestMethod]
        public void A_service_is_upcoming_then_in_progress_then_finished()
        {
            Bounds bounds = BoundsOf(Saturday, Dinner, Paris);

            Assert.AreEqual(At(Saturday, 19), bounds.OpeningUtc);
            Assert.AreEqual(At(Saturday, 23), bounds.ClosingUtc);
            Assert.AreEqual(ServiceState.Upcoming, StateOf(bounds, At(Saturday, 18, 59)));
            Assert.AreEqual(ServiceState.InProgress, StateOf(bounds, At(Saturday, 19)));
            Assert.AreEqual(ServiceState.Finished, StateOf(bounds, At(Saturday, 23)));
        }

        [TestMethod]
        public void A_service_past_midnight_closes_the_next_day()
        {
            Bounds bounds = BoundsOf(Saturday, LateDinner, Paris);

            Assert.AreEqual(At(Saturday.AddDays(1), 1), bounds.ClosingUtc);
            Assert.AreEqual(ServiceState.InProgress, StateOf(bounds, At(Saturday.AddDays(1), 0, 30)));
        }

        [TestMethod]
        public void The_default_service_is_the_one_in_progress()
        {
            Assert.AreEqual(new Choice(Saturday, Dinner), DefaultService(At(Saturday, 20), Paris, EveryDay));
            Assert.AreEqual(new Choice(Saturday, Lunch), DefaultService(At(Saturday, 13), Paris, EveryDay));
        }

        [TestMethod]
        public void Between_two_services_the_default_is_the_next_one_of_the_day()
        {
            Assert.AreEqual(new Choice(Saturday, Dinner), DefaultService(At(Saturday, 16), Paris, EveryDay));
            Assert.AreEqual(new Choice(Saturday, Lunch), DefaultService(At(Saturday, 9), Paris, EveryDay));
        }

        [TestMethod]
        public void After_the_last_service_the_default_stays_on_it()
        {
            Assert.AreEqual(new Choice(Saturday, Dinner), DefaultService(At(Saturday, 23, 30), Paris, EveryDay));
        }

        [TestMethod]
        public void At_half_past_midnight_the_service_of_the_evening_before_is_still_in_progress()
        {
            DateOnly sunday = Saturday.AddDays(1);
            List<Window> lateEvenings(DateOnly _) => [LateDinner];

            Assert.AreEqual(new Choice(Saturday, LateDinner), DefaultService(At(sunday, 0, 30), Paris, lateEvenings));
        }

        [TestMethod]
        public void A_day_without_service_shows_the_next_open_day()
        {
            DateOnly tuesday = Saturday.AddDays(3);
            List<Window> fromTuesday(DateOnly day) => day < tuesday ? [] : [Dinner];

            Assert.AreEqual(new Choice(tuesday, Dinner), DefaultService(At(Saturday, 10), Paris, fromTuesday));
            Assert.IsNull(DefaultService(At(Saturday, 10), Paris, _ => []));
        }

        [TestMethod]
        public void A_chosen_day_opens_on_its_first_service_unless_it_is_today()
        {
            Assert.AreEqual(Lunch, WindowOfDay(Saturday, [Lunch, Dinner], At(Saturday.AddDays(-2), 20), Paris));
            Assert.AreEqual(Dinner, WindowOfDay(Saturday, [Lunch, Dinner], At(Saturday, 20), Paris));
            Assert.IsNull(WindowOfDay(Saturday, [], At(Saturday, 20), Paris));
        }

        [TestMethod]
        public void A_reservation_belongs_to_the_service_whose_hours_contain_its_start()
        {
            var dinner = new Choice(Saturday, LateDinner);
            List<Window> windows = [Lunch, LateDinner];

            Assert.IsTrue(BelongsTo(Booked(ReservationStatus.Confirmed, At(Saturday, 20)), dinner, windows, Paris));
            // 00:30 le dimanche, jour de service samedi : le dîner qui passe minuit
            Assert.IsTrue(BelongsTo(Booked(ReservationStatus.Confirmed, At(Saturday.AddDays(1), 0, 30)), dinner, windows, Paris));
            Assert.IsFalse(BelongsTo(Booked(ReservationStatus.Confirmed, At(Saturday, 12, 30)), dinner, windows, Paris));
            Reservation otherDay = Booked(ReservationStatus.Confirmed, At(Saturday, 20));
            otherDay.ServiceDay = Saturday.AddDays(7);
            Assert.IsFalse(BelongsTo(otherDay, dinner, windows, Paris));
        }

        [TestMethod]
        public void A_confirmed_reservation_occupies_its_planned_time()
        {
            Interval? interval = OccupationOf(Booked(ReservationStatus.Confirmed, At(Saturday, 20)), At(Saturday, 12));

            Assert.AreEqual(new Interval(At(Saturday, 20), At(Saturday, 22)), interval);
        }

        [TestMethod]
        public void A_seated_table_that_overruns_stays_occupied_until_now()
        {
            Reservation seated = Booked(ReservationStatus.Seated, At(Saturday, 20), seatedAt: At(Saturday, 20, 5));

            Assert.AreEqual(new Interval(At(Saturday, 20), At(Saturday, 22)), OccupationOf(seated, At(Saturday, 21)));
            Assert.AreEqual(new Interval(At(Saturday, 20), At(Saturday, 22, 40)), OccupationOf(seated, At(Saturday, 22, 40)));
        }

        [TestMethod]
        public void An_early_arrival_starts_the_occupation_when_they_sat_down()
        {
            Reservation seated = Booked(ReservationStatus.Seated, At(Saturday, 20), seatedAt: At(Saturday, 19, 45));

            Assert.AreEqual(At(Saturday, 19, 45), OccupationOf(seated, At(Saturday, 20))!.Start);
        }

        [TestMethod]
        public void A_finished_meal_ends_when_it_was_released_or_at_its_planned_end_if_closed_automatically()
        {
            Reservation released = Booked(ReservationStatus.Finished, At(Saturday, 20), seatedAt: At(Saturday, 20), finishedAt: At(Saturday, 21, 30));
            Reservation autoClosed = Booked(ReservationStatus.Finished, At(Saturday, 20), seatedAt: At(Saturday, 20));

            Assert.AreEqual(new Interval(At(Saturday, 20), At(Saturday, 21, 30)), OccupationOf(released, At(Saturday, 23)));
            Assert.AreEqual(new Interval(At(Saturday, 20), At(Saturday, 22)), OccupationOf(autoClosed, At(Saturday, 23)));
        }

        [TestMethod]
        [DataRow(ReservationStatus.Pending)]
        [DataRow(ReservationStatus.Cancelled)]
        [DataRow(ReservationStatus.NoShow)]
        public void A_request_a_cancellation_or_a_no_show_occupy_nothing(ReservationStatus status)
        {
            Assert.IsNull(OccupationOf(Booked(status, At(Saturday, 20)), At(Saturday, 20)));
        }

        [TestMethod]
        public void An_interval_covers_its_start_but_not_its_end()
        {
            var interval = new Interval(At(Saturday, 20), At(Saturday, 22));

            Assert.IsTrue(interval.Covers(At(Saturday, 20)));
            Assert.IsTrue(interval.Covers(At(Saturday, 21, 59)));
            Assert.IsFalse(interval.Covers(At(Saturday, 22)));
            Assert.IsFalse(interval.Covers(At(Saturday, 19, 59)));
        }

        [TestMethod]
        public void Slots_count_present_covers_taken_tables_and_flag_unplaced_arrivals()
        {
            Guid t1 = Guid.NewGuid(), t2 = Guid.NewGuid();
            DateTime now = At(Saturday, 12);
            Reservation placed = Booked(ReservationStatus.Confirmed, At(Saturday, 19), covers: 4);
            Reservation group = Booked(ReservationStatus.Confirmed, At(Saturday, 20), covers: 6);
            Reservation unplaced = Booked(ReservationStatus.Confirmed, At(Saturday, 19, 45), covers: 2);
            Reservation request = Booked(ReservationStatus.Pending, At(Saturday, 19), covers: 8);
            List<Booking> bookings =
            [
                new(placed, OccupationOf(placed, now), true, [t1]),
                new(group, OccupationOf(group, now), true, [t1, t2]),
                new(unplaced, OccupationOf(unplaced, now), false, []),
                new(request, OccupationOf(request, now), false, []),
            ];

            List<SlotFigures> slots = SlotsOf(new Choice(Saturday, Dinner), Paris, bookings);

            Assert.AreEqual(8, slots.Count);
            Assert.AreEqual(new SlotFigures(new TimeOnly(19, 0), At(Saturday, 19), 4, 1, false), slots[0]);
            // 19:30 : l'arrivée non placée de 19:45 commence dans ce créneau
            Assert.AreEqual(new SlotFigures(new TimeOnly(19, 30), At(Saturday, 19, 30), 4, 1, true), slots[1]);
            // 20:00 : le groupe sur T1 + T2 rejoint la table de 19:00 ; le non placé compte ses couverts, pas de table
            Assert.AreEqual(new SlotFigures(new TimeOnly(20, 0), At(Saturday, 20), 12, 2, false), slots[2]);
            Assert.AreEqual(new SlotFigures(new TimeOnly(22, 30), At(Saturday, 22, 30), 0, 0, false), slots[7]);
        }

        [TestMethod]
        public void Slots_of_a_service_past_midnight_continue_the_next_day()
        {
            List<SlotFigures> slots = SlotsOf(new Choice(Saturday, LateDinner), Paris, []);

            Assert.AreEqual(12, slots.Count);
            Assert.AreEqual(new TimeOnly(0, 30), slots[^1].Time);
            Assert.AreEqual(At(Saturday.AddDays(1), 0, 30), slots[^1].At);
        }
    }
}
