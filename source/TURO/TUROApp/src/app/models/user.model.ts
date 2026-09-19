export type UserRole = 'Admin' | 'Staff';

/** Un compte de l'équipe. Un utilisateur n'appartient qu'à un restaurant */
export interface UserStaff {
    id: string,
    restaurantId: string,
    role: UserRole,
    /** L'identifiant de connexion */
    login: string,
    /**
     * Le mot de passe haché
     * @see ⚠️ Ne doit **jamais** sortir de l'API : à retirer des réponses côté serveur
     */
    passwordHash: string,
}
