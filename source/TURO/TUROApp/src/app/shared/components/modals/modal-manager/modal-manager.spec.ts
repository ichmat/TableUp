import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalManager } from './modal-manager';
import { ModalService } from '../../../../core/services/modal/modal.service';

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

  it('should lay the modals over everything, the rail and overlays included', () => {
    void TestBed.inject(ModalService).infoModal('Déjà réservé', 'Sophie a déjà une réservation sur ce créneau.');
    fixture.detectChanges();

    const host = (fixture.nativeElement as HTMLElement).firstElementChild as HTMLElement;
    expect(host.className).toContain('z-50');
  });
});
