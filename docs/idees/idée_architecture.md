# Architecture TableUP

## Objectif

L'objectif à **long terme** de tableUp c'est de posséder : 
- une application client qui permet de rechercher, réserver une table dans des restaurants avec son compte utilisateur
- une application restaurateur permettant de gérer ses tables et ses reservations

## Idées 

![](/images/architecture.png)

Je verrais bien plusieurs instances : 
- *app.tableup.fr* : serveur web et api pour les utilisateurs clients TableUp
- Application TableUP
- *restaurant.tableup.fr* : serveur central regroupant les dernières infos des restaurants, fais aussi office de page de connexion restaurateur pour transférer celui-ci vers l'instance du serveur applicatif qui héberge son tenant.
- *cloud.tableup.fr* : cloud de sauvegarde pour les tenant restaurateur. L'autorisation de l'utilisation du cloud est déterminé par *restaurant.tableup.fr*.

Dans le fonctionnement du système, si une instance restaurateur TableUP souhaite s'intégré au système il faut d'abord que sa connexion soit validé par le système. Soit une clé privé à déjà été intégré dans les fichiers de configuration, et donc la connexion est direct, soit à l'intialisation, une pair de clé est créé et l'admin doit validé la clé publique côté *restaurant.tableup.fr*.
Une fois l'instance connectée et validée, tout les 5 min, il ping sa présence au près de *restaurant.tableup.fr*. Les données du restaurants (nom, type de cuisine, ect.) sont envoyées à chaque modifications, pareil pour ce qui est des disponibilités de reservation.
Ces informations sont ensuites récupérer par *app.tableup.fr* quand un client le demande.

### Types d'hébergements restaurateur

**Version Local** : 

L'instance du serveur restaurateur est hébergé chez le restaurateur lui-même

- ✅ Cela permet au restaurateur de toujours avoir accès à ses données même en cas de coupure internet (bien que le système de réservation en ligne ne sera plus fonctionnel)
- ✅ Le restaurateur peut être rassurée à l'idée que ses données sont chez eux
- ✅ Moins de charge côté serveurs TableUP
- ℹ️ Possibilité de sauvegarder les données dans *cloud.tableup.fr* si l'utilisateur à demandé la fonctionnalité
- ⛔ Cela demande une installation physique supplémentaire
- ⛔ Impossibilité d'accéder à l'application en dehors du réseau du restaurateur

![](/images/architecture_local.png)

**Version Hébergé** : 

L'instance du serveur restaurateur est hébergé chez TableUP

- ✅ Pas d'installation physique
- ✅ Accès à l'application en dehors du réseau du restaurateur
- ℹ️ Possibilité de sauvegarder les données dans *cloud.tableup.fr* si l'utilisateur à demandé la fonctionnalité
- ⛔ Non accessible si plus de réseau chez le restaurateur
- ⛔ Plus de charge côté serveurs TableUP

![](/images/architecture_heberge.png)

### Redis

Utilisation de Redis pour *app.tableup.fr*

![Utilisation Redis](/images/idee_redis.png)

### SSO

**SSO Global** : 

Mise en place d'un service SSO Général pour gérer tout les connexions dans TableUP

![](/images/idee_sso_global.png)

**Double SSO** : 

- Un service SSO pour les activités clientes : pc, tablette restaurateur, client.
- Un autre pour les connexions machines : instance restaurateur, cloud, serveur central

![](/images/idee_2_sso.png)