# TableUP – Checklist MVP (Restaurants indépendants – France)

## Objectif MVP

- Gérer de bout en bout le flux **réservation → plan de salle → placement**, sans augmenter la charge de travail du staff pendant le service.[web:62][web:64]  
- Centraliser toutes les réservations dans une vue unique, avec un **plan de salle temps réel** et des notifications automatiques de base.[web:47][web:49][web:50][web:64]  

---

## Niveau 1 – Must‑have (v1)

### A. Côté client – Widget / booking flow

- [ ] Formulaire de réservation simple :
  - [ ] Date (future uniquement)
  - [ ] Créneau horaire
  - [ ] Nombre de couverts
  - [ ] Coordonnées : nom, téléphone, email
  - [ ] Champ “commentaires / allergies / demandes”  
- [ ] Affichage uniquement des créneaux réellement disponibles (pas d’heure proposée si la capacité est atteinte).
- [ ] Page de confirmation immédiate après la réservation.  
- [ ] Email de confirmation automatique envoyé au client (avec récap complet). 

### B. Côté resto – Agenda, plan de salle & walk-ins

- [ ] Plan de salle visuel :
  - [ ] Tables avec nom/numéro et capacité
  - [ ] Zones : salle, terrasse, étage (au minimum concept de “zone”)
  - [ ] Statuts de table : libre / réservée / occupée / à nettoyer  
- [ ] Agenda des réservations :
  - [ ] Vue par jour/service avec créneaux de 15–30 min
  - [ ] Statuts de réservation : confirmée / assise / terminée / no‑show / annulée  
- [ ] Liaison plan de salle ↔ agenda :
  - [ ] Depuis l’agenda, assigner une réservation à une table
  - [ ] Depuis une table, voir la réservation associée
  - [ ] Possibilité de changer une table assignée (drag‑and‑drop ou menu)  
- [ ] Saisie rapide des walk‑ins :
  - [ ] Bouton “Ajouter un client de passage”
  - [ ] Nombre de couverts
  - [ ] Heure d’arrivée
  - [ ] Assignation immédiate ou différée à une table  

### C. Multi‑canal minimal

- [ ] Création manuelle d’une réservation côté staff (téléphone, email, etc.). 
- [ ] Champ “source” obligatoire : `web / téléphone / walk-in / autre`.  
- [ ] Filtrage ou tri par source dans l’agenda.  

### D. Notifications & anti no‑show (base)

- [ ] Email de confirmation automatique (inclus dans Must‑have A).  
- [ ] Rappel automatique :
  - [ ] Paramètre global pour activer/désactiver les rappels
  - [ ] Délai configurable (ex. 24h avant)  
- [ ] Possibilité de marquer une réservation comme :
  - [ ] No‑show
  - [ ] Annulation tardive  
- [ ] Historisation de ces statuts pour usage futur (stats, politique no‑show).[web:50]  

### E. Mini‑CRM intégré

- [ ] Fiche client minimale :
  - [ ] Nom
  - [ ] Email
  - [ ] Téléphone
  - [ ] Historique des réservations (dates, nb de couverts, statuts)  
- [ ] Notes visibles pour le service :
  - [ ] allergies
  - [ ] occasions spéciales
  - [ ] commentaires internes (“habitué”, “VIP”, etc.)[web:47][web:52][web:53][web:64]  

### F. Paramétrage & back‑office

- [ ] Règles de capacité :
  - [ ] Capacité max de couverts par service/jour
  - [ ] Option pour limiter le nombre de couvert par créneau (simple, par ex. max X couverts / 15 min)
- [ ] Fenêtre de réservation :
  - [ ] Durée minimale entre maintenant et la réservation (ex. pas de résa < 1h à l’avance)
  - [ ] Durée maximale (ex. pas de résa > N jours/mois à l’avance)  
- [ ] Politique no‑show (sans CB en v1) :
  - [ ] Texte de conditions d’annulation configurable
  - [ ] Affichage de ce texte sur le widget de réservation
  - [ ] Case d’acceptation obligatoire avant validation de la réservation
- [ ] Gestion des comptes staff :
  - [ ] Rôle **admin** (configuration, gestion utilisateurs, plan global)
  - [ ] Rôle **staff** (accès plan de salle, agenda, création/modif de réservations)  

---

## Niveau 2 – Should‑have (v1.1)

### G. Liste d’attente

