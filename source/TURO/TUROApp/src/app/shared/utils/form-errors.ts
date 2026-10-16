import type { ModalService } from '../../core/services/modal/modal.service';

/** Ce qu'on lit d'un formulaire Signal Forms pour le vérifier avant d'enregistrer */
type CheckedForm = () => { errorSummary(): readonly { message?: string }[], markAsTouched(): void };

/**
 * Avant d'enregistrer : un formulaire invalide marque tous ses champs et montre sa première erreur.
 * Résout `true` si l'enregistrement peut continuer
 */
export async function isFormValid(form: CheckedForm, modal: ModalService, fallback: string): Promise<boolean> {
    const errors = form().errorSummary();
    if (errors.length === 0) {
        return true;
    }
    form().markAsTouched();
    await modal.infoModal('Erreur', errors[0].message ?? fallback);
    return false;
}
