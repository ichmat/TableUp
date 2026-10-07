import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ClientListItem, ClientPage, ClientQuery } from '../../../models';
import { ClientService, DEFAULT_CLIENT_QUERY } from '../../../core/services/client/client.service';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { ClientList } from './client-list';

const item = (change: Partial<ClientListItem>): ClientListItem => ({
  id: 'c1', name: 'Sophie Marchand', phone: '0612345678', tags: [], hasAllergy: false,
  visitCount: 41, noShowCount: 2, atRisk: false, lastServiceDay: null, ...change,
});

describe('ClientList', () => {
  let fixture: ComponentFixture<ClientList>;
  let clients: jasmine.SpyObj<ClientService>;
  const page = signal<ClientPage | null>(null);
  const query = signal<ClientQuery>(DEFAULT_CLIENT_QUERY);
  const listFailed = signal(false);
  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent!.replace(/\s+/g, ' ');
  const button = (label: string) => Array.from(element().querySelectorAll('button')).find((b) => b.textContent!.includes(label));

  beforeEach(async () => {
    page.set({ items: [item({})], total: 1, page: 0, pageSize: 50 });
    query.set(DEFAULT_CLIENT_QUERY);
    listFailed.set(false);
    clients = jasmine.createSpyObj<ClientService>('ClientService', ['setQuery', 'showMore', 'exportCsv'], { page, query, listFailed });

    await TestBed.configureTestingModule({
      imports: [ClientList],
      providers: [
        { provide: ClientService, useValue: clients },
        { provide: RestaurantService, useValue: { model: signal({ timeZone: 'Europe/Paris' }) } },
        { provide: ModalService, useValue: jasmine.createSpyObj<ModalService>('ModalService', ['infoModal']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientList);
    fixture.detectChanges();
  });

  it('should name the ratio column for what it holds, never « Fiabilité »', () => {
    expect(text()).toContain('NO-SHOW / VISITES');
    expect(text()).not.toContain('FIABILIT');
  });

  it('should show the ratio with its denominator, coral only when the API says so', () => {
    page.set({ items: [item({ id: 'a', noShowCount: 2, visitCount: 41 }), item({ id: 'b', noShowCount: 2, visitCount: 3, atRisk: true })], total: 2, page: 0, pageSize: 50 });
    fixture.detectChanges();

    const ratios = Array.from(element().querySelectorAll<HTMLElement>('[data-ratio]'));
    expect(ratios.map((r) => r.textContent!.trim())).toEqual(['2 / 41', '2 / 3']);
    expect(ratios[0].className).not.toContain('bg-coral');
    expect(ratios[1].className).toContain('bg-coral');
  });

  it('should list the last name first, the formatted phone, tags and the allergy mark', () => {
    page.set({ items: [item({ tags: ['Regular'], hasAllergy: true })], total: 1, page: 0, pageSize: 50 });
    fixture.detectChanges();

    expect(text()).toContain('Marchand, Sophie');
    expect(text()).toContain('06 12 34 56 78');
    expect(text()).toContain('Habitué');
    expect(element().querySelector('[data-allergy]')).not.toBeNull();
  });

  it('should open a client and ask for a new one', () => {
    const opened: string[] = [];
    let created = 0;
    fixture.componentInstance.opened.subscribe((id) => opened.push(id));
    fixture.componentInstance.create.subscribe(() => created++);

    element().querySelector<HTMLElement>('[data-client="c1"]')!.click();
    button('+ Client')!.click();

    expect(opened).toEqual(['c1']);
    expect(created).toBe(1);
  });

  it('should wait for the typing to settle before searching', fakeAsync(() => {
    const component = fixture.componentInstance as unknown as { onSearch(text: string): void };

    component.onSearch('06');
    tick(200);
    component.onSearch('06 12');
    tick(299);
    expect(clients.setQuery).not.toHaveBeenCalled();
    tick(1);

    expect(clients.setQuery).toHaveBeenCalledOnceWith({ search: '06 12' });
  }));

  it('should sort, filter by tag and by risk', () => {
    element().querySelector<HTMLElement>('[data-sort="Visits"]')!.click();
    const select = element().querySelector<HTMLSelectElement>('[data-filter="tag"]')!;
    select.value = 'Press';
    select.dispatchEvent(new Event('change'));
    element().querySelector<HTMLElement>('[data-filter="risk"]')!.click();

    expect(clients.setQuery.calls.allArgs()).toEqual([[{ sort: 'Visits' }], [{ tag: 'Press' }], [{ atRisk: true }]]);
  });

  it('should offer more rows only while some are missing', () => {
    expect(button('Afficher plus')).toBeUndefined();

    page.set({ items: [item({})], total: 60, page: 0, pageSize: 50 });
    fixture.detectChanges();
    button('Afficher plus')!.click();

    expect(clients.showMore).toHaveBeenCalled();
  });

  it('should stop offering more rows at the API cap, and ask to narrow the search', () => {
    page.set({ items: [item({})], total: 600, page: 0, pageSize: 500 });
    query.set({ ...DEFAULT_CLIENT_QUERY, pageSize: 500 });
    fixture.detectChanges();

    expect(button('Afficher plus')).toBeUndefined();
    expect(text()).toContain('Les 500 premiers clients sont affichés : affinez la recherche.');
  });

  it('should say when nothing matches the search, and when the list failed', () => {
    page.set({ items: [], total: 0, page: 0, pageSize: 50 });
    query.set({ ...DEFAULT_CLIENT_QUERY, search: 'Zoé' });
    fixture.detectChanges();
    expect(text()).toContain('Aucun client pour « Zoé »');

    listFailed.set(true);
    fixture.detectChanges();
    expect(text()).toContain("La liste des clients n'a pas pu être chargée.");
  });
});
