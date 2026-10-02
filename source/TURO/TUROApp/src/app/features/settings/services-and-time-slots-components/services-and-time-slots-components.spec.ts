import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ServicesAndTimeSlotsComponents } from './services-and-time-slots-components';

describe('ServicesAndTimeSlotsComponents', () => {
  let component: ServicesAndTimeSlotsComponents;
  let fixture: ComponentFixture<ServicesAndTimeSlotsComponents>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServicesAndTimeSlotsComponents]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ServicesAndTimeSlotsComponents);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
