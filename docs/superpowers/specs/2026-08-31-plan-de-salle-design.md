# TableUp — Conception : plan de salle & gestion des tables

**Date :** 31 août 2026
**Statut :** conception complète. Les douze sections sont validées ; les points ouverts du §13 restent à trancher, la plupart au moment de l'implémentation.
**Source :** `CAHIER_DES_CHARGES_RESTAURATEUR.md`, niveau 1 point B (agenda + plan de salle visuel).
**Maquettes :** `.superpowers/brainstorm/*/content/*.html`

---

## 1. Décisions verrouillées

| Sujet | Décision |
|---|---|
| Écran principal | Le plan de salle temps réel, l'agenda à côté |
| Représentation | **Plan spatial fidèle** — vraies positions, vraies formes, vraies tailles |
| Composition | Frise horaire en bandeau + plan + colonne « À placer » repliable |
| Appareils | Tablette (Surface Pro 7) **et** bureau. Téléphone hors périmètre |
| Cible | Petits restaurants par défaut, structure prévue pour tenir la montée en taille |
| Direction visuelle | **G — L'ardoise chaude** : interface beige, plan en ardoise, numéros à la craie |
| Typographie | **Exo 2** (interface) + **Caveat** (craie), toutes deux sur Google Fonts |
| Statuts de table | 4 couleurs **+ forme du contour**, légende affichée en permanence |
| « En retard » | Pas un statut : un cercle corail par-dessus le bleu « réservée » |
| Salles / étages | Onglets au-dessus du plan, avec compteurs et badges |
| Placement | Toutes les possibilités montrées : `✓` vert plein / `~✓` vert-jaune |
| Confirmation | Popup **uniquement** si la table a une réserve, avec la raison explicite |
| Tables jointes | Table virtuelle réservable, créée par accolage dans l'éditeur ou en service |
| Édition du plan | Bouton crayon dans la ligne d'onglets, visible en mode admin seulement |
| Structure de navigation | 5 entrées de rail. **Plan et Agenda sont deux vues de « Service »**, pas deux écrans |
| Onglet « Liste » | **Écarté** — l'écran Réservations remplit déjà ce rôle |
| Rail | Icônes seules, pas de bouton de repli. Survol (PC) / 3 s (tablette). **Recouvre, ne pousse pas** |
| Rail sur tablette | Un contact **navigue** ; les libellés confirment. Déployé au premier lancement |
| Changement de service | En touchant la date. Popup calendrier + services du jour, avec leur état |
| Atterrissage | Plan si un service est en cours, Accueil sinon |
| Rôles | Service et Administrateur |
| Statuts de réservation | 6 badges. **Teinte = cours normal, plein = anomalie, gris = clos.** Une seule couleur forte par ligne |
| Source | Demandée **uniquement** à la création manuelle. Déduite du point d'entrée partout ailleurs |
| Actions rapides | Colonne « Action » dans la liste : `✓`/`✗`, Placer, Arrivée, Libérer |
| Action principale de la fiche | **Une seule**, déduite de l'état. L'orange est réservé à ce qui reste à faire |
| Position des boutons | **Jamais réordonnés selon le contexte** — une position stable vaut mieux qu'une hiérarchie juste |
| Fiche ouverte sur le plan | Remplace la colonne, **pas de voile**, et le plan se recompose (seule exception à la règle du recouvrement) |
| Glisser une demande en attente | Accepte **et** place d'un geste |
| Gestes conséquents | Pas de popup : **envoi différé de 8 s + bandeau « Annuler »** |
| Journal | Une ligne horodatée et signée par événement, sur chaque réservation |
| Identité client | **Le téléphone est la clé.** Un walk-in sans numéro ne crée aucune fiche client |
| Compteurs client | **Stockés**, pas déduits — mais toute sortie de `no_show` décrémente, et le journal reste l'autorité |
| Fusion de fiches | **Uniquement sur une clé exacte** (téléphone ou e-mail). Jamais sur le nom |
| Suppression d'un client | **Anonymisation** : les réservations survivent, les comptes restent justes |
| Notes client | Deux champs : `allergies` (structuré, affiché) et `notes_internes` (ne sort jamais du logiciel) |
| Fiches client et réservation | **Un seul panneau**, elles se remplacent, la flèche nomme d'où l'on vient. Profondeur 2 |
| Recomposition du plan | **Le plan se recompose uniquement quand quelque chose y est désigné.** Sinon le panneau survole |
| Ordre des champs du formulaire | Celui de l'appel téléphonique : couverts, date, heure, puis identité |
| Disponibilité | Une **bande d'heures** libre / serré / complet, jamais un menu déroulant |
| « Complet » | **Avertit, ne bloque jamais.** Un logiciel qui dit non se fait contourner sur papier |
| Walk-in | Pas le formulaire : **touche une table libre → « Asseoir maintenant »** |
| Réglages | **Aucun réglage posé nu** : chacun affiche sa conséquence, souvent avec un aperçu sur les vraies tables |
| Calendrier des exceptions | **Un jour normal ne porte aucune marque.** Le défaut doit être muet pour que l'exception crie |
| Fermer un jour occupé | Le panneau **confronte** les réservations concernées, numéros affichés, et offre « je les appelle » |
| Fermeture exceptionnelle | **Deux champs** : motif interne (jamais envoyé) et message client (pré-rédigé, bon par défaut) |
| Conditions d'annulation | **Versionnées.** La réservation garde la version acceptée — un booléen ne prouve rien |
| Case d'acceptation | Jamais pré-cochée. **Texte vide → aucune case affichée** |
| Capacité | **Se résout sur les tables, jamais sur un total de couverts.** Un restaurant se remplit en tables |
| Mode d'occupation | **rotation** ou **service_unique**, réglé **par service** — deux modèles de restaurant, pas une préférence |
| Créneau libéré par une prévision | S'affiche **« serré », jamais « libre »** : le logiciel ne promet pas un départ qu'il n'a pas vu |
| Cadence et plafond de couverts | **Avertissements seulement**, désactivés par défaut. Non prioritaires en v1 |
| Création d'une table | **Glisser depuis la palette sur le plan**, puis remplir le panneau de droite. Jamais de table sans emplacement |
| Plan à l'échelle | Canevas en **mètres**, grille 25 cm, tout aimanté. Un plan qui ne ressemble pas à la salle ne sert à rien |
| Décor | Murs, porte, bar, passe : **des repères, pas de la décoration** |
| Éditeur de plan | **Brouillon puis publication** — la seule exception à l'action immédiate. Le service en cours ne bouge pas |
| Fond de plan | Image décalquable, **calibrée sur une longueur connue**, jamais publiée |
| Widget : créneau serré | **Toujours une demande**, jamais confirmé d'office. Barrière structurelle, non réglable |
| Widget : mode service unique | **Pas de « sur demande »** — il y a de la place ou il n'y en a pas |
| Widget : rapprochement | Invisible pour le client. On ne lui fait pas porter une incertitude dont le restaurant est maître |
| Widget : créneau complet | **Disparaît**, ne s'affiche pas barré. L'inverse du §8.4, où le restaurateur peut forcer |
| Widget : vie privée | **Ne révèle jamais** ce que le restaurant sait d'un numéro. Rattachement silencieux côté serveur |
| Widget : confirmation auto | Un simple oui/non. **Aucun seuil de couverts** — un total de couverts ne dit rien de la place réelle (§9.4) |
| Accueil | **Deux sections, une seule porte des boutons.** « À traiter » doit pouvoir être vide |
| Ordre de « À traiter » | **La proximité dans le temps.** Le service en cours est encadré et surélevé |
| Tables non libérées | **Closes à l'ouverture du service suivant**, pas à la fermeture théorique. `termine_a` null, `cloture_auto` vrai |
| Marques de réservation | **Voyagent avec la réservation** partout où elle apparaît. Pas de bloc de veille séparé |
| Icônes de sens | **La couleur porte l'alerte, le dessin porte le sujet.** Allergie = un couvert, blanc sur corail |
| Allergies en service | **Un bouton « Allergies » + fenêtre flottante**, jamais un accusé de lecture. La fenêtre se ferme, la pastille reste |
| Modification de plan | **N'annule jamais une réservation.** Au pire elle retombe dans « À placer » |

---

## 2. Identité visuelle

### 2.1 Principe

L'interface reprend le système que le restaurateur avait déjà dessiné (beige chaud, orange, coins ronds, italiques pour le secondaire). Le **plan** seul devient une ardoise sombre : un objet posé dans la salle claire. Les numéros de table et les noms de zone sont à la craie.

La craie ne touche **jamais** une donnée qu'on lit vite : heures, couverts, noms de clients restent en Exo 2.

### 2.2 Palette

| Rôle | Valeur |
|---|---|
| Fond application | `#EDE8E2` |
| Surfaces (rail, cartes, créneaux) | `#FBFAF8` |
| Bordures | `#DFD9D1` / `#E4DED6` |
| Texte principal | `#3A3A38` |
| Texte secondaire | `#9A968F` |
| **Orange — interaction uniquement** | `#F5A04A` |
| Plan (ardoise) | `#2E2A26`, bordure `#241F1B` |
| Craie | `#B6AC9C` |

**Règle absolue : l'orange ne code jamais un statut.** Il signale la sélection, l'élément actif, l'action. Si une table était orange, on ne saurait plus si c'est parce qu'elle est occupée ou parce qu'elle est sélectionnée.

### 2.3 Couleurs de statut (sur l'ardoise)

| Statut | Fond | Contour | Texte | Forme du trait |
|---|---|---|---|---|
| Libre | `rgba(255,255,255,.05)` | `#6A6055` | `#C9BFB0` | plein |
| Réservée | `rgba(120,190,230,.16)` | `#6FA8CC` | `#A8D5F0` | plein |
| Occupée | `rgba(230,120,95,.20)` | `#D9765C` | `#F2A48E` | plein |
| À nettoyer | `rgba(230,200,90,.14)` | `#C9AC52` | `#E3CE86` | **pointillé** |
| En retard | *(fond « réservée »)* | + anneau `#D9765C` 2 px | — | plein |

### 2.4 Couleurs d'aide au placement

Elles n'existent que pendant un placement, puis disparaissent. Elles n'entrent donc jamais en concurrence avec les statuts.

| Niveau | Halo | Badge |
|---|---|---|
| Parfaite | `#5FBF7A`, 3 px | `✓` vert plein |
| Possible, à réserve | `#B3BE4E`, 3 px | `~✓` vert-jaune |
| Réservations en attente (sur un créneau) | — | `!` violet `#5B4A8A` |

**Le contour de la table ne change jamais** : il appartient au statut. Seul le halo porte la compatibilité. Une table propre mais trop grande garde son trait plein ; une table à nettoyer garde son pointillé. Les deux reçoivent le même halo vert-jaune.

Le badge `~✓` fait déjà une différence de forme, pas seulement de couleur — nécessaire pour un daltonien deutan et pour un écran en plein soleil en terrasse.

### 2.5 Typographie

| Rôle | Police |
|---|---|
| Horloge, chiffres | Exo 2 · 700 |
| Courant | Exo 2 · 600 |
| Secondaire | Exo 2 · italique 300–400, gris |
| Numéros de table, noms de zone | Caveat · 600–700 |

Icônes : SVG dessinés, **jamais d'emoji**. Les emoji changent de dessin selon l'OS, ne se recolorent pas, et jurent avec l'ardoise.

**Règle des icônes porteuses de sens : la couleur porte l'alerte, le dessin porte le sujet.** À 15 px une icône ne peut dire qu'une chose. Le corail signifiant déjà « attention, ça coûte » partout (§6.2, §6.6), le glyphe n'a pas à porter l'avertissement en plus du sujet — ce qui autorise un dessin plus simple, donc lisible réduit.

**Allergie : un couvert** (fourchette et couteau), blanc sur corail. Trois traits verticaux, ce qui résiste le mieux à la réduction, et aucun autre élément du logiciel ne lui ressemble. Écarté : le point d'exclamation, qui alerte sans rien dire et se confondrait avec toute autre alerte future ; l'épi de blé barré, qui signifie *sans gluten* et non *allergie*.

---

## 3. Modèle de données

### 3.1 Entités

#### Restaurant — le locataire

Toutes les requêtes sont filtrées par `restaurant_id`. C'est la frontière du multi-tenant.

| Champ | Note |
|---|---|
| `id` | |
| `nom` | |
| `fuseau` | `Europe/Paris` |
| `rotation_defaut` | Durée par défaut d'un repas, en minutes (ex. 105) |
| `tolerance_places` | Places en trop tolérées avant de dégrader en `~✓` (ex. 2) |
| `retard_grace` | Minutes avant d'afficher le cercle « en retard » (ex. 15) |
| `rappel_actif`, `rappel_delai_h` | Rappel J-1. Le désactiver rend le compteur de no-show plus sévère qu'il n'est juste (§9.9) |
| `confirmation_auto` | Confirmation automatique d'une réservation web sur un créneau franchement libre (§11.3) |


Tous les champs de comportement — de `rotation_defaut` à `confirmation_auto` — se règlent au §9 et gouvernent les sections 5 à 8.

#### Zone

| Champ | Note |
|---|---|
| `id`, `restaurant_id` | |
| `nom` | Salle, Terrasse, Étage |
| `ordre` | Ordre des onglets |
| `largeur`, `hauteur` | **En mètres** — le plan est à l'échelle de la vraie salle (§10.3). Le rendu convertit, la donnée reste métrique |

#### Table — physique, indivisible

Créée en **glissant un type depuis la palette sur le plan**, puis décrite dans le panneau de droite (§10.2). Elle naît donc toujours avec un emplacement.

| Champ | Note |
|---|---|
| `id`, `zone_id` | |
| `nom` | « 7 », « T12 », « Bar 3 » |
| `capacite` | |
| `forme` | ronde / carrée / rectangulaire |
| `x`, `y`, `l`, `h`, `rotation` | Toujours portées par la table physique, y compris quand elle est liée |
| `a_nettoyer_depuis` | **Le seul état physique stocké** (voir §3.2) |
| `active` | Une table se **désactive**, ne se supprime jamais : une réservation de 2024 mentionne « T7 » (§10.3) |

#### Décor — non réservable

Les repères de la salle. Sans eux, huit rectangles gris ne sont pas une salle (§10.3).

| Champ | Note |
|---|---|
| `id`, `zone_id` | |
| `type` | mur · porte · bar · passe · pilier · escalier · autre |
| `libelle` | Optionnel, affiché sur la forme |
| `x`, `y`, `l`, `h`, `rotation` | Comme une table |

Aucune capacité, jamais proposé au placement, jamais cliquable en service.

