import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ZoneTabs } from './zone-tabs';

describe('ZoneTabs', () => {
  let fixture: ComponentFixture<ZoneTabs>;
  const element = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(ZoneTabs);
    fixture.componentRef.setInput('tabs', [{ id: 'z1', name: 'Salle', taken: 8, total: 12 }, { id: 'z2', name: 'Terrasse', taken: 3, total: 6 }]);
    fixture.componentRef.setInput('activeId', 'z1');
    fixture.detectChanges();
  });

  it('should show each room with its tables taken, the active one orange', () => {
    expect(element().querySelector('[data-zone="z1"]')!.textContent).toContain('Salle 8/12');
    expect(element().querySelector('[data-zone="z1"]')!.getAttribute('class')).toContain('bg-interactive');
    expect(element().querySelector('[data-zone="z2"]')!.getAttribute('class')).not.toContain('bg-interactive');
  });

  it('should hand back the room touched', () => {
    const selected = jasmine.createSpy('selected');
    fixture.componentInstance.selected.subscribe(selected);

    (element().querySelector('[data-zone="z2"]') as HTMLButtonElement).click();

    expect(selected).toHaveBeenCalledOnceWith('z2');
  });

  it('should offer the plan editor to an administrator only', () => {
    expect(element().querySelector('[data-edit-plan]')).toBeNull();

    fixture.componentRef.setInput('canEdit', true);
    fixture.detectChanges();

    expect(element().querySelector('[data-edit-plan]')!.getAttribute('href')).toBe('/parametres/plan');
  });
});
