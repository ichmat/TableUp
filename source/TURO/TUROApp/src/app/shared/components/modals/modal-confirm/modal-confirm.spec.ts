import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalConfirm, ModalConfirmModel } from './modal-confirm';

describe('ModalConfirm', () => {
  let fixture: ComponentFixture<ModalConfirm>;
  const confirmed = jasmine.createSpy('confirmed');
  const MODEL: ModalConfirmModel = {
    kind: 'confirm', title: 'Placer Moreau sur 6 ?', description: 'Table collée — il faudra les séparer.\n2 places de trop',
    buttons: [{ text: 'Annuler', type: 'Secondary', onClick: () => {} }, { text: 'Placer', type: 'Primary', onClick: confirmed }],
  };
  const element = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ModalConfirm] }).compileComponents();
    fixture = TestBed.createComponent(ModalConfirm);
    fixture.componentRef.setInput('model', MODEL);
    fixture.detectChanges();
  });

  it('should show the title, the description and its buttons in order', () => {
    expect(element().textContent).toContain('Placer Moreau sur 6 ?');
    expect(element().textContent).toContain('2 places de trop');
    expect(Array.from(element().querySelectorAll('button')).map((b) => b.textContent!.trim())).toEqual(['Annuler', 'Placer']);
  });

  it('should run the action of the button touched', () => {
    Array.from(element().querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Placer')!.click();

    expect(confirmed).toHaveBeenCalledTimes(1);
  });
});