#### Combinaison — la table virtuelle

Créée par accolage dans l'éditeur, ou à la première utilisation en service. **Jamais supprimée, seulement désactivée.**

| Champ | Note |
|---|---|
| `id`, `zone_id` | |
| `nom` | « 12-13 » proposé automatiquement, modifiable |
| `capacite` | **Saisie, pas calculée** — deux rondes accolées perdent souvent une place au raccord |
| `tables[]` | L'ensemble des tables physiques membres |
| `active` | Collées **en ce moment**, oui ou non |
| `a_active_le` | Quand le rapprochement est prévu — déclenche un rappel |
| `a_desactive_le` | Quand la séparation est prévue — déclenche un rappel |

Aucune géométrie propre : la combinaison se dessine à partir des `x/y` de ses membres.

#### Service

| Champ | Note |
|---|---|
| `id`, `restaurant_id` | |
| `jour`, `ouverture`, `fermeture` | Par jour de semaine |
| `pas_creneau` | 15 ou 30 min → détermine la frise |
| `mode_occupation` | **rotation** ou **service_unique** — décide si une table se libère avant la fin du service (§9.4) |
| `duree_prevue` | Hérite de `rotation_defaut`, surchargeable par service |
| `cadence_max`, `plafond_couverts` | Avertissements de cuisine, nullables. **Ne décident jamais de la disponibilité** (§9.4) |

La disponibilité se résout **sur les tables**, jamais sur un total de couverts : une réservation de 2 sur une table de 4 consomme une table et deux couverts (§9.4).

#### Fermeture exceptionnelle

| Champ | Note |
|---|---|
| `id`, `restaurant_id` | |
| `du`, `au`, `type` | |
| `horaires_remplacement` | Optionnel |
| `motif`, `motif_detail` | Pastille + texte libre. **Ne sortent jamais du logiciel** (§9.7) |
| `message_client` | Ce que les clients concernés reçoivent. Pré-rédigé, modifiable |

`motif` et `message_client` sont deux champs et non un : « chef malade » est une information dont les clients n'ont pas besoin. Même séparation qu'entre `allergies` et `notes_internes` au §7.5.

#### Réservation

| Champ | Note |
|---|---|
| `id`, `restaurant_id` | |
| `client_id` | **Nullable** — un client de passage ne crée aucune fiche client (§7.2, §8.7) |
| `debut` | UTC |
| `duree` | Minutes, initialisée depuis `rotation_defaut` |
| `jour_service` | **Date locale du service.** Un dîner commencé à 00:30 appartient à la veille |
| `couverts` | |
| `statut` | **en_attente** · confirmée · assise · terminée · no-show · annulée |
| `source` | web · telephone · sur_place · google · plateforme · autre *(obligatoire, cf. §6.3)* |
| `zone_souhaitee` | Optionnel |
| `rappel_envoye_le` | Rappel J-1 — volet D du cahier des charges |
| `confirme_par_client_le` | Réponse du client au rappel. Null ≠ no-show, mais alimente le risque |
| `annule_le`, `annule_par` | `client` ou `restaurant` — **ce n'est pas le même événement** |
| `conditions_version_id`, `conditions_acceptees_le` | Quelle version du texte le client a acceptée, et quand (§9.6). Null pour une création par le restaurant |
| `note` | « intérieur svp », allergies, occasion |
| `assis_a` | |
| `termine_a` | **Nullable** — une clôture automatique ne connaît pas l'heure de fin (§12.4) |
| `cloture_auto` | Vrai si la réservation a été close par l'ouverture du service suivant. Permet aux statistiques de durée d'**exclure ces lignes au lieu de les croire** |

`jour_service` n'est pas une commodité : sans lui, le chiffre d'affaires d'un samedi soir se retrouve à cheval sur deux dates et tous les rapports sont faux.

`en_attente` est le premier statut, et il manquait : le plan de salle porte déjà un badge « réservations en attente » et l'écran Réservations un bandeau « 3 demandes ». Sans ce statut, une demande non traitée est indiscernable d'une réservation ferme — et occupe une table qu'elle n'a pas encore gagnée.

`annule_par` n'est pas un détail d'archivage : sans lui, on ne distingue pas un client qui se désiste d'un restaurant qui refuse, et le compteur de fiabilité du client devient injuste.

#### Journal d'événements

Une ligne par fait, rattachée à une réservation. Voir §6.8.

| Champ | Note |
|---|---|
| `id`, `reservation_id` | |
| `horodatage` | |
| `type` | création · acceptation · refus · rappel · confirmation client · placement · déplacement · arrivée · libération · no-show · annulation · modification |
| `auteur_id` | Null si l'auteur est le système |
| `details` | Ce qui a changé, pour les modifications |

#### Affectation

Le lien entre une réservation et **une seule** entité réservable.

| Champ | Note |
|---|---|
| `id`, `reservation_id` | |
| `table_id` **ou** `combinaison_id` | Contrainte : exactement un des deux est rempli |
| `affecte_par`, `affecte_a` | |

Un groupe = une ligne. C'est la table virtuelle qui porte le rapprochement, pas une affectation multi-lignes.

#### Client — mini-CRM

Détaillé au §7.

| Champ | Note |
|---|---|
| `id`, `restaurant_id` | |
| `nom`, `email`, `telephone` | **Le téléphone est la clé d'identité**, l'e-mail la clé de secours (§7.2) |
| `allergies` | **Champ à part, jamais dans les notes.** C'est ce qui permet de l'épingler en corail sur la fiche réservation (§6.6) |
| `notes_internes` | Habitudes, occasions, « habitué », « VIP ». **Ne sort jamais du logiciel** — ni e-mail, ni widget |
| `tags` | vip · habitué · à surveiller · presse. **Manuels**, jamais calculés (§7.7) |
| `nb_visites`, `nb_noshow` | **Stockés**, écriture symétrique, cache redressable (§7.4) |
| `consentement_marketing`, `consentement_le` | Distinct de la réservation. Prévu au modèle, pas d'écran en v1 (§7.9) |
| `anonymise_le` | Suppression = anonymisation : les réservations survivent (§7.8) |

Il n'y a **pas** de champ `preferences` : le commentaire appartient à la réservation, ce qui doit durer va dans `notes_internes`.

Un **client de passage** ne crée aucune ligne dans cette table (§7.2).

#### Conditions d'annulation — versionnées

Une ligne par enregistrement du texte. Jamais modifiée, jamais supprimée : c'est ce qui rend le consentement vérifiable six mois plus tard (§9.6).

| Champ | Note |
|---|---|
| `id`, `restaurant_id` | |
| `version` | Incrémenté à chaque enregistrement |
| `texte` | Vide autorisé — dans ce cas le widget n'affiche **ni texte ni case** |
| `cree_le`, `cree_par` | |

#### Utilisateur

| Champ | Note |
|---|---|
| `id`, `restaurant_id` | |
| `role` | admin · staff |

Le bouton « Éditer le plan » n'existe que pour `admin`.

---

### 3.2 D'où vient la couleur d'une table

**Le statut n'est pas une colonne.** Une seule chose est stockée : `a_nettoyer_depuis`, parce que c'est un fait physique que personne ne peut déduire. Tout le reste se calcule à partir des **intervalles d'occupation** qui recouvrent l'heure choisie sur la frise.

C'est ce qui rend la frise possible. Avec un statut stocké, une table n'aurait qu'un seul état — celui de maintenant — et scruter à 21:00 ne montrerait rien.

À l'heure **T**, pour une table donnée :

1. Chercher l'affectation dont l'intervalle `[début, début + durée]` recouvre T.
2. Si son statut de réservation est **assise** → **occupée**.
3. Si c'est **confirmée** → **réservée**. Et si `maintenant > début + retard_grace`, ajouter l'anneau corail « en retard ».
4. Aucun intervalle ? Alors `a_nettoyer_depuis` décide : rempli → **à nettoyer**, vide → **libre**.

**Décision prise :** une table sale reste affichée « à nettoyer » sur **tous** les créneaux, y compris futurs, tant que personne ne l'a nettoyée. Le plan dit ce qui *est*, pas ce qu'on espère.

**Nettoyage implicite :** placer une réservation sur une table à nettoyer **la nettoie**. La table passe directement en « réservée ». Conséquence à connaître : elle quitte instantanément tout décompte de tables à redresser — le nettoyage devient la responsabilité de celui qui a placé.

---

### 3.3 Tables virtuelles : la règle de conflit

Dès qu'une combinaison est réservable comme une vraie table, plusieurs entités partagent le même bois.

> **Toute entité réservable se résout en un ensemble de tables physiques** — une table simple est un ensemble d'un élément.
> **Deux entités sont en conflit si leurs ensembles se croisent.**

Exemple : réserver `13-14` à 21:00 occupe `{13, 14}`. Donc à 21:00 :

| Entité | Ensemble | État |
|---|---|---|
| table 12 | {12} | libre |
| table 13 | {13} | prise |
| table 14 | {14} | prise |
| 12-13 | {12, 13} | prise — *parce qu'elle contient 13* |
| 13-14 | {13, 14} | Nguyen · 8p |

Une seule requête, valable pour toutes les combinaisons présentes et futures, y compris les chaînes `12-13-14`.

---

### 3.4 Tables virtuelles : cycle de vie

Deux horloges distinctes, qu'il ne faut pas confondre :

| | Ce que ça gouverne | Comment ça se calcule |
|---|---|---|
| `active` + les deux dates | Ce qui est physiquement collé **en ce moment** — donc ce que le plan dessine | État manuel, ne bascule que sur réponse humaine |
| Conflit de réservation | Ce qui est libre **à l'heure T** | Intervalle + intersection des ensembles (§3.3) |

Ce cloisonnement est nécessaire. Sans lui, réserver `12-13` pour 21:30 rendrait 12 et 13 indisponibles **immédiatement**, et deux clients attendus à 19:30 sur ces mêmes tables perdraient leur place.

#### Les quatre états

| # | État | `active` | `a_active_le` | `a_desactive_le` |
|---|---|---|---|---|
| 1 | Dormante | faux | null | null |
| 2 | Rapprochement prévu | faux | 21:30 | null |
| 3 | Liée | vrai | null | null |
| 4 | Séparation prévue | vrai | null | 23:15 |

#### Les transitions

| | Déclencheur |
|---|---|
| 1 → 2 | Une réservation est placée sur la combinaison. `a_active_le` se calcule seul |
| 2 → 3 | Réponse « oui, c'est fait » au rappel. `active` = vrai, `a_active_le` s'efface |
| 2 → 1 | « Finalement non », ou réservation annulée |
| 3 → 4 | Une réservation ultérieure a besoin d'une table membre **séparément** |
| 4 → 1 | Réponse « oui, les séparer ». `active` = faux, `a_desactive_le` s'efface |
| 3 → 1 | Déliage à la main, sans rappel |

#### Calcul des deux dates

**Toujours recalculées, jamais saisies** — à chaque placement, annulation ou no-show.

- **`a_active_le`** = heure de début de la prochaine affectation sur cette combinaison. Aucune marge, aucun délai configurable. Null s'il n'y a rien à venir ; null dès que `active = vrai`.
- **`a_desactive_le`** = fin de la série d'affectations en cours, **mais seulement si** une réservation ultérieure a besoin d'une table membre **seule**. Null si rien ne réclame les tables séparément — on laisse collé. Null dès que `active = faux`.

#### Invariant

> Une table physique appartient à **au plus une combinaison active** à la fois.

Vérifié avant chaque activation. Si 13 est déjà collée à 14, le rappel « 12 et 13 sont-elles rapprochées ? » ne peut pas aboutir : il faut d'abord séparer 13-14.

#### Contrainte en base

```sql
CHECK (
  (active = true  AND a_active_le    IS NULL)
  OR
  (active = false AND a_desactive_le IS NULL)
)
```

Au plus une action en attente à la fois. Sans cette contrainte, un bug de recalcul passera inaperçu jusqu'au jour où un rappel sonnera pour rien en plein service.

#### Les rappels

Le logiciel **ne bascule jamais `active` tout seul**. Il sonne, l'utilisateur répond.

- **Rappel de rapprochement** (à `a_active_le`) — trois réponses : *Oui, c'est fait* / *Pas encore, me redemander dans 10 minutes* / *Finalement non*.
- **Rappel de séparation** (à `a_desactive_le`) — *Oui, les séparer* / *Non, les laisser ensemble*.
- **Rappel après no-show** — « Nguyen ne s'est pas présenté. Séparer 12 et 13 ? » Le logiciel sait que la réservation est tombée ; il ne sait pas si le restaurateur préfère récupérer deux tables de 4 ou garder sa grande table pour un walk-in.

**Aucun rappel n'expire.** Il reste affiché tant que personne n'a répondu. Pas de délai, pas de bascule automatique, pas d'annulation.

---

### 3.5 Fonction de compatibilité

Pour une réservation donnée et une heure T, chaque entité réservable reçoit un verdict.

#### Écartée — estompée à 26 %, pas de halo

- Une affectation recouvre déjà `[T, T + durée]`, ou un conflit d'ensemble (§3.3)
- `capacite < couverts − tolérance_basse` — une 2p pour 6 personnes ne sert à rien
- La zone est fermée pour ce service

#### `✓` Parfaite — halo vert plein, **dépôt immédiat sans popup**

- Libre sur tout l'intervalle
- `couverts ≤ capacite ≤ couverts + tolerance_places`
- Propre
- Zone conforme au souhait, s'il y en a un

#### `~✓` À réserve — halo vert-jaune, **popup de confirmation**

Possible, mais avec au moins une raison à dire.

#### Catalogue des raisons

| Raison | Texte affiché au dépôt |
|---|---|
| Table non nettoyée | **Table non nettoyée** — Legrand est parti à 20:12, elle n'a pas encore été redressée. *En plaçant Moreau, elle sera considérée comme nettoyée.* |
| Places en trop | **2 places de trop** — table de 6 pour 4 personnes. Il ne te restera plus de table de 6 ce soir. |
| Places en moins | **1 place manquante** — table de 3 pour 4 personnes. À rapprocher d'une autre ? |
| Réservée plus tard | **Réservée à 22:00** — il reste 1h30, la rotation moyenne est de 1h45. |
| Zone non demandée | **Terrasse** — la réservation demandait la salle. *(note du client : « intérieur svp »)* |
| Rapprochement nécessaire | **Rapprochement nécessaire** — les tables 12 et 13 devront être poussées l'une contre l'autre avant l'arrivée. |

Une entité peut cumuler plusieurs raisons ; le popup les liste **toutes**.

#### Propositions de rapprochement

Le moteur ne se contente pas d'accepter un rapprochement, il le **propose** : sans cela, un groupe de 8 dans un restaurant sans table de 8 reçoit « aucune table disponible ».

