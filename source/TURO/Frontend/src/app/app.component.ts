import { Component, input } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavComponent } from './features/nav-component/nav-component';
import { ModalManager } from "./shared/components/modals/modal-manager/modal-manager";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavComponent, ModalManager],
  templateUrl: './app.component.html',
})
export class AppComponent {

}
