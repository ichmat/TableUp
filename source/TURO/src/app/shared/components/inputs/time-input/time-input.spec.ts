import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeInput } from './time-input';

describe('TimeInput', () => {
  let component: TimeInput;
  let fixture: ComponentFixture<TimeInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimeInput]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TimeInput);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
