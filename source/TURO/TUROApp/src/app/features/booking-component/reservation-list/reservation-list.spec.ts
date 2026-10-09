import { ClosureService } from '../../../core/services/closure/closure.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ReservationListItem, ReservationPage, ReservationQuery } from '../../../models';
import { DEFAULT_RESERVATION_QUERY, ReservationService } from '../../../core/services/reservation/reservation.service';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { ReservationActions } from '../reservation-actions';
import { ReservationList } from './reservation-list';

const ROW = (id: string, change: Partial<ReservationListItem> = {}): ReservationListItem => ({
  id, start: '2026-08-20T18:30:00Z', serviceDay: '2026-08-20', covers: 4, status: 'Confirmed', source: 'Web', note: null, placeName: null,
  noShowFrom: '2026-08-20T18:45:00Z',
  client: { id: `c-${id}`, name: `Client ${id}`, phone: '0612345678', tags: [], hasAllergy: false, visitCount: 3, noShowCount: 0, atRisk: false },
  ...change,
});

describe('ReservationList', () => {
  let fixture: ComponentFixture<ReservationList>;
  let actions: jasmine.SpyObj<ReservationActions>;
  const page = signal<ReservationPage | null>(null);
  const query = signal<ReservationQuery>(DEFAULT_RESERVATION_QUERY);
  const setQuery = jasmine.createSpy('setQuery');
  const showMore = jasmine.createSpy('showMore');
  const element = () => fixture.nativeElement as HTMLElement;
  const row = (id: string) => element().querySelector(`[data-reservation="${id}"]`) as HTMLElement;
  const text = (node: Element) => node.textContent!.replace(/\s+/g, ' ');

  beforeEach(async () => {
    page.set({
      hasMore: false,
      pending: { count: 0, oldestCreatedAt: null },
      days: [{
        serviceDay: '2026-08-20', covers: 6, toPlace: 1, items: [
          ROW('pending', { status: 'Pending' }),
          ROW('toplace', { note: 'anniversaire' }),
          ROW('placed', { placeName: '3', source: 'Phone' }),
          ROW('seated', { status: 'Seated', placeName: '12' }),
          ROW('finished', { status: 'Finished', placeName: '5' }),
          ROW('walkin', { client: null, source: 'WalkIn', status: 'Seated', placeName: '7' }),
          ROW('marked', { client: { id: 'c9', name: 'Roux', phone: null, tags: ['Vip'], hasAllergy: true, visitCount: 0, noShowCount: 2, atRisk: true } }),
        ],
      }],
    });
    query.set(DEFAULT_RESERVATION_QUERY);
    setQuery.calls.reset();
    showMore.calls.reset();
    actions = jasmine.createSpyObj<ReservationActions>('ReservationActions', ['run', 'place']);
    actions.run.and.resolveTo(null);

    await TestBed.configureTestingModule({
      imports: [ReservationList],
      providers: [
        { provide: ReservationService, useValue: { page, query, listFailed: signal(false), setQuery, showMore } },
        { provide: RestaurantService, useValue: { model: signal({ timeZone: 'Europe/Paris', zones: [{ id: 'z1', name: 'Terrasse' }] }) } },
        { provide: ReservationActions, useValue: actions },
        { provide: ClosureService, useValue: { closures: signal([]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ReservationList);
    fixture.detectChanges();
  });

  it('should group the day under its header and read each line from time to action', () => {
    expect(text(element())).toContain('6 couverts · 1 à placer');
    const line = text(row('toplace'));
    expect(line).toContain('20:30');
    expect(line).toContain('Client toplace');
    expect(line).toContain('4 pers.');
    expect(line).toContain('« anniversaire »');
    expect(line).toContain('WEB');
    expect(line).toContain('CONFIRMÉE');
    expect(text(row('placed'))).toContain('TÉL');
  });

  it('should name a walk-in and give it no mark', () => {
    expect(text(row('walkin'))).toContain('Client de passage');
    expect(row('walkin').querySelector('[data-mark]')).toBeNull();
  });

  it('should carry the marks of the client, the risk drawn as an outline', () => {
    const marked = row('marked');
    expect(marked.querySelector('[data-mark="allergy"]')).not.toBeNull();
    expect(text(marked)).toContain('VIP');
    expect(text(marked)).toContain('1re visite');
    const risk = marked.querySelector('[data-mark="risk"]')!;
    expect(risk.textContent).toContain('NO-SHOW ×2');
    expect(risk.className).toContain('border-coral');
    expect(risk.className).not.toContain('bg-coral ');
  });

  it('should offer one quick action per status, and keep the column when there is none', () => {
    expect(row('pending').querySelector('[data-accept]')).not.toBeNull();
    expect(row('pending').querySelector('[data-refuse]')).not.toBeNull();
    expect(row('toplace').querySelector('[data-place]')).not.toBeNull();
    expect(row('placed').querySelector('[data-arrive]')).not.toBeNull();
    expect(row('seated').querySelector('[data-release]')).not.toBeNull();
    const closed = row('finished').querySelector('[data-action]')!;
    expect(closed.querySelector('button')).toBeNull();
  });

  it('should act from the line without opening the sheet', () => {
    const opened = jasmine.createSpy('opened');
    fixture.componentInstance.opened.subscribe(opened);

    (row('pending').querySelector('[data-accept]') as HTMLButtonElement).click();
    (row('toplace').querySelector('[data-place]') as HTMLButtonElement).click();

    expect(actions.run).toHaveBeenCalledOnceWith('pending', 'accept');
    expect(actions.place).toHaveBeenCalledOnceWith('2026-08-20', 'toplace');
    expect(opened).not.toHaveBeenCalled();
    row('seated').click();
    expect(opened).toHaveBeenCalledOnceWith('seated');
  });

  it('should show the violet banner only while requests wait, and filter them on demand', () => {
    expect(element().querySelector('[data-pending]')).toBeNull();

    page.update((current) => ({ ...current!, pending: { count: 3, oldestCreatedAt: new Date(Date.now() - 4 * 3600_000 - 60_000).toISOString() } }));
    fixture.detectChanges();
    const banner = element().querySelector('[data-pending]')!;
    expect(text(banner)).toContain('3 demandes attendent une réponse · la plus ancienne depuis 4 h');
    (banner.querySelector('button') as HTMLButtonElement).click();

    expect(setQuery).toHaveBeenCalledOnceWith({ period: 'Upcoming', status: 'Pending' });
  });

  it('should change period and filters', () => {
    (element().querySelector('[data-period="Past"]') as HTMLButtonElement).click();
    const zone = element().querySelector('[data-filter="zone"]') as HTMLSelectElement;
    zone.value = 'z1';
    zone.dispatchEvent(new Event('change'));

    expect(setQuery).toHaveBeenCalledWith({ period: 'Past' });
    expect(setQuery).toHaveBeenCalledWith({ zoneId: 'z1' });
  });

  it('should say when the period is empty, and offer more days when some remain', () => {
    page.set({ hasMore: true, pending: { count: 0, oldestCreatedAt: null }, days: [] });
    fixture.detectChanges();

    expect(text(element())).toContain('Aucune réservation sur cette période.');
    (element().querySelector('[data-show-more]') as HTMLButtonElement).click();
    expect(showMore).toHaveBeenCalled();
  });
});
