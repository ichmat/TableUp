import { Service, signal } from '@angular/core';
import type { ButtonModalConfirm, ModalConfirmModel } from '../../../shared/components/modals/modal-confirm/modal-confirm';
import type { ModalFormInput, ModalFormModel } from '../../../shared/components/modals/modal-form/modal-form';

export interface ModalRequestModel{
    title: string;
    onCrossClicked?: () => void;
}

export type ModalModel = ModalConfirmModel | ModalFormModel;

@Service()
export class ModalService {
    private _displayModals = signal<ModalModel[] | null>(null);
    displayModals = this._displayModals.asReadonly();

    private addModal(modal: ModalModel){
        this._displayModals.update((oldValue) => {
            if(oldValue === null){
                return [modal];
            }
            return oldValue.concat([modal]);
        })
    }

    /**
     * Retire cette modale précisément, et non la dernière affichée :
     * un callback peut avoir ouvert une autre modale avant la fermeture
     */
    private removeModal(modal: ModalModel){
        this._displayModals.update((oldValue) => {
            const remaining = oldValue?.filter((m) => m !== modal) ?? [];
            return remaining.length === 0 ? null : remaining;
        })
    }

    confirmModal(title:string, desc: string, okText: string = "Valider", cancelText: string = "Annuler"): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const close = (result: boolean) => {this.removeModal(modal);resolve(result);}
            const modal: ModalConfirmModel = {
                kind:'confirm',
                title: title,
                description: desc,
                buttons: [
                    {text: okText, type: 'Primary', onClick: () => close(true)},
                    {text: cancelText, type: 'Secondary', onClick: () => close(false)},
                ],
                onCrossClicked: () => close(false),
            };
            this.addModal(modal);
        });
    }

    infoModal(title:string, desc: string, okText: string = "Ok"): Promise<void> {
        return new Promise<void>((resolve) => {
            const close = () => {this.removeModal(modal);resolve();}
            const modal: ModalConfirmModel = {
                kind:'confirm',
                title: title,
                description: desc,
                buttons: [
                    {text: okText, type: 'Primary', onClick: close},
                ],
                onCrossClicked: close,
            };
            this.addModal(modal);
        });
    }

    actionModal(title:string, desc: string, buttons: ButtonModalConfirm[]): Promise<void> {
        return new Promise<void>((resolve) => {
            const close = () => {this.removeModal(modal);resolve();}
            const modal: ModalConfirmModel = {
                kind:'confirm',
                title: title,
                description: desc,
                // La modale se ferme avant l'action, qui peut en ouvrir une autre
                buttons: buttons.map((b) => ({...b, onClick: () => {close();b.onClick();}})),
                onCrossClicked: close,
            };
            this.addModal(modal);
        });
    }

    /** Résout `true` si le formulaire est validé (les `setValue` ont alors été appelés), `false` s'il est annulé */
    formModal(title: string, inputs: ModalFormInput[], desc?: string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const close = (validated: boolean) => {this.removeModal(modal);resolve(validated);}
            const modal: ModalFormModel = {
                kind: 'form',
                title: title,
                desc: desc,
                inputs: inputs,
                onValidate: () => close(true),
                onCancel: () => close(false),
                onCrossClicked: () => close(false),
            };
            this.addModal(modal);
        });
    }
}
