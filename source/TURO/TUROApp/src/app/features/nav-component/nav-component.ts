import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from "@angular/router";
import { Home01Icon, User03Icon, Ticket01Icon, Table01Icon, Setting07Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { AuthService } from '../../core/services/auth/auth.service';

@Component({
  imports: [RouterLink, RouterLinkActive, HugeiconsIconComponent],
  selector: 'app-nav-component',
  templateUrl: './nav-component.html',
  styles: `
  `
})
export class NavComponent {
  authService = inject(AuthService)

  home = Home01Icon;
  client = User03Icon;
  booking = Ticket01Icon;
  table = Table01Icon;
  settings = Setting07Icon;

  mainNav = viewChild.required<ElementRef<HTMLElement>>('mainNav');
  parameterNav = viewChild.required<ElementRef<HTMLAnchorElement>>('parameterNav');

  openNavBar(){
    this.mainNav().nativeElement.classList.replace('w-14', 'w-48');
    this.parameterNav().nativeElement.classList.replace('w-12', 'w-46');
  }

  closeNavBar(){
    this.mainNav().nativeElement.classList.replace('w-48', 'w-14');
    this.parameterNav().nativeElement.classList.replace('w-46', 'w-12');
  }
}
