import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ClientDetail, ClientHistoryItem } from '../../../models';
import { ClientService } from '../../../core/services/client/client.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { ClientSheet } from './client-sheet';

const DAY = 24 * 60 * 60 * 1000;
const at = (id: string, offsetDays: number, change: Partial<ClientHistoryItem> = {}): ClientHistoryItem => {
  const start = new Date(Date.now() + offsetDays * DAY);
  return { id, start: start.toISOString(), serviceDay: start.toISOString().slice(0, 10), covers: 2, status: 'Finished', placeName: 'T6', ...change };
};
const SOPHIE: ClientDetail = {
  id: 'c1', name: 'Sophie Marchand', phones: ['0612345678', '0711223344'], emails: ['s@mail.fr'], allergies: 'Fruits à coque',
  internalNotes: 'Préfère la fenêtre', tags: ['Regular'], visitCount: 41, noShowCount: 2, averageCovers: 3.4, atRisk: false,
  marketingConsent: false, createdAt: '2026-01-01T00:00:00Z', mergeCandidates: [], version: 1,
  history: [at('up', 3, { status: 'Confirmed' }), at('p1', -10), at('p2', -20, { status: 'NoShow', placeName: null })],
};

describe('ClientSheet', () => {
  let fixture: ComponentFixture<ClientSheet>;
  let clients: jasmine.SpyObj<ClientService>;
  let modal: jasmine.SpyObj<ModalService>;
  const detail = signal<ClientDetail | null>(SOPHIE);
  const isAdmin = signal(true);
  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent!.replace(/\s+/g, ' ');
  const button = (label: string) => Array.from(element().querySelectorAll('button')).find((b) => b.textContent!.includes(label))!;

  beforeEach(async () => {
    detail.set(SOPHIE);
    isAdmin.set(true);
    clients = jasmine.createSpyObj<ClientService>('ClientService', ['update', 'merge', 'anonymize'],
      { detail, detailFailed: signal(false) });
    modal = jasmine.createSpyObj<ModalService>('ModalService', ['infoModal', 'confirmModal']);
    modal.infoModal.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [ClientSheet],
      providers: [
        { provide: ClientService, useValue: clients },
        { provide: AuthService, useValue: { isAdmin } },
        { provide: RestaurantService, useValue: { model: signal({ timeZone: 'Europe/Paris' }) } },
        { provide: ModalService, useValue: modal },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientSheet);
    fixture.detectChanges();
  });

  it('should stack identity, allergy, counters, notes, history and actions in that order', () => {
    const blocks = Array.from(element().querySelectorAll('[data-block]')).map((b) => b.getAttribute('data-block'));

    expect(blocks).toEqual(['identity', 'allergy', 'counters', 'notes', 'history', 'actions']);
    expect(text()).toContain('06 12 34 56 78');
    expect(text()).toContain('Fruits à coque');
    expect(text()).toContain('3,4');
    expect(text()).toContain('NOTES · INTERNE');
  });

  it('should say when no allergy is known, and hide empty notes', () => {
    detail.set({ ...SOPHIE, allergies: null, internalNotes: null });
    fixture.detectChanges();

    expect(text()).toContain('Aucune allergie connue');
    expect(element().querySelector('[data-block="notes"]')).toBeNull();
  });

  it('should put upcoming reservations first, then a PASSÉES rule', () => {
    const rows = Array.from(element().querySelectorAll('[data-history-row], [data-past-separator]'))
      .map((r) => r.hasAttribute('data-past-separator') ? 'rule' : r.getAttribute('data-history-row'));

    expect(rows).toEqual(['up', 'rule', 'p1', 'p2']);
    expect(text()).toContain('CONFIRMÉE');
    expect(text()).toContain('NO-SHOW');
  });

  it('should draw no rule when every reservation is past', () => {
    detail.set({ ...SOPHIE, history: [at('p1', -10), at('p2', -20)] });
    fixture.detectChanges();

    expect(element().querySelector('[data-past-separator]')).toBeNull();
  });

  it('should show ten reservations, then offer the others', () => {
    detail.set({ ...SOPHIE, history: Array.from({ length: 13 }, (_, i) => at(`p${i}`, -1 - i)) });
    fixture.detectChanges();

    expect(element().querySelectorAll('[data-history-row]').length).toBe(10);
    button('Voir les 3 autres').click();
    fixture.detectChanges();
    expect(element().querySelectorAll('[data-history-row]').length).toBe(13);
  });

  it('should hide merge and delete from the service staff', () => {
    detail.set({ ...SOPHIE, mergeCandidates: [{ id: 'c2', name: 'S. Marchand', phone: '0711223344', sharedKey: 'Email' }] });
    fixture.detectChanges();
    expect(text()).toContain('Même e-mail que S. Marchand');
    expect(text()).toContain('Supprimer le client');

    isAdmin.set(false);
    fixture.detectChanges();
    expect(element().querySelector('[data-block="merge"]')).toBeNull();
    expect(text()).not.toContain('Supprimer le client');
  });

  it('should merge only after a confirmation naming the other client', async () => {
    detail.set({ ...SOPHIE, mergeCandidates: [{ id: 'c2', name: 'S. Marchand', phone: null, sharedKey: 'Phone' }] });
    fixture.detectChanges();
    modal.confirmModal.and.resolveTo(true);
    clients.merge.and.resolveTo({ value: SOPHIE, error: null });

    button('Fusionner').click();
    await fixture.whenStable();

    expect(modal.confirmModal.calls.mostRecent().args[1]).toContain('S. Marchand');
    expect(clients.merge).toHaveBeenCalledOnceWith('c1', 'c2');
  });

  it('should add a missing tag at once', async () => {
    clients.update.and.resolveTo({ value: SOPHIE, error: null });

    button('+ tag').click();
    fixture.detectChanges();
    element().querySelector<HTMLElement>('[data-tag-option="Vip"]')!.click();
    await fixture.whenStable();

    expect(clients.update.calls.mostRecent().args[1].tags).toEqual(['Regular', 'Vip']);
  });

  it('should close once the client is deleted', async () => {
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    modal.confirmModal.and.resolveTo(true);
    clients.anonymize.and.resolveTo({ value: null, error: null });

    button('Supprimer le client').click();
    await fixture.whenStable();

    expect(modal.confirmModal.calls.mostRecent().args[1]).toContain('Client supprimé');
    expect(clients.anonymize).toHaveBeenCalledOnceWith('c1');
    expect(closed).toBe(1);
  });
});
