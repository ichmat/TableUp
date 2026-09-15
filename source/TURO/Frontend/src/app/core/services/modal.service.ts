import { Service, signal } from '@angular/core';

interface ButtonModal {
    text: string,
    type: 'Primary' | 'Secondary' |  'Tertiary',
    onClick: () => void
}

interface ModalRequest {
    title: string,
    description: string,
    buttons: ButtonModal[],
    onCrossClicked?: () => void
}

@Service()
export class ModalService {
    /** NE PAS UTILISER */
    readonly displayModals = signal<ModalRequest[] | null>(null);

    private addModal(modal: ModalRequest){
        this.displayModals.update((oldValue) => {
            if(oldValue === null){
                return [modal];
            }
            return oldValue.concat([modal]);
        })
    }

    private removeLastModal(){
        this.displayModals.update((oldValue) => {
            if(oldValue === null || oldValue.length === 1){
                return null;
            }
            oldValue.pop();
            return oldValue;
        })
    }

    confirmModal(title:string, desc: string, okText: string = "Valider", cancelText: string = "Annuler"): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this.addModal({
                title: title,
                description: desc,
                buttons: [
                    {text: okText, type: 'Primary', onClick: () => {this.removeLastModal();resolve(true)}},
                    {text: cancelText, type: 'Secondary', onClick: () => {this.removeLastModal();resolve(false)}},
                ],
                onCrossClicked: () => {this.removeLastModal();resolve(false)},
            })
        });
    }
}
