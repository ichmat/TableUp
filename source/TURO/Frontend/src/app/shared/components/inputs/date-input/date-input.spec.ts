import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateInput } from './date-input';

describe('DateInput', () => {
  let component: DateInput;
  let fixture: ComponentFixture<DateInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateInput]
    })
      .compileComponents();

    fixture = TestBed.createComponent(DateInput);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
