
<p align="center">
    <img src="images\TableUp.png" />
</p>

Le projet **TableUP** a pour vocation d'être un <u>système de restauration</u> incluant la gestion du restaurant pour les restaurateur et une application mobile utilisés par les clients qui veulent chercher et reserver un restaurant.

Les fonctionnalités finaux sont : 
- **Gestion du restaurant** avec 2 modes de fonctionnements : 
    - ☁️ Solution dans le cloud
    - 💻 Solution en local chez le restaurateur
- **Cloud backup** utiliser pour sauvegarder les données restaurateurs
- **Application recherche et reservation** de restaurant pour les clients
- **Le service central** qui relis et met à disposition les informations pour réserver

> ℹ️ *Sachant que la réservation sera possible à partir de l'application, par google map et sur un site en direct*

![Architecture V1](images/architecture.png)

➡️ **La version 1 ne prévoit que la partie restaurateur pour le moment**

## Stack technique

Application restaurateur : 

> *Code disponible dans `source\TURO`*

- Angular v22
- Typescript
- C# 
- ASP NET Core v10
- Entity Framework Core v10
- PostgreSQL
