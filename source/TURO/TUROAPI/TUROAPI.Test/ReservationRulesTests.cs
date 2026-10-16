using TUROAPI.Services;
using static TUROAPI.Services.ReservationClock;

namespace TUROAPI.Test
{
    /// <summary>Règles pures des réservations : plages ouvertes, instant UTC, table des gestes, texte du journal</summary>
    [TestClass]
    public sealed class ReservationRulesTests
    {
        private static readonly TimeZoneInfo Paris = TimeZoneInfo.FindSystemTimeZoneById("Europe/Paris");
        private static readonly DateOnly Saturday = new(2026, 10, 10);

        private static Service Dinner(DayOfWeek day, int opening, int closing, int step = 30, int? duration = null) => new()
        {
            Id = Guid.NewGuid(), Day = day, Opening = new TimeOnly(opening, 0), Closing = new TimeOnly(closing, 0),
            SlotStep = step, OccupancyMode = OccupancyMode.Rotation, ExpectedDuration = duration,
        };

        [TestMethod]
        public void Windows_of_a_normal_day_are_its_services_with_their_duration()
        {
            List<Window> windows = WindowsOf(Saturday,
                [Dinner(DayOfWeek.Saturday, 19, 23, duration: 105), Dinner(DayOfWeek.Saturday, 12, 14), Dinner(DayOfWeek.Sunday, 19, 23)],
                [], defaultRotation: 120);

            CollectionAssert.AreEqual(new[]
            {
                new Window(new TimeOnly(12, 0), new TimeOnly(14, 0), 30, 120),
                new Window(new TimeOnly(19, 0), new TimeOnly(23, 0), 30, 105),
            }, windows);
        }

        [TestMethod]
        public void A_closed_day_has_no_window_and_modified_hours_replace_the_services()
        {
            var closed = new Closure { From = Saturday, To = Saturday.AddDays(1), Type = ClosureType.Closed };
            var modified = new Closure
            {
                From = Saturday, To = Saturday, Type = ClosureType.ModifiedHours,
                ReplacementHours = [new ReplacementHours { Opening = new TimeOnly(12, 0), Closing = new TimeOnly(15, 0) }],
            };
            Service[] services = [Dinner(DayOfWeek.Saturday, 19, 23, step: 15)];

            Assert.AreEqual(0, WindowsOf(Saturday, services, [closed], 120).Count);
            CollectionAssert.AreEqual(new[] { new Window(new TimeOnly(12, 0), new TimeOnly(15, 0), 15, 120) },
                WindowsOf(Saturday, services, [modified], 120));
            // Sans service ce jour-là, le pas de remplacement est de 30 min
            CollectionAssert.AreEqual(new[] { new Window(new TimeOnly(12, 0), new TimeOnly(15, 0), 30, 120) },
                WindowsOf(Saturday, [], [modified], 120));
        }

        [TestMethod]
        [DataRow(19, 0, true)]
        [DataRow(22, 59, true)]
        [DataRow(23, 0, false)]
        [DataRow(18, 59, false)]
        public void A_time_belongs_to_a_window_until_its_closing_excluded(int hour, int minute, bool inside)
        {
            Window dinner = new(new TimeOnly(19, 0), new TimeOnly(23, 0), 30, 120);

            Assert.AreEqual(inside, WindowAt([dinner], new TimeOnly(hour, minute)) != null);
        }

        [TestMethod]
        public void A_window_after_midnight_holds_the_small_hours()
        {
            Window late = new(new TimeOnly(22, 0), new TimeOnly(2, 0), 30, 120);

            Assert.IsNotNull(WindowAt([late], new TimeOnly(0, 30)));
            Assert.IsNull(WindowAt([late], new TimeOnly(2, 0)));
            Assert.IsNull(WindowAt([late], new TimeOnly(12, 0)));
        }

        [TestMethod]
        public void Slots_run_from_the_opening_to_the_last_one_before_closing()
        {
            CollectionAssert.AreEqual(
                new[] { new TimeOnly(19, 0), new TimeOnly(19, 30), new TimeOnly(20, 0), new TimeOnly(20, 30) },
                Slots(new Window(new TimeOnly(19, 0), new TimeOnly(21, 0), 30, 120)));
            CollectionAssert.AreEqual(
                new[] { new TimeOnly(23, 0), new TimeOnly(23, 30), new TimeOnly(0, 0), new TimeOnly(0, 30) },
                Slots(new Window(new TimeOnly(23, 0), new TimeOnly(1, 0), 30, 120)));
        }