- **Aucun filtre de proximité** : le restaurateur connaît sa salle, c'est lui qui décide.
- Mais les candidats sont **triés par distance croissante**, calculée depuis les `x/y` des tables physiques. Les voisines remontent en tête, le reste reste atteignable.
- Un rapprochement est **toujours `~✓`**, jamais `✓` : pousser deux tables et refaire les couverts coûte du travail physique.

---

## 4. Navigation et écrans

### 4.1 Inventaire

| Écran | Rôle | État |
|---|---|---|
| **Accueil** | L'état du jour *avant* et *après* le service : à traiter, récapitulatif, fermeture du jour | Conçu (§12) |
| **Service → Plan** | La salle en temps réel : placement, statuts, rapprochements | Conçu (§5) |
| **Service → Agenda** | Les mêmes réservations sur un axe temps : arrivées, rotation, liens physiques | Conçu (§4.5) |
| **Réservations** | Recherche, filtres, création manuelle multi-canal. Tout ce qui n'est pas le service courant | Conçu (§6) |
| **Clients** | Mini-CRM : fiche, historique, no-shows, allergies, notes | Conçu (§7) |
| **Paramètres** | Ouvertures, services, capacités, notifications, tables & zones, équipe | Conçu (§9) |
| **Fiche réservation** | **Pas un écran** : panneau latéral. Se remplace avec la fiche client | Conçu (§6.5, §7.6) |
| **Formulaire de création** | **Pas un écran** : panneau ouvert par le « + » global, qui survole le plan | Conçu (§8) |
| **Éditeur de plan** | Plein écran, atteint par le crayon. Admin uniquement | Conçu (§10) |
| **Widget client** | Application publique séparée, hors back-office. **Mobile d'abord** | Conçu (§11) |

### 4.2 Structure : le service est un seul endroit

Le rail compte **cinq entrées** : Accueil · Service · Réservations · Clients — puis Réglages épinglé en bas.

Plan et Agenda ne sont **pas** deux entrées du rail : ce sont deux onglets de vue à l'intérieur de « Service ». C'est la décision structurante de cette section.

**Pourquoi.** L'unité de travail d'un restaurateur n'est pas « le plan » ou « l'agenda » — c'est *un service*. Le plan et la frise sont deux façons de regarder le même service : l'un dans l'espace, l'autre dans le temps. En faire deux écrans distincts oblige à synchroniser leur contexte (date + service) ; le jour où cette synchronisation lâche, on change de vue et on place une arrivée le mauvais soir. En les réunissant sous un en-tête unique, la question ne se pose plus : il n'y a qu'un seul contexte, écrit une seule fois.

**Il n'y a pas de troisième onglet « Liste ».** L'écran Réservations remplit déjà ce rôle et le remplit mieux, avec ses filtres et sa recherche.

**Deux niveaux d'onglets** cohabitent dans la vue Plan : les vues (Plan / Agenda) au-dessus, les salles (Salle / Terrasse / Étage) à droite sur la même ligne. Les deux portent des badges, ce qui les rend cohérents plutôt que confus.

Deux conséquences directes :

- **Le bouton « + » est global**, dans l'en-tête, pas dans le plan. Créer une réservation doit rester possible depuis la fiche d'un client comme depuis la salle.
- **La fiche réservation est un panneau**, jamais un écran plein. Toucher une réservation ouvre un volet à droite *sans quitter la vue* : on garde le plan sous les yeux pendant qu'on lit les notes du client.

### 4.3 En-tête de contexte et sélecteur de service

Une seule ligne, toujours au même endroit, partagée par les deux vues : horloge · état du service · date · pastille de couverts.

**Par défaut, l'en-tête affiche le service en cours** — il n'y a rien à choisir en arrivant.

**Toucher la date ouvre la popup de sélection.** Elle contient :

- un calendrier du mois. Le jour courant est marqué ; **les jours de fermeture sont grisés et non cliquables** — la fermeture exceptionnelle se voit donc ici, sans écran supplémentaire ;
- un point sous chaque jour portant des réservations ;
- **les services du jour choisi**, et eux seuls : un dimanche sans service du soir n'affiche qu'un bouton ;
- l'état de chaque service (*terminé* / *en cours* / *à venir*) et son remplissage. C'est ce qui transforme un sélecteur en information.

Choisir ferme la popup et recharge **la vue courante** : on ne repart pas au plan si on était dans l'agenda.

**Retour au présent.** Dès qu'on n'est plus sur le service en cours, l'en-tête change de ton et affiche un bouton **« Aujourd'hui »**. Sans lui, on oublie qu'on regarde mardi prochain et on place une arrivée au mauvais soir.

### 4.4 Le rail

**Icônes seules au repos.** Largeur 46 px. Il n'y a **pas de bouton de repli** : l'état replié est l'état normal, et les libellés se révèlent par interaction.

| Contexte | Comportement |
|---|---|
| **PC** | Survol → les libellés apparaissent. Ouverture après **150 ms**, fermeture après **200 ms** |
| **Tablette** | Contact sur le rail → libellés visibles **3 s**. Le compte repart de zéro à chaque nouveau contact sur le rail |
| **Tablette — sortie** | Contact ailleurs sur l'écran → fermeture **immédiate**, sans attendre les 3 s |
| **Premier lancement** | Le rail s'ouvre **déployé**, et se replie après le premier contact |

**La règle qui décide de tout : le rail recouvre, il ne pousse pas.** Le rail déployé est un calque flottant avec ombre portée ; la largeur réservée dans la mise en page reste celle des icônes, toujours. Autrement, chaque passage de souris relaie toute la salle — les tables glissent de ~86 px sous le curseur, et si un glisser-déposer est en cours, la table visée n'est plus là où on la lâche.

Les délais de 150 / 200 ms ne sont pas décoratifs : sans le premier, le rail s'ouvre chaque fois que le curseur *traverse* le bord gauche pour aller ailleurs ; sans le second, une sortie en diagonale referme le rail au moment où l'on vise une entrée.

**Sur tablette, un contact sur une icône navigue immédiatement.** Les libellés qui suivent sont une *confirmation* — on lit où l'on vient d'aller — et non une aide au choix. Le coût d'une navigation ne double jamais. Le seul défaut de cette règle, taper en aveugle la toute première fois, est payé une fois pour toutes par le rail déployé au premier lancement.

Trois règles de bord :

1. **Inerte pendant un glisser.** Tant qu'une réservation est saisie, le rail ne réagit ni au survol ni au contact. Rien ne doit apparaître au-dessus de la salle pendant qu'on vise une table.
2. **L'entrée active reste lisible repliée** — pastille orange pleine. C'est ce qui rend le repli acceptable.
3. **Naviguer referme.** Le rail se replie dès que le nouvel écran est là, sans attendre les 3 s. Le délai sert à la lecture, jamais à l'attente.

Le rail navigue entre **sections**, jamais entre salles. Mélanger les deux le rendrait illisible.

### 4.5 La vue Agenda

Même ossature que le plan — même rail, même en-tête, mêmes onglets, même colonne « À placer ». Seul le centre change : la salle vue dans l'espace devient la salle vue dans le temps.

**Une ligne par table, le temps en abscisse.** Un trait orange vertical marque l'instant présent ; la vue s'ouvre centrée dessus.

| Élément | Rendu |
|---|---|
| Réservation | Bloc bleu, largeur = durée. Toucher ouvre la fiche |
| Table virtuelle | Ligne propre, libellé violet (`12-13`) |
| Lien physique | Ligne dédiée, glissée **sous** sa table virtuelle |
| Rapprochement prévu, non confirmé | Bloc orange pointillé + rappel `!` |
| Lien physique confirmé (`active = vrai`) | Bloc vert plein |

**La bande fantôme.** Quand une combinaison porte une réservation, les lignes de ses tables physiques affichent une **bande hachurée « via 12-13 »** sur le même intervalle.

Sans elle, la ligne *Table 12* paraît libre à 22:00 alors qu'elle est prise. Le moteur refusera bien la double réservation grâce à la règle d'intersection (§3.3) — mais l'œil, lui, aura déjà promis la table au téléphone avant que le moteur ait son mot à dire. La bande fantôme est le rendu visuel direct de cette règle.

Elle est **dérivée, jamais saisie**, et **non cliquable** : la toucher sélectionne la réservation réelle, sur la ligne de la combinaison.

Deux règles de lisibilité, sans lesquelles un restaurant de 20 tables afficherait 40 lignes vides :

1. Une ligne de **table virtuelle** n'apparaît que si elle porte quelque chose ce jour-là.
2. Une ligne **Lien physique** n'apparaît que sous les combinaisons ayant un rapprochement prévu ou actif dans la fenêtre affichée.

### 4.6 Écran d'atterrissage

À l'ouverture de l'application :

- **un service est en cours** → Plan de salle, sur ce service ;
- **sinon** → Accueil.

L'accueil reste atteignable en permanence dans le rail. Il devient l'écran de l'*avant* et de l'*après* — pas celui de 20 h 30, où l'imposer coûterait un tap à chaque ouverture, cinquante fois par soir.

### 4.7 Rôles

Deux rôles au minimum, rendus nécessaires par le bouton crayon « visible en mode admin seulement ».

| Rôle | Accès |
|---|---|
| **Service** | Accueil, Service, Réservations, Clients. Place, déplace, marque une arrivée, note un no-show. **Ne peut pas** déplacer une table ni modifier les horaires d'ouverture |
| **Administrateur** | Tout, plus l'éditeur de plan, les paramètres, l'équipe et le widget |

---

## 5. L'écran plan de salle

### 5.1 Anatomie

```
┌────┬──────────────────────────────────────────────────────┐
│    │  20:07   Service en cours — 3 tables à placer        │
│rail│                        20/08/26 Jeudi  32/48 couverts│
│ 46 ├──────────────────────────────────────────────────────┤
│ px │  19:00 │ 19:30 │ 20:00 │ 20:30 │ 21:00 │ 21:30       │  frise
│    ├──────────────────────────────────────────────────────┤
│    │ [Plan][Agenda]  (Salle 8/12)(Terrasse 3/6)  ✎ Éditer │  onglets
│    ├───────────────────────────────────┬──────────────────┤
│    │                                   │  À PLACER · 3    │
│    │            PLAN (ardoise)         │  Moreau · 4p     │
│    │                                   │  Bekkali · 2p    │
│    │                                   │  Chen · 6p       │
│    ├───────────────────────────────────┴──────────────────┤
│    │  Libre · Réservée · Occupée · À nettoyer · En retard │  légende
└────┴──────────────────────────────────────────────────────┘
```

### 5.2 Rail de navigation

Voir **§4.4**. Le rail est commun à tous les écrans : 46 px, icônes seules, révélation au survol ou au contact, et **inerte pendant un glisser-déposer** — règle qui compte particulièrement ici.

### 5.3 En-tête

Voir **§4.3**. Commun aux vues Plan et Agenda : horloge · statut italique du service avec l'élément actionnable en orange · date cliquable (ouvre le sélecteur de service) · pastille de couverts.

#### Le bouton « Allergies »

Une pastille corail dans l'en-tête, portant **l'icône couvert, le mot « Allergies » et le compte**. Elle n'apparaît que si le service en compte au moins une.

Elle ouvre une **fenêtre flottante** : heure · nom · allergène · table, dans cet ordre — celui où on le dit en cuisine. « À placer » en pointillé quand la table n'est pas encore connue : l'information manquante est nommée plutôt que vide.

Trois règles :

1. **La fenêtre survole, ne pousse pas** (§8.6) : elle ne désigne rien sur le plan. Toucher à côté ferme.
2. **La fenêtre se ferme, la pastille reste.** On peut ranger l'information, jamais la déclarer traitée. Un bouton « vu, transmis » serait un accusé de lecture — une case qu'on coche sur sa propre parole, et qu'on finit par cocher sans lire.
3. **Le mot accompagne l'icône.** C'est ce qui rend la pastille de table (§5.6) lisible sans explication : un dessin isolé ne s'apprend pas, un dessin à côté de son mot, si.

C'est ici que vivent les allergies du service, **pas sur l'Accueil** : celui-ci se lit une fois à 11:12, l'écran Service reste ouvert tout le service — y compris à 13:00, quand le convive arrive et qu'il faut s'en souvenir. Et « 2 allergies » y était une abstraction, alors qu'ici c'est une table.

### 5.4 Frise horaire

Un créneau par pas de service (15 ou 30 min). Chacun porte l'heure, le nombre de couverts, et une barre de remplissage.

- Le créneau actif est **orange plein**.
- Un badge **`!` violet** signale les créneaux ayant des réservations non placées. **Pas de compteur** : le nombre exact est déjà dans « À placer ». Le badge dit « regarde ici », pas « combien ».
- Le violet est choisi parce que l'orange est déjà pris par le créneau actif : un badge orange posé dessus disparaîtrait.

**Sélectionner une réservation déplace la frise sur son créneau.** Sinon on illuminerait les tables libres à 20:00 pour une réservation de 20:30.

### 5.5 Onglets de zone

Une pastille par zone, avec son taux d'occupation. L'onglet actif est orange.

Pendant un placement, chaque onglet porte **le meilleur niveau qu'il contient** : vert s'il a du parfait, vert-jaune s'il n'a que du possible, estompé s'il n'a rien. Une zone vide mais sans table assez grande est **estompée, pas badgée** — le badge dit « compatible », pas « libre ».

**Bouton « ✎ Éditer le plan »** poussé à droite, contour orange, visible en mode admin seulement, estompé pendant un placement.

### 5.6 Le plan

Ardoise sombre, tables aux vraies positions et vraies formes. Numéros à la craie, capacité en petit.

Chaque table affiche son statut par **couleur + forme du contour**. La légende reste affichée en permanence sous le plan — pas dans une aide.

*Justification :* l'auteur du design lui-même a mal lu deux couleurs sur quatre lors d'un test. Si lui se trompe, l'extra du samedi soir se trompera aussi.

#### Ce qui qualifie une réservation voyage avec elle

**Règle générale.** Les marques qui *qualifient* une réservation — allergie, VIP, habitué, première visite, antécédent de no-show — n'appellent aucun geste propre : elles changent la façon de traiter la réservation. Elles apparaissent donc **partout où la réservation apparaît** : ligne de l'écran Réservations (§6.1), colonne « À placer », bloc de l'Agenda, et **pastille sur la table** du plan.

Elles appartiennent à la réservation, pas à la table : une pastille suit un déplacement.

L'allergie est le premier cas de cette règle et le plus sérieux — pastille corail portant l'icône couvert (§2.5), en haut à droite de la table.

