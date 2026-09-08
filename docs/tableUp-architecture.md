# TableUp — Conception : architecture système

**Date :** 8 septembre 2026
**Statut :** décisions d'architecture arrêtées. Cible **V3**. Les points du §17 restent ouverts.
**Source :** `idée_architecture.md`, revue d'architecture du 8 septembre 2026.
**Complète :** `tableUp-conception.md` (conception fonctionnelle du logiciel restaurateur), qui reste l'autorité sur tout ce qui touche au plan de salle, aux réservations et aux clients.
**Schémas :** `images/architecture*.png`, `images/idee_*.png`

> Ce document décrit la **cible V3**. Il est écrit maintenant parce qu'une partie de ses conséquences doit être respectée dès la V1 — le §2 dit lesquelles, et pourquoi.

---

## 1. Décisions verrouillées

| Sujet | Décision |
|---|---|
| Autorité des données | **Le tenant est l'autorité.** Le central est un annuaire et un routeur, jamais une source de vérité |
| Données personnelles au centre | **Aucune.** Le central ne détient ni client, ni réservation, ni table |
| Disponibilité | **Ne se réplique pas.** Le tenant publie une **projection** `(date, créneau, couverts) → libre / serré / complet` |
| Lecture et écriture | **Lecture optimiste, écriture autoritaire.** Le widget lit la projection, la réservation est créée par le tenant, qui rejoue le vrai calcul |
| Présence du tenant | **Canal duplex persistant sortant** (SignalR). Le ping de 5 min est supprimé |
| Connexion entrante vers un tenant | **Jamais.** Aucune conception ne peut supposer un port ouvert chez le restaurateur |
| Restaurant injoignable | Toute demande client devient **`en_attente`** (§11.2 de la conception). Au-delà de 2 h hors ligne, le restaurant cesse d'être réservable |
| Hébergé : forme du tenant | **Une instance par tenant**, artefact strictement identique à la version locale |
| Bases de données en hébergé | **Un serveur Postgres mutualisé, N bases** — pas N serveurs |
| `app.tableup.fr` | Recherche, page publique du restaurant, réservation client, compte client TableUp |
| `restaurant.tableup.fr` | Annuaire, enrôlement des instances, connexion restaurateur et routage, autorisation cloud |
| `myrestaurant` / `onlinerestaurant` | **Interfaces restaurateur uniquement.** Aucun client n'y accède jamais |
| Alias tenant | `{slug}.tableup.fr` suit le restaurateur dans les deux modes d'hébergement |
| HTTPS en local | Enregistrement DNS public pointant vers l'IP privée + certificat Let's Encrypt par **challenge DNS-01**. Jamais d'auto-signé |
| Clé d'instance | **Une paire par instance**, générée au premier démarrage. La privée ne quitte jamais la machine |
| Clé livrée dans l'image | **Interdit.** Une image commune contenant une clé compromet tout le parc |
| Certificat d'instance | Durée 90 jours, renouvelé sur le canal, révocable. Porte le `restaurant_id`, vérifié à chaque message |
| Authentification machine | **mTLS.** Ce n'est pas du SSO : une machine n'a ni session, ni redirection, ni mot de passe oublié |
| SSO | **Deux domaines d'identité** : humains (clients, personnel) et machines. Séparés par nature, pas par préférence |
| Connexion du personnel | **Locale d'abord.** Une coupure internet ne doit jamais empêcher le personnel de se connecter |
| Sauvegarde cloud | **Chiffrée de bout en bout par le tenant.** TableUp est techniquement incapable de lire |
| Clé de sauvegarde perdue | **Les données sont perdues.** Pas de séquestre, pas de bris de glace. La prévention est active, pas déclarative |
| Porteurs de clé | **Deux KEK** possibles sur la même sauvegarde : le restaurateur et un second porteur de son choix |
| Vérification de possession | Bouton « vérifier ma clé », déchiffrement **entièrement dans le navigateur**. Trimestriel |
| Test de restauration | **Le tenant teste sa propre sauvegarde chaque semaine** — lui seul peut la lire |
| Migration local ↔ hébergé | **Une restauration**, pas une conversion. Les octets se déplacent, rien n'est rechiffré |
| Version d'API | Négociée à la connexion. Fenêtre de support **N-2** annoncée |
| Mise à jour | Manifeste **signé**, déploiement progressif, rollback automatique |
| Fenêtre de mise à jour | **Jamais pendant le service.** Restaurant fermé, dans son fuseau |
| Matériel local | Raspberry Pi 5 + **NVMe sur PCIe** + **module RTC**. Jamais d'USB-SATA, alimentation officielle |
| Remplacement d'une box | **15 minutes.** Sauvegarde + clé + enrôlement = une box neuve repart |
| Fichier client | Responsable de traitement : **le restaurateur**. TableUp : **sous-traitant**. Contrat art. 28 obligatoire |
| Réservation via `app.` | **Responsabilité conjointe (art. 26)** présumée, à confirmer juridiquement |
| Allergies | **Donnée de santé (art. 9).** Consentement explicite, champ facultatif, finalité affichée, purgée avec la fiche |
| `notes_internes` | **Visible par tous les rôles.** Service et Administrateur |
| Effacement | **Anonymisation (§7.8), jamais de suppression.** Les réservations anonymisées sont **conservées définitivement** |
| Effacement déclenché par le client | Possible depuis l'application cliente, **pour les restaurants réservés via TableUp uniquement** |
| Réponse à une demande d'effacement | **Identique qu'il existe des données ou non.** Le §11.4 de la conception s'applique ici |
| Demande d'effacement chez le restaurateur | File visible, **exécutée automatiquement** au bout de quelques jours sauf opposition motivée |
| Purge automatique | **3 ans après le dernier contact**, anonymisation, allergies comprises |
| Sauvegardes et effacement | Les anciennes disparaissent à la **rotation**. Toute restauration **rejoue le journal des effacements** |
| Hébergeur | **Union européenne.** Pas d'hyperscaler américain pour de la donnée de santé |
| Géolocalisation, médias | **Hors V1.** Pas de coordonnées ni de photos dans le modèle actuel |

