import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SettingsComponent } from './settings-component';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
      .compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open Placement and Règles de réservation from the menu', () => {
    const element: HTMLElement = fixture.nativeElement;
    const entry = (label: string) => [...element.querySelectorAll('p')].find((p) => p.textContent?.trim() === label)!;

    entry('Placement').click();
    fixture.detectChanges();
    expect(element.querySelector('app-placement-settings-component')).not.toBeNull();

    entry('Règles de réservation').click();
    fixture.detectChanges();
    expect(element.querySelector('app-booking-rules-component')).not.toBeNull();
  });
});

describe('SettingsComponent opened from the floor plan editor', () => {
  it('should open "Salles et tables" for ?page=salles', async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ page: 'salles' }) } } },
      ],
    }).compileComponents();

    const component = TestBed.createComponent(SettingsComponent).componentInstance;

    expect(component.currentSetting).toBe('Room & tables');
  });
});