**Cette règle remplace l'idée d'un bloc de veille « ce qui demande une attention ».** Un digest posé sur un seul écran laisse invisible ce qui est déjà confirmé et placé — précisément les réservations qu'on croise le plus. Une marque qui voyage n'a pas ce défaut.

Nuance conservée du §6.6 : sur la **fiche** réservation, l'allergie reste écrite en toutes lettres et épinglée, jamais réduite à une icône. Une icône signale, un mot informe — et au moment de servir, c'est le mot qu'il faut.

### 5.7 Colonne « À placer » — 126 px, repliable

**Deux groupes**, deux compteurs, une séparation nette :

1. **À placer** — les réservations confirmées sans table.
2. **En attente** — les demandes non encore acceptées, bordure violette.

Une pastille par réservation : nom, couverts, heure, source. La sélection la met en orange et estompe les autres. Les deux groupes sont glissables ; ils ne peuvent pas être confondus.

### 5.8 Le placement

1. Toucher une réservation → **la fiche remplace la colonne** (§6.7), la frise saute sur son créneau, les tables compatibles reçoivent leur halo, tout le reste tombe à 26 % d'opacité. `Échap` annule.
2. Déposer sur une table `✓` → placement immédiat, aucun popup.
3. Déposer sur une table `~✓` → popup listant **toutes** les raisons, puis *Annuler* / *Placer*.
4. Si le dépôt crée une combinaison inédite → popup de création (nom auto « 12-13 » modifiable, capacité proposée à la somme et modifiable). Si la combinaison existe déjà, aucune question.
5. Si la réservation déposée est **en attente**, elle est acceptée du même geste, et le message au client part avec 8 s de délai annulable (§6.7).

---

## 6. Réservations, fiche et parcours de placement

### 6.1 L'écran Réservations

Le travail hors service : confirmer, chercher, créer, déplacer.

Le rail ne change pas. L'en-tête, si : **ni date ni service** — ce contexte appartient à l'écran Service. On regarde une période, pas un moment.

| Élément | Décision |
|---|---|
| Recherche | Par nom **et par numéro de téléphone**. Quand le téléphone sonne, on a le numéro avant le nom, et l'orthographe est un pari |
| Filtres | Périodes (À venir / Aujourd'hui / Passées) puis Statut, Source, Salle |
| Groupement | **Par jour**, pas de liste plate. L'en-tête de jour porte le total de couverts et l'état (« complet à 20:30 ») — seule vue où l'on voit venir un samedi chargé trois semaines à l'avance |
| Demandes en attente | Un **bandeau violet** en haut de liste, pas un onglet. Un onglet, il faut penser à aller le voir ; un bandeau, il faut penser à l'ignorer — et il disparaît seul quand la file est vide |

**Anatomie d'une ligne :** heure · nom et détails · [risque client] [source] · table · **badge de statut** · **action rapide**.

### 6.2 Le système de badges

Six statuts, une règle pour qu'ils ne fassent pas un arc-en-ciel : **la teinte dit le cours normal, le plein dit l'anomalie, le gris dit que c'est clos.** On lit l'état d'une soirée sans lire un seul mot.

| Statut | Badge | Traitement | Pourquoi cette couleur |
|---|---|---|---|
| `en_attente` | À RÉPONDRE | Teinte violette `#EDE6F5` / `#5B4A8A` | Même violet que le badge `!` du plan. Un seul violet, un seul sens : « ça t'attend » |
| `confirmee` | CONFIRMÉE | Teinte bleue `#E4EFF7` / `#3D6E8E` | Même bleu qu'une table *réservée* — c'est exactement ce qu'une confirmation produit sur le plan |
| `assise` | ASSISE | Teinte corail `#F7E7E1` / `#B4674F` | Même corail qu'une table *occupée*. La liste et le plan parlent la même langue |
| `terminee` | TERMINÉE | Gris | Rien à faire, doit se retirer de l'œil |
| `annulee` | ANNULÉE | Gris **barré** | Le barré la distingue de « terminée » sans ajouter une couleur |
| `no_show` | NO-SHOW | Corail **plein** `#B4674F` | Le seul badge plein. Une anomalie qui coûte de l'argent doit se voir de loin |

**La source reste toujours grise.** Elle est présente sur *chaque* ligne : la colorer reviendrait à colorer toute la liste et à noyer les statuts, qui eux appellent une action. Information de référence, pas alerte.

**Deux corails, deux formes.** `NO-SHOW ×2` en **contour** est un antécédent du *client*, un risque à venir ; `NO-SHOW` en **plein** est le résultat de *cette réservation*, déjà acté. Même couleur parce que même sujet, formes opposées parce que ni le même objet ni le même temps — et lisible en niveaux de gris.

**Règle générale : une seule couleur forte par ligne, toujours à la même abscisse.** On balaye la colonne de droite sans lire.

### 6.3 Le champ `source`

Il n'est demandé **qu'à la création manuelle**. Partout ailleurs le logiciel le connaît et l'écrit lui-même.

| Origine | Source | Demandée ? |
|---|---|---|
| Widget public | `web` | Non — écrite d'office, non modifiable |
| Google Reserve *(niveau 3)* | `google` | Non — écrite d'office |
| Création depuis le **plan de salle** en service | `sur_place` | Pré-choisie, modifiable |
| Création depuis l'écran **Réservations** | `telephone` | **Oui** — le seul vrai cas |

Dans ce dernier cas, les quatre valeurs restent affichées côte à côte, une seule allumée. Un menu déroulant refermé cache la question ; quatre boutons dont un allumé la posent en permanence, sans coûter un geste.

### 6.4 La colonne « Action »

Actions rapides, directement dans la liste, sans ouvrir la fiche.

| État | Action rapide | Remarque |
|---|---|---|
| `en_attente` | `✓` vert · `✗` corail | Pas de « Placer » ici : on ne place pas depuis une liste, il faut voir la salle |
| `confirmee` sans table | **Placer** *(orange)* | Seule action orange de la colonne — la seule qui ouvre un ailleurs (la vue Plan, au bon service) |
| `confirmee` placée | **Arrivée** | Le geste le plus fréquent d'un début de service : un tap depuis la liste |
| `assise` | **Libérer** | Clôt la réservation et passe la table en « à nettoyer » |
| `terminee`, `no_show`, `annulee` | — | Colonne vide mais **jamais absente** : la grille ne bouge pas d'une ligne à l'autre |

Trois règles :

1. **Jamais deux actions concurrentes**, sauf `en_attente` où accepter et refuser sont symétriques. Partout ailleurs, le doute se résout en ouvrant la fiche.
2. **`✓` et `✗` sont dessinés et teintés**, jamais des emojis — ils changent de forme d'un appareil à l'autre. Le vert est celui du plan : il y dit « cette table convient », ici « oui ». Même sens affirmatif.
3. **Toute action rapide est annulable** par le bandeau différé (§6.7).

### 6.5 La fiche réservation

**Un panneau, jamais un écran.** Largeur ~250–308 px selon le contexte. Il s'ouvre à l'identique depuis les trois endroits qui y mènent : une ligne de la liste, un bloc de l'agenda, une table du plan. Toucher à côté ferme.

Contenu, de haut en bas :

1. **Identité** — nom, couverts, date, heure, badge de statut, badge de source.
2. **Allergie épinglée** — voir §6.6.
3. **Bandeau CRM** — nombre de visites, no-shows, dernière visite, téléphone, lien vers la fiche client.
4. **Détails** — note de la réservation, salle souhaitée, durée, table affectée.
5. **Journal** — voir §6.8.
6. **Actions** — une seule principale, déduite de l'état.

#### L'action principale est déduite de l'état

Une fiche peut théoriquement déclencher huit choses. Les afficher à parité obligerait à *lire* avant d'agir — inacceptable un samedi à 20 h 30.

| État | Action principale | Effet |
|---|---|---|
| `en_attente` | **Accepter et placer à une table** *(orange)*, puis *Accepter*, puis *Refuser* | Voir ci-dessous |
| `confirmee` sans table | **Placer à une table** *(orange)* | Ferme la colonne, allume les tables compatibles |
| `confirmee` placée | **Marquer l'arrivée** *(encre)* | → `assise`, horodate `assis_a`, la table passe occupée |
| `assise` | **Libérer la table** *(encre)* | → `terminee`, `termine_a`, la table passe « à nettoyer » |
| `terminee`, `no_show`, `annulee` | Aucune | Lecture seule. Une sortie discrète : « Rouvrir », en cas d'erreur de saisie |

**L'orange est réservé à ce qui n'est pas encore fait.** *Placer* et *Accepter* sont oranges ; *Marquer l'arrivée* et *Libérer* passent en encre. Sinon l'orange perd son sens, qui est « il reste quelque chose à faire ici ».

**Les trois boutons d'une demande en attente ne changent jamais de place.** « Accepter et placer à une table » reste en tête **même hors du service en cours**, où il est pourtant moins pertinent. Une position stable vaut mieux qu'une hiérarchie juste : un bouton qui se déplace selon l'heure se tape de travers.

Justification de l'ordre : pendant un service, accepter sans placer laisse une réservation en suspens dans la colonne — du travail remis à plus tard. *Accepter* seul garde tout son sens la veille, en préparation. *Refuser* reste visible et discret : le cacher pousserait à laisser traîner les demandes, le mettre à parité en ferait un choix aussi banal qu'accepter.

### 6.6 Trois règles que le contenu impose

**L'allergie n'est pas une note.** C'est la seule information de la fiche dont l'oubli a une conséquence physique. Épinglée sous le nom, en corail, jamais repliée, jamais mélangée à « anniversaire » ou « près de la fenêtre ». Elle vient de la fiche **client** et suit le client à toutes ses réservations, y compris celles saisies par quelqu'un qui ne le connaît pas.

**Le bouton « No-show » n'existe pas trop tôt.** Il n'apparaît qu'une fois l'heure dépassée de `retard_grace`. Avant, il n'a pas de sens et ne peut produire qu'une erreur coûteuse : un no-show injustement inscrit reste dans l'historique d'un client fidèle. Sa confirmation nomme la conséquence : « 2ᵉ no-show pour ce client ».

**Modifier peut casser le placement.** Passer une réservation de 4 à 6 couverts sur une table de 4 rend l'affectation invalide. Le panneau ne déplace rien tout seul et ne libère rien en silence : il garde la table, affiche « la table 12 ne suffit plus », et propose de replacer. Un logiciel qui déplace une table sans qu'on le lui demande finit par être contourné.

### 6.7 Le parcours de placement depuis le plan

#### La colonne, en deux groupes

1. **À placer** — les réservations confirmées sans table.
2. **En attente** — les demandes non encore acceptées, bordure violette.

Deux groupes, deux compteurs, une séparation nette. On ne peut pas les confondre, et pourtant les deux sont glissables.

#### Ouvrir la fiche

Toucher une réservation ouvre la fiche **à la place de la colonne**, et allume les tables compatibles sur le plan.

**Pas de voile sur le plan.** Si ouvrir la fiche allume les tables compatibles, le plan n'est pas en attente — il est *l'objet* de l'action.

**Ici, et seulement ici, le plan se recompose.** La fiche est plus large que la colonne (250 px contre 126) ; si elle recouvrait le plan, une table allumée pourrait se retrouver dessous — exactement ce qu'on cherchait à montrer. Ce n'est pas une contradiction avec la règle du rail (§4.4) : le rail s'ouvre au survol, par accident, potentiellement pendant un glisser ; la fiche s'ouvre sur un clic délibéré, une fois, avant tout glisser. Le décalage coûte 124 px et garantit qu'aucune table allumée n'est cachée. Les tables des autres salles restent signalées par le badge vert sur l'onglet de salle.

#### Glisser une demande en attente sur une table

**Un geste, deux effets** : la demande est acceptée et la table réservée.

Mais l'un des deux **sort du logiciel** — accepter envoie un message à un vrai client, et un lâcher mal visé est un courriel qu'on ne rattrape pas. La protection retenue n'est **pas** une popup :

> **L'envoi est différé de 8 secondes**, et un bandeau propose « Annuler ». La table est réservée immédiatement, la fiche passe « confirmée », seul le message attend son tour.

Une popup demande « es-tu sûr ? » à quelqu'un qui vient d'agir et qui répond oui par réflexe. L'annulation différée intervient au moment où l'on *voit* le résultat — donc au moment où l'on repère l'erreur. Elle rattrape aussi ce qu'une popup ne rattrape pas : la mauvaise table, la mauvaise ligne.

**Ce bandeau sert à tous les gestes conséquents** : accepter, refuser, marquer un no-show, y compris depuis la colonne Action de la liste.

La popup de raison sur les tables `~✓` (§5.8) reste, elle : elle n'interroge pas, elle **informe** d'une chose qu'on ne peut pas voir.

### 6.8 Le journal

Chaque entrée porte un horodatage et un auteur — une personne, ou *système*.

S'y inscrivent : création (avec la source) · acceptation ou refus · rappel envoyé · confirmation du client · placement et déplacements · arrivée · libération · no-show · annulation avec `annule_par` · toute modification d'heure, de date ou de couverts.

**Pourquoi il vaut son coût.** « J'avais confirmé » contre « on n'a jamais eu de réponse » est la dispute la plus fréquente du métier, et elle se termine toujours par un geste commercial. Une ligne horodatée la tranche en trois secondes. C'est aussi ce qui rend le compteur de no-show défendable devant le client : on peut montrer.

---

## 7. Clients — le mini-CRM

Volet E du cahier des charges.

### 7.1 Ce que cet écran est vraiment

**Personne ne vient ici pour « consulter ses clients ».** On y arrive pour trois raisons, toujours les mêmes : noter une allergie qu'on vient d'apprendre au téléphone, vérifier qui est ce nom avant de dire oui à une demande, retrouver un numéro.

C'est un écran de *conséquence*, pas de destination. Il en découle une règle de proportion : **la liste reste mince, la fiche porte tout le poids.**

### 7.2 Qui devient un client — le téléphone est l'identité

C'est **la** question de tout CRM de restaurant, et elle se tranche avant de dessiner quoi que ce soit.

| Situation | Décision |
|---|---|
| Réservation avec un numéro **déjà connu** | Rattachée à la fiche existante **sans rien demander**. Le compteur de visites monte seul |
| Réservation avec un numéro inconnu | Crée une fiche client, silencieusement. Aucun écran de plus |
| Numéro absent mais e-mail connu | L'e-mail sert de clé de secours |
| **Client de passage** (walk-in, ni numéro ni e-mail) | **Ne crée aucune fiche.** C'est une occupation de table, pas un client |

La dernière ligne compte autant que les trois autres. Un walk-in qui créerait une fiche, c'est « Table 4 · 2 pers » quatre cents fois par an : au bout d'un trimestre la liste est ininterrogeable, le compteur de visites ne veut plus rien dire, et l'export CSV du volet I est inexploitable. **Un CRM se salit une fois, et ne se renettoie jamais.**

### 7.3 La liste

En-tête : recherche **par nom et par numéro de téléphone** (même règle qu'au §6.1 — quand le téléphone sonne, on a le numéro avant le nom, et l'orthographe est un pari ; la recherche ignore espaces et points), bouton « + Client », filtres, export CSV.

**Colonnes :** Nom · Téléphone · Tags · Visites · Dernière · **No-show / Visites**.

| Décision | Pourquoi |
|---|---|
| Tri par défaut : **récents**, pas alphabétique | Le client qu'on cherche est presque toujours celui qu'on vient de voir ou qu'on va voir. L'alphabétique est un tri d'annuaire ; ici on n'a pas d'annuaire, on a une mémoire courte |
| L'en-tête s'appelle **« No-show / Visites »**, jamais « Fiabilité » | Un en-tête doit nommer ce qu'il y a dans la case, pas la conclusion qu'on en tire. « Fiabilité » oblige à deviner dans quel sens `2 / 41` se lit |
| Le ratio porte **toujours son dénominateur** | `2 / 41` est une bonne cliente ; `2 / 3` est autre chose. Le même chiffre nu condamnerait les deux |
| Le ratio passe en **corail plein** au-delà d'un seuil | Même badge que le no-show du §6.2. Une anomalie coûteuse se voit de loin |

### 7.4 Les compteurs sont stockés, et l'écriture est symétrique

`nb_visites` et `nb_noshow` sont **des champs stockés**, pas des agrégats calculés à l'affichage.

C'est l'exception à la règle du §3.2 (« ce qui se déduit ne se stocke pas »), et elle est justifiée par la nature de la lecture :

| | Statut d'une table (§3.2) | Compteurs d'un client |
|---|---|---|
| Objets à l'écran | ~20 tables, toujours les mêmes | **Des centaines de clients**, listés et filtrés |
| Portée du calcul | Les occupations **du jour** | L'historique **complet**, depuis toujours |
| Coût d'affichage | Négligeable | Un agrégat par ligne : la liste devient lente **et empire avec le succès du restaurant** |

Deux garde-fous, sans lesquels le stockage produirait un compteur faux :

1. **L'écriture est symétrique.** Tout passage **vers** `no_show` incrémente ; tout passage **hors de** `no_show` décrémente — y compris le bouton « Rouvrir » du §6.5. Un compteur qui ne sait que monter colle une faute à un client pour toujours.
2. **Le journal reste l'autorité.** Le compteur est un *cache*, la vérité est dans les réservations et le journal (§6.8). D'où une action **« Recompter »** sur la fiche client, et un recomptage global nocturne — pour redresser une dérive après un import, une migration ou un bug, sans rien perdre.

### 7.5 La fiche client

Un **panneau**, comme la fiche réservation. Contenu, de haut en bas :

1. **Identité** — nom, tags, téléphone, e-mail.
2. **Allergie** — champ structuré, corail, jamais repliée.
3. **Compteurs** — visites · couverts moyens · no-shows.
4. **Notes · interne** — fond gris, mention « interne ».
5. **Historique** des réservations.
6. **Actions** — « Nouvelle réservation » (orange), « Modifier ».

#### Deux champs de texte, pas trois

Le modèle initial prévoyait un champ `notes` unique pour « allergies, occasions, VIP ». Il en faut **deux**, et pas davantage :

- **`allergies`** — champ à part. Si l'allergie vit dans un bloc de texte libre, le logiciel *ne peut pas* l'épingler en corail sur la fiche réservation (§6.6) ni garantir qu'elle apparaît. La structurer est la condition de la promesse faite au §6.6.
- **`notes_internes`** — tout le reste : habitudes, occasions, « habitué », « négocie toujours ». **Ne sort jamais du logiciel** : jamais dans un e-mail de confirmation, jamais dans le widget. Le fond gris et la mention « interne » le rappellent à celui qui écrit.

Il n'y a **pas** de champ « préférences ». Le commentaire appartient à la réservation ; ce qui doit durer va dans les notes internes. Deux champs libres pour la même chose, c'est surtout deux endroits où chercher.

#### L'historique

**Trié du plus récent au plus ancien, réservations à venir en haut.** Le haut de la liste répond ainsi à « quand est-ce qu'on la revoit ? » — la question qu'on se pose vraiment en ouvrant une fiche client.

Un **trait fin marque le passage au passé** : sans lui, une réservation à venir et une réservation terminée se ressemblent trop. Chaque ligne porte date · couverts · table · badge de statut (§6.2).

### 7.6 La navigation entre les deux fiches

La fiche client et la fiche réservation **se remplacent l'une l'autre dans un panneau unique**. Jamais deux panneaux à l'écran.

- Depuis une fiche réservation, le lien client ouvre la fiche client avec, en en-tête, **« ← Réservation de jeudi 20:00 »**.
- Depuis une fiche client, cliquer une ligne d'historique ouvre **la fiche de cette réservation** avec **« ← Sophie Marchand »**.

**La flèche nomme toujours d'où l'on vient.** Profondeur **2 maximum** : un troisième aller-retour ramène au premier panneau au lieu d'empiler.

**Ce n'est pas la même fenêtre.** La fiche réservation porte *son* commentaire, *son* journal et ses propres boutons déduits de l'état (§6.5) — « Marquer l'arrivée » sur une réservation confirmée, aucun bouton principal sur une réservation terminée.

**Pourquoi le panneau qui se remplace plutôt que l'empilement ou l'écran plein.** Deux panneaux côte à côte mangent 572 px — la moitié d'une Surface Pro — et font cohabiter deux « fermer » dont le doigt en rate un sur deux. Un écran plein, lui, quitte le service : on perd le plan et les tables allumées, ce qui est cher payé pour lire une allergie pendant un coup de feu. Le panneau qui se remplace est aussi exactement ce que fait déjà la fiche quand elle remplace la colonne des réservations (§6.7) : même geste, même règle, rien de nouveau à apprendre.

### 7.7 Les tags restent manuels

Quatre : **VIP** · **Habitué** · **À surveiller** · **Presse**.

Le volet M parle d'un tag « fidèle » : tentant de le calculer sur le nombre de visites, mais **la fidélité telle qu'un restaurateur l'entend n'est pas un seuil** — c'est quelqu'un qu'on connaît. Un tag automatique qui se pose et se retire tout seul devient du bruit ; celui qu'on pose à la main est un jugement, et il vaut quelque chose. Le compteur de visites est déjà là, à côté, pour ceux qui veulent le chiffre.

### 7.8 Doublons et suppression

#### La fusion ne se propose que sur une clé exacte

| Cas | Comportement |
|---|---|
| Même téléphone **exact** | Rattachement automatique et silencieux à la création. Aucun doublon ne naît |
| Même e-mail **exact**, téléphones différents | **Fusion proposée** sur la fiche. Conserve les **deux** numéros, concatène les historiques |
| Même téléphone exact, e-mails différents | Idem : fusion proposée, les deux e-mails sont gardés |
| **Même nom et prénom**, aucune clé commune | **Rien.** Pas de badge, pas de suggestion, pas de fusion manuelle |

La dernière ligne ferme un vrai risque. Deux « Paul Lefebvre » sont souvent deux personnes réelles ; les fusionner mélange leurs allergies, et une allergie héritée du mauvais client envoie quelqu'un aux urgences. En n'autorisant la fusion que sur une clé identique, **le scénario devient impossible par construction** plutôt que déconseillé par un avertissement qu'on cliquera sans lire.

La fusion additionne `nb_visites` et `nb_noshow`, puis déclenche un recomptage (§7.4).

#### Supprimer un client = anonymiser

Le droit à l'effacement est réel, mais effacer *les réservations* ferait **bouger le chiffre d'affaires de l'an dernier**. La suppression efface le nom, l'e-mail, le téléphone, l'allergie et les notes ; les réservations restent, signées « Client supprimé », avec leurs couverts et leurs dates. Les comptes sont justes, la personne a disparu.

### 7.9 Ce qui ne va pas ici

| Tentation | Où ça va |
|---|---|
| « Qui vient ce soir qui mérite une attention ? » | Écran **Accueil**. C'est une question sur *un service*, pas sur un fichier — et la réponse doit venir sans qu'on la demande |
| Campagnes e-mail / SMS *(volet M)* | Hors périmètre v1. Elles exigent un **consentement marketing distinct de la réservation** : un client qui réserve n'a pas accepté de recevoir des promotions. Le champ de consentement est prévu au modèle, l'écran non |
| Score de risque no-show calculé *(volet N)* | Plus tard. Le rapport `2 / 41` dit déjà l'essentiel, et il est **explicable au client** ; un score ne l'est pas |

---

## 8. Le formulaire de création

Le « + » global de l'en-tête (§4.2). Volet C du cahier des charges.

### 8.1 Il ne demande jamais ce qu'il sait déjà

Le « + » s'ouvre depuis quatre endroits qui n'en savent pas autant les uns que les autres. **Même formulaire partout, pré-rempli différemment** — la logique du champ `source` au §6.3, appliquée à tous les champs.

| Ouvert depuis | Déjà connu, donc jamais demandé | Source |
|---|---|---|
| **Une table du plan** | Date, service, **et la table** | `sur_place` |
| **Un créneau de l'agenda** | Date, service, heure | `sur_place` |
| **Une fiche client** | Nom, téléphone, e-mail, allergie — le bloc identité est rempli et replié | `telephone` |
| **L'écran Réservations** | Rien. Le formulaire complet, dans l'ordre | `telephone` |

### 8.2 L'ordre des champs est l'ordre de l'appel téléphonique

**Couverts → date → heure → identité.** Une réservation par téléphone se déroule toujours pareil : *combien* → *quand* → *y a-t-il de la place* → *à quel nom*. On ne prend pas le nom avant de savoir qu'on peut asseoir les gens.

Un formulaire rangé dans l'ordre de la base de données — client d'abord, réservation ensuite — oblige le restaurateur à **garder les couverts en tête pendant qu'il tape un nom**, ou à faire répéter. C'est deux secondes à chaque appel, et une erreur de temps en temps.

Il n'y a **pas d'assistant en deux étapes** pour autant : un seul formulaire, où la réponse de disponibilité arrive d'elle-même dès que les couverts et la date sont saisis. L'ordre de la conversation est respecté sans imposer un bouton « Suivant » à un utilisateur qui tape vite.

### 8.3 La bande d'heures est le cœur du formulaire

Un formulaire qui se contente d'enregistrer est un carnet en papier avec des écrans en plus. **Ce qui justifie son existence, c'est qu'il répond.** Dès que couverts et date sont saisis, chaque créneau du service se colore — avant même qu'on ait touché au nom.

| État | Traitement | Sens |
|---|---|---|
| **Libre** | Vert plein | Une table adaptée est libre sur tout l'intervalle, **sans supposer aucun départ** |
| **Serré** | Ambre, **bordure pointillée** | Possible sous condition : un rapprochement, **ou un départ prévu qui n'a pas encore eu lieu**. Le formulaire nomme la condition — il informe, il ne demande pas (même esprit qu'au §5.8). Définition complète au **§9.4** |
| **Complet** | Gris **barré** | Aucune table, aucune combinaison, aucun départ prévu |

