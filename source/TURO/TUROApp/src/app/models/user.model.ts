export type UserRole = 'Admin' | 'Staff';

/** Un compte de l'équipe. Un utilisateur n'appartient qu'à un restaurant */
export interface UserStaff {
    id: string,
    restaurantId: string,
    role: UserRole,
}