---

## 2. Portée : ce qui est V3, et ce qui doit être vrai dès la V1

Tout ce document décrit la V3. Mais cinq décisions coûtent presque rien aujourd'hui et se paient en réécriture si elles sont prises trop tard.

| À faire dès la V1 | Pourquoi maintenant |
|---|---|
| Le moteur de disponibilité est une **fonction pure isolée** | Sans dépendance au contexte HTTP ni au `DbContext`, il pourra tourner dans le tenant, dans un test, ou ailleurs. Sinon c'est une réécriture |
| La **projection matérialisée** existe | Elle n'est pas une exigence d'architecture : c'est la réponse au point ouvert *« coût du calcul de la bande d'heures à chaque frappe »* (§13 de la conception). On la construit pour le formulaire ; elle se trouve être exactement ce que le central attendra |
| `restaurant_id` sur **chaque ligne** | Migrer hébergé → local, c'est extraire un tenant. Une base sans discriminant ne s'extrait pas |
| Un **numéro de version d'API** dans l'en-tête | Ajouter du versionnement à une API déployée coûte une génération de clients |
| **Aucune supposition de connexion entrante** | Un seul appel du central vers le tenant écrit aujourd'hui, et le mode local devient impossible demain |

Et une règle qui gouverne tout le reste :

> **Aucune opération du tenant ne doit jamais exiger que le central soit debout, sauf la réservation en ligne.**

Elle interdit d'un coup l'authentification central-only, les réglages central-only et le contrôle de licence en ligne. Elle fait de `restaurant.tableup.fr` un point de défaillance **acceptable** : s'il tombe, les restaurants continuent de servir, seule la réservation web s'arrête.

---

## 3. Les instances et leurs rôles

![Architecture globale](/images/architecture.png)

| Instance | Rôle | Détient des données personnelles ? |
|---|---|---|
| **`app.tableup.fr`** | Recherche de restaurants, page publique, parcours de réservation client, compte client TableUp | ✅ le compte client TableUp uniquement |
| **`restaurant.tableup.fr`** | Annuaire des restaurants, enrôlement et supervision des instances, connexion restaurateur et routage vers son tenant, autorisation de la sauvegarde cloud | ⛔ **aucune** |
| **`cloud.tableup.fr`** | Dépôt des sauvegardes chiffrées. Stockage objet + endpoint d'autorisation, pas un service applicatif | ⛔ **aucune en clair** |
| **`myrestaurant` / `onlinerestaurant`** | Le logiciel restaurateur : plan de salle, réservations, clients, réglages. **Interfaces restaurateur uniquement** | ✅ tout le fichier client |

**Ni un client ni le public n'accèdent jamais à `myrestaurant` ou `onlinerestaurant`.** La page publique d'un restaurant et le parcours de réservation sont servis par `app.tableup.fr`, qui lit la projection. C'est ce qui permet au tenant de rester derrière une box sans aucune exposition publique.

### 3.1 Les noms de domaine

`{slug}.tableup.fr` (par exemple `chez-marcel.tableup.fr`) suit le restaurateur **dans les deux modes**. En hébergé il pointe vers son instance ; en local vers l'adresse de sa box sur le réseau. Le personnel garde son favori, la tablette garde son raccourci, et une migration ne casse rien.

### 3.2 HTTPS sur le réseau local

Une box sur `192.168.x.x` n'a ni certificat public ni moyen de passer un challenge HTTP.

**Solution :** publier un enregistrement DNS A public pointant vers l'IP privée de la box, et obtenir un vrai certificat Let's Encrypt par **challenge DNS-01** — qui ne demande aucune joignabilité de la machine. C'est le mécanisme utilisé en production par Plex et Philips Hue.

⛔ **Pas de certificat auto-signé.** Sur une tablette utilisée tous les jours, l'avertissement de sécurité devient une écharde quotidienne, puis un réflexe de clic, puis une faille.

---

## 4. La disponibilité ne se réplique pas

### 4.1 Pourquoi « envoyer les disponibilités » n'a pas de sens

Le §9.4 de la conception l'établit : **la disponibilité n'est pas une donnée, c'est une fonction.**

```
dispo( plan, réservations, mode d'occupation, durée prévue,
       rapprochements possibles, zones fermées,
       couverts demandés, intervalle demandé )
```