C'est **le vocabulaire du §5.8 réutilisé tel quel** : vert plein / ambre pointillé / gris barré. Un restaurateur qui a compris les tables `~✓` du plan comprend cette bande sans explication. Trois niveaux, une seule grammaire dans tout le logiciel — et lisible en noir et blanc, conformément au §2.3.

**C'est une bande, pas un menu déroulant.** Un déroulant refermé répond « 20:00 est pris » et s'arrête là. La bande répond en plus à la question suivante — *« et à 19:30, ça irait ? »* — qui est celle qu'on pose au téléphone trois secondes plus tard. Même raison que les quatre boutons de source au §6.3.

### 8.4 « Complet » n'est jamais un verrou

**Toucher un créneau complet reste possible.** Le formulaire prévient — « aucune table pour 4 à 20:30 » — et laisse passer. La réservation part en « À placer » avec sa marque, comme n'importe quelle autre.

Le restaurateur connaît sa salle mieux que le logiciel : il sait que la 7 part toujours tôt le samedi. **Un logiciel qui dit non se fait contourner — et il se fait contourner sur papier**, c'est-à-dire hors de toute vue d'ensemble. Autant garder la réservation dedans, même signalée.

La **liste d'attente** serait la vraie réponse à « complet », mais elle est au niveau 2 du cahier (volet G). Le formulaire est dessiné pour l'accueillir plus tard sans bouger : un troisième bouton à côté de « Créer ».

### 8.5 Le client se reconnaît au numéro, pendant l'appel

Dès que le numéro correspond (§7.2), la fiche s'attache et **l'allergie s'affiche dans le formulaire**. C'est tout le rendement du §7 : l'information ne sert pas à consulter après coup, elle sert à parler mieux *maintenant* — « on note toujours les fruits à coque, c'est bien ça ? »

Le ratio `2 / 41` apparaît au même moment, et c'est le seul moment où il sert : pendant qu'on décide d'accepter un samedi 20:00. Lu le lendemain, il ne change plus rien.

**Nom et téléphone sont obligatoires** pour une réservation à venir. Sans numéro, ni le rappel J-1 (volet D) ni un simple changement d'horaire ne sont possibles. L'e-mail reste facultatif, mais il conditionne la confirmation automatique.

### 8.6 Le formulaire est un panneau, et il **survole**

Un panneau de ~322 px, comme les fiches. Il remplace le panneau déjà ouvert s'il y en a un.

**Il recouvre le plan, il ne le pousse pas** — c'est la règle générale du §4.4, pas l'exception du §6.7.

Cette différence n'est pas arbitraire, et elle se formule en une phrase :

> **Le plan se recompose uniquement quand quelque chose y est désigné.** Sinon, le panneau survole.

La fiche réservation ouverte pour un placement *allume des tables compatibles* : le plan est alors l'**objet** de l'action, et rien de ce qui est allumé ne doit passer dessous. Le formulaire de création, lui, n'allume rien — il n'a même pas de champ table (§8.7). Le plan y est un **contexte**, pas une cible : le recouvrir partiellement ne cache aucune information dont on ait besoin à cet instant, alors qu'un décalage de 322 px déplacerait toutes les tables pendant qu'on est au téléphone.

