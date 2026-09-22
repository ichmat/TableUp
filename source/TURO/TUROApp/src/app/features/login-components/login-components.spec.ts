import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponents } from './login-components';

describe('LoginComponents', () => {
  let component: LoginComponents;
  let fixture: ComponentFixture<LoginComponents>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponents]
    })
      .compileComponents();

    fixture = TestBed.createComponent(LoginComponents);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
