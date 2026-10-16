import { twMerge } from 'tailwind-merge';

export const DEFAULT_INPUT_STYLE =
    "px-3 py-2 rounded-lg border-4 border-border-soft bg-app focus-within:outline-0 focus-within:border-interactive " +
    "focus-within:inset-shadow-sm transition duration-200 w-52 cursor-text flex flex-row flex-nowrap overflow-hidden " +
    "gap-2"

export const INPUT_ERROR_STYLE = "border-red-500"

export const INPUT_DISABLED_STYLE = "opacity-50 cursor-not-allowed"

/** Le cadre d'un champ : `classes` s'ajoute au style par défaut, l'erreur et la désactivation passent par-dessus */
export function inputWrapperClass(showError: boolean, disabled: boolean, ...classes: (string | undefined)[]): string {
    return twMerge(DEFAULT_INPUT_STYLE, ...classes,
        showError ? INPUT_ERROR_STYLE : '',
        disabled ? INPUT_DISABLED_STYLE : '',
    );
}
