# TUROAPI — migrations Entity Framework Core

> Commandes à lancer depuis `source/TURO/TUROAPI/TUROAPI`.

| Besoin | Commande |
|---|---|
| Créer une migration | `dotnet ef migrations add <Nom>` |
| Lister les migrations et leur état | `dotnet ef migrations list` |
| Supprimer la dernière migration non appliquée | `dotnet ef migrations remove` |
| Appliquer les migrations en attente | `dotnet ef database update` |
| Aller jusqu'à une migration précise | `dotnet ef database update <Nom>` |
| Tout annuler | `dotnet ef database update 0` |
| Supprimer la base | `dotnet ef database drop --force` |
| Générer le SQL | `dotnet ef migrations script --idempotent --output migration.sql` |

Sous Visual Studio (Console du Gestionnaire de package) : `Add-Migration`, `Get-Migration`, `Remove-Migration`, `Update-Database`, `Script-Migration`.