Le plan reste donc largement visible pendant l'appel — on voit la salle se remplir en même temps qu'on répond, ce qu'aucune bande d'heures ne remplacera tout à fait.

Au moment où l'on touche **« Créer et placer »**, le formulaire se ferme et le placement s'ouvre : là, le plan se recompose, parce que des tables sont désignées. La règle tient d'un bout à l'autre du geste.

### 8.7 Deux choses que ce formulaire ne fait pas

| Cas | Où ça se passe |
|---|---|
| **Le client de passage** *(walk-in, volet B)* | Pas ici. On **touche une table libre sur le plan** → « Asseoir maintenant » → couverts. Deux gestes, pas de nom, pas de téléphone, pas de fiche client (§7.2). Un formulaire de réservation pour des gens déjà debout devant vous, c'est une file d'attente qu'on crée soi-même |
| **Choisir la table** | Sauf ouverture depuis une table, il n'y a **pas de champ table**. On ne place pas depuis un formulaire, pour la raison qu'on ne place pas depuis une liste (§6.4) : il faut voir la salle. Le bouton dit « **Créer et placer** » et enchaîne sur le plan, tables compatibles allumées. « Créer » seul reste possible : la réservation tombe dans « À placer » |

**La durée** est affichée, pré-remplie depuis `rotation_defaut`, et modifiable. Un groupe de 8 pour un anniversaire ne tient pas en 1 h 45 ; si on ne peut pas le dire, le plan ment pour toute la soirée.

**La confirmation part en différé.** La case est cochée d'office si un e-mail est connu, et l'envoi suit la règle du §6.7 : 8 secondes, bandeau « Annuler ». Une confirmation partie avec la mauvaise date se rattrape mal, et c'est justement au moment où l'on *voit* la réservation apparaître qu'on repère la faute de frappe.

---

## 9. Paramètres

Volet F du cahier des charges, plus tout ce que les sections précédentes ont renvoyé ici.

### 9.1 La règle qui gouverne l'écran

Presque toutes les règles fines des sections 5 à 8 reposent sur un nombre qui vit ici : le halo vert dépend de `tolerance_places`, l'anneau « en retard » de `retard_grace`, la bande d'heures de `rotation_defaut`, la frise de `pas_creneau`.

> **Aucun réglage n'est posé nu.**

Chacun est suivi d'une phrase qui dit sa conséquence *dans la langue de l'écran qu'il gouverne*, et — quand c'est possible — d'un aperçu construit avec les vraies tables du restaurant. Un champ « Tolérance de places : `[2]` » ne sera jamais réglé correctement par personne. « Pour une réservation de 4 personnes : T5 ✓ · T2 ✓ · T7 ~✓ · T11 ✗ » se règle en trois secondes.

C'est ici que les promesses du logiciel se tiennent ou se cassent : un réglage mal compris ne produit pas une erreur, il produit une dégradation silencieuse de toutes les aides au placement.

### 9.2 Structure

Dix sections dans une **colonne permanente de 158 px**, à droite du rail, la section courante en encre.

| Section | Contenu |
|---|---|
| **Ouvertures** | Horaires habituels et exceptionnels (§9.3) |
| **Services et créneaux** | `pas_creneau`, mode d'occupation, durée prévue, avertissements de cuisine (§9.4) |
| **Salles et tables** | Liste des salles et des tables, dimensions d'une salle — puis **porte vers l'éditeur de plan** (§10), en plein écran. Le chevron `›` le signale. La création d'une table se fait dans l'éditeur (§10.2) |
| **Placement** | `tolerance_places`, `rotation_defaut`, `retard_grace`, proposition des rapprochements |
| **Règles de réservation** | Fenêtre : délai minimum avant réservation, horizon maximum |
| **No-show** | Conditions d'annulation (§9.6) |
| **Notifications** | Confirmation automatique, rappel J-1 et son délai |
| **Équipe** | Comptes, rôles (§4.7) |
| **Widget** | Apparence et activation du parcours public |
| **Restaurant** | Nom, fuseau, coordonnées |

**Pourquoi une colonne permanente plutôt qu'une liste dont on revient.** Paramétrer, c'est régler plusieurs choses à la suite ; une liste avec retour coûte six navigations pour trois réglages. Surtout, un réglage qu'on ne voit jamais n'est jamais trouvé : la colonne expose en permanence l'étendue de ce qui est réglable. Il reste ~1 100 px pour le contenu sur une Surface Pro, largement assez — c'est du paramétrage, pas un plan de salle.

### 9.3 Ouvertures

**Horaires habituels : une colonne par jour**, les services empilés, un « + » pour en ajouter. C'est la seule disposition qui laisse voir la forme d'une semaine d'un coup d'œil — et donc repérer qu'on a oublié le service du midi le vendredi.

**Horaires exceptionnels : un calendrier mensuel**, navigation par année et liste des mois à gauche.

Deux corrections par rapport à la maquette d'origine :

| Correction | Raison |
|---|---|
| **Le vert / rouge / jaune devient couleur + forme** : hachures pour une fermeture, pointillé ambre pour des horaires modifiés | Le §2.3 interdit déjà de distinguer deux états par la teinte seule, et vert/rouge est précisément la paire que ne distinguent pas ~8 % des hommes. Même grammaire qu'au §8.3 |
| **Un jour normal ne porte plus aucune marque** | En vert, un calendrier d'*exceptions* est vert à 95 % : on apprend à ne plus le regarder, et la fermeture du 16 se noie dans la masse. **Le défaut doit être muet pour que l'exception crie** |

Les jours de fermeture habituelle sont légèrement hachurés et non cliquables, cohérent avec la popup de sélection de service (§4.3).

### 9.4 Services et créneaux — la capacité se résout sur les tables

#### Pourquoi pas en couverts

**Un restaurant ne se remplit pas en couverts, il se remplit en tables.**

Salle de 9 tables, 34 places. Samedi 20:00 : huit tables occupées par 24 personnes, il reste une table de 2. Un plafond réglé à 35 couverts affiche `24 / 35` — « il reste 11 couverts » — et le widget accepterait une table de 6. Il n'y a nulle part pour la mettre.

Le compteur n'est pas imprécis, **il mesure la mauvaise chose**. Une réservation de 2 sur une table de 4 consomme *une table* et *deux couverts* ; additionner quelques réservations de ce type suffit à déclarer de la place là où il n'y a plus une chaise. Le décalage n'est pas un arrondi, il est structurel.

**Donc : la disponibilité se calcule sur les tables, pour l'intervalle demandé.**

#### Deux modes d'occupation, réglés par service

Une table n'est pas « prise » ou « libre » dans l'absolu : elle l'est *pendant un intervalle*. « Ai-je une table pour 4 à 21:00 ? » dépend entièrement de ce qu'on suppose du repas commencé à 19:30. Deux hypothèses, qui sont deux modèles de restaurant :

| Mode | Hypothèse | Pour qui |
|---|---|---|
| **Rotation** | La table se libère après `duree_prevue`. Un second service est proposé | Le bistrot qui tourne. **Optimiste** : elle parie que les gens partent à l'heure |
| **Service unique** | Une table prise l'est **jusqu'à la fin du service** | La table d'hôte, le gastronomique. **Honnête** : elle ne promet jamais ce qu'elle ne tient pas |

**C'est un réglage par service, pas une règle universelle** — beaucoup de maisons tournent le midi et pas le soir. `duree_prevue` est héritée de `rotation_defaut` (§3.1) et surchargeable par service.

#### Ce que ça change au §8.3 : « serré » gagne son deuxième sens

Le §8.3 définissait « serré » comme *possible via un rapprochement*. Il faut y ajouter le cas plus fréquent, et plus dangereux : **le créneau qui n'est libre que si quelqu'un part à l'heure.**

| État de la bande d'heures | Définition complète |
|---|---|
| **Libre** — vert plein | Une table adaptée est libre sur tout l'intervalle, **sans supposer aucun départ** |
| **Serré** — ambre pointillé | Libre **seulement si** un repas en cours se termine comme prévu, **ou** seulement en rapprochant deux tables. Le formulaire nomme la condition : *« libre si la table 6 part à 21:00 comme prévu »* |
| **Complet** — gris barré | Aucune table, aucune combinaison, aucun départ prévu. Reste franchissable (§8.4) |

**En mode rotation, un créneau libéré par une prévision ne s'affiche jamais « libre ».** Sinon le logiciel promet un départ qu'il n'a pas vu, et on connaît la suite : la tablée de 19:15 s'attarde jusqu'à 22:00 et quatre personnes attendent debout.

C'est aussi ce qui fait gagner sa place au troisième état. Avec deux niveaux seulement, une prévision de départ devrait s'afficher soit « libre » — et le logiciel mentirait à la place du restaurant — soit « complet », et le restaurant perdrait un second service qu'il fait très bien. L'ambre pointillé dit exactement ce qu'il faut dire : *oui, sous condition, et voici laquelle*.

#### Trois contraintes qu'on confond

Le volet F présentait « capacité max de couverts » et « max X couverts par créneau » comme deux réglages voisins. Ce sont trois choses de natures différentes :

| Contrainte | D'où elle vient | Rôle |
|---|---|---|
| **Disponibilité des tables** | La **salle**. Physique | **Décide** libre / serré / complet. La seule qui gouverne la bande d'heures et le widget |
| **Cadence d'arrivée** | La **cuisine**, en pointe | **Avertit.** Huit tables à 20:00 pile est plaçable et humainement intenable — c'est ce que « X couverts / 15 min » cherchait vraiment : un étalement, pas un plafond |
| **Plafond de couverts** | La **cuisine**, en volume | **Avertit.** 60 assiettes dans la soirée, quel que soit le nombre de tables. Réel, mais jamais un signal de disponibilité |

**Une seule décide, deux avertissent.** Les deux avertissements sont réglables, **désactivés par défaut**, et *ne sont pas prioritaires pour la v1* : la disponibilité des tables suffit à faire fonctionner le logiciel.

Et dans tous les cas : **aucune jauge « 24 / 35 » ne s'affiche comme un indicateur de remplissage.** Ce chiffre a déjà trompé quelqu'un ; il n'a pas sa place dans un en-tête.

### 9.5 Un réglage qui contredit le réel doit le dire tout de suite

Changer `rotation_defaut` est sans danger : les réservations existantes gardent la durée reçue à leur création (§3.1). Mais **fermer un jour, ou raccourcir un service, entre en conflit avec des réservations déjà prises** — et là, le logiciel ne peut pas se contenter d'enregistrer.

Le panneau confronte : « Ce jour porte déjà **3 réservations confirmées · 11 couverts** », la liste avec les heures, les noms et **les numéros de téléphone**, puis trois sorties :

1. **Annuler la fermeture**
2. **Fermer et prévenir les clients** — les messages partent (§9.7)
3. **Fermer, je les appelle** — aucun message ne part

La troisième n'est pas un repli, c'est souvent la bonne. Annuler par courriel le réveillon de quelqu'un est le genre de chose qui coûte un client définitivement ; un appel le sauve. C'est pourquoi les numéros sont affichés dans la liste, prêts à composer.

**Dans les trois cas, les annulations portent `annule_par = restaurant`** (§3.1). Aucun de ces clients ne doit voir son compteur de fiabilité bouger pour une fermeture dont il n'est pas responsable.

### 9.6 Les conditions d'annulation

#### Pourquoi elles existent : il n'y a rien d'autre

Le cahier exclut l'empreinte bancaire en v1. Sans elle, un client qui ne vient pas ne se coûte rien à lui-même et coûte une table au restaurant. **Il reste un seul levier : un engagement que le client a activement pris.** Ce n'est pas un ornement juridique, c'est la seule pièce du dispositif anti-no-show.

D'où : **la case est cochée par le client, jamais pré-cochée**, et le bouton « Réserver » reste éteint tant qu'elle ne l'est pas. Un bas de page qu'on ne lit pas ne change aucun comportement ; un geste actif, si — non parce qu'il serait exécutoire, mais parce qu'une personne qui a dit oui explicitement se sent tenue.

#### Trois fonctions

| Fonction | Ce qu'elle produit |
|---|---|
| **Dissuader** | « Prévenez-nous 2 h avant » transforme un no-show en annulation — et une annulation à 18 h, c'est une table qu'on revend |
| **Rendre le compteur défendable** | Sans conditions acceptées, le compteur de no-show du §7 n'est que **l'opinion privée du restaurant** sur son client. Avec elles, c'est la mesure d'un écart à une règle lue et approuvée. C'est ce qui permet de dire « vous aviez accepté de nous prévenir » plutôt que « vous nous avez posé un lapin » |
| **Écrire les règles de la maison** | Ce texte n'est pas du droit, c'est le **mode d'emploi du restaurant** : « table gardée 15 minutes », « au-delà de 8 personnes nous rappelons », « terrasse non garantie ». Elles ne vivent aujourd'hui que dans la tête du patron |

#### Le texte ne doit pas contredire les réglages

Si le texte annonce « table gardée 15 minutes » et que `retard_grace` vaut 30, le restaurant ment à son client sans le savoir. **L'éditeur affiche donc, à côté du texte, ce que le logiciel fait réellement** — `retard_grace`, l'état des rappels, le délai d'annulation autorisé — avec les écarts signalés en corail et une proposition d'alignement.

#### Ce qu'on enregistre au moment du clic

**Pas un booléen.** Une case stockée en `true` ne prouve rien six mois plus tard : on ne sait plus *quel texte* a été accepté. Si les conditions changent en mars, un client qui a réservé en janvier a accepté le texte de janvier.

Donc : **chaque enregistrement du texte crée une version**, et la réservation garde le numéro de version accepté plus l'horodatage. Le journal (§6.8) porte alors « conditions acceptées (version 3) » et le texte exact est réaffichable. C'est ce qui rend vrai la promesse du §6.8 : *on peut montrer*.

#### Le texte vide

**Si le texte est vide, rien ne s'affiche sur le widget** : pas de case, pas de mention. Un restaurant qui ne veut embarrasser personne a le droit de ne rien écrire, et le logiciel ne doit pas le harceler.

Mais il ne doit **jamais** afficher une case « j'accepte les conditions » qui ne pointe vers rien : c'est sans valeur, et ça fait mentir le restaurant à son client.

**Un texte est proposé au départ**, déjà aligné sur les réglages en place — le logiciel connaît `retard_grace` et sait si les rappels sont actifs. Le restaurateur corrige au lieu d'écrire : vide, ce champ le resterait pour toujours, parce que personne ne rédige des conditions d'annulation un mardi.

### 9.7 La fermeture exceptionnelle porte un message — et **deux** champs

Annuler la soirée de quelqu'un sans dire pourquoi est le pire message qu'un restaurant puisse envoyer. Mais **la raison notée pour soi et la phrase que le client lit ne sont pas la même chose.**

