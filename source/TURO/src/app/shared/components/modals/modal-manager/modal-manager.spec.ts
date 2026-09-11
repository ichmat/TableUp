import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalManager } from './modal-manager';

describe('ModalManager', () => {
  let component: ModalManager;
  let fixture: ComponentFixture<ModalManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalManager]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ModalManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