        [TestMethod]
        public void Start_is_the_local_time_converted_to_utc()
        {
            Window dinner = new(new TimeOnly(19, 0), new TimeOnly(23, 0), 30, 120);

            DateTime start = StartUtc(Saturday, new TimeOnly(20, 0), dinner, Paris);

            // 10 octobre 2026 : heure d'été, UTC+2
            Assert.AreEqual(new DateTime(2026, 10, 10, 18, 0, 0, DateTimeKind.Utc), start);
            Assert.AreEqual(DateTimeKind.Utc, start.Kind);
            Assert.AreEqual(new TimeOnly(20, 0), LocalTime(start, Paris));
        }

        [TestMethod]
        public void A_meal_after_midnight_starts_the_next_calendar_day()
        {
            Window late = new(new TimeOnly(22, 0), new TimeOnly(2, 0), 30, 120);

            DateTime start = StartUtc(Saturday, new TimeOnly(0, 30), late, Paris);

            // Dimanche 11 à 00:30 heure de Paris, toujours rattaché au service du samedi (RES-02)
            Assert.AreEqual(new DateTime(2026, 10, 10, 22, 30, 0, DateTimeKind.Utc), start);
        }

        [TestMethod]
        public void Spring_forward_moves_a_missing_hour_one_hour_later()
        {
            Window night = new(new TimeOnly(22, 0), new TimeOnly(4, 0), 30, 120);

            // 29 mars 2026 : 02:30 n'existe pas à Paris ; 03:30 heure d'été = 01:30 UTC
            DateTime start = StartUtc(new DateOnly(2026, 3, 28), new TimeOnly(2, 30), night, Paris);

            Assert.AreEqual(new DateTime(2026, 3, 29, 1, 30, 0, DateTimeKind.Utc), start);
        }

        [TestMethod]
        public void Fall_back_takes_the_first_of_the_two_same_hours()
        {
            Window night = new(new TimeOnly(22, 0), new TimeOnly(4, 0), 30, 120);

            // 25 octobre 2026 : 02:30 existe deux fois ; la première est encore en heure d'été (UTC+2)
            DateTime start = StartUtc(new DateOnly(2026, 10, 24), new TimeOnly(2, 30), night, Paris);

            Assert.AreEqual(new DateTime(2026, 10, 25, 0, 30, 0, DateTimeKind.Utc), start);
        }

        [TestMethod]
        [DataRow(ReservationGesture.Accept, ReservationStatus.Pending, ReservationStatus.Confirmed)]
        [DataRow(ReservationGesture.Refuse, ReservationStatus.Pending, ReservationStatus.Cancelled)]
        [DataRow(ReservationGesture.Arrive, ReservationStatus.Confirmed, ReservationStatus.Seated)]
        [DataRow(ReservationGesture.Release, ReservationStatus.Seated, ReservationStatus.Finished)]
        [DataRow(ReservationGesture.NoShow, ReservationStatus.Confirmed, ReservationStatus.NoShow)]
        [DataRow(ReservationGesture.Cancel, ReservationStatus.Pending, ReservationStatus.Cancelled)]
        [DataRow(ReservationGesture.Cancel, ReservationStatus.Confirmed, ReservationStatus.Cancelled)]
        [DataRow(ReservationGesture.Reopen, ReservationStatus.NoShow, ReservationStatus.Confirmed)]
        [DataRow(ReservationGesture.Reopen, ReservationStatus.Finished, ReservationStatus.Seated)]
        [DataRow(ReservationGesture.Reopen, ReservationStatus.Cancelled, ReservationStatus.Confirmed)]
        public void Each_gesture_leads_from_its_status_to_the_next(ReservationGesture gesture, ReservationStatus from, ReservationStatus to)
        {
            Assert.AreEqual(to, ReservationTransitions.Target(gesture, from));
        }

        [TestMethod]
        public void Reopening_a_refused_request_gives_back_a_request()
        {
            Assert.AreEqual(ReservationStatus.Pending,
                ReservationTransitions.Target(ReservationGesture.Reopen, ReservationStatus.Cancelled, closedByRefusal: true));
        }

        [TestMethod]
        public void Every_other_pair_is_refused()
        {
            var allowed = new HashSet<(ReservationGesture, ReservationStatus)>
            {
                (ReservationGesture.Accept, ReservationStatus.Pending), (ReservationGesture.Refuse, ReservationStatus.Pending),
                (ReservationGesture.Arrive, ReservationStatus.Confirmed), (ReservationGesture.Release, ReservationStatus.Seated),
                (ReservationGesture.NoShow, ReservationStatus.Confirmed), (ReservationGesture.Cancel, ReservationStatus.Pending),
                (ReservationGesture.Cancel, ReservationStatus.Confirmed), (ReservationGesture.Reopen, ReservationStatus.NoShow),
                (ReservationGesture.Reopen, ReservationStatus.Finished), (ReservationGesture.Reopen, ReservationStatus.Cancelled),
            };
            foreach (ReservationGesture gesture in Enum.GetValues<ReservationGesture>())
            {
                foreach (ReservationStatus status in Enum.GetValues<ReservationStatus>())
                {
                    if (!allowed.Contains((gesture, status)))
                    {
                        Assert.IsNull(ReservationTransitions.Target(gesture, status), $"{gesture} depuis {status}");
                    }
                }
            }
        }

        [TestMethod]
        public void Each_gesture_writes_its_own_journal_line()
        {
            CollectionAssert.AreEqual(
                new[] { EventType.Acceptance, EventType.Refusal, EventType.Arrival, EventType.Release, EventType.NoShow, EventType.Cancellation, EventType.Reopening },
                Enum.GetValues<ReservationGesture>().Select(ReservationTransitions.EventOf).ToArray());
        }

        [TestMethod]
        [DataRow(ReservationSource.Phone, "téléphone")]
        [DataRow(ReservationSource.WalkIn, "sur place")]
        [DataRow(ReservationSource.Platform, "plateforme")]
        [DataRow(ReservationSource.Other, "autre")]
        [DataRow(ReservationSource.Web, "web")]
        [DataRow(ReservationSource.Google, "google")]
        public void Sources_are_named_in_french(ReservationSource source, string label)
        {
            Assert.AreEqual(label, ReservationJournal.SourceLabel(source));
        }

        [TestMethod]
        [DataRow(105, "1 h 45")]
        [DataRow(120, "2 h")]
        [DataRow(45, "45 min")]
        [DataRow(65, "1 h 05")]
        public void Durations_read_like_the_screen(int minutes, string text)
        {
            Assert.AreEqual(text, ReservationJournal.Duration(minutes));
        }

        private static readonly Guid Salle = Guid.NewGuid();
        private static readonly Guid Terrasse = Guid.NewGuid();

        [TestMethod]
        public void Changes_list_what_moved_in_a_fixed_order()
        {
            var before = new ReservationJournal.Fields(new DateOnly(2026, 8, 20), new TimeOnly(20, 0), 4, 105, null, Salle, "Salle");
            var after = new ReservationJournal.Fields(new DateOnly(2026, 8, 21), new TimeOnly(20, 30), 6, 120, "anniversaire", Terrasse, "Terrasse");

            Assert.AreEqual(
                "jeu. 20/08 → ven. 21/08 · 20:00 → 20:30 · 4 → 6 couverts · durée 1 h 45 → 2 h · salle : Salle → Terrasse · commentaire modifié",
                ReservationJournal.Changes(before, after));
        }

        [TestMethod]
        public void No_change_writes_nothing_and_an_unset_zone_reads_indifferent()
        {
            var fields = new ReservationJournal.Fields(new DateOnly(2026, 8, 20), new TimeOnly(20, 0), 4, 105, "x", null, null);

            Assert.IsNull(ReservationJournal.Changes(fields, fields));
            Assert.AreEqual("salle : indifférent → Salle", ReservationJournal.Changes(fields, fields with { ZoneId = Salle, ZoneName = "Salle" }));
        }
    }
}
