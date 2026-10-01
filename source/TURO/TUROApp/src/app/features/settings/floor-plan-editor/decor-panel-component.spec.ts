import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DraftDecor, Zone } from '../../../models';
import { DecorPanelComponent } from './decor-panel-component';

const DECOR: DraftDecor = { id: 'd', zoneId: 'salle', type: 'Bar', label: null, x: 0, y: 4, width: 3, height: 0.6, rotation: 0 };
const ZONES: Zone[] = [{ id: 'salle', restaurantId: 'r', name: 'Salle', order: 0, width: 8, height: 5.5 }];

describe('DecorPanelComponent', () => {
  let fixture: ComponentFixture<DecorPanelComponent>;
  let host: HTMLElement;
  let changes: { id: string, patch: Partial<DraftDecor> }[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DecorPanelComponent] }).compileComponents();
    fixture = TestBed.createComponent(DecorPanelComponent);
    host = fixture.nativeElement;
    fixture.componentRef.setInput('decor', DECOR);
    fixture.componentRef.setInput('zones', ZONES);
    changes = [];
    fixture.componentInstance.changed.subscribe((change) => changes.push(change));
    fixture.detectChanges();
  });

  it('should commit an empty label as null, and a label trimmed', () => {
    const label = host.querySelector<HTMLInputElement>('[data-field="label"] input')!;
    label.value = ' Comptoir ';
    label.dispatchEvent(new Event('input'));
    label.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(changes).toEqual([{ id: 'd', patch: { label: 'Comptoir' } }]);
  });

  it('should change the type from the list', () => {
    const select = host.querySelector<HTMLSelectElement>('[data-field="type"] select')!;
    select.value = 'Pass';
    select.dispatchEvent(new Event('change'));
    expect(changes).toEqual([{ id: 'd', patch: { type: 'Pass' } }]);
  });

  it('should always offer to delete a decor', () => {
    expect(host.textContent).toContain('Supprimer');
  });
});
