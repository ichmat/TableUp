import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalConfirm } from './modal-confirm';

describe('ModalConfirm', () => {
  let component: ModalConfirm;
  let fixture: ComponentFixture<ModalConfirm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalConfirm]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ModalConfirm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