- [ ] Liste d’attente :
  - [ ] Ajout de clients en attente avec taille de groupe
  - [ ] Lien entre une entrée de liste d’attente et une table libérée
  - [ ] Notification (SMS ou autre) quand la table est prête

### H. Pacing & capacité avancée

- [ ] Limitation de couverts par créneau :
  - [ ] Paramètres par service (ex. midi / soir)
  - [ ] Blocage automatique des créneaux dépassant cette limite
- [ ] Durée de rotation :
  - [ ] Paramètre global de durée de rotation par type de service (ex. 1h30)
  - [ ] Utilisation de cette durée pour calculer la disponibilité des tables

### I. Analytics de base

- [ ] Tableau de bord :
  - [ ] Nombre de couverts par jour / semaine / mois
  - [ ] Taux d’occupation (par service)
  - [ ] Nombre et taux de no‑shows
  - [ ] Répartition par canal (web / téléphone / walk‑in) 
- [ ] Export CSV :
  - [ ] Export des réservations sur une période
  - [ ] Export des clients
  - [ ] Export des stats agrégées

### J. Intégration POS légère

- [ ] État “payée / libérée” côté TableUP pour chaque table (même si déconnecté du POS dans un premier temps). 
- [ ] API / hooks internes prévus pour :
  - [ ] Recevoir un changement d’état de table depuis un POS (v2)
  - [ ] Mapper les tables POS ↔ TableUP 

---

## Niveau 3 – Later (v2+)

### K. Paiement & empreinte bancaire

- [ ] Dépôt / empreinte CB :
  - [ ] Configuration par politique (grands groupes, jours spéciaux, services critiques)
  - [ ] Montant configurable (par couvert ou forfait)
  - [ ] Délais d’annulation gratuits paramétrables
- [ ] Intégration PSP :
  - [ ] Intégration avec Stripe / Payplug / autre PSP
  - [ ] Webhooks pour mettre à jour les réservations selon l’état du paiement  

### L. Intégrations externes

- [ ] Intégration Google Reserve (Reserve with Google) pour exposer la dispo TableUP dans l’écosystème Google.[web:2][web:58][web:64]  
- [ ] Connecteurs marketplaces sélectionnées, avec possibilité :
  - [ ] d’activer/désactiver par canal
  - [ ] de taguer les réservations issues de chaque canal  

### M. Marketing & fidélisation

- [ ] Campagnes email/SMS :
  - [ ] Filtre par fréquence / canal / tag client
  - [ ] Templates simples pour relances (ex. “reviens dîner”, “promotion midi”)  
- [ ] Programmes de fidélité simples :
  - [ ] Compteur de visites
  - [ ] Tags “fidèle” / “VIP” et avantages associés[web:52][web:57][web:64]  

### N. Intelligence & automatisation avancées

- [ ] Allocation automatique des tables selon :
  - [ ] taille du groupe
  - [ ] durée estimée
  - [ ] optimisation du taux de remplissage 
- [ ] Score de risque no‑show (basé sur historique, canal, jour / service) avec suggestions de dépôt renforcé.  
- [ ] Suggestions de pacing (capture de capacité) selon historique par jour de la semaine / saison.  

### O. Menu intégrer 

- [ ] Système de menu Niv 1
  - [ ] Afficher le menu sur le site 
  - [ ] Tag des alergènes 
  - [ ] Modification du menu
  - [ ] Possibilité de changer la disponibilité des plats en temps réels
- [ ] Système de menu Niv 2
  - [ ] Prise de commande directement sur le menu
  - [ ] Système de QRCode directement affilié à une table pour la prise de la commande
  - [ ] Payement en ligne possible ou en caisse 
  - [ ] Paramétrage des différentes préférences du restaurateur (Payement : Caisse et en Ligne / Seulement en Caisse / Seulement en Ligne; Menu : Prise de commande possible par table / Prise de commande mais ajouter un nom et numéro table / Affichage du menu uniquement)

## Autre idée sans plan - Petit + 

- [ ] Outil de vérification de QRCode
  ℹ️ Pour éviter le **quishing**, on pourra mettre à disposition un petit outil qui va vérifier les liens des QRCodes scannées.

---

## Notes d’implémentation

- Utiliser une logique de **multi‑tenant** dès le départ (un tenant = un restaurant), même si au début tu n’en as qu’un.
- Gérer correctement les **timezones** et changements d’heure (services typiquement en heure locale resto).
- Prévoir dès la v1 une API ou au moins une couche de services propre pour faciliter les futures intégrations POS / Google / marketplaces. 