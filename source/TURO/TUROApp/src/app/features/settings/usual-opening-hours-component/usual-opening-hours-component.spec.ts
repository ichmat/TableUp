import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UsualOpeningHoursComponent } from './usual-opening-hours-component';

describe('UsualOpeningHoursComponent', () => {
  let component: UsualOpeningHoursComponent;
  let fixture: ComponentFixture<UsualOpeningHoursComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsualOpeningHoursComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(UsualOpeningHoursComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
