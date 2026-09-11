import { Component, input } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavComponent } from './features/nav-component/nav-component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {

}
