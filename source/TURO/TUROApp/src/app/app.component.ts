import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { NavComponent } from './features/nav-component/nav-component';
import { ModalManager } from "./shared/components/modals/modal-manager/modal-manager";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavComponent, ModalManager],
  templateUrl: './app.component.html',
})
export class AppComponent {
  private _router = inject(Router);

  /** Une route `data: { fullScreen: true }` (l'éditeur de plan) s'affiche sans le rail */
  protected isFullScreen = toSignal(this._router.events.pipe(
    filter((event) => event instanceof NavigationEnd),
    map(() => {
      let route = this._router.routerState.snapshot.root;
      while (route.firstChild) {
        route = route.firstChild;
      }
      return route.data['fullScreen'] === true;
    }),
  ), { initialValue: false });
}
