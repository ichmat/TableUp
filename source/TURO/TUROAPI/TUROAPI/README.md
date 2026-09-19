# TUROAPI — migrations Entity Framework Core

L'API ne contient aucun script SQL : **le schéma de la base est produit par les migrations EF Core**, versionnées dans le dépôt. Ce document liste les commandes.

> Sauf mention contraire, toutes les commandes se lancent **depuis `source/TURO/TUROAPI/TUROAPI`** (le dossier qui contient `TUROAPI.csproj`).
>
> Pour les lancer depuis ailleurs, ajoute `--project <chemin vers TUROAPI.csproj>`.

Pour démarrer la base et l'application, voir [`source/TURO/README.md`](../README.md).

---

## Prérequis

| Élément | Vérification | Si absent |
|---|---|---|
| Outil `dotnet-ef` | `dotnet ef --version` | `dotnet tool install --global dotnet-ef` |
| Paquet `Microsoft.EntityFrameworkCore.Design` | Déjà dans `TUROAPI.csproj` | — |
| Un `DbContext` dans le projet | `dotnet ef dbcontext list` | Voir ci-dessous |
| Une chaîne de connexion | `dotnet user-secrets list` | Voir [`README.md` §3.2](../README.md#32-donner-la-chaîne-de-connexion-à-lapi-une-seule-fois) |

Mettre l'outil à jour : `dotnet tool update --global dotnet-ef`

⚠️ **Tant qu'aucun `DbContext` n'existe**, toutes les commandes échouent avec `Unable to create a 'DbContext' of type ''`. Ce n'est pas une erreur de configuration : il faut d'abord une classe `TuroDbContext` et son enregistrement dans `Program.cs` (`builder.Services.AddDbContext<TuroDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Turo")))`).

ℹ️ `dotnet ef` s'exécute **sur ta machine**, jamais dans le conteneur. Il lit donc les *user secrets*, pas la variable `ConnectionStrings__Turo` que Compose passe à l'API. Le user secret doit être renseigné même si tu travailles en mode dev.

---

## Le cycle normal

```
1. Modifier les classes de Models/
2. dotnet ef migrations add <Nom>
3. LIRE le fichier généré dans Migrations/
4. dotnet ef database update
```

⛔ **L'étape 3 n'est pas facultative.** EF déduit le schéma par convention : toute colonne que tu n'as pas déclarée est une convention qui ne t'a pas compris. La migration est le seul endroit où ça se voit avant que ce soit en base.

---

## Créer et inspecter

| Besoin | Commande |
|---|---|
| Créer une migration | `dotnet ef migrations add <Nom>` |
| Lister les migrations et leur état | `dotnet ef migrations list` |
| Lister sans se connecter à la base | `dotnet ef migrations list --no-connect` |
| Vérifier si les modèles ont changé depuis la dernière migration | `dotnet ef migrations has-pending-model-changes` |
| Voir le `DbContext` détecté | `dotnet ef dbcontext info` |

ℹ️ `migrations add` **ne se connecte pas** à la base : elle compare tes modèles au dernier *snapshot* (`Migrations/TuroDbContextModelSnapshot.cs`). Postgres n'a donc pas besoin de tourner pour créer une migration — seulement pour l'appliquer.

## Appliquer

| Besoin | Commande |
|---|---|
| Appliquer toutes les migrations en attente | `dotnet ef database update` |
| Aller jusqu'à une migration précise | `dotnet ef database update <NomMigration>` |
| Créer la base si elle n'existe pas | *(fait automatiquement par `database update`)* |

## Revenir en arrière

| Besoin | Commande |
|---|---|
| Supprimer la **dernière** migration (pas encore appliquée) | `dotnet ef migrations remove` |
| Annuler jusqu'à une migration donnée, en base | `dotnet ef database update <MigrationPrécédente>` |
| Tout annuler, base vide de schéma | `dotnet ef database update 0` |
| Supprimer la base entière | `dotnet ef database drop --force` |

⚠️ `migrations remove` refuse de retirer une migration **déjà appliquée**. L'ordre est toujours : d'abord revenir en arrière en base (`database update <précédente>`), ensuite `migrations remove`.

⛔ `database drop` et `database update 0` détruisent les données. Il n'y a pas d'annulation.

## Générer du SQL

Pour un déploiement où l'on n'exécute pas `dotnet ef` — une box chez un restaurateur, par exemple.

| Besoin | Commande |
|---|---|
| Script de toutes les migrations | `dotnet ef migrations script` |
| Script entre deux migrations | `dotnet ef migrations script <De> <À>` |
| Script rejouable sans risque | `dotnet ef migrations script --idempotent --output migration.sql` |
| Exécutable autonome qui applique les migrations | `dotnet ef migrations bundle` |

ℹ️ `--idempotent` enveloppe chaque migration dans un test « si elle n'est pas déjà appliquée ». C'est la forme à privilégier dès qu'on ne sait pas avec certitude dans quel état est la base cible.

---

## Depuis Visual Studio

Console du Gestionnaire de package (`Outils ▸ Gestionnaire de package NuGet ▸ Console`), avec **TUROAPI** comme projet par défaut :

| Terminal | Console du Gestionnaire de package |
|---|---|
| `dotnet ef migrations add <Nom>` | `Add-Migration <Nom>` |
| `dotnet ef migrations list` | `Get-Migration` |
| `dotnet ef migrations remove` | `Remove-Migration` |
| `dotnet ef database update` | `Update-Database` |
| `dotnet ef database update <Nom>` | `Update-Database <Nom>` |
| `dotnet ef migrations script` | `Script-Migration` |

---

## Options utiles

| Option | Effet |
|---|---|
| `--project <csproj>` | Projet qui contient le `DbContext` |
| `--startup-project <csproj>` | Projet qui porte la configuration (ici le même) |
| `--context <NomDuContext>` | À préciser s'il y a plusieurs `DbContext` |
| `--no-build` | Ne recompile pas — utile en boucle rapide, dangereux si le code a changé |
| `--verbose` | Affiche la cause réelle derrière un message d'erreur laconique |

---

## Conventions de nommage

Un nom de migration décrit **le changement**, pas la date ni le numéro — EF préfixe déjà l'horodatage.

| ✅ | ⛔ |
|---|---|
| `InitialCreate` | `Migration1` |
| `AddRefreshToken` | `Update` |
| `DropCompositeKeys` | `Fix` |
| `AddUserStaffLoginIndex` | `20260916` |

---

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `Unable to create a 'DbContext' of type ''` | Pas de `DbContext`, ou il n'est pas enregistré dans `Program.cs` | Ajouter la classe et son `AddDbContext` |
| `No project was found` | Commande lancée depuis le mauvais dossier | Se placer dans `source/TURO/TUROAPI/TUROAPI`, ou passer `--project` |
| `Connection refused` / `No connection could be made` | Postgres ne tourne pas | `docker compose up -d` depuis `source/TURO` |
| `password authentication failed for user "turo"` | *User secret* absent ou différent du `.env` | Refaire [`README.md` §3.2](../README.md#32-donner-la-chaîne-de-connexion-à-lapi-une-seule-fois) |
| `The migration '<X>' has already been applied` | `migrations remove` sur une migration en base | `dotnet ef database update <précédente>` d'abord |
| `Build failed` | Le projet ne compile pas | `dotnet build` et corriger — EF a besoin de l'assembly pour lire le modèle |
| La migration générée est vide | Aucun changement détecté depuis le snapshot | `dotnet ef migrations has-pending-model-changes` pour confirmer |
| Une colonne inattendue apparaît dans la migration | Une FK non déclarée, complétée par une propriété *shadow* | Vérifier l'annotation `[ForeignKey]` ou la configuration Fluent de la relation |