« Chef malade » est une information dont onze clients n'ont pas besoin — et qui, lue par un inconnu, en inquiète certains sur la cuisine. **C'est exactement la séparation du §7.5** entre `allergies` (affiché) et `notes_internes` (ne sort jamais) : même principe, deuxième application.

| Champ | Traitement |
|---|---|
| **Motif** — pastilles *(Fériés · Maladie · Travaux · Privé · Autre)* + texte libre | Fond gris, mention « **jamais envoyé** ». Alimente le journal et, plus tard, les statistiques : combien de soirs perdus cette année, et pourquoi |
| **Message aux clients** | Fond orange, mention « **lu par 3 clients** ». Pré-rédigé, modifiable |

Quatre décisions :

1. **Le motif se pose en un geste.** À 17 h, quand le chef vient d'appeler, personne n'a envie de rédiger. Les pastilles couvrent les cas courants, le texte libre le reste.
2. **Le message par défaut est bon.** Sous le coup du stress, le restaurateur enverra exactement ce qui est proposé — le texte pré-rédigé doit donc déjà être celui qu'on voudrait recevoir : date et heure insérées, excuse franche, et **une invitation à revenir**. La meilleure réparation n'est pas une formule de politesse.
3. **Envoi différé de 8 s, et le bandeau dit le compte.** La règle du §6.7, avec une précision qui compte : « 3 messages partent dans 8 s ». Trois est une chose, vingt-sept en est une autre — et c'est le dernier instant où l'on peut vérifier qu'on a fermé le bon jour.
4. **Même panneau depuis l'Accueil.** Fermer ce soir en urgence et prévoir la fermeture d'août sont le même geste : un seul composant, deux points d'entrée — comme le formulaire de création au §8.1.

### 9.8 Qui peut toucher à quoi

Le §4.7 réserve les paramètres à l'administrateur. Une nuance s'impose : **fermer *ce soir* n'est pas un paramétrage.** Le chef est malade à 17 h et le patron n'est pas là. La fermeture du jour se déclare **depuis l'Accueil**, accessible au rôle Service, avec le même panneau de conflit et les mêmes deux champs.

Les paramètres servent à *prévoir* les fermetures ; l'Accueil à *subir* celle d'aujourd'hui.

### 9.9 Deux réglages qui ne peuvent pas être à moitié faits

**Désactiver les rappels doit dire ce que ça coûte.** Le rappel J-1 remplit `rappel_envoye_le`, et la réponse du client alimente `confirme_par_client_le` (§3.1). Sans rappel, un client qui ne vient pas n'a jamais eu l'occasion de se dédire — **le compteur de no-show devient plus sévère qu'il n'est juste**. La bascule le dit en une phrase.

**Changer `pas_creneau` change la frise et la bande d'heures.** Passer de 30 à 15 minutes double la longueur de la bande du §8.3 et la densité de la frise du §5.4. Le réglage montre l'effet avant de valider.

---

## 10. L'éditeur de plan (admin)

Plein écran, atteint par le crayon, réservé au rôle administrateur (§4.7).

### 10.1 La contrainte de départ

C'est un outil de dessin pour quelqu'un qui ne dessine pas. Un restaurateur l'ouvre le jour de l'installation, puis quand il achète deux tables.

> **Aucune courbe d'apprentissage n'est finançable : ce qui n'est pas compris en dix secondes ne le sera jamais**, parce qu'il n'y aura pas de deuxième fois pour apprendre.

### 10.2 Créer une table : glisser depuis la palette, puis remplir à droite

Une **palette de types de tables** à gauche (ronde 2, carrée 4, rectangulaire 6…). On glisse un type sur le plan : **la table naît là où on l'a lâchée**, nommée automatiquement (T1, T2, T3…), et **le panneau de droite prend aussitôt le relais** pour le nom, les places, la forme et les dimensions.

Un geste pour la poser, un panneau pour la décrire. La palette se complète d'elle-même : chaque forme utilisée y reste disponible. **« Dupliquer »** couvre les huit tables de 2 identiques.

**Ceci remplace le formulaire préalable initialement prévu.** La séparation « créer d'abord sans plan, poser ensuite » avait une bonne raison — ne pas se battre avec une souris pendant la saisie — mais elle produit un défaut plus coûteux : après le formulaire, douze tables indifférenciées s'empilent dans un coin, à distribuer une par une. La saisie était rapide, le rangement devenait pénible.

Surtout : **une table « créée mais nulle part » est un état que le reste du logiciel ne sait pas représenter.** Avec la palette, le plan est constamment cohérent — il n'existe jamais de table sans emplacement.

### 10.3 Cinq décisions qui font la différence entre un plan et un gribouillis

| Décision | Pourquoi |
|---|---|
| **Le canevas est en mètres, la grille à 25 cm** | La salle se saisit en dimensions réelles (8,00 m × 5,50 m), les tables en centimètres. **Un plan à l'échelle ressemble à la vraie salle** — et c'est la seule chose qui compte, puisqu'on s'en sert pour reconnaître « la table du fond à droite » en trois secondes. Un plan aux proportions fantaisistes se lit plus lentement que rien |
| **Tout s'aimante à la grille** | Sans aimantation, dix tables placées à la main sont dix tables de guingois — et un plan de travers donne l'impression d'un logiciel bricolé. Rotation aimantée par pas de 15° |
| **Du décor, parce qu'on s'oriente avec** | Murs, porte, bar, passe cuisine, pilier. **Ce n'est pas de la décoration, ce sont les repères** : sans la porte et le bar, huit rectangles gris ne sont pas une salle, et le serveur doit lire les numéros au lieu de reconnaître l'endroit |
| **Les combinaisons sont visibles sur le plan** | Deux tables voisines ont exactement la même apparence, qu'une combinaison `5-6` soit déclarée ou non. **Sans marque, on ne peut pas auditer son propre paramétrage** ni comprendre pourquoi le logiciel propose un rapprochement ici et pas là. Une pastille violette porte le nom et la capacité |
| **Une table se désactive, ne se supprime pas** | Même règle que les combinaisons (§3.4). Une réservation de 2024 mentionne « T7 » : si T7 disparaît de la base, l'historique devient illisible et les statistiques par table sont fausses. La table quitte le plan, la donnée reste |

Le panneau de droite porte aussi la **salle** de la table : c'est ainsi qu'on déplace une table vers la terrasse, plutôt qu'en la glissant sur un onglet — un geste qu'on ne réussit pas du premier coup et qu'on déclenche par accident.

### 10.4 Le fond de plan : décalquer plutôt que deviner

La plupart des restaurateurs ont déjà un plan — un PDF de l'architecte, une photo, un croquis. **On peut poser cette image en fond de canevas et poser les tables par-dessus.** C'est probablement le raccourci le plus utile de toute l'installation : dessiner une salle de mémoire prend une heure, la décalquer prend dix minutes et donne un meilleur résultat.

Trois règles :

1. **L'image doit être calibrée avant de servir.** Une photo n'a pas d'échelle. On trace une ligne sur une longueur connue — le chambranle d'une porte, un mur — et on saisit sa dimension réelle : le logiciel met l'image à l'échelle. Sans cette étape, le plan décalqué *paraît* juste mais ses tables ont la mauvaise taille, et tout le §10.3 s'effondre en silence.
2. **L'opacité est réglable**, pour que le fond reste un guide et non un motif qui masque les tables.
3. **Le fond ne se publie jamais.** C'est une aide au tracé, visible dans l'éditeur seulement. Une photo derrière le plan de service ruinerait la lisibilité au coup d'œil que toute la §2 cherche à obtenir — et les repères du service existent déjà, ce sont les objets `Décor`. Deux mécanismes pour la même chose vaudraient moins qu'un. Une fois le décalquage fini, l'image peut être supprimée.

### 10.5 L'accolage

Coller une table contre une autre fait apparaître un cadre orange et propose de créer une table virtuelle :

- Nom pré-rempli à partir des numéros (« 12-13 »), modifiable.
- Capacité proposée à la somme, modifiable.
- Deux boutons d'importance égale : **« Créer »** et **« Non, juste les déplacer »**.

Ce second bouton n'est pas un détail : deux tables de 2 collées le long d'une banquette ne forment pas une table de 4 réservable. **Le système ne doit rien déduire tout seul.**

### 10.6 Le brouillon — la seule exception à la règle de l'action immédiate

Partout ailleurs, ce logiciel agit tout de suite et offre huit secondes pour annuler (§6.7). **Ici, non : on modifie un brouillon, et on publie.** L'en-tête porte en permanence « **Brouillon · 4 modifications** », plus une annulation par étapes (↶ ↷) et un « Abandonner » qui remet tout.

Deux raisons, et la seconde est la plus forte :

1. **Un plan est une composition.** Trente déplacements ne se jugent pas un par un ; un bandeau de 8 s après chaque glissement serait inutile, parce qu'on ne sait pas qu'on s'est trompé avant d'avoir regardé l'ensemble.
2. **La salle est peut-être pleine.** Si l'administrateur réorganise le plan à 20 h 30 depuis le bureau, **l'équipe en service ne doit pas voir les tables bouger sous ses doigts**. Le plan publié reste celui du service en cours jusqu'à la publication. Un plan à moitié fini poussé en direct est pire que pas de changement du tout.

Le bandeau permanent répond à la question qu'on se pose en revenant deux jours plus tard : *est-ce que j'avais fini ?*

### 10.7 Désactiver une table qui porte des réservations

Même classe de problème que fermer un jour occupé (§9.5), donc **même traitement : on confronte.** Le panneau liste les réservations à venir sur cette table et signale les combinaisons dont elle est membre, puis offre trois sorties : *Annuler*, *Replacer ces réservations*, *Désactiver et les laisser à placer*.

**Aucune réservation n'est jamais annulée par une modification de plan.** Elle retombe au pire dans « À placer » (§5.7) — visible, en attente d'une décision humaine. Un client ne doit pas perdre sa table parce qu'on a déplacé un meuble.

La combinaison dont la table était membre passe simplement **dormante** : elle n'est pas supprimée non plus (§3.4).

---

## 11. Le widget client

Volet A du cahier des charges. Application publique, séparée du back-office.

### 11.1 Trois renversements

C'est le seul écran que voit un client, et le premier du projet qui ne se dessine pas pour un restaurateur.

| | Back-office | Widget |
|---|---|---|
| **Appareil** | Surface Pro, souris ou doigt posé | **Un pouce sur un téléphone**, debout dans la rue. Une colonne, cibles larges, aucun survol |
| **Utilisateur** | Apprend son logiciel, y revient tous les jours | **Ne reviendra pas.** Une hésitation de trois secondes et il téléphone — ou réserve ailleurs |
| **Vocabulaire** | Statuts, tables, `~✓`, serré | **Rien de tout ça.** Le client n'a pas à connaître la mécanique d'un restaurant pour y dîner |

L'ordre des questions reste celui de l'appel téléphonique (§8.2) : **combien → quel jour → à quelle heure → qui**. On ne demande les coordonnées qu'une fois la place trouvée.

### 11.2 Ce que le client peut réserver — la règle complète

Le §9.4 a défini deux modes d'occupation. **Ils ne donnent pas le même widget.**

| Mode du service | État du créneau | Ce que le client voit | Statut créé |
|---|---|---|---|
| **service_unique** | Une table convient pour tout le service | Un créneau normal | Selon la configuration (§11.3) |
| **service_unique** | Aucune table | **Rien** | — |
| **rotation** | Une table est libre **sans supposer aucun départ** | Un créneau normal | Selon la configuration (§11.3) |
| **rotation** | Libre **seulement si un départ prévu a lieu** | « **Sur demande** », bordure pointillée | **Toujours `en_attente`** |
| **rotation** | Ni l'un ni l'autre | **Rien** | — |

**En mode service_unique, « sur demande » n'existe pas.** C'est cohérent par construction : « serré » signifie *oui si quelqu'un part à l'heure*, et dans ce mode personne ne part avant la fin du service. Il y a de la place, ou il n'y en a pas.

**Un rapprochement n'est pas une condition, pour le client.** Le §9.4 donnait deux causes à « serré » : un rapprochement de tables, ou un départ prévu. Seule la seconde franchit le widget. Rapprocher deux tables est un travail que le restaurant maîtrise et qu'il voit venir sur son plan ; un départ à l'heure est un pari sur un tiers. **On ne fait pas peser sur le client une incertitude dont on est maître, et on ne lui cache pas celle dont on ne l'est pas.**

**Un créneau complet ne s'affiche pas grisé : il disparaît.** Le cahier le demande, et c'est juste — une liste d'heures barrées donne l'impression d'un restaurant qui refuse plutôt que d'un restaurant qui marche. Une ligne discrète suffit : « 20:30 n'est plus disponible ».

C'est **l'inverse exact du §8.4**, où « complet » n'est jamais un verrou. Le restaurateur peut forcer parce qu'il connaît sa salle ; le client, non.

### 11.3 Deux barrières, de natures différentes

Ce qui précède sépare ce que j'avais confondu :

| | Nature | Réglable ? |
|---|---|---|
| **Un créneau serré est toujours une demande** | **Structurelle.** Le restaurant ne peut pas promettre ce qui dépend du départ d'un tiers | **Non.** Ce n'est pas une politique commerciale, c'est une limite du réel |
| **Confirmation automatique d'un créneau franchement libre** | **Politique.** Combien de fois par jour le restaurateur veut-il arbitrer | **Oui**, par un simple oui/non |

**Il n'existe aucun seuil de couverts déclenchant une validation.** Un nombre de couverts ne dit rien de la place disponible : plusieurs réservations de 4 posées sur des tables de 6 laissent des trous, sous-comptent les couverts, et un seuil calé là-dessus finirait par accorder une réservation alors qu'aucune table n'est libre. **La disponibilité se lit sur les tables, et sur elles seules (§9.4)** — ici comme partout ailleurs.

Une grande tablée n'a donc pas besoin d'un réglage à part : si le logiciel propose le créneau, c'est qu'une table ou une combinaison la reçoit réellement. Un restaurateur qui veut malgré tout poser les yeux sur chaque demande désactive simplement la confirmation automatique.

Un restaurant en **service_unique** n'a que cette seconde barrière, la première n'ayant pas d'objet chez lui. C'est cohérent : dans ce mode, il n'existe aucune incertitude à arbitrer, seulement une préférence de contrôle.

**Aucune mécanique nouvelle n'est nécessaire.** `en_attente` existe au §3.1, le bandeau violet au §6.1, le badge du plan au §5.7, et « accepter et placer d'un geste » au §6.7. Le widget ne fait que remplir une file déjà conçue.

