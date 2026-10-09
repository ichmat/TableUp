import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavComponent } from './nav-component';

describe('NavComponent', () => {
  let component: NavComponent;
  let fixture: ComponentFixture<NavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(NavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should lay the rail over the screens, since it covers them and never pushes them (§4.4)', () => {
    // Le rail n'existe que connecté : un module neuf, qui lit le jeton à la construction d'AuthService
    TestBed.resetTestingModule();
    localStorage.setItem('jwt', 'token');
    TestBed.configureTestingModule({ imports: [NavComponent], providers: [provideRouter([])] });
    const connected = TestBed.createComponent(NavComponent);
    connected.detectChanges();

    const nav = (connected.nativeElement as HTMLElement).querySelector('nav')!;
    expect(nav.className).toContain('z-30');
    localStorage.removeItem('jwt');
  });
});
