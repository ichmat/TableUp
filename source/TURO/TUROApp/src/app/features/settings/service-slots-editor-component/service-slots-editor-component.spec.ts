import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RestaurantService as ServiceModel } from '../../../models';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { ServiceSlotsEditorComponent } from './service-slots-editor-component';

const SERVICE: ServiceModel = {
  id: 'service-1',
  restaurantId: 'restaurant-1',
  day: 'Tuesday',
  opening: '19:00:00',
  closing: '22:30:00',
  slotStep: 30,
  occupancyMode: 'Rotation',
  expectedDuration: null,
  maxCadence: null,
  coverCap: null,
};

describe('ServiceSlotsEditorComponent', () => {
  let component: ServiceSlotsEditorComponent;
  let fixture: ComponentFixture<ServiceSlotsEditorComponent>;
  let updateService: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServiceSlotsEditorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .compileComponents();

    updateService = spyOn(TestBed.inject(RestaurantService), 'updateService').and.resolveTo(null);

    fixture = TestBed.createComponent(ServiceSlotsEditorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('service', SERVICE);
    fixture.componentRef.setInput('defaultRotation', 105);
    fixture.detectChanges();
  });

  it('should start without changes', () => {
    expect(component.hasChanges()).toBeFalse();
  });

  it('should detect a slot step change and cancel it', () => {
    component.setSlotStep(15);
    expect(component.hasChanges()).toBeTrue();

    component.cancel();
    expect(component.hasChanges()).toBeFalse();
  });

  it('should send null for an inherited duration and disabled warnings', async () => {
    component.setOccupancyMode('SingleService');
    await component.save();

    expect(updateService).toHaveBeenCalledOnceWith('service-1', jasmine.objectContaining({
      occupancyMode: 'SingleService',
      expectedDuration: null,
      maxCadence: null,
      coverCap: null,
    }));
  });

  it('should keep the previous service draft when the same service reloads', () => {
    component.setSlotStep(15);
    fixture.componentRef.setInput('service', { ...SERVICE });
    fixture.detectChanges();

    expect(component.hasChanges()).toBeTrue();
  });
});
