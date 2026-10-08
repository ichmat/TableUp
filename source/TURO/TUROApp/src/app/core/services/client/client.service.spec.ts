import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { ApiError, ClientDetail, ClientListItem, ClientPage, DataScope } from '../../../models';
import { RealtimeService } from '../realtime/realtime.service';
import { ClientService, fileNameOf } from './client.service';

const PAGE: ClientPage = { items: [], total: 0, page: 0, pageSize: 50 };
const DETAIL: ClientDetail = {
  id: 'c1', name: 'Sophie Marchand', phones: ['0612345678'], emails: [], allergies: null, internalNotes: null, tags: [],
  visitCount: 0, noShowCount: 0, averageCovers: null, atRisk: false, marketingConsent: false, createdAt: '2026-10-05T10:00:00Z',
  mergeCandidates: [], history: [], version: 1,
};
const item = (id: string, name: string): ClientListItem => ({
  id, name, phone: '0612345678', tags: [], hasAllergy: false, allergies: null, visitCount: 0, noShowCount: 0, atRisk: false, lastServiceDay: null,
});

describe('fileNameOf', () => {
  it('should read the file name of a Content-Disposition header', () => {
    expect(fileNameOf("attachment; filename=clients-2026-10-05.csv; filename*=UTF-8''clients-2026-10-05.csv")).toBe('clients-2026-10-05.csv');
    expect(fileNameOf(null)).toBeNull();
  });
});

