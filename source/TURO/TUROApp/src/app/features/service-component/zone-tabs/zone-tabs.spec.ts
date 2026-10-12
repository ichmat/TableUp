import { ComponentFixture, TestBed } from '@angular/core/testing';
import { bestLevel, ZoneTabs } from './zone-tabs';

describe('ZoneTabs', () => {
  let fixture: ComponentFixture<ZoneTabs>;
  const element = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
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

  it('should offer the edit mode to both roles, and say how to leave it', () => {
    let toggled = 0;
    fixture.componentInstance.editToggle.subscribe(() => toggled++);
    const edit = () => element().querySelector('[data-edit-plan]') as HTMLButtonElement;
    expect(edit().textContent).toContain('Éditer le plan');

    edit().click();
    fixture.componentRef.setInput('editing', true);
    fixture.detectChanges();

    expect(toggled).toBe(1);
    expect(edit().textContent).toContain('Terminer');
  });

  it('should dim the edit mode during a placement', () => {
    fixture.componentRef.setInput('levels', {});
    fixture.detectChanges();
    expect((element().querySelector('[data-edit-plan]') as HTMLButtonElement).disabled).toBeTrue();
  });
});

describe('ZoneTabs placement levels', () => {
  let fixture: ComponentFixture<ZoneTabs>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ZoneTabs);
    fixture.componentRef.setInput('tabs', [{ id: 'z1', name: 'Salle', taken: 1, total: 4 }, { id: 'z2', name: 'Terrasse', taken: 0, total: 2 }]);
  });

  it('should keep the best level of a zone', () => {
    expect(bestLevel(['Excluded', 'WithReserve', 'Perfect'])).toBe('Perfect');
    expect(bestLevel(['NotAdvised', 'WithReserve'])).toBe('WithReserve');
    expect(bestLevel(['NotAdvised'])).toBe('NotAdvised');
    expect(bestLevel(['Excluded'])).toBeNull();
    expect(bestLevel([])).toBeNull();
  });

  it('should badge a compatible zone and dim one without any', () => {
    fixture.componentRef.setInput('levels', { z1: 'Perfect', z2: null });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-zone="z1"] [data-level]')!.textContent).toContain('✓');
    expect(el.querySelector('[data-zone="z2"]')!.getAttribute('class')).toContain('opacity-40');
    expect(el.querySelector('[data-zone="z2"] [data-level]')).toBeNull();
  });
});
