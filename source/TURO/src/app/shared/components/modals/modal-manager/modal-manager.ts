import { Component, inject } from '@angular/core';
import { ModalService } from '../../../../core/services/modal.service';

@Component({
  imports: [],
  selector: 'app-modal-manager',
  templateUrl: './modal-manager.html',
})
export class ModalManager {
  protected readonly modalService = inject(ModalService);
  
}
