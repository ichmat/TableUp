import { Service, signal } from '@angular/core';
import type { ModalConfirmModel } from '../../../shared/components/modals/modal-confirm/modal-confirm';
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

    private removeLastModal(){
        this._displayModals.update((oldValue) => {
            if(oldValue === null || oldValue.length === 1){
                return null;
            }
            return oldValue.slice(0,-1);
        })
    }

    confirmModal(title:string, desc: string, okText: string = "Valider", cancelText: string = "Annuler"): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this.addModal({
                kind:'confirm',
                title: title,
                description: desc,
                buttons: [
                    {text: okText, type: 'Primary', onClick: () => {this.removeLastModal();resolve(true)}},
                    {text: cancelText, type: 'Secondary', onClick: () => {this.removeLastModal();resolve(false)}},
                ],
                onCrossClicked: () => {this.removeLastModal();resolve(false)},
            } as ModalConfirmModel)
        });
    }

    infoModal(title:string, desc: string, okText: string = "Ok"): Promise<void> {
        return new Promise<void>((resolve) => {
            this.addModal({
                kind:'confirm',
                title: title,
                description: desc,
                buttons: [
                    {text: okText, type: 'Primary', onClick: () => {this.removeLastModal();resolve()}},
                ],
                onCrossClicked: () => {this.removeLastModal();resolve()},
            } as ModalConfirmModel)
        });
    }

    /** Résout `true` si le formulaire est validé (les `setValue` ont alors été appelés), `false` s'il est annulé */
    formModal(title: string, inputs: ModalFormInput[], desc?: string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const close = (validated: boolean) => {this.removeLastModal(); resolve(validated)};
            this.addModal({
                kind: 'form',
                title: title,
                desc: desc,
                inputs: inputs,
                onValidate: () => close(true),
                onCancel: () => close(false),
                onCrossClicked: () => close(false),
            });
        });
    }
}
