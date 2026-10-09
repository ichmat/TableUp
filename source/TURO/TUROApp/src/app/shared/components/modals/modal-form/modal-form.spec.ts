import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalService } from '../../../../core/services/modal/modal.service';
import { ModalForm, ModalFormModel } from './modal-form';

describe('ModalForm', () => {
  let fixture: ComponentFixture<ModalForm>;
  let modal: jasmine.SpyObj<ModalService>;
  let saved: string | null;
  let validated: jasmine.Spy;
  const element = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    saved = null;
    validated = jasmine.createSpy('validated');
    modal = jasmine.createSpyObj<ModalService>('ModalService', ['infoModal']);
    await TestBed.configureTestingModule({
      imports: [ModalForm],
      providers: [{ provide: ModalService, useValue: modal }],
    }).compileComponents();
    fixture = TestBed.createComponent(ModalForm);
    const model: ModalFormModel = {
      kind: 'form', title: 'Renommer la salle', desc: 'Le nom apparaît dans les onglets.',
      inputs: [{ valueType: 'string', label: 'Nom', required: true, defaultValue: 'Salle', setValue: (value) => { saved = value; } }],
      onValidate: validated, onCancel: () => {},
    };
    fixture.componentRef.setInput('model', model);
    fixture.detectChanges();
  });

  it('should show the title, the description and each field with its required mark', () => {
    expect(element().textContent).toContain('Renommer la salle');
    expect(element().textContent).toContain('Le nom apparaît dans les onglets.');
    expect(element().textContent!.replace(/\s+/g, ' ')).toContain('Nom *');
  });

  it('should hand back the values, then validate', () => {
    fixture.componentInstance.validate();

    expect(saved).toBe('Salle');
    expect(validated).toHaveBeenCalledTimes(1);
    expect(modal.infoModal).not.toHaveBeenCalled();
  });
});
