import { Component, ComponentRef, computed, effect, inject, inputBinding, viewChild, ViewContainerRef } from '@angular/core';
import { ModalService } from '../../../../core/services/modal/modal.service';
import { ModalConfirm, ModalConfirmModel } from '../modal-confirm/modal-confirm';
import { ModalForm } from '../modal-form/modal-form';

@Component({
  imports: [ModalConfirm, ModalForm],
  selector: 'app-modal-manager',
  templateUrl: './modal-manager.html',
})
export class ModalManager {
  modalService = inject(ModalService);
  // private readonly host = viewChild.required('host', { read: ViewContainerRef });

  // modalChildrens = computed(() => {
  //   const components: ComponentRef<unknown>[] = [];

  //   if(this._modalService.displayModals() !== null && 
  //      this._modalService.displayModals()!.length > 0){
  //     this._modalService.displayModals()!.forEach((modal) => {

  //       if(modal.kind === 'confirm'){
  //         components.push(this.host().createComponent(ModalConfirm, {
  //           bindings: [
  //             inputBinding('model', () => modal as ModalConfirmModel)
  //           ]
  //         }))
  //       }
  //     });
  //   }

  //   return components;
  // });
  
}
