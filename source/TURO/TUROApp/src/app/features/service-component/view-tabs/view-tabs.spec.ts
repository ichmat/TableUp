import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ServiceViewKind, ViewTabs } from './view-tabs';

describe('ViewTabs', () => {
  let fixture: ComponentFixture<ViewTabs>;
  const element = () => fixture.nativeElement as HTMLElement;
  const tab = (kind: ServiceViewKind) => element().querySelector(`[data-view="${kind}"]`) as HTMLButtonElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(ViewTabs);
    fixture.componentRef.setInput('active', 'plan');
    fixture.detectChanges();
  });

  it('marks the active view and emits the other', () => {
    const selected = jasmine.createSpy('selected');
    fixture.componentInstance.selected.subscribe(selected);

    expect(tab('plan').textContent).toContain('Plan');
    expect(tab('agenda').textContent).toContain('Agenda');
    expect(tab('plan').getAttribute('class')).toContain('bg-interactive');
    expect(tab('agenda').getAttribute('class')).not.toContain('bg-interactive');
    expect(tab('plan').getAttribute('aria-pressed')).toBe('true');

    tab('agenda').click();
    tab('plan').click();

    expect(selected).toHaveBeenCalledOnceWith('agenda');
  });

  it('ignores clicks when disabled', () => {
    const selected = jasmine.createSpy('selected');
    fixture.componentInstance.selected.subscribe(selected);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    tab('agenda').click();

    expect(tab('agenda').disabled).toBeTrue();
    expect(selected).not.toHaveBeenCalled();
  });
});
