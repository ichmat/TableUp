import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError, ClientDetail } from '../../../models';
import { ClientService } from '../../../core/services/client/client.service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { ClientForm } from './client-form';

const SOPHIE: ClientDetail = {
  id: 'c1', name: 'Sophie Marchand', phones: ['0612345678'], emails: [], allergies: 'Arachide', internalNotes: null,
  tags: ['Vip'], visitCount: 0, noShowCount: 0, averageCovers: null, atRisk: false, marketingConsent: false,
  createdAt: '2026-01-01T00:00:00Z', mergeCandidates: [], history: [], version: 1,
};

type Draft = Record<string, unknown>;
type FormAccess = { _draft: { (): Draft, update(fn: (d: Draft) => Draft): void }, save(): Promise<void> };

describe('ClientForm', () => {
  let fixture: ComponentFixture<ClientForm>;
  let clients: jasmine.SpyObj<ClientService>;
  let modal: jasmine.SpyObj<ModalService>;
  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent!.replace(/\s+/g, ' ');
  const button = (label: string) => Array.from(element().querySelectorAll('button')).find((b) => b.textContent!.trim() === label);
  const form = () => fixture.componentInstance as unknown as FormAccess;

  beforeEach(async () => {
    clients = jasmine.createSpyObj<ClientService>('ClientService', ['create', 'update', 'findByPhone']);
    modal = jasmine.createSpyObj<ModalService>('ModalService', ['infoModal', 'confirmModal']);
    modal.infoModal.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [ClientForm],
      providers: [{ provide: ClientService, useValue: clients }, { provide: ModalService, useValue: modal }],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientForm);
    fixture.detectChanges();
  });

  it('should refuse a client without name, phone or e-mail, without calling the API', async () => {
    await form().save();
    fixture.detectChanges();

    expect(clients.create).not.toHaveBeenCalled();
    expect(text()).toContain('Indiquez le nom');
    expect(text()).toContain('Indiquez au moins un téléphone ou un e-mail');
  });

  it('should send a trimmed request without the empty lines', async () => {
    clients.create.and.resolveTo({ value: SOPHIE, error: null });
    const saved: ClientDetail[] = [];
    fixture.componentInstance.saved.subscribe((client) => saved.push(client));
    form()._draft.update((d) => ({ ...d, name: ' Sophie Marchand ', phones: ['06 12 34 56 78', ' '], emails: [''], allergies: ' ', tags: ['Press'] }));

    await form().save();

    expect(clients.create).toHaveBeenCalledOnceWith({
      name: 'Sophie Marchand', phones: ['06 12 34 56 78'], emails: [], allergies: null, internalNotes: null, tags: ['Press'], version: null,
    });
    expect(saved).toEqual([SOPHIE]);
  });

  it('should add and remove phone lines, up to five', () => {
    for (let i = 0; i < 6; i++) {
      button('+ numéro')?.click();
      fixture.detectChanges();
    }
    expect(element().querySelectorAll('[data-phone]').length).toBe(5);
    expect(button('+ numéro')).toBeUndefined();

    element().querySelector<HTMLElement>('[data-remove-phone="1"]')!.click();
    fixture.detectChanges();
    expect(element().querySelectorAll('[data-phone]').length).toBe(4);
  });

  it('should start from the client, and keep the typing when the same client reloads', () => {
    fixture.componentRef.setInput('client', SOPHIE);
    fixture.detectChanges();
    expect(form()._draft()['phones']).toEqual(['06 12 34 56 78']);

    form()._draft.update((d) => ({ ...d, name: 'Sophie M.' }));
    fixture.componentRef.setInput('client', { ...SOPHIE, allergies: 'Arachide, lait' });
    fixture.detectChanges();

    expect(form()._draft()['name']).toBe('Sophie M.');
  });

  it('should offer to open the client who already has the number', async () => {
    fixture.componentRef.setInput('client', SOPHIE);
    fixture.detectChanges();
    clients.update.and.resolveTo({ value: null, error: 'This phone number already belongs to Paul.', code: ApiError.ClientPhoneTaken });
    clients.findByPhone.and.resolveTo({ id: 'c2', name: 'Paul Lefebvre', phone: '0612345678', tags: [], hasAllergy: false, allergies: null,
      visitCount: 0, noShowCount: 0, atRisk: false, lastServiceDay: null });
    modal.confirmModal.and.resolveTo(true);
    const opened: string[] = [];
    fixture.componentInstance.openClient.subscribe((id) => opened.push(id));

    await form().save();

    expect(clients.findByPhone).toHaveBeenCalledWith('06 12 34 56 78', 'c1');
    expect(modal.confirmModal.calls.mostRecent().args[1]).toContain('Paul Lefebvre');
    expect(opened).toEqual(['c2']);
    expect(modal.infoModal).not.toHaveBeenCalled();
  });

  it('should let a merged client keep notes longer than the limit, but not grow them', async () => {
    const merged = { ...SOPHIE, internalNotes: 'n'.repeat(2500) };
    fixture.componentRef.setInput('client', merged);
    fixture.detectChanges();
    clients.update.and.resolveTo({ value: merged, error: null });

    await form().save();
    expect(clients.update).toHaveBeenCalled();

    clients.update.calls.reset();
    form()._draft.update((d) => ({ ...d, internalNotes: 'n'.repeat(2501) }));
    await form().save();
    expect(clients.update).not.toHaveBeenCalled();
  });

  it('should save with the version it was opened with, and offer to reload when another device changed the client', async () => {
    fixture.componentRef.setInput('client', SOPHIE);
    fixture.detectChanges();
    form()._draft.update((d) => ({ ...d, name: 'Sophie M.' }));
    // Un autre poste enregistre une allergie : la fiche se recharge (SignalR), la saisie reste
    const changed = { ...SOPHIE, allergies: 'Arachide, lait', version: 2 };
    fixture.componentRef.setInput('client', changed);
    fixture.detectChanges();
    clients.update.and.resolveTo({ value: null, error: 'This client was changed on another device since it was opened.', code: ApiError.ClientChanged });
    modal.confirmModal.and.resolveTo(true);

    await form().save();

    expect(clients.update.calls.mostRecent().args[1].version).toBe(1);
    expect(modal.confirmModal.calls.mostRecent().args[0]).toBe('Fiche modifiée sur un autre poste');
    expect(form()._draft()['allergies']).toBe('Arachide, lait');
    expect(form()._draft()['name']).toBe('Sophie Marchand');
    expect(modal.infoModal).not.toHaveBeenCalled();
  });

  it('should mark internal notes as never leaving the software', () => {
    expect(text()).toContain('Ne sort jamais du logiciel');
  });
});