describe('ClientService', () => {
  let service: ClientService;
  let http: HttpTestingController;
  const handlers = new Map<DataScope, () => void>();

  // Le GET de la liste ; `findByPhone` demande `pageSize=5`, ce qui le distingue
  const listCall = (): TestRequest =>
    http.expectOne((r) => r.url === '/api/clients' && r.method === 'GET' && r.params.get('pageSize') !== '5' && !r.params.has('phone'));
  const settle = async () => {
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
  };

  beforeEach(() => {
    // AuthService lit le jeton à sa construction
    localStorage.setItem('jwt', 'token');
    handlers.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: RealtimeService, useValue: { onDataChanged: (scope: DataScope, reload: () => void) => { handlers.set(scope, reload); return () => undefined; } } },
      ],
    });
    service = TestBed.inject(ClientService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });

  afterEach(() => localStorage.removeItem('jwt'));

  it('should ask for the first fifty recent clients', () => {
    const call = listCall();

    expect(call.request.params.get('sort')).toBe('Recent');
    expect(call.request.params.get('page')).toBe('0');
    expect(call.request.params.get('pageSize')).toBe('50');
    expect(call.request.params.has('search')).toBeFalse();
    expect(call.request.params.has('atRisk')).toBeFalse();
  });

  it('should grow the page on show more, and go back to fifty when the search changes', async () => {
    listCall().flush(PAGE);
    await settle();

    service.showMore();
    TestBed.tick();
    listCall().flush(PAGE);
    expect(service.query().pageSize).toBe(100);
    await settle();

    service.setQuery({ search: ' 06 12 ', tag: 'Vip', atRisk: true });
    TestBed.tick();
    const call = listCall();
    expect(call.request.params.get('pageSize')).toBe('50');
    expect(call.request.params.get('search')).toBe('06 12');
    expect(call.request.params.get('tag')).toBe('Vip');
    expect(call.request.params.get('atRisk')).toBe('true');
  });

  it('should keep the previous page while the next one loads', async () => {
    listCall().flush({ ...PAGE, total: 1, items: [item('c1', 'Sophie')] });
    await settle();
    // L'écran affiche la première page avant que la recherche ne change
    expect(service.page()?.total).toBe(1);

    service.setQuery({ sort: 'Name' });
    TestBed.tick();

    expect(service.page()?.total).toBe(1);
    listCall().flush(PAGE);
    await settle();
    expect(service.page()?.total).toBe(0);
  });

  it('should load the selected client and reload both on a clients notification', async () => {
    listCall().flush(PAGE);
    service.select('c1');
    TestBed.tick();
    http.expectOne('/api/clients/c1').flush(DETAIL);
    await settle();
    expect(service.detail()?.name).toBe('Sophie Marchand');

    handlers.get(DataScope.Clients)!();
    TestBed.tick();

    listCall().flush(PAGE);
    http.expectOne('/api/clients/c1').flush({ ...DETAIL, name: 'Sophie M.' });
    await settle();
    expect(service.detail()?.name).toBe('Sophie M.');
  });

  it('should refresh the list and the open sheet after an update', async () => {
    listCall().flush(PAGE);
    service.select('c1');
    TestBed.tick();
    http.expectOne('/api/clients/c1').flush(DETAIL);
    await settle();

    const result = service.update('c1', { name: 'Sophie M.', phones: ['0612345678'], emails: [], allergies: null, internalNotes: null, tags: [], version: 1 });
    const put = http.expectOne((r) => r.url === '/api/clients/c1' && r.method === 'PUT');
    put.flush({ ...DETAIL, name: 'Sophie M.' });

    expect((await result).value?.name).toBe('Sophie M.');
    expect(service.detail()?.name).toBe('Sophie M.');
    TestBed.tick();
    listCall().flush(PAGE);
  });

  it('should return the API code when a number is taken', async () => {
    listCall().flush(PAGE);
    const result = service.create({ name: 'Autre', phones: ['0612345678'], emails: [], allergies: null, internalNotes: null, tags: [], version: null });
    http.expectOne((r) => r.url === '/api/clients' && r.method === 'POST').flush(
      { statusCode: 409, message: 'This phone number already belongs to Sophie Marchand.', error: 'ClientPhoneTaken' },
      { status: 409, statusText: 'Conflict' });

    expect(await result).toEqual({ value: null, error: 'This phone number already belongs to Sophie Marchand.', code: ApiError.ClientPhoneTaken });
  });

  it('should close the sheet once the client is anonymized', async () => {
    listCall().flush(PAGE);
    service.select('c1');
    TestBed.tick();
    http.expectOne('/api/clients/c1').flush(DETAIL);

    const result = service.anonymize('c1');
    http.expectOne((r) => r.url === '/api/clients/c1' && r.method === 'DELETE').flush(null, { status: 204, statusText: 'No Content' });

    expect((await result).error).toBeNull();
    expect(service.selectedId()).toBeNull();
  });

  it('should download the export with its file name', async () => {
    listCall().flush(PAGE);
    const result = service.exportCsv();
    http.expectOne('/api/clients/export').flush(new Blob(['Nom']), {
      headers: { 'Content-Disposition': 'attachment; filename=clients-2026-10-05.csv' },
    });

    const file = (await result).value!;
    expect(file.fileName).toBe('clients-2026-10-05.csv');
    expect(await file.blob.text()).toBe('Nom');
  });

  it('should find the owner of a number, other than the client being edited', async () => {
    listCall().flush(PAGE);
    const owner = service.findByPhone('0612345678', 'c1');
    http.expectOne((r) => r.url === '/api/clients' && r.params.get('pageSize') === '5' && r.params.get('search') === '0612345678')
      .flush({ ...PAGE, items: [item('c1', 'Moi'), item('c2', 'Sophie Marchand')] });

    expect((await owner)?.id).toBe('c2');
  });

  it('should recognize a whole number, never a piece of one', async () => {
    listCall().flush(PAGE);
    const owner = service.findExactPhone('06 12 34 56 78');
    http.expectOne((r) => r.url === '/api/clients' && r.params.get('phone') === '06 12 34 56 78' && r.params.get('pageSize') === '1')
      .flush({ ...PAGE, items: [item('c2', 'Sophie Marchand')] });

    expect((await owner)?.id).toBe('c2');
  });
});