Elle change à chaque réservation, chaque annulation, chaque walk-in, chaque nettoyage de table, chaque modification du plan. Et — point décisif — **le restaurant prend des réservations par téléphone qui ne traversent jamais internet.**

Deux sorties étaient possibles. Une seule est retenue.

**⛔ Écarté — répliquer l'état brut au centre.** Il faudrait deux implémentations du moteur de compatibilité (§3.5 de la conception), qui divergeraient ; et en version locale, répliquer la base client au centre annule la promesse « mes données restent chez moi ».

**✅ Retenu — publier une projection.**

### 4.2 La projection

Le tenant matérialise, pour chaque combinaison, un verdict à trois états :

```
( date, créneau, nombre de couverts ) → libre | serré | complet
```

Dimensionnement, par restaurant :

```
60 jours × ~16 créneaux/jour × 10 tailles de tablée ≈ 9 600 cellules × 2 bits
```

Coût de recalcul sur une réservation : seuls les créneaux recouvrant `[T, T + durée + rotation]` du jour concerné changent, soit **~100 cellules**. Négligeable, y compris sur une box.

Le central reçoit une grille de feux tricolores. **Il ne connaît ni les tables, ni les clients, ni les réservations.** C'est ce qui rend la version locale honnête : au centre, il n'y a rien à voler.

### 4.3 Lecture optimiste, écriture autoritaire

La projection est **indicative**. Elle peut être périmée de quelques secondes.

```
Client → app.          : lit la projection. Rapide, potentiellement en retard
Client → app. → tenant : crée la réservation
tenant                 : rejoue le vrai calcul (§3.5) et peut refuser
```

**Le tenant est le seul écrivain de ses propres tables.** C'est ce qui rend le double-booking structurellement impossible — à condition que l'écriture traverse réellement le canal et attende une vraie réponse. ⚠️ **Un timeout ne se traduit jamais en confirmation :** il se traduit en `en_attente`.

### 4.4 Ce que la projection donne au client

Ce que le client voit dérive de la projection selon le §11.2 de la conception, sans mécanique nouvelle :

| Projection | Mode rotation | Mode service unique |
|---|---|---|
| **libre** | créneau normal | créneau normal |
| **serré** | « sur demande », toujours `en_attente` | *n'existe pas* |
| **complet** | le créneau **disparaît** | le créneau **disparaît** |

⚠️ Rappel du §11.2 : « serré » a deux causes — un rapprochement de tables, ou un départ prévu. **Seule la seconde franchit le widget.** La projection doit donc distinguer les deux causes, sinon elle fait peser sur le client une incertitude dont le restaurant est maître.

---

## 5. Le canal persistant

### 5.1 Le ping de 5 minutes est supprimé

Il ne résolvait qu'un problème — la présence — et en créait trois :

- ⛔ Une box tombée reste « en ligne » jusqu'à 5 minutes. Des clients réservent dans le vide.
- ⛔ Il ne dit pas comment une réservation **redescend** vers une box sans IP publique. En polling, le client attend 5 minutes sa confirmation — pour un widget où *« une hésitation de trois secondes et il téléphone »* (§11.1), c'est disqualifiant.
- ⛔ Il double le canal de publication des modifications.

### 5.2 Une connexion duplex sortante

Le tenant ouvre et maintient une connexion vers `restaurant.tableup.fr` — **SignalR**, qui gère la reconnexion, le backoff, et retombe en SSE ou long-polling à travers les pare-feux hostiles.

Un seul mécanisme rend alors quatre services :

| Besoin | Comment |
|---|---|
| Présence | La liveness de la connexion, à la seconde |
| Publication de la projection | Poussée montante à chaque modification |
| Réservation web entrante | Poussée descendante, réponse synchrone |
| Commandes (effacement, renouvellement de certificat, mise à jour) | Poussée descendante, durables, avec accusé |

Le keep-alive remplace le ping. La dérive entre la projection et la réalité se compte en secondes, pas en minutes.

---

## 6. Les deux modes d'hébergement

### 6.1 Version locale

![Version locale](/images/architecture_local.png)

- ✅ Le restaurateur garde l'accès à ses données même sans internet
- ✅ Les données ne quittent physiquement pas le restaurant
- ✅ Moins de charge côté TableUp
- ℹ️ Sauvegarde cloud possible, chiffrée, sur demande
- ⛔ Une installation physique à faire et à maintenir
- ⛔ Pas d'accès en dehors du réseau du restaurant

### 6.2 Version hébergée

![Version hébergée](/images/architecture_heberge.png)

**Une instance par tenant.** L'artefact déployé est **strictement identique** à celui d'une box. Trois bénéfices que ce choix achète :

- ✅ La migration devient une restauration, pas une conversion
- ✅ Un seul binaire à tester
- ✅ Une fuite inter-tenant est structurellement impossible

Le prix, à connaître d'avance : 100 restaurants = 100 conteneurs. Deux conséquences :

- **Postgres mutualisé** — un serveur, N bases. Pas N serveurs.
- **Un orchestrateur dès le départ** : « déployer une version sur 100 conteneurs avec rollback » ne se fait pas à la main.

