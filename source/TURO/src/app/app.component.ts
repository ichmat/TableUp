import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TuNavComponent } from './tu-nav/tu-nav.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TuNavComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'TURO';
}
