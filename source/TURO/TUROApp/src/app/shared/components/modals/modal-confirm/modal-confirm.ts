import { Component, input } from '@angular/core';
import { ModalRequestModel } from '../../../../core/services/modal/modal.service';

export interface ButtonModalConfirm {
    text: string,
    type: 'Primary' | 'Secondary' |  'Tertiary',
    onClick: () => void
}

export interface ModalConfirmModel extends ModalRequestModel{
  kind: 'confirm';
  description: string;
  buttons: ButtonModalConfirm[];
}

@Component({
  imports: [],
  selector: 'app-modal-confirm',
  templateUrl: './modal-confirm.html',
})

export class ModalConfirm {
  model = input.required<ModalConfirmModel>();
}
