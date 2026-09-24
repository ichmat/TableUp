# TURO — Conception : stack technique du front

**Date :** 8 septembre 2026
**Statut :** stack arrêtée pour la première tranche (Paramètres, §9 de la conception). Les points du §10 restent ouverts.
**Complète :** `TURO-conception.md` (autorité fonctionnelle) et `tableUp-architecture.md` (autorité système). Ce document ne tranche que des questions d'outillage front ; il ne modifie aucune décision de ces deux-là.

> Contexte particulier : le code est écrit **à la main par le développeur**, qui vient de React/TypeScript et découvre Angular. Le mode de travail est le **TDD** — les tests et l'énoncé de chaque étape sont fournis, l'implémentation est faite par le développeur. Cette contrainte a autant de poids que les contraintes techniques dans les arbitrages ci-dessous.

---

## 1. Décisions verrouillées

| Sujet | Décision |
|---|---|
| Framework | **Angular v22**, zoneless, standalone, signals. Version exacte épinglée au scaffold |
| Monorepo | **Nx** |
| Périmètre codé maintenant | **Le front uniquement.** L'API est bouchonnée, ses contrats sont écrits |
| Première tranche | **Paramètres** (§9 de la conception), les dix sections du §9.2 |
| Autorité sur le front | **L'API du tenant (.NET).** `libs/domain` est un miroir de présentation, **jamais une autorité** |
| Autorité sur les données | **Le tenant.** `restaurant.tableup.fr` est un relais, jamais une source de vérité (§1 de l'architecture) |
| Formulaires | **Signal Forms** (`@angular/forms/signals`), stabilisés en v22 |
| Lectures | **`httpResource()`**. Aucune bibliothèque de cache tierce |
| Écritures | **Toutes** par un unique service `CommandGateway` |
| Écriture rejouée après coupure | **Peut être refusée.** Une commande en file n'est jamais une confirmation |
| État global | **Aucun store.** Signals et services suffisent. ⛔ Pas de NgRx |
| Composants | **`@angular/aria` + `@angular/cdk`**, headless. ⛔ Pas d'Angular Material |
| Styles | **Tailwind v4**, tokens déclarés en CSS par `@theme`, **nommés par rôle** |
| Polices | **Auto-hébergées** (`@fontsource`), précachées. ⛔ Jamais `fonts.googleapis.com` |
| Bouchon d'API | **MSW**, partagé entre le mode dev et les tests |
| Tests unitaires | **Vitest** (défaut du CLI Angular) |
| Tests de bout en bout | **Playwright** |
| PWA | **`@angular/pwa`** dès la première tranche |
| File d'écritures hors ligne | **Hors tranche** — mais `CommandGateway` en pose la forme dès maintenant |
| Langue du code | **Anglais** — identifiants, types, noms de fichiers, libellés de tests. **Commentaires en français** |
| Heures d'ouverture | **`LocalTime` (`"19:00"`), jamais un `Date`.** Fuseau appliqué en un seul endroit |

---

## 2. Portée

Cette tranche livre l'écran **Paramètres** du §9, ses dix sections, et rien d'autre. Les écrans Plan, Agenda, Réservations, Clients et Accueil ne sont pas construits ; le widget client (§11) appartient à `app.tableup.fr` et ne vit pas dans ce dépôt.

Trois choses sont néanmoins mises en place maintenant, parce qu'elles coûtent peu aujourd'hui et se paient en réécriture plus tard. C'est la même logique que le §2 de `tableUp-architecture.md`.

| À faire dès cette tranche | Pourquoi maintenant |
|---|---|
| **`CommandGateway` unique** | Le §9.7 exige déjà une file d'envois différés annulable. La file hors ligne du §6.3 est la même pièce, persistée. Écrite après coup, elle demande de reprendre chaque écran |
| **Polices auto-hébergées** | Ajoutées plus tard, elles obligent à reprendre le chargement des styles et la stratégie de cache du service worker |
| **Frontières de modules Nx** | Une frontière posée après coup ne se pose pas : elle se négocie contre du code existant |

---

## 3. Structure du workspace

```
tableup/
├─ apps/
│  ├─ turo/                 back-office restaurateur
│  └─ turo-e2e/             Playwright
└─ libs/
   ├─ domain/               types + logique de présentation — zéro import Angular
   ├─ data-access/          httpResource, CommandGateway, handlers MSW
   ├─ ui/                   composants présentationnels, tokens
   └─ feature-parametres/   les dix sections du §9.2
```

### 3.1 Pourquoi Nx, et ce qu'on lui demande vraiment

Ce n'est pas pour le cache de build — à cette échelle il ne sert à rien. C'est pour `@nx/enforce-module-boundaries` : chaque lib porte un tag, on déclare qui peut importer qui, et **une violation d'architecture devient une erreur de lint** plutôt qu'une remarque en revue de code.

| Tag | Peut importer |
|---|---|
| `type:domain` | **rien** — Angular compris |
| `type:ui` | `type:domain` |
| `type:data-access` | `type:domain` |
| `type:feature` | `type:domain`, `type:ui`, `type:data-access` |
| `type:app` | `type:feature` |

La première ligne est la seule qui compte vraiment. Le §2 de `tableUp-architecture.md` exige que le moteur de disponibilité soit *« une fonction pure isolée, sans dépendance au contexte HTTP ni au DbContext »*. Aujourd'hui c'est une phrase dans un document. Ici, c'est une règle que le linter fait respecter à chaque commit — et qui ne fatigue pas.

Nx est un coût d'apprentissage supplémentaire, assumé : il achète cette frontière-là.

---

## 4. Qui fait autorité

### 4.1 Deux axes, à ne jamais confondre

Le mot « serveur » désigne deux choses dans ce système. Employé seul, il rend fausse une phrase sur deux.

| Axe | Qui fait autorité | Origine |
|---|---|---|
| Front Angular ↔ **API du tenant** | L'**API du tenant** | Décision de ce document, §4.2 |
| **Tenant** ↔ `restaurant.tableup.fr` | Le **tenant** | §1 de `tableUp-architecture.md` : *« le central est un annuaire et un routeur, jamais une source de vérité »* |

Le tenant est donc **subordonné à personne et autorité pour tout ce qui le concerne**. Le central relaie ; il ne tranche pas. C'est ce qui rend la version locale honnête, et c'est ce qui rend le double-booking structurellement impossible (§4.3 de l'architecture : *« le tenant est le seul écrivain de ses propres tables »*).

Dans la suite de ce document, **« l'API du tenant »** désigne le back-end .NET qui accompagne le front TURO. Le central est toujours nommé `restaurant.tableup.fr`.

### 4.2 `libs/domain` : ce qu'elle est, et ce qu'elle n'est pas

**L'API du tenant est l'autorité métier du front.** `libs/domain` est un miroir de présentation, subordonné par construction.

Cette décision découle du §4.1 de `tableUp-architecture.md`, qui écarte explicitement toute solution imposant *« deux implémentations du moteur de compatibilité, qui divergeraient »*. Le raisonnement qui valait entre le tenant et le central vaut à l'identique entre le C# et le TypeScript.

| Appartient à `libs/domain` | N'y appartient jamais |
|---|---|
| Les types du modèle (§3.1 de la conception) | Le moteur de compatibilité (§3.5) |
| Résoudre, pour une date, quels services s'appliquent — pour **afficher** un calendrier | Décider si une table est disponible |
| Comparer le texte des conditions à `retard_grace` (§9.6) — deux réglages déjà détenus par le client | Compter les réservations affectées par une fermeture (§9.5) |
| Formater, trier, grouper | Valider une règle métier de façon autoritaire |
| Numéroter les versions du texte des conditions (§9.6) | Arbitrer un conflit de réservation |

**La règle qui décide dans les cas limites :** si le résultat peut contredire l'API du tenant, il ne se calcule pas ici. On le demande.

⚠️ Conséquence directe sur le §9.5. La confrontation *« ce jour porte déjà 3 réservations confirmées · 11 couverts »* est un **appel à l'API du tenant**, jamais un calcul local. Le front affiche la réponse et ne la recalcule pas, même s'il croit détenir les données nécessaires.

ℹ️ `libs/domain` reste sans dépendance Angular, pour deux raisons qui survivent à cette subordination : ses tests s'écrivent en Vitest pur, sans `TestBed` — ce qui en fait le terrain d'apprentissage du TDD, framework mis de côté ; et elle reste lisible par quelqu'un qui ne connaît pas Angular.

---

## 5. La couche données

### 5.1 Le front n'est pas le tenant

Une confusion à écarter tout de suite, parce qu'elle est facile à faire et coûteuse.

Le tenant fait autorité sur ses données (§4.1). **Mais le front TURO n'est pas le tenant** : c'est une tablette, ou un navigateur, qui parle au tenant. Quand le Wi-Fi de la salle tombe, la tablette est coupée de la box alors que la box va très bien (§6.3 de l'architecture).

Donc : **la file d'attente du front ne détient jamais de vérité.** Elle détient des *intentions* qui n'ont pas encore été soumises.

### 5.2 Lectures — `httpResource()`

`httpResource()` expose `value()`, `isLoading()`, `error()`, `status()`, et refait la requête quand un signal d'entrée change. C'est, en natif et sans dépendance, ce qu'apporte TanStack Query côté React.

Les lectures sont exposées par des services de feature. **Aucun composant n'appelle `HttpClient` directement.**

```
@if (reglages.hasValue())   { … }
@else if (reglages.error()) { … }
@else if (reglages.isLoading()) { … }
```

⛔ **Les données chargées ne sont jamais recopiées dans un store global.** Elles ont déjà un propriétaire : la ressource qui les a chargées.

### 5.3 Écritures — `CommandGateway`

Toutes les écritures passent par un service unique. Aucune exception.

Ce n'est pas une abstraction spéculative. Le §9.7 exige déjà :

> **Envoi différé de 8 s, et le bandeau dit le compte.** « 3 messages partent dans 8 s »

C'est-à-dire : une file de commandes en attente, comptée, annulable, vidée après délai. Le §6.3 de `tableUp-architecture.md` réclame par ailleurs *« une file d'écritures rejouée à la reconnexion »*. **Ce sont les deux moitiés du même objet.** Le bandeau « Annuler » est construit maintenant parce qu'il est au cahier des charges ; la persistance de la file s'y ajoutera plus tard sans toucher un seul écran.

`CommandGateway` porte donc, dès cette tranche :

| Responsabilité | Origine |
|---|---|
| Mettre une commande en attente, avec un délai | §9.7 |
| Exposer le nombre de commandes en attente | §9.7 — « 3 messages », pas « des messages » |
| Annuler une commande en attente | §9.7 |
| Émettre effectivement à l'expiration du délai | §9.7 |
| *(plus tard)* Persister la file et la rejouer | §6.3 de l'architecture |
| **Porter le refus d'une commande rejouée** | §5.4 ci-dessous |

⚠️ Le §13 de la conception laisse ouvert le comportement si l'application est fermée pendant les 8 s. Ce document ne le tranche pas ; il note seulement que la persistance de la file est l'endroit où la réponse se trouvera.

### 5.4 Une commande en file n'est jamais une confirmation

C'est la règle la plus importante de cette section, et elle vaut surtout pour les réservations.

Le §4.3 de l'architecture pose la sémantique, pour le client web : *« lecture optimiste, écriture autoritaire »*, et l'avertissement qui va avec :

> ⚠️ **Un timeout ne se traduit jamais en confirmation :** il se traduit en `en_attente`.

**La même règle s'applique à la file du front restaurateur.** Une réservation saisie sur une tablette coupée du réseau n'est pas une réservation : c'est une intention en attente de soumission. Quand la connexion revient, le tenant rejoue le vrai calcul et **peut refuser** — la table a pu être prise entre-temps par le téléphone, par une autre tablette, ou par un walk-in.

Trois obligations en découlent :

| Obligation | Pourquoi |
|---|---|
| `CommandGateway` expose un **résultat de rejeu**, pas seulement un succès | Sans lui, un refus est silencieux et la table est promise deux fois |
| L'interface **distingue visuellement** « en file » de « confirmé » | Le §6.2 de la conception a déjà la grammaire : teinte = cours normal, plein = anomalie |
| Un refus **remonte à l'utilisateur**, jamais dans un journal | La personne qui a pris l'appel doit rappeler le client. Personne d'autre ne le fera |

ℹ️ Cette règle ne pèse pas sur la tranche Paramètres : y mettre en file une fermeture exceptionnelle ne peut être refusé par personne. Elle est écrite maintenant parce que `CommandGateway` est conçu maintenant — et qu'une file qui suppose le succès ne se corrige pas, elle se réécrit.

### 5.5 Le bouchon — MSW

Les handlers MSW sont typés contre `libs/domain` et servent **à la fois** le mode dev dans le navigateur et les tests Vitest. Un seul bouchon, pas deux.

Comme l'interception se fait au niveau réseau, aucun code applicatif ne connaît MSW. Le jour où l'API .NET existe, on le retire et rien d'autre ne bouge.

Les handlers **sont** le contrat d'API tant que le C# n'existe pas. Ils doivent donc être écrits avec le sérieux d'une spécification : ce sont eux que le backend devra honorer.

### 5.6 Rafraîchissement — notifications SignalR

Plusieurs écrans d'un même restaurant affichent les mêmes données. Quand l'une d'elles change, l'API le dit à tous — par SignalR, sur le hub `/api/hubs/turo`.

**Une notification ne transporte aucune donnée.** Elle dit seulement *quoi* a changé : `DataChanged(scope)`, où `DataScope` (miroir de l'enum C#) nomme un GET à refaire. Le front recharge sa ressource ; la lecture reste l'unique chemin des données, avec ses contrôles d'accès.

| Règle | Pourquoi |
|---|---|
| Les écritures restent en REST ; le hub ne reçoit rien du client | Validation, `ApiError` et journalisation n'existent qu'une fois, dans les contrôleurs |
| Le contrôleur notifie **après** `SaveChanges` (`NotifyChangedAsync`) | Une exception annule la notification : on n'annonce jamais un changement qui n'a pas eu lieu |
| Tout le groupe du restaurant est notifié, auteur compris | L'auteur refait un GET de trop ; l'exclure demanderait de transmettre son `connectionId` à chaque requête |
| À chaque reconnexion, **tout** est rechargé | Les notifications ne sont pas durables : celles émises pendant une coupure sont perdues |

Côté front, `RealtimeService` porte la connexion, qui suit l'authentification. Chaque service de données s'y abonne pour son scope et recharge sa `httpResource` ; aucun composant ne connaît SignalR.

⚠️ Les requêtes de SignalR ne passent pas par l'intercepteur HTTP. Le JWT est fourni par `accessTokenFactory`, qui le rafraîchit lui-même lorsqu'il approche de son expiration — l'API ferme la connexion à ce moment-là (`CloseOnAuthenticationExpiration`).

ℹ️ Ce canal est interne au tenant. Il ne se confond pas avec le canal persistant tenant → central du §5 de l'architecture, qui utilise la même technologie pour un tout autre rôle.

---

## 6. La couche UI

### 6.1 Composants : `@angular/aria` + CDK

`@angular/aria` fournit des directives **headless** implémentant les motifs WAI-ARIA : clavier, attributs ARIA, gestion du focus, lecteurs d'écran. Aucun style imposé. Le CDK fournit l'`Overlay` pour les panneaux du §9.5 et le `LiveAnnouncer`.

⛔ **Pas d'Angular Material.** Le §2 de la conception impose une palette précise, des contours pointillés porteurs de sens (§2.3), des halos (§2.4), Caveat sur les numéros de table et l'interdiction des emoji (§2.5). Rhabiller Material pour obtenir « l'ardoise chaude » coûte davantage que d'écrire les composants, et laisse une couche de styles à combattre en permanence.

ℹ️ Le `LiveAnnouncer` n'est pas un raffinement : le bandeau du §9.7 annonce que trois messages vont partir dans huit secondes. Un utilisateur qui ne voit pas l'écran doit l'entendre, sinon le délai d'annulation ne lui est pas offert.

### 6.2 Styles : Tailwind v4, tokens nommés par rôle

La configuration est en CSS, par la directive `@theme`.

```css
@import "tailwindcss";

@theme {
  --color-app:         #EDE8E2;
  --color-surface:     #FBFAF8;
  --color-bordure:     #DFD9D1;
  --color-texte:       #3A3A38;
  --color-texte-2:     #9A968F;
  --color-interaction: #F5A04A;
  --color-ardoise:     #2E2A26;
  --color-craie:       #B6AC9C;

  --font-exo:   "Exo 2", system-ui, sans-serif;
  --font-craie: "Caveat", cursive;
}
```

**Les tokens portent leur rôle, jamais leur couleur.** Le §2.2 pose une règle absolue : *« l'orange ne code jamais un statut »*. Avec un token nommé `orange`, poser `bg-orange` sur une pastille de statut est une faute invisible. Avec `bg-interaction`, la même faute se lit à voix haute. Le vocabulaire fait respecter la règle mieux qu'un commentaire.

Les couleurs de statut du §2.3 et les couleurs d'aide au placement du §2.4 reçoivent leurs propres tokens, distincts, quand les écrans qui les portent seront construits.

### 6.3 Le composant qui porte le §9.1

Le §9.1 pose : **« aucun réglage n'est posé nu »** — chacun est suivi d'une phrase disant sa conséquence, et quand c'est possible d'un aperçu.

C'est une discipline qu'on tient trois semaines puis qu'on oublie sous pression. On la rend mécanique :

```ts
@Component({ selector: 'tu-reglage' })
export class Reglage {
  libelle     = input.required<string>();
  consequence = input.required<string>();
}
```

`input.required()` fait échouer **la compilation** si un réglage est posé sans sa phrase de conséquence. La règle de conception devient une erreur de build.

C'est le même mouvement que les frontières Nx du §3.1 : confier une intention à un outil qui ne fatigue pas.

### 6.4 Les heures ne sont pas des dates

`Restaurant.fuseau` existe au §3.1 de la conception, et tout le §9 manipule des **heures locales du restaurant**, pas des instants. « Le service du soir commence à 19:00 » n'est pas un `Date`.

**Décision :** dans `libs/domain`, une heure d'ouverture est un `LocalTime` — la chaîne `"19:00"`. La conversion en instant se fait à un seul endroit, avec `date-fns` et `@date-fns/tz`, en appliquant `Restaurant.fuseau`.

⚠️ Sans cette règle, le jour du passage à l'heure d'hiver, un service réglé à 18:00 s'affiche à 17:00 ou 19:00 selon la machine qui regarde. Ce bug ne se voit pas en développement : il arrive deux fois par an, en production, et il déplace des réservations.

---

## 7. PWA

`@angular/pwa` installe le service worker Angular. Il précache la coque applicative et les assets, et met en cache les lectures.

**Les polices sont auto-hébergées** (`@fontsource/exo-2`, `@fontsource/caveat`), donc bundlées, donc précachées comme tout asset.

⚠️ Le §2.5 de la conception indique Exo 2 et Caveat *« toutes deux sur Google Fonts »*. En version locale (§6.1 de l'architecture), la box n'a pas nécessairement internet et `fonts.googleapis.com` est injoignable : l'interface retomberait sur une police système et l'ardoise à la craie disparaîtrait. **L'auto-hébergement n'est pas une préférence, c'est une correction.**

**La mise à jour ne s'active jamais pendant le service.** Le §12 de l'architecture l'exige. `SwUpdate` laisse le choix du moment d'activation : `activateUpdate()` n'est appelé que si aucun service n'est en cours.

⛔ **Le service worker Angular ne fait pas de Background Sync.** Il ne rejoue aucune écriture. C'est exactement le trou que `CommandGateway` (§5.3) est là pour combler.

---

## 8. Tests

`ng test` lance **Vitest**, en Node avec jsdom. C'est le défaut du CLI Angular ; Karma est en fin de vie.

**En zoneless, on attend `await fixture.whenStable()`** plutôt que d'appeler `fixture.detectChanges()` : c'est ce qui reproduit l'ordonnancement réel de la détection de changement.

Playwright couvre le bout en bout.

### 8.1 L'ordre des phases

L'ordre sépare délibérément les difficultés : apprendre à lire un test, puis apprendre Angular — jamais les deux dans la même étape.

| Phase | Emplacement | Ce qui s'y apprend |
|---|---|---|
| 1 | `libs/domain`, Vitest pur | Lire un test, le faire passer. **Aucun Angular** : ni `TestBed`, ni injection, ni composant |
| 2 | `libs/data-access` + MSW | `httpResource`, injection de dépendances, `CommandGateway` |
| 3 | `libs/ui` | Composants, `input()` / `output()`, `TestBed`, `whenStable()` |
| 4 | `feature-parametres` | Routes enfants, garde de rôle (§4.7), Signal Forms |
| 5 | `turo-e2e` | Un parcours complet : fermer un jour occupé → confrontation → bandeau 8 s → annuler |

La phase 1 n'est pas un échauffement : la résolution d'affichage des ouvertures contre les exceptions (§9.3), la comparaison du texte des conditions à `retard_grace` (§9.6) et le versionnement du §9.6 sont de vraies pièces de l'écran.

### 8.2 Forme d'une étape

Chaque étape fournit : l'objectif en une phrase · le ou les tests qui échouent · le concept Angular en jeu et son équivalent React · les fichiers à créer · la commande qui prouve que c'est fini.

Le développeur n'a jamais accès à une implémentation de référence. Le test est la seule spécification exécutable.

---

## 9. Hors de cette tranche

| Sujet | Où il ira |
|---|---|
| Les écrans Plan, Agenda, Réservations, Clients, Accueil | Tranches suivantes |
| L'éditeur de plan (§10 de la conception) | Tranche dédiée — canevas en mètres, aimantation, glisser-déposer |
| Le widget client (§11) | `app.tableup.fr`, dépôt distinct |
| L'API .NET | Après stabilisation des contrats portés par les handlers MSW |
| Persistance de la file d'écritures | Quand un écran de service en aura besoin (§6.3 de l'architecture) |
| Authentification | Aucune décision ici. Voir §10 |
| Canal persistant tenant → central, projection | Concernent le tenant, pas le front restaurateur. Le front n'utilise SignalR que pour les notifications de changement (§5.6) |

---

## 10. Points ouverts

| Sujet | État |
|---|---|
| Connexion du personnel dans TURO | Tranché côté API : **access token JWT court + jeton de rafraîchissement opaque révocable**, émis par l'API du tenant elle-même — le §7.2 de l'architecture interdit qu'un SSO central soit la seule autorité. La mécanique front (stockage du jeton, rafraîchissement silencieux) reste à concevoir |
| Forme exacte des contrats d'API | Les handlers MSW en tiennent lieu. Le passage à OpenAPI, et la génération de types depuis le C#, ne sont pas décidés |
| Comportement du délai de 8 s si l'application est fermée | §13 de la conception. Non tranché ; la persistance de la file du §5.2 est l'endroit où la réponse se trouvera |
| Zoom et déplacement du plan | §13 de la conception. Hors tranche, mais influencera le choix SVG contre canevas — donc à trancher avant la tranche Plan |
| Version exacte d'Angular et de Nx | À épingler au scaffold, puis à reporter ici |
