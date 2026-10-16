import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { AppComponent } from './app.component';
import { UndoService } from './core/services/undo/undo.service';

@Component({ template: '' })
class EmptyPage {}

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([
          { path: '', component: EmptyPage },
          { path: 'plein-ecran', component: EmptyPage, data: { fullScreen: true } },
        ]),
        { provide: UndoService, useValue: { state: signal(null) } },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should hide the rail on a full screen route', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-nav-component')).not.toBeNull();

    await router.navigateByUrl('/plein-ecran');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-nav-component')).toBeNull();
  });
});