Bonne nouvelle : hébergé et local posent alors **exactement le même problème de mise à jour** (§12). Un seul mécanisme à écrire.

### 6.3 Les deux modes ne dégradent pas pareil

C'est le point que les schémas ne montrent pas et qu'il faut dire au restaurateur :

| Coupure internet chez le restaurateur | Local | Hébergé |
|---|---|---|
| Réservations web | arrêtées | arrêtées |
| Plan de salle, liste des réservations | ✅ **fonctionne** | ⛔ **écran noir en plein service** |

Ce ne sont pas deux inconvénients de même poids. En hébergé, il faut donc soit une **PWA offline-first** (cache du service du jour + file d'écritures rejouée à la reconnexion), soit une information franche du restaurateur.

⚠️ Et même en local : la tablette parle à la box par le Wi-Fi du restaurant, souvent le même AP que le réseau invité. Un AP qui tombe et la tablette est noire alors que la box va très bien. **Même besoin de cache local, y compris sur le LAN.**

---

## 7. Hors ligne

### 7.1 Restaurant injoignable, côté client

La conception contient déjà la réponse : **`en_attente`** (§11.2), avec la phrase du §11.6 :

> « Ce n'est pas encore une réservation. Le restaurant vous confirme par e-mail. »

C'est exactement l'argument que la conception fait pour « sur demande » : on ne cache pas au client une incertitude dont on n'est pas maître. Aucune mécanique nouvelle.

**Au-delà de 2 heures hors ligne**, le restaurant cesse d'être réservable et bascule sur « appeler le restaurant ». Sans ce seuil, un restaurant fermé une semaine retrouve quarante demandes sans réponse — et quarante clients déçus.

### 7.2 Personnel privé d'internet

⚠️ Si un SSO central est la seule autorité, une coupure empêche le personnel de se connecter, et la promesse « accès à ses données en toutes circonstances » est fausse.

**Le tenant porte donc son propre magasin de credentials**, ou au minimum des jetons signés valides hors ligne longtemps (jeton de rafraîchissement de 30 jours en cache local). C'est ce qui tranche le débat du §8 : un SSO global unique n'est pas viable en version locale.

---

## 8. Identité : deux domaines, pas deux SSO

![Deux SSO](/images/idee_2_sso.png)

Trois populations, qui ne partagent presque rien :

| Population | Identité | Durée de vie | Facteur | Volume |
|---|---|---|---|---|
| **Clients TableUp** | e-mail | années | mot de passe, lien magique | milliers → millions |
| **Personnel** | login court, borné à **un** restaurant | mois (turnover) | PIN sur tablette partagée, session longue | dizaines par restaurant |
| **Machines** | certificat | vie de l'instance | mTLS | une par tenant |

### 8.1 La troisième n'est pas du SSO

Une machine n'a ni session, ni redirection, ni écran de consentement, ni mot de passe oublié. Forcer un protocole humain (OIDC) sur un problème machine est une erreur de nature.

**L'authentification machine, c'est la PKI du §9 — pas un fournisseur d'identité.** Les schémas la décrivaient deux fois, une fois comme « paire de clés validée par l'admin » et une fois comme `sso.devices.tableup.fr` : ce sont la même chose, et il n'en reste qu'une.

### 8.2 Clients et personnel restent séparés

Le personnel se connecte sur **une tablette partagée en cuisine** : PIN court, session permanente, sémantique « qui est de service ». Le client se connecte une fois sur son téléphone. Une seule politique de mot de passe ne peut pas servir les deux.

ℹ️ Un restaurateur est aussi, parfois, un client TableUp. Deux comptes, même adresse e-mail : c'est normal et sans conséquence — comme un compte Workspace et un compte Gmail.

### 8.3 Ce que voit le personnel

Le §4.7 de la conception définit deux rôles, Service et Administrateur. **Le découpage ne porte pas sur les données client :**

| Donnée | Service | Administrateur |
|---|---|---|
| Nom, couverts, heure | ✅ | ✅ |
| `allergies` | ✅ | ✅ |
| Téléphone | ✅ | ✅ |
| `notes_internes` | ✅ | ✅ |
| Historique, compteurs de fiabilité | ✅ | ✅ |
| Réglages, éditeur de plan, exceptions | ⛔ | ✅ |

**Le fichier client est visible par tous les rôles du restaurant.** Ce qui distingue l'Administrateur, c'est le pouvoir de changer la configuration, pas le droit de voir les clients. Un serveur qui ne voit pas les notes ne peut pas faire son service.

Ce qui reste vrai en revanche : **aucun compte TableUp n'accède au fichier client** (§14.3).

---

## 9. Enrôlement et PKI des instances

### 9.1 Génération

**Une paire de clés par instance, générée au premier démarrage.** La clé privée ne quitte jamais la machine : fichier en `0600`, hors du dépôt de sauvegarde, idéalement dans un élément sécurisé.

⛔ **Aucune clé privée n'est livrée dans une image.** Une image commune contenant une clé fait qu'une seule machine démontée compromet tout le parc.

### 9.2 Enrôlement

L'instance présente sa clé publique et un **code à usage unique et courte durée** — imprimé sur la box, ou remis au restaurateur en hébergé. Le central le vérifie et retourne un certificat signé.

ℹ️ La validation manuelle par un administrateur reste possible et suffit au démarrage. Elle ne passe pas ~50 restaurants, et elle suppose quelqu'un d'éveillé quand une box est installée un samedi soir.

### 9.3 Portée et durée

- Le certificat **porte le `restaurant_id`**, vérifié **à chaque message**. Sans cela, une instance compromise publie des disponibilités pour le restaurant d'à côté.
- **Durée 90 jours**, renouvelée automatiquement sur le canal persistant.
- **Liste de révocation** vérifiée à l'établissement de la connexion. Instance volée, restaurateur parti : la révocation doit exister avant d'en avoir besoin.

---

## 10. Sauvegarde chiffrée de bout en bout

### 10.1 Le principe

**C'est le tenant qui chiffre.** TableUp reçoit des octets qu'il ne peut pas lire, et peut l'écrire dans son contrat : *« nous sommes techniquement incapables de lire vos sauvegardes. »*

⚠️ Rappel juridique (§14.1) : **des données chiffrées restent des données personnelles.** Le chiffrement est une mesure de sécurité (art. 32), pas un changement de nature. Ce qu'il apporte est ailleurs, et c'est considérable : l'**art. 34(3)(a)** dispense de notifier les personnes concernées quand les données sont rendues incompréhensibles — à condition de ne pas avoir fui la clé avec les données.

### 10.2 Schéma d'enveloppe

```
DEK   clé de données, aléatoire, propre au restaurant, chiffre la sauvegarde
KEK   clé d'enveloppe, chiffre la DEK. C'est elle que le restaurateur détient
```

La sauvegarde stocke `{données chiffrées par DEK} + {DEK chiffrée par KEK}`.

- **Migration** : on déplace les octets, on ne rechiffre rien (§11)
- **Rotation de KEK** : on rechiffre 200 octets, pas 2 Go

⛔ **La KEK n'est jamais dérivée d'un mot de passe.** Changer son mot de passe rendrait les anciennes sauvegardes illisibles, et un mot de passe faible ruinerait le chiffrement. Elle est **aléatoire**.

### 10.3 Clé perdue = données perdues

**Décision assumée : pas de séquestre, pas de bris de glace, pas de clé de recouvrement TableUp.** Un restaurateur qui perd sa clé perd ses sauvegardes. C'est le prix de la promesse d'inaccessibilité, et il est payé sciemment.

En contrepartie, la prévention est **active**, jamais un simple bandeau :

| Mesure | Détail |
|---|---|
| **Trois sorties à la génération** | Sur le même écran : téléchargement du fichier, **QR code imprimable**, copie texte. Un papier dans un coffre survit à un disque mort |
| **Deux porteurs** | La DEK est chiffrée par **deux KEK** : celle du restaurateur, et une seconde qu'il remet à qui il veut — associé, comptable, conjoint. Zéro connaissance conservée par TableUp, et le mode de panne le plus probable (une personne, un support) disparaît |
| **Vérification trimestrielle** | Bouton « vérifier ma clé » : la page charge un blob de test et le déchiffre **entièrement en JavaScript, dans le navigateur**. La clé ne quitte jamais le poste. On découvre une clé perdue un mardi calme, pas le jour de l'incendie |

### 10.4 Le test de restauration

**Une sauvegarde chiffrée corrompue est indiscernable d'une sauvegarde chiffrée saine.** Personne ne s'en apercevra pendant deux ans.

Le central ne peut pas la vérifier. **Le tenant, si** — il détient la clé, puisqu'il chiffre. Donc, **chaque semaine** : il retélécharge sa propre sauvegarde depuis `cloud.tableup.fr`, la déchiffre, la restaure dans une base jetable, vérifie le compte de réservations, et remonte le résultat dans la télémétrie (§16).

> Sans ce test, le système de sauvegarde est une croyance, pas une garantie.

### 10.5 Conséquence à assumer

La clé est présente sur la machine du tenant. **Une box volée est une box qui peut lire les sauvegardes cloud.** D'où : chiffrement du disque de la box, et clé stockée hors du dépôt de sauvegarde.

---

## 11. Migration local ↔ hébergé

Puisque l'artefact est identique dans les deux modes et que le format de sauvegarde est de première classe, **la migration est une restauration** :

```
1. Le restaurateur fournit sa KEK à la nouvelle instance
2. La nouvelle instance récupère la sauvegarde, la déchiffre, restaure
3. Nouvel enrôlement (§9) : nouvelle paire de clés, nouveau certificat
4. Révocation du certificat de l'ancienne instance
5. L'alias {slug}.tableup.fr bascule
```

Rien n'est rechiffré, rien n'est converti. C'est aussi le chemin de sortie : un restaurateur qui quitte TableUp part avec une sauvegarde qu'il est le seul à pouvoir lire.

---

## 12. Maintien du parc

Hébergé et local posent le même problème. Un seul mécanisme.

| Élément | Décision |
|---|---|
| **Version d'API** | Négociée à la connexion. Fenêtre **N-2** annoncée. Le central refuse poliment une instance trop ancienne et affiche pourquoi côté restaurateur |
| **Manifeste de mise à jour** | **Signé** (Ed25519), clé publique embarquée dans l'image, servi par un serveur de paquets |
| **Déploiement** | Progressif : canari 5 % → 25 % → 100 %, **rollback automatique** sur santé dégradée |
| **Rollback** | Conteneur A/B — l'ancienne image reste sur le disque, le retour est instantané |
| **Fenêtre** | ⛔ **Jamais en heures de service.** Restaurant fermé, dans son fuseau (`Restaurant.fuseau`, §3.1 de la conception) |
| **Migrations de schéma** | En avant seulement, idempotentes, testées sur une base réelle restaurée |

⚠️ **Ne jamais faire reposer la sécurité d'une mise à jour sur HTTPS seul.** Le serveur de paquets est la surface d'attaque la plus rentable du système : le compromettre, c'est compromettre tout le parc d'un coup. La signature découple la sécurité du transport.

⚠️ Sur un parc, une migration de schéma ratée n'est pas un incident : c'est cent incidents simultanés.

---

## 13. Matériel de la version locale

**Raspberry Pi 5**, avec trois conditions non négociables :

| Condition | Raison |
|---|---|
| **NVMe sur le HAT PCIe** | Une carte SD ne survit pas aux écritures d'une base de réservations. ⛔ Et **jamais d'adaptateur USB-SATA** : les ponts bon marché décrochent sous charge et corrompent la base |
| **Module RTC + pile** | Le connecteur existe sur le Pi 5. Sans lui, après une coupure de courant sans internet, la machine redémarre à une date fausse et **place toutes les réservations à la mauvaise heure** |
| **Alimentation officielle** | Le Pi est notoirement sensible à la sous-tension, et une alimentation insuffisante provoque des corruptions silencieuses. `throttled` est surveillé (§16) |

ℹ️ **.NET sur ARM64** est pleinement supporté. À vérifier plutôt que supposer : que les dépendances natives (SkiaSharp, rendu du fond de plan §10.4 de la conception) aient bien un build ARM64.

### 13.1 Ce qui compte plus que le choix du matériel

> **Une box doit être remplaçable en 15 minutes.**

Sauvegarde chiffrée + clé du restaurateur + enrôlement automatisé = une machine neuve, une restauration, on repart. Avec ça, le matériel devient un détail — et on peut en changer entre deux séries sans rien reconcevoir.

---

## 14. RGPD

> Ce chapitre pose le cadre. Il doit être relu par un avocat ou un DPO avant lancement.

### 14.1 Ce que le chiffrement ne fait pas

**Des données chiffrées restent des données personnelles.** Tant qu'elles sont réidentifiables par quelqu'un détenant la clé, c'est de la **pseudonymisation**, pas de l'anonymisation. Le chiffrement ne sort pas du champ du règlement et ne change aucun rôle.

Ce qu'il change réellement :

| Sans chiffrement | Avec E2EE |
|---|---|
| Fuite du dépôt = violation à notifier à la CNIL **et à chaque personne** | **Art. 34(3)(a)** : notification aux personnes non requise, les données étant incompréhensibles |
| L'hébergeur a accès | L'hébergeur n'a rien d'exploitable |
| TableUp a accès | **TableUp n'a pas accès** |

### 14.2 Qui est responsable de quoi

| Traitement | Responsable | Sous-traitant | Ce qu'il faut |
|---|---|---|---|
| **Fichier client du restaurant** (§7 de la conception : téléphone, allergies, notes, historique) | **Le restaurateur** | **TableUp** | **Contrat art. 28** : finalités, durée, instructions documentées, confidentialité, sécurité, sous-traitants ultérieurs, sort des données en fin de contrat, aide à l'exercice des droits |
| **Compte client TableUp** | **TableUp** | l'hébergeur | Politique de confidentialité, base légale : le contrat |
| **Réservation faite via `app.`** | ⚠️ **responsabilité conjointe (art. 26)** présumée | — | Accord art. 26 + mention lisible de qui fait quoi |

Le troisième est le piège. TableUp détermine les moyens (le formulaire, le parcours) et une partie des finalités, le restaurant en détermine d'autres. La jurisprudence (CJUE *Fashion ID*, C-40/17) retient la responsabilité conjointe **pour l'étape où les deux déterminent conjointement**, sans exiger une responsabilité égale sur tout le cycle. À faire trancher, en se préparant à un art. 26 plutôt qu'à un art. 28 pur.

### 14.3 Ce que la version locale change

Si la box n'envoie qu'une projection sans PII, **TableUp ne traite rien** du fichier client — sauf pendant ses interventions.

⚠️ **Le support à distance est un traitement.** Un accès de dépannage à une box, c'est un accès au fichier client. Donc, dès la conception :

- Consentement du restaurateur **à chaque session**, pas une fois pour toutes
- Durée limitée, expiration automatique
- Journalisation inaltérable
- Si possible, un mode support qui montre les écrans sans exposer la base

### 14.4 Les allergies

Une allergie ou intolérance alimentaire est une **donnée de santé** (art. 9). Le principe est l'interdiction, sauf **consentement explicite** (art. 9(2)(a)).

- ✅ Le §11.5 de la conception fait déjà l'essentiel : champ **séparé**, **facultatif**, nommé sans ambiguïté
- ➕ Ajouter une **phrase de finalité** au-dessus du champ : *« transmise au restaurant pour la préparation de votre repas »*. Un consentement explicite suppose que la personne sache ce qu'elle donne et pourquoi
- ⚠️ Le §11.5 fait **suivre l'allergie aux visites suivantes** — excellent pour le service, mais c'est une donnée de santé conservée au-delà de la réservation. Le client doit le savoir, et elle est **purgée avec la fiche** (§14.5)
- ℹ️ C'est cette donnée qui justifie à elle seule le chiffrement des sauvegardes

ℹ️ Le §11.4 (« le widget ne révèle jamais ce que le restaurant sait », jamais d'allergie pré-remplie) est **exactement** une mesure de minimisation au sens du règlement. Conçue pour de bonnes raisons produit, elle est aussi juridiquement excellente : elle a sa place dans le registre.

### 14.5 Conservation

- **3 ans après le dernier contact** — pas après la création. Puis **anonymisation** (§7.8 de la conception), allergies comprises.
- **Les réservations anonymisées sont conservées définitivement.** Le restaurant garde son historique de couverts et ses statistiques ; il perd l'attribution nominative. C'est exactement ce que l'anonymisation doit produire.
- ℹ️ Accrocher la purge au **recomptage nocturne** déjà prévu au §13 de la conception : un seul travail de nuit, une seule fenêtre, un seul point de surveillance.

### 14.6 Sauvegardes et effacement

TableUp ne peut pas réécrire une sauvegarde qu'il ne peut pas lire — **et n'a pas à le faire**. Les nouvelles sauvegardes ne contiennent plus la donnée, les anciennes disparaissent à la rotation. C'est la tolérance admise par la CNIL, à trois conditions :

1. Rétention **bornée et documentée** (30 ou 90 jours)
2. Ne **jamais réinjecter** en production une donnée effacée
3. Une étape post-restauration qui **rejoue le journal des effacements**

⚠️ Le troisième point doit être écrit maintenant. Le jour où une restauration servira, personne n'y pensera.

### 14.7 Trois choses à verrouiller tôt

- **Registre des traitements (art. 30)** : le sous-traitant tient le sien aussi. Deux pages, et il structure toutes les décisions ci-dessus.
- **Hébergeur dans l'Union européenne** (Scaleway, OVH, Clever Cloud). Un hyperscaler américain, même avec des serveurs à Paris, fait entrer dans le chapitre V et le *Cloud Act*, avec analyse d'impact des transferts. Pour de la donnée de santé et un argument commercial « vos données restent en France », ça ne vaut pas la peine.
- **Sous-traitants ultérieurs** à lister et faire autoriser : hébergeur, service d'e-mail transactionnel (§11.6 de la conception), SMS de rappel.

---

## 15. L'effacement déclenché par le client

Personne ne le propose. C'est un différenciateur — et un mécanisme piégeux sur cinq points.

### 15.1 Le périmètre

TableUp ne peut pas, et n'a pas à, effacer les données d'un client chez un restaurant où il a réservé **par téléphone** : il n'en est ni responsable ni destinataire, et le central ignore jusqu'à leur existence.

| Portée | |
|---|---|
| ✅ Le compte TableUp lui-même | |
| ✅ Les fiches créées chez les restaurants réservés **via TableUp** | |
| ↪️ Le reste | Écran « contacter le restaurant », avec un modèle de courrier pré-rédigé |

Cela suffit à un index central minimal : `client_id → restaurant_ids`.

⚠️ **Ne pas passer par un hachage de numéro de téléphone.** L'espace des mobiles français fait ~10⁹ valeurs : une table arc-en-ciel se calcule en minutes. Un numéro haché n'est pas anonyme. `app.` connaît déjà son client par son compte — il n'a besoin de rien d'autre.

### 15.2 L'oracle d'énumération

Si l'écran affiche *« vos données ont été supprimées chez Le Bistrot du Port »*, alors quiconque accède au compte apprend **où la personne dîne**. C'est précisément ce que le §11.4 de la conception interdit au widget.

**La même règle s'applique ici :**

- Réauthentification forte avant d'ouvrir l'écran — pas seulement la session en cours
- **Réponse identique qu'il existe des données ou non.** Le client déclenche, il reçoit « demande enregistrée », point.

### 15.3 Le trajet

```
Client   → app.     : demande d'effacement (client_id)
app.     → central  : une commande durable par tenant concerné
central  → tenant   : sur le canal persistant, avec accusé de réception
tenant              : anonymise (§7.8), acquitte, journalise
central  → app.     : « terminé chez N/N restaurants »
```

- La commande est **durable et rejouée** jusqu'à acquittement : une box éteinte une semaine la reçoit à son retour
- ⚠️ **Le délai légal d'un mois (art. 12(3)) court pendant ce temps.** Sans acquittement sous ~7 jours, escalade par e-mail au restaurateur
- Le client voit un état « en cours » honnête, jamais un faux « c'est fait »

### 15.4 Effacer, c'est anonymiser

⛔ **Jamais de `DELETE`.** Le §7.8 de la conception est déjà le bon mécanisme : les réservations survivent, anonymes, **conservées définitivement**, et les comptes du restaurant restent justes.

Deux cas à traiter :

| Cas | Comportement |
|---|---|
| **Une réservation future** | Ne peut pas être anonymisée sans être annulée — le restaurant a besoin d'un nom pour accueillir. Proposer : *« cela annulera votre réservation du 12 chez X, confirmer ? »*, avec `annule_par = client` |
| **Obligation légale ou litige en cours** | Le restaurateur peut s'opposer, **avec motif** |

D'où la mécanique côté restaurateur : une file « demandes d'effacement » visible dans ses réglages, **exécutée automatiquement au bout de quelques jours sauf opposition motivée**. L'automatisme protège du délai légal ; l'opposition lui laisse sa responsabilité — puisque juridiquement **c'est lui le responsable de traitement**, et TableUp le sous-traitant qui agit sur instruction. L'autorisation permanente de transmettre et d'exécuter ces demandes doit figurer au contrat art. 28.

### 15.5 La tension à assumer : le no-show blanchi

Elle est réelle, elle n'a pas de solution technique élégante, et le restaurateur la signalera.

**Un client peut effacer son historique de no-show.** Le §7.4 de la conception stocke un compteur de fiabilité, le §6.2 en fait un badge. Un client qui a posé trois lapins efface sa fiche, réserve le lendemain, et repart avec un compteur vierge.

Il n'y a pas de contournement propre : conserver un identifiant qui permet de recoller, **c'est ne pas avoir effacé**. Donc on cadre :

- Les réservations restent, anonymes et définitives : le restaurant garde son **historique agrégé**, il perd l'attribution
- L'intérêt légitime peut justifier de refuser l'effacement d'un no-show **très récent** dans un litige en cours. C'est étroit, c'est temporaire, et c'est au restaurateur de l'invoquer — d'où la file du §15.4
- ➕ **Le dire franchement dans la documentation restaurateur.** Une limite annoncée est une limite acceptée ; découverte, c'est une trahison

---

## 16. Observabilité

Cent instances ; quand l'une déraille à 20 h 30 un samedi, il faut le savoir **avant** que le restaurateur n'appelle. La présence ne suffit pas.

| Signal | Pourquoi |
|---|---|
| Version de l'application et de l'API | Savoir qui est en retard sur le parc (§12) |
| Taille de la base, croissance | Anticiper un disque plein |
| Taux d'erreur, latence du canal | Détecter une instance qui souffre |
| **Date de la dernière sauvegarde réussie** | Une sauvegarde qui ne tourne plus est silencieuse |
| **Résultat du test de restauration hebdomadaire** (§10.4) | La seule preuve que la sauvegarde vaut quelque chose |
| **Dérive d'horloge** | Une horloge fausse place les réservations à la mauvaise heure |
| `throttled` (matériel local) | Détecter une alimentation insuffisante avant la corruption |
| Âge de la dernière projection publiée | Détecter une divergence silencieuse avec la réalité |

⛔ **Aucune donnée personnelle dans la télémétrie.** Des compteurs, des versions, des durées. Jamais un nom, jamais un numéro.

---

## 17. Points ouverts

| Sujet | État |
|---|---|
| Responsabilité conjointe ou sous-traitance pour la réservation via `app.` | §14.2. À faire trancher juridiquement — ça change les mentions et le contrat signé par chaque restaurateur |
| Distinction des deux causes de « serré » dans la projection | §4.4. Le widget doit laisser passer le départ prévu et pas le rapprochement. Le format exact de la projection n'est pas arrêté |
| Seuil de 2 h hors ligne | §7.1. Posé au jugé. À vérifier sur des coupures réelles |
| Délai d'exécution automatique d'une demande d'effacement | §15.4. « Quelques jours » — à fixer, en tenant compte du mois légal |
| Rétention exacte des sauvegardes | §14.6. 30 ou 90 jours. Arbitrage entre coût de stockage et fenêtre de restauration |
| Cache offline du tenant | §6.3. Nécessaire en hébergé, souhaitable en local pour absorber les coupures Wi-Fi. Mécanique non conçue |
| Orchestrateur en hébergé | §6.2. Cent conteneurs à déployer, superviser, redémarrer. Outil non choisi |
| Serveur de paquets | §12. Format du manifeste, hébergement, procédure de rotation de la clé de signature : non conçus |
| Matériel : Pi 5 équipé contre mini-PC | §13. Une fois le Pi correctement équipé (NVMe, HAT, RTC, alimentation, boîtier), les coûts sont proches. Restent à arbitrer l'assemblage en série, le SAV et l'approvisionnement |
| Géolocalisation | §1. La recherche « près de moi » suppose des coordonnées absentes du modèle. Hors V1 |
| Médias (photos, menus) | §1. Un pipeline d'assets entier, absent de la conception. Hors V1 |
| Second porteur de clé | §10.3. L'écran de désignation et la remise de la seconde KEK ne sont pas dessinés |
| Support à distance | §14.3. Le mode « montrer les écrans sans exposer la base » est une intention, pas une conception |
| Schémas | Les images actuelles montrent encore le ping de 5 min et le double SSO. À refaire pour refléter le canal persistant et la projection |