### 11.4 Deux règles de confidentialité qui ne se voient pas

**Le widget ne révèle jamais ce que le restaurant sait.** Saisir un numéro déjà connu rattache la réservation à la fiche client (§7.2) — **en silence, côté serveur**. Jamais de « bonjour Sophie ! », jamais d'allergie pré-remplie, jamais de « votre 41ᵉ visite ».

Sinon **n'importe qui tapant un numéro de téléphone apprendrait où son propriétaire dîne, à quelle fréquence, et ses allergies.** Le confort d'un habitué ne vaut pas ça.

**Aucune table n'est montrée ni choisie.** Pas de plan de salle côté client. Le choix de table est le levier d'optimisation du restaurant : deux personnes qui prennent la table de 6 coûtent la soirée. Le client exprime au mieux une **préférence de salle** — terrasse, intérieur — qui alimente `zone_souhaitee` (§3.1). Une préférence n'est pas une promesse, et le §5.8 le rappelle déjà au placement.

### 11.5 Le champ allergies est séparé du commentaire

Le cahier prévoit un champ unique « commentaires / allergies / demandes ». **Il faut le couper en deux**, pour la raison posée au §7.5 :

| Champ du widget | Où ça va | Pourquoi |
|---|---|---|
| **« Allergies ou intolérances »** *(facultatif)* | `Client.allergies` | Une allergie tapée dans un commentaire libre atterrit dans `Reservation.note`, d'où le logiciel **ne peut ni l'épingler en corail (§6.6) ni la faire suivre** aux visites suivantes. C'est la seule information que le widget peut capter et dont l'oubli a une conséquence physique — et la demander est un signal de sérieux |
| **« Une demande ? »** *(facultatif)* | `Reservation.note` | Anniversaire, poussette, préférence de salle. Attaché à *cette* réservation, pas au client : on ne fête pas un anniversaire toute l'année |

### 11.6 La fin du parcours

**Page de confirmation immédiate**, puis e-mail récapitulatif (volet A). Deux versions selon le statut créé :

- **Confirmée** — « C'est réservé », récapitulatif, adresse, téléphone, conditions d'annulation rappelées, lien « ajouter à mon agenda ».
- **En attente** — « Demande envoyée », et une phrase qui ne laisse aucune ambiguïté : **« Ce n'est pas encore une réservation. Le restaurant vous confirme par e-mail. »** Un client qui croit avoir réservé alors qu'il a demandé est un no-show involontaire, et une soirée gâchée pour deux parties.

Les conditions d'annulation affichées et la case à cocher suivent le §9.6 : jamais pré-cochée, et invisibles si le texte est vide.

La **fenêtre de réservation** (§9.2) gouverne les jours proposés : pas de réservation à moins d'une heure, pas au-delà de l'horizon fixé.

---
## 12. L'Accueil

Écran d'atterrissage hors service (§4.6). Le dernier conçu, et celui qui rassemble ce que les autres lui ont renvoyé.

### 12.1 Il répond à une seule question

Le §4.6 l'a cadré : c'est **l'écran de l'avant et de l'après**, jamais celui de 20 h 30. On l'ouvre donc toujours dans la même situation — on vient d'arriver, le service commence dans un moment — et il n'a qu'une question à traiter :

> **« Est-ce que je peux ouvrir tranquille ? »**

Ce n'est pas « comment va mon restaurant ? ». Celle-là appelle un tableau de bord, et **un tableau de bord se regarde deux fois puis plus jamais**, parce qu'il montre des chiffres qui ne demandent rien.

### 12.2 Deux sections, une seule porte des boutons

| Section | Contenu | Règle |
|---|---|---|
| **À traiter** | Ce qui attend une action | **Chaque ligne porte son geste** — accepter, refuser, placer, confirmer un rapprochement — avec les actions rapides du §6.4. Une notification « 3 demandes en attente » sans moyen d'y répondre est une liste de corvées : elle ajoute une navigation au lieu d'en retirer une |
| **Récapitulatif** | Ce qui est simplement vrai | **Aucun bouton, jamais.** Si un chiffre appelait une action, il serait au-dessus |

Cette séparation stricte est ce qui empêche l'écran de devenir un tableau de bord, et elle rend la première section crédible : ce qui y figure mérite vraiment qu'on s'arrête.

**Et « À traiter » doit pouvoir être vide.** Un écran d'accueil qui a *toujours* quelque chose à montrer apprend à être ignoré. Quand il n'y a rien, il le dit — et c'est une information qui vaut d'être lue : « Rien à traiter. Les demandes sont répondues, et les 11 réservations de ce midi ont toutes une table. »

**Chaque ligne a une condition d'achèvement objective** : une demande est répondue, une table est placée, deux tables sont physiquement collées. Le logiciel sait quand c'est fini. Rien n'y figure dont la clôture dépendrait d'une parole donnée à soi-même — c'est pourquoi les allergies vivent sur l'écran Service (§5.4) et non ici.

### 12.3 L'ordre de « À traiter » : la proximité dans le temps

| Rang | Contenu | Traitement |
|---|---|---|
| **1** | Le **service en cours ou imminent** | **Encadré et surélevé** — bordure violette, ombre portée, titre « SERVICE EN COURS » avec le compte à rebours. Priorité absolue : passé l'ouverture, une demande sans réponse est une table qu'on perd ou qu'on survend |
| **2** | Les services suivants, **du plus proche au plus lointain** | Groupés par service, intertitre discret (« CE SOIR », « SAMEDI 6 SEPT. ») |
| **3** | **Pour information** | Ce qui est déjà résolu et n'attend qu'un regard (§12.4) |

**Bénéfice caché : la liste se réordonne seule au fil de la journée.** Ce qui était « ce soir » à 11 h devient le bloc surélevé à 18 h 30. Un tri par urgence réelle est un tri que personne n'a à maintenir.

Les lignes qui peuvent y figurer :

- **Les demandes en attente**, détaillées une par une et non comptées. « 3 demandes » oblige à cliquer pour décider ; « Bouvier, 7 pers., vendredi » se tranche en lisant. Elles portent leurs marques de qualification (§5.7) : habitué, première visite, no-show ×2.
- **Les réservations sans table** du service concerné. Placer à froid prend une minute ; placer à 12 h 40 avec des gens debout dans l'entrée en prend cinq et se fait mal. Cette ligne déplace le travail au moment où il coûte le moins.
- **Les rapprochements à préparer** (`a_active_le`, §3.4) : « coller 12 et 13 avant 20:30 ». C'est du travail physique dans la salle, et il n'a de sens qu'annoncé à l'avance — personne ne déplace une table pendant le coup de feu.

### 12.4 Les tables oubliées se ferment seules

À 23 h on ferme parfois sans clore les dernières tables : elles resteraient `assise` pour toujours. Les conséquences sont réelles — le plan ment le lendemain matin, les couverts servis sont faux, et le passage à `terminee` qui alimente les compteurs client (§7.4) n'arrive jamais.

> **Règle : à l'ouverture d'un service, toute réservation encore `assise` d'un service précédent passe `terminee`, avec `termine_a = null` et `cloture_auto = vrai`.**

**Le déclencheur est l'ouverture du service suivant, pas la fermeture théorique du service courant.** Un service ferme à 23:00 et des gens finissent leur dessert à 23:40 : c'est normal, et clore à l'heure dite mentirait autant que l'oubli.

Ce qu'on perd est assumé : la durée réelle du repas. `termine_a` devient nullable, et `cloture_auto` dit pourquoi — ainsi une future statistique de durée moyenne saura **exclure ces lignes au lieu de les croire**. Une donnée manquante et honnête vaut mieux qu'une donnée inventée.

**Cela reste affiché, en dernier**, sous « Pour information », en gris, sans bordure de couleur, avec deux sorties discrètes : *corriger les heures* pour qui tient à sa donnée, *masquer* pour tous les autres.

### 12.5 Le récapitulatif

Trois cartes : **ce midi**, **ce soir**, **hier**. Le service en cours est souligné d'un trait d'encre, pas d'une couleur.

Il couvre la journée entière et pas seulement le service imminent : à 11:12 on prépare le midi, mais **c'est aussi le seul moment calme pour découvrir que le soir est à 18 tables sur 19**.

**Le remplissage se dit en tables** — « 18 tables sur 19 au plus fort, vers 20:30 ». Les couverts figurent aussi, mais comme volume de travail pour la cuisine, jamais comme jauge de remplissage (§9.4). Le pic est nommé **avec son heure** : c'est le seul chiffre qui change quelque chose à la façon dont on organise sa soirée.

La carte « hier » porte les couverts servis, les no-shows, les annulations tardives et les clients de passage. Sans bouton : ce qui appelait une action est remonté au-dessus.

### 12.6 Les raccourcis

Sous l'horloge : **Voir le service** (en encre, la destination normale — et il nomme le service concerné), **Voir les réservations**, **Clients**, plus le **« + Réservation »** à droite, cohérent avec le « + » global du §8.1.

Ils font double emploi avec le rail, volontairement. **Le rail sert à naviguer, ces boutons servent à partir** : quand on a fini de lire l'Accueil, on va quelque part, et le geste suivant mérite d'être là où le regard vient de s'arrêter plutôt qu'à 34 px du bord gauche.

### 12.7 « Fermer aujourd'hui »

En haut à droite, en gris, **jamais en rouge**. Ce n'est pas une alerte : c'est une action rare qu'il faut pouvoir trouver sans jamais la craindre.

Elle ouvre le panneau du §9.7 — motif interne, message aux clients, confrontation des réservations concernées — et reste accessible au rôle Service (§9.8).

### 12.8 Après le service

À 23 h 40, le compte à rebours n'a plus d'objet et le bandeau change de phrase : **« Service terminé · prochain service demain 11:30 »**.

Le reste ne bouge pas, et c'est voulu : **les tables non libérées apparaissent alors avant qu'on parte**, au moment où les clore est encore naturel — plutôt que le lendemain matin, comme une réparation. La même ligne rend deux services à deux moments : un rappel le soir, un rattrapage au matin.

---

## 13. Points ouverts

| Sujet | État |
|---|---|
| Rendu sur Surface Pro 7 | À vérifier en conditions réelles : lisibilité du halo vert-jaune posé sur une table « à nettoyer » (deux jaunes voisins), et lisibilité générale à trois mètres |
| Partage d'une table entre deux réservations | **Écarté.** Les tables virtuelles rendent le besoin caduc : la granularité réservable est l'entité, pas la place |
| Zoom / déplacement du plan | Nécessaire pour les grandes salles sur tablette. Mécanique non conçue |
| Fichier `TableUp.fig` | Jamais ouvert. Son contenu n'a été ni lu ni pris en compte |
| Rapprochements en chaîne | Le modèle les supporte (`12-13-14`). L'ergonomie de création à trois tables ou plus n'a pas été dessinée |
| Agenda et salles | Les onglets de salle filtrent-ils aussi l'agenda, ou l'agenda montre-t-il toutes les salles groupées ? Non tranché |
| Agenda : hauteur | Au-delà d'une vingtaine de tables, les lignes ne tiennent plus dans un écran. Défilement vertical présumé, non conçu |
| Téléphone | Hors périmètre. La bascule du rail en barre basse est prévue dans la structure, pas dessinée |
| Placer depuis l'écran Réservations | « Placer » bascule vers la vue Plan au bon service. Le retour vers la liste après placement n'est pas conçu |
| File d'envoi différé | Le bandeau de 8 s suppose une file de messages annulable côté serveur. Comportement si l'application est fermée pendant le délai : non tranché |
| Modification d'une réservation | §6.6 dit que le panneau signale l'affectation devenue invalide. L'écran de modification lui-même n'est pas dessiné |
| Seuil du ratio no-show | À partir de quel rapport le badge `2 / 41` passe-t-il en corail plein ? Un seuil absolu punit le nouveau client, un seuil relatif punit le rare visiteur. Non tranché |
| Recomptage nocturne | §7.4 prévoit un recomptage global des compteurs client. Sa fréquence et son coût sur une grosse base ne sont pas évalués |
| Import de clients | Un restaurateur qui arrive avec un fichier existant contourne la règle « le téléphone est la clé » : l'écran d'import et sa déduplication ne sont pas conçus |
| Calcul de la bande d'heures | §8.3 suppose de tester chaque créneau contre l'occupation et les rapprochements possibles. Le coût de ce calcul à chaque frappe n'est pas évalué |
| Pas des créneaux | La bande affiche des demi-heures. Un service qui travaille au quart d'heure la rendrait deux fois plus longue : non tranché |
| Réservation à cheval sur deux services | Le formulaire demande un service. Un déjeuner tardif qui déborde sur le dîner n'a pas de comportement défini |
| Texte proposé des conditions | §9.6 prévoit un texte par défaut aligné sur les réglages. Sa rédaction exacte n'est pas écrite, et elle engage le restaurant |
| Statistiques de fermeture | Le champ `motif` est prévu pour alimenter un « combien de soirs perdus, et pourquoi ». L'écran n'existe pas |
| Prévision de départ et réalité | §9.4 affiche « serré » quand un créneau dépend d'un départ prévu. Ce que le logiciel fait quand le départ n'a pas lieu — prévenir ? proposer une autre table ? — n'est pas conçu |
| Zoom et échelle du canevas | §10.3 fixe le plan en mètres. Comment une salle de 15 m tient sur une Surface Pro — zoom, ajustement automatique — rejoint le point « zoom / déplacement du plan » ci-dessus, toujours non conçu |
| Formats du fond de plan | §10.4 accepte une image. Un PDF multi-pages, ou un plan vectoriel, demanderaient une conversion dont le coût n'est pas évalué |
| Deux demandes sur le même créneau serré | Une demande `en_attente` ne réserve aucune table — sinon une demande oisive bloquerait la salle. Deux clients peuvent donc demander le même créneau, et le restaurateur arbitre. Le comportement d'affichage de ce cas n'est pas conçu |
| Modifier ou annuler côté client | §11.6 renvoie vers l'e-mail et le téléphone. Un lien d'annulation autonome éviterait des appels, mais demande un jeton et une page publique de plus : hors périmètre v1, non conçu |
| Nombre d'allergies par service | §5.4 replie au-delà de trois derrière « +3 autres ». Le seuil est posé au jugé, à vérifier sur un vrai service chargé |
| Note de service imprimable | Le briefing d'équipe à voix haute — allergies, tablées, VIP du soir — a été écarté de l'Accueil comme bloc de veille. Un document lisible d'un coup avant le service reste une idée non conçue |
| Correction d'une clôture automatique | §12.4 propose « corriger les heures ». L'écran de saisie de cette correction n'est pas dessiné |
