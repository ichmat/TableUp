# TURO — lancer l'application

TURO est le logiciel restaurateur de TableUp. Ce dossier contient :

| Dossier | Contenu |
|---|---|
| `TUROAPI/` | API ASP.NET Core (.NET 10) |
| `TUROApp/` | Front Angular 22 |

L'application se lance de **trois façons**, toutes décrites dans `compose.yaml` :

| Mode | À quoi il sert | Ce qui tourne dans Docker |
|---|---|---|
| [**Prod**](#1-mode-prod) | Tester l'image telle qu'elle sera livrée sur la box ou en hébergé | Postgres + **une seule image** `turo` (API + front) |
| [**Dev**](#2-mode-dev) | Développer avec rechargement à chaud, sans rien installer d'autre que Docker | Postgres + API (`dotnet watch`) + front (`ng serve`) |
| [**Base seule**](#3-mode-base-seule) | Développer dans l'IDE (débogueur, points d'arrêt) | Postgres uniquement |

> Toutes les commandes de ce document se lancent **depuis `source/TURO`**.

---

## Prérequis

| Outil | Prod | Dev | Base seule |
|---|:---:|:---:|:---:|
| Docker Desktop (Compose v2.22 ou plus) | ✅ | ✅ | ✅ |
| .NET SDK 10 | — | — | ✅ |
| Node.js 24 (ou 22.22+) | — | — | ✅ |

⚠️ **Docker Desktop doit être démarré** avant toute commande `docker`. Tant qu'il ne l'est pas, les commandes échouent avec `request returned 500 Internal Server Error`.

## Configuration : le fichier `.env`

À faire **une seule fois**, avant le premier lancement :

```powershell
Copy-Item .env.example .env
```

Ouvre ensuite `.env` et **change `POSTGRES_PASSWORD`**.

| Variable | Défaut | Rôle |
|---|---|---|
| `POSTGRES_DB` | `turo` | Nom de la base |
| `POSTGRES_USER` | `turo` | Utilisateur Postgres |
| `POSTGRES_PASSWORD` | *(obligatoire)* | Mot de passe Postgres. Sans lui, Compose refuse de démarrer |
| `POSTGRES_PORT` | `5432` | Port de Postgres sur ta machine |
| `TURO_PORT` | `8080` | Port de l'application en mode prod |
| `API_PORT` | `5080` | Port de l'API en mode dev |
| `FRONT_PORT` | `4200` | Port du front en mode dev |

⛔ **Le fichier `.env` n'est jamais commité.** Il est dans le `.gitignore`. Seul `.env.example` est versionné.

---

## 1. Mode prod

Construit et lance **l'artefact livré** : une seule image qui contient l'API et le front, plus Postgres.

```powershell
docker compose --profile prod up --build
```

➡️ Ouvre **http://localhost:8080**

| URL | Réponse |
|---|---|
| `http://localhost:8080/` | L'application Angular |
| `http://localhost:8080/settings` (toute route Angular) | L'application Angular, qui affiche la bonne page |
| `http://localhost:8080/api/...` | L'API |

**Lancer en arrière-plan :**

```powershell
docker compose --profile prod up --build -d
docker compose --profile prod logs -f turo     # suivre les logs
```

**Arrêter :**

```powershell
docker compose --profile prod down
```

ℹ️ `--build` reconstruit l'image à partir du code actuel. Sans lui, Compose réutilise la dernière image construite, qui peut dater.

---

## 2. Mode dev

Tout tourne dans Docker, avec **rechargement à chaud**. Une modification dans `TUROApp/` ou `TUROAPI/` est recopiée dans le conteneur et prise en compte sans relancer quoi que ce soit.

```powershell
docker compose --profile dev up --build --watch
```

➡️ Ouvre **http://localhost:4200**

| URL | Service |
|---|---|
| `http://localhost:4200` | Front (`ng serve`). Les appels à `/api` sont relayés vers l'API |
| `http://localhost:5080/api/...` | API en direct, pour la tester sans le front |
| `localhost:5432` | Postgres, pour ton outil SQL |

**Ce qui se passe quand tu modifies un fichier :**

| Modification | Effet |
|---|---|
| Fichier Angular (`.ts`, `.html`, `.css`) | Recopié dans le conteneur, la page se recharge |
| Fichier C# (`.cs`) | Recopié, `dotnet watch` applique le changement ou redémarre l'API |
| `TUROApp/package-lock.json` (nouveau paquet npm) | L'image du front est **reconstruite** automatiquement |
| `TUROAPI/TUROAPI/TUROAPI.csproj` (nouveau paquet NuGet) | L'image de l'API est **reconstruite** automatiquement |

**Arrêter :** `Ctrl+C`, puis :

```powershell
docker compose --profile dev down
```

ℹ️ Les dossiers `node_modules`, `bin` et `obj` de ta machine ne sont **jamais** recopiés : ceux du conteneur sont construits pour Linux, ceux de Windows ne fonctionneraient pas.

---

## 3. Mode base seule

Seul Postgres tourne dans Docker. L'API et le front se lancent depuis ton IDE ou ton terminal, avec le débogueur.

### 3.1 Démarrer la base

```powershell
docker compose up -d
```

Postgres écoute sur `localhost:5432`, accessible uniquement depuis ta machine.

### 3.2 Donner la chaîne de connexion à l'API (une seule fois)

Dans ce mode, l'API ne lit pas `.env`. On lui donne la chaîne de connexion par les *user secrets* de .NET : elle reste sur ta machine, hors du dépôt.

```powershell
dotnet user-secrets set "ConnectionStrings:Turo" "Host=localhost;Port=5432;Database=turo;Username=turo;Password=<ton mot de passe du .env>" --project TUROAPI/TUROAPI
```

### 3.3 Lancer l'API

**Terminal :**

```powershell
dotnet watch run --project TUROAPI/TUROAPI --launch-profile http
```

**Visual Studio :** choisis le profil de lancement **`http`**, puis F5.

⚠️ Le profil `Container (Dockerfile)` de Visual Studio est un autre mécanisme : il lance l'API dans un conteneur à part, sans la base du compose. Pour ce mode, prends bien `http`.

L'API écoute sur **http://localhost:5247**.

### 3.4 Lancer le front

```powershell
cd TUROApp
npm install        # la première fois, ou après un changement de package.json
npm start
```

➡️ Ouvre **http://localhost:4200**. Les appels à `/api` sont relayés vers `http://localhost:5247`.

### 3.5 Arrêter la base

```powershell
docker compose down
```

---

## Commandes utiles

| Besoin | Commande |
|---|---|
| Voir les conteneurs qui tournent | `docker compose --profile dev --profile prod ps` |
| Suivre les logs d'un service | `docker compose --profile dev logs -f api` |
| Ouvrir `psql` dans la base | `docker compose exec db psql -U turo -d turo` |
| Reconstruire sans cache | `docker compose --profile prod build --no-cache` |
| Vérifier le compose sans rien lancer | `docker compose --profile dev --profile prod config --quiet` |

### ⚠️ Remettre la base à zéro

Les données de Postgres vivent dans le volume Docker `turo_db-data`. Elles **survivent** à `down`, à un redémarrage et à une reconstruction.

Pour les **effacer définitivement** :

```powershell
docker compose --profile dev --profile prod down -v
```

⛔ `-v` supprime le volume. Il n'y a pas d'annulation possible.

### Toujours préciser le profil

Compose **ignore les services dont le profil n'est pas précisé**, y compris pour les arrêter. Un `docker compose down` sans `--profile dev` arrête Postgres mais laisse tourner l'API et le front du mode dev.

---

## Comment c'est construit

### Le `Dockerfile` et ses cibles

Un seul `Dockerfile`, plusieurs **cibles**. Compose choisit la cible selon le mode.

```
front-deps ──┬── front-dev ................ mode dev   (ng serve)
             └── front-build ──┐
                               ├── final .. mode prod  (image livrée)
api-restore ─┬── api-build ────┘
             └── api-dev .................. mode dev   (dotnet watch)
```

| Cible | Base | Rôle |
|---|---|---|
| `front-deps` | `node:24-bookworm-slim` | `npm ci`, gardé en cache tant que `package-lock.json` ne change pas |
| `front-dev` | ↑ | `ng serve` sur le port 4200 |
| `front-build` | ↑ | `ng build --configuration production` |
| `api-restore` | `dotnet/sdk:10.0` | `dotnet restore`, gardé en cache tant que le `.csproj` ne change pas |
| `api-dev` | ↑ | `dotnet watch run` sur le port 8080 |
| `api-build` | ↑ | `dotnet publish -c Release` |
| **`final`** | `dotnet/aspnet:10.0` | API publiée + front copié dans `wwwroot`. Tourne sans droits root |

ℹ️ L'image du front est en **glibc** (`bookworm-slim`) et pas en Alpine : le `package-lock.json` ne référence que les binaires natifs `-gnu` (esbuild, rolldown, lmdb, Tailwind).

### Une seule image en production

En prod, **l'API sert elle-même le front** depuis `wwwroot` :

- Les routes `/api/...` vont aux controllers.
- Une route `/api/...` inconnue renvoie **404**, jamais la page Angular.
- Les fichiers existants (JS, CSS, polices, favicon) sont servis tels quels.
- Toute autre route renvoie `index.html`, et le routeur Angular affiche la bonne page.

Front et API partagent donc **la même origine** : pas de CORS à configurer.

C'est l'artefact « strictement identique » de `docs/tableUp-architecture.md` (§6.2) : la même image tourne sur la box et en hébergé, seule la configuration change.

### La base de données

| Élément | Valeur |
|---|---|
| Image | `postgres:18` |
| Volume | `turo_db-data`, monté sur `/var/lib/postgresql` (emplacement attendu depuis Postgres 18) |
| Port | `127.0.0.1:5432`, jamais exposé sur le réseau |
| Démarrage | L'API attend que Postgres réponde à `pg_isready` avant de démarrer |
| Chaîne de connexion | Transmise à l'API par la variable `ConnectionStrings__Turo`, lue en C# par `builder.Configuration.GetConnectionString("Turo")` |

ℹ️ Aucun script SQL n'initialise la base : le schéma viendra des **migrations EF Core** de l'API.

---

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `request returned 500 Internal Server Error` | Docker Desktop n'est pas démarré ou démarre encore | Lancer Docker Desktop et attendre qu'il indique *Engine running* |
| `POSTGRES_PASSWORD manquant` | Pas de fichier `.env` | `Copy-Item .env.example .env`, puis renseigner le mot de passe |
| `port is already allocated` | Le port est déjà pris (un Postgres installé sur Windows, un `ng serve` oublié…) | Changer le port concerné dans `.env` |
| L'API ne se connecte pas à la base en mode base seule | *User secret* absent ou mot de passe différent de `.env` | Refaire l'étape [3.2](#32-donner-la-chaîne-de-connexion-à-lapi-une-seule-fois) |
| Le mot de passe changé dans `.env` n'est pas pris en compte | Postgres n'utilise `POSTGRES_PASSWORD` qu'à la **création** du volume | Changer le mot de passe dans `psql`, ou remettre la base à zéro |
| Le front en dev ne voit pas un nouveau paquet npm | L'image n'a pas été reconstruite | `docker compose --profile dev up --build --watch` |
