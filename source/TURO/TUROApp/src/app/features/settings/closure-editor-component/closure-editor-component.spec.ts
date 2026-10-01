import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ExceptionalClosure, ImpactedReservation, RestaurantService as ServiceModel } from '../../../models';
import { ClosureService } from '../../../core/services/closure/closure.service';
import { ClosureEditorComponent } from './closure-editor-component';

const DINNER: ServiceModel = {
  id: 'service-1', restaurantId: 'r', day: 'Thursday', opening: '19:00:00', closing: '22:30:00',
  slotStep: 30, occupancyMode: 'Rotation', expectedDuration: null, maxCadence: null, coverCap: null,
};

const IMPACTED: ImpactedReservation = {
  id: 'reservation-1', serviceDay: '2026-12-24', localStart: '19:30:00', covers: 2,
  clientName: 'Perrin', clientPhone: '07 88 21 04 33', tables: ['T3'],
};

const CREATED: ExceptionalClosure = {
  id: 'closure-1', restaurantId: 'r', from: '2026-12-24', to: '2026-12-24', type: 'Closed',
  replacementHours: null, reason: 'PublicHoliday', reasonDetail: null, customerMessage: null,
};

describe('ClosureEditorComponent', () => {
  let component: ClosureEditorComponent;
  let fixture: ComponentFixture<ClosureEditorComponent>;
  let closureService: ClosureService;
  let done: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClosureEditorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .compileComponents();

    closureService = TestBed.inject(ClosureService);
    fixture = TestBed.createComponent(ClosureEditorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('day', '2026-12-24');
    fixture.componentRef.setInput('today', '2026-10-01');
    fixture.componentRef.setInput('restaurantName', 'Chez Test');
    fixture.componentRef.setInput('services', [DINNER]);
    done = jasmine.createSpy('done');
    component.done.subscribe(done);
    fixture.detectChanges();
  });

  it('should save directly when no reservation is impacted', async () => {
    spyOn(closureService, 'impact').and.resolveTo({ value: [], error: null });
    const create = spyOn(closureService, 'create').and.resolveTo({ value: CREATED, error: null });

    await component.save();

    expect(create).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      from: '2026-12-24', to: '2026-12-24', type: 'Closed', replacementHours: null, cancelledReservationIds: [],
    }));
    expect(done).toHaveBeenCalled();
  });

  it('should confront impacted reservations, then cancel them on "je les appelle"', async () => {
    spyOn(closureService, 'impact').and.resolveTo({ value: [IMPACTED], error: null });
    const create = spyOn(closureService, 'create').and.resolveTo({ value: CREATED, error: null });

    await component.save();
    fixture.detectChanges();

    expect(create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('07 88 21 04 33');

    await component.closeAndCall();

    expect(create).toHaveBeenCalledOnceWith(jasmine.objectContaining({ cancelledReservationIds: ['reservation-1'] }));
    expect(done).toHaveBeenCalled();
  });

  it('should propose a customer message naming the day and the restaurant', () => {
    const message: string = (fixture.nativeElement as HTMLElement).querySelectorAll('textarea')[1].value;
    expect(message).toContain('le jeudi 24 décembre');
    expect(message).toContain('Chez Test');
  });

  it('should prefill modified hours with the usual services of the day', () => {
    component.setType('ModifiedHours');
    fixture.detectChanges();

    const times = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('app-time-input'));
    expect(times.length).toBe(2);
  });
});
