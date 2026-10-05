namespace TUROAPI.Test
{
    /// <summary>
    /// Table virtuelle de deux tables ou plus (MOD-02, MOD-03) : jamais supprimée une fois publiée. L'éditeur décide
    /// de ce qui est collé en ce moment (IsActive) ; une table n'est que dans une combinaison active (§3.4)
    /// </summary>
    [TestClass]
    public sealed class CombinationTests
    {
        private sealed record Arranged(HttpClient Admin, ZoneResponse Salle, DraftTableItem T1, DraftTableItem T2);

        private static async Task<Arranged> ArrangeAsync()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            HttpClient admin = restaurant.AdminClient();
            ZoneResponse salle = await PlanApi.AddZoneAsync(admin, "Salle", 8, 6);
            // Deux tables collées bord à bord
            return new Arranged(admin, salle, PlanApi.Table(salle.Id, "T1", x: 1, y: 1), PlanApi.Table(salle.Id, "T2", x: 1.8, y: 1));
        }

        [TestMethod]
        public async Task New_combination_is_published_dormant_in_its_tables_room()
        {
            (HttpClient admin, ZoneResponse salle, DraftTableItem t1, DraftTableItem t2) = await ArrangeAsync();
            DraftCombinationItem banquette = PlanApi.Combination("Banquette", 7, t1.Id, t2.Id);

            List<ZoneResponse> plan = await PlanApi.SaveAndPublishAsync(admin,
                new FloorPlanDraftContent { Tables = [t1, t2], Combinations = [banquette] });

            CombinationResponse published = plan.Single().Combinations.Single();
            Assert.AreEqual(banquette.Id, published.Id);
            Assert.AreEqual(salle.Id, published.ZoneId);
            Assert.AreEqual("Banquette", published.Name);
            Assert.AreEqual(7, published.Capacity);
            Assert.IsFalse(published.IsActive);
            Assert.IsNull(published.ActivateAt);
            Assert.IsNull(published.DeactivateAt);
            CollectionAssert.AreEquivalent(new[] { t1.Id, t2.Id }, published.TableIds);
        }

        [TestMethod]
        public async Task Combination_joins_at_least_two_different_tables_of_the_plan()
        {
            (HttpClient admin, _, DraftTableItem t1, DraftTableItem t2) = await ArrangeAsync();
            List<Guid>[] wrongMembers = [[t1.Id], [t1.Id, t1.Id], [t1.Id, Guid.NewGuid()], [t1.Id, t2.Id, t1.Id]];

            foreach (List<Guid> members in wrongMembers)
            {
                DraftCombinationItem combination = PlanApi.Combination("C", 4, t1.Id, t2.Id);
                combination.TableIds = members;
                await ApiAssert.ErrorAsync(await PlanApi.SaveDraftAsync(admin,
                    new FloorPlanDraftContent { Tables = [t1, t2], Combinations = [combination] }),
                    HttpStatusCode.Forbidden, "InvalidModification", "combination C: it must join at least two different tables of the plan.");
            }
        }

        [TestMethod]
        public async Task Members_of_a_published_combination_are_fixed()
        {
            (HttpClient admin, ZoneResponse salle, DraftTableItem t1, DraftTableItem t2) = await ArrangeAsync();
            DraftTableItem t3 = PlanApi.Table(salle.Id, "T3", x: 4);
            DraftCombinationItem banquette = PlanApi.Combination("Banquette", 7, t1.Id, t2.Id);
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t1, t2, t3], Combinations = [banquette] });

            banquette.TableIds = [t1.Id, t3.Id];
            await ApiAssert.ErrorAsync(await PlanApi.SaveDraftAsync(admin,
                new FloorPlanDraftContent { Tables = [t1, t2, t3], Combinations = [banquette] }),
                HttpStatusCode.Forbidden, "InvalidModification", "combination Banquette: the tables of a published combination cannot change.");

            // Le même couple, dans l'autre ordre : rien ne change
            banquette.TableIds = [t2.Id, t1.Id];
            await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin,
                new FloorPlanDraftContent { Tables = [t1, t2, t3], Combinations = [banquette] }));
        }

        [TestMethod]
        public async Task Published_combination_cannot_be_removed()
        {
            (HttpClient admin, _, DraftTableItem t1, DraftTableItem t2) = await ArrangeAsync();
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent
            {
                Tables = [t1, t2],
                Combinations = [PlanApi.Combination("Banquette", 7, t1.Id, t2.Id)],
            });

            await ApiAssert.ErrorAsync(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent { Tables = [t1, t2] }),
                HttpStatusCode.Forbidden, "InvalidModification", "combination Banquette: a published combination cannot be removed from the plan.");
        }

        [TestMethod]
        public async Task Unpublished_combination_can_be_removed()
        {
            (HttpClient admin, _, DraftTableItem t1, DraftTableItem t2) = await ArrangeAsync();
            await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent
            {
                Tables = [t1, t2],
                Combinations = [PlanApi.Combination("Banquette", 7, t1.Id, t2.Id)],
            }));

            List<ZoneResponse> plan = await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t1, t2] });

            Assert.AreEqual(0, plan.Single().Combinations.Count);
        }

        [TestMethod]
        public async Task Same_set_of_tables_cannot_be_combined_twice()
        {
            (HttpClient admin, ZoneResponse salle, DraftTableItem t1, DraftTableItem t2) = await ArrangeAsync();
            DraftTableItem t3 = PlanApi.Table(salle.Id, "T3", x: 2.6, y: 1);

            await ApiAssert.ErrorAsync(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent
            {
                Tables = [t1, t2, t3],
                Combinations = [PlanApi.Combination("C1", 12, false, t1.Id, t2.Id, t3.Id), PlanApi.Combination("C2", 12, false, t3.Id, t1.Id, t2.Id)],
            }), HttpStatusCode.Forbidden, "InvalidModification", "another combination already joins these tables.");

            // Une chaîne et la paire qu'elle contient sont deux combinaisons différentes
            await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent
            {
                Tables = [t1, t2, t3],
                Combinations = [PlanApi.Combination("C1", 12, false, t1.Id, t2.Id, t3.Id), PlanApi.Combination("C2", 8, false, t1.Id, t2.Id)],
            }));
        }

        [TestMethod]
        public async Task Chain_of_three_tables_is_published_with_all_its_tables()
        {
            (HttpClient admin, ZoneResponse salle, DraftTableItem t1, DraftTableItem t2) = await ArrangeAsync();
            DraftTableItem t3 = PlanApi.Table(salle.Id, "T3", x: 2.6, y: 1);
            DraftCombinationItem chain = PlanApi.Combination("T1-T2-T3", 12, true, t1.Id, t2.Id, t3.Id);

            List<ZoneResponse> plan = await PlanApi.SaveAndPublishAsync(admin,
                new FloorPlanDraftContent { Tables = [t1, t2, t3], Combinations = [chain] });

            CombinationResponse published = plan.Single().Combinations.Single();
            Assert.IsTrue(published.IsActive);
            Assert.AreEqual(salle.Id, published.ZoneId);
            CollectionAssert.AreEquivalent(new[] { t1.Id, t2.Id, t3.Id }, published.TableIds);
        }

        [TestMethod]
        public async Task Table_belongs_to_one_active_combination_at_most()
        {
            (HttpClient admin, ZoneResponse salle, DraftTableItem t1, DraftTableItem t2) = await ArrangeAsync();
            DraftTableItem t3 = PlanApi.Table(salle.Id, "T3", x: 2.6, y: 1);
            DraftCombinationItem pair = PlanApi.Combination("T1-T2", 8, true, t1.Id, t2.Id);
            DraftCombinationItem chain = PlanApi.Combination("T1-T2-T3", 12, true, t1.Id, t2.Id, t3.Id);

            await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin,
                new FloorPlanDraftContent { Tables = [t1, t2, t3], Combinations = [pair, chain] }));
            await ApiAssert.ErrorAsync(await PlanApi.PublishAsync(admin), HttpStatusCode.Forbidden, "InvalidModification",
                "table T1: it belongs to two active combinations.");

            // T3 collée contre T1-T2 : la chaîne s'active, la paire se désactive et reste en mémoire
            pair.IsActive = false;
            List<ZoneResponse> plan = await PlanApi.SaveAndPublishAsync(admin,
                new FloorPlanDraftContent { Tables = [t1, t2, t3], Combinations = [pair, chain] });
            Assert.IsFalse(plan.Single().Combinations.Single(c => c.Id == pair.Id).IsActive);
            Assert.IsTrue(plan.Single().Combinations.Single(c => c.Id == chain.Id).IsActive);
        }

        [TestMethod]
        public async Task Changing_the_activity_clears_the_planned_dates_and_keeping_it_keeps_them()
        {
            (HttpClient admin, _, DraftTableItem t1, DraftTableItem t2) = await ArrangeAsync();
            DraftCombinationItem banquette = PlanApi.Combination("Banquette", 7, false, t1.Id, t2.Id);
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t1, t2], Combinations = [banquette] });
            DateTime planned = DateTime.UtcNow.AddHours(2);
            // Les rappels n'ont pas encore d'écran (service) : on pose les dates en base
            Task PlanDatesAsync() => TestApi.WithDbAsync(db => db.Combinations
                .Where(c => c.Id == banquette.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.ActivateAt, planned).SetProperty(c => c.DeactivateAt, planned)));
            async Task<CombinationResponse> PublishAsync() => (await PlanApi.SaveAndPublishAsync(admin,
                new FloorPlanDraftContent { Tables = [t1, t2], Combinations = [banquette] })).Single().Combinations.Single();

            // Même activité, autre nom : ce que le service avait prévu reste
            await PlanDatesAsync();
            banquette.Name = "Grande";
            CombinationResponse renamed = await PublishAsync();
            Assert.IsNotNull(renamed.ActivateAt);
            Assert.IsNotNull(renamed.DeactivateAt);

            // Collées dans l'éditeur : active, plus rien de prévu
            banquette.IsActive = true;
            CombinationResponse glued = await PublishAsync();
            Assert.IsTrue(glued.IsActive);
            Assert.IsNull(glued.ActivateAt);
            Assert.IsNull(glued.DeactivateAt);

            // Séparées dans l'éditeur : inactive, plus rien de prévu
            await PlanDatesAsync();
            banquette.IsActive = false;
            CombinationResponse separated = await PublishAsync();
            Assert.IsFalse(separated.IsActive);
            Assert.IsNull(separated.ActivateAt);
            Assert.IsNull(separated.DeactivateAt);
        }

        [TestMethod]
        public async Task Combination_name_and_seats_are_checked_at_publish()
        {
            (HttpClient admin, _, DraftTableItem t1, DraftTableItem t2) = await ArrangeAsync();
            (string Name, int Capacity, string Message)[] cases =
            [
                ("", 4, "combination sans nom: a combination needs a name."),
                (new string('C', 21), 4, "name cannot exceed 20 characters."),
                ("C", 0, "combination C: seats must be between 1 and 100."),
                ("C", 101, "combination C: seats must be between 1 and 100."),
                // Un nom ne désigne qu'une chose : table ou combinaison
                ("t1", 4, "another table or combination already has this name."),
            ];

            foreach ((string name, int capacity, string message) in cases)
            {
                await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent
                {
                    Tables = [t1, t2],
                    Combinations = [PlanApi.Combination(name, capacity, t1.Id, t2.Id)],
                }));
                await ApiAssert.ErrorAsync(await PlanApi.PublishAsync(admin), HttpStatusCode.Forbidden, "InvalidModification", message);
            }
            List<ZoneResponse> plan = await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent
            {
                Tables = [t1, t2],
                Combinations = [PlanApi.Combination("C", 100, t1.Id, t2.Id)],
            });
            Assert.AreEqual(100, plan.Single().Combinations.Single().Capacity);
        }

        [TestMethod]
        public async Task Moving_a_member_away_requires_deactivating_and_bringing_it_back_reuses_it()
        {
            (HttpClient admin, ZoneResponse salle, DraftTableItem t1, DraftTableItem t2) = await ArrangeAsync();
            ZoneResponse terrasse = await PlanApi.AddZoneAsync(admin, "Terrasse", 6, 4);
            DraftCombinationItem banquette = PlanApi.Combination("Banquette", 7, true, t1.Id, t2.Id);
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t1, t2], Combinations = [banquette] });

            // Encore active, ses tables dans deux salles : refusé à la publication
            t2.ZoneId = terrasse.Id;
            await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin,
                new FloorPlanDraftContent { Tables = [t1, t2], Combinations = [banquette] }));
            await ApiAssert.ErrorAsync(await PlanApi.PublishAsync(admin), HttpStatusCode.Forbidden, "InvalidModification",
                "combination Banquette: an active combination needs all its tables in the same room.");

            // L'éditeur la désactive en même temps : accepté, elle garde sa salle d'origine
            banquette.IsActive = false;
            List<ZoneResponse> split = await PlanApi.SaveAndPublishAsync(admin,
                new FloorPlanDraftContent { Tables = [t1, t2], Combinations = [banquette] });
            CombinationResponse inert = split.SelectMany(z => z.Combinations).Single();
            Assert.AreEqual(salle.Id, inert.ZoneId);
            Assert.IsFalse(inert.IsActive);

            t2.ZoneId = salle.Id;
            List<ZoneResponse> reunited = await PlanApi.SaveAndPublishAsync(admin,
                new FloorPlanDraftContent { Tables = [t1, t2], Combinations = [banquette] });
            CombinationResponse back = reunited.SelectMany(z => z.Combinations).Single();
            Assert.AreEqual(banquette.Id, back.Id);
            Assert.AreEqual(salle.Id, back.ZoneId);
            Assert.IsFalse(back.IsActive);
        }

        [TestMethod]
        public async Task Moving_both_members_moves_the_combination()
        {
            (HttpClient admin, _, DraftTableItem t1, DraftTableItem t2) = await ArrangeAsync();
            ZoneResponse terrasse = await PlanApi.AddZoneAsync(admin, "Terrasse", 6, 4);
            DraftCombinationItem banquette = PlanApi.Combination("Banquette", 7, t1.Id, t2.Id);
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t1, t2], Combinations = [banquette] });

            t1.ZoneId = terrasse.Id;
            t2.ZoneId = terrasse.Id;
            List<ZoneResponse> plan = await PlanApi.SaveAndPublishAsync(admin,
                new FloorPlanDraftContent { Tables = [t1, t2], Combinations = [banquette] });

            Assert.AreEqual(terrasse.Id, plan.SelectMany(z => z.Combinations).Single().ZoneId);
        }

        [TestMethod]
        public async Task Name_and_seats_of_a_published_combination_can_change()
        {
            (HttpClient admin, _, DraftTableItem t1, DraftTableItem t2) = await ArrangeAsync();
            DraftCombinationItem banquette = PlanApi.Combination("Banquette", 7, t1.Id, t2.Id);
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t1, t2], Combinations = [banquette] });

            banquette.Name = "  Grande  ";
            banquette.Capacity = 8;
            List<ZoneResponse> plan = await PlanApi.SaveAndPublishAsync(admin,
                new FloorPlanDraftContent { Tables = [t1, t2], Combinations = [banquette] });

            CombinationResponse renamed = plan.Single().Combinations.Single();
            Assert.AreEqual("Grande", renamed.Name);
            Assert.AreEqual(8, renamed.Capacity);
        }

        [TestMethod]
        public async Task Room_keeping_a_split_combination_cannot_be_deleted()
        {
            (HttpClient admin, ZoneResponse salle, DraftTableItem t1, DraftTableItem t2) = await ArrangeAsync();
            ZoneResponse terrasse = await PlanApi.AddZoneAsync(admin, "Terrasse", 6, 4);
            ZoneResponse cour = await PlanApi.AddZoneAsync(admin, "Cour", 6, 4);
            DraftCombinationItem banquette = PlanApi.Combination("Banquette", 7, t1.Id, t2.Id);
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t1, t2], Combinations = [banquette] });
            // Les deux tables partent dans deux salles différentes : la combinaison reste dans la salle, vide de tables
            t1.ZoneId = terrasse.Id;
            t2.ZoneId = cour.Id;
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t1, t2], Combinations = [banquette] });

            await ApiAssert.ErrorAsync(await admin.DeleteAsync($"api/restaurant/floor-plan/zones/{salle.Id}"),
                HttpStatusCode.Forbidden, "InvalidModification", "a combination belongs to this room, it cannot be deleted.");
        }
    }
}
