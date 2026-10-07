import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DraftTable, Zone } from '../../../models';
import { TablePanelComponent } from './table-panel-component';

const TABLE: DraftTable = { id: 'a', zoneId: 'salle', name: 'T3', capacity: 4, shape: 'Square', x: 1, y: 1, width: 0.9, height: 0.9, rotation: 0 };
const ZONES: Zone[] = [
  { id: 'salle', restaurantId: 'r', name: 'Salle', order: 0, width: 8, height: 5.5 },
  { id: 'terrasse', restaurantId: 'r', name: 'Terrasse', order: 1, width: 6, height: 4 },
];

describe('TablePanelComponent', () => {
  let fixture: ComponentFixture<TablePanelComponent>;
  let host: HTMLElement;
  let changes: { id: string, patch: Partial<DraftTable> }[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TablePanelComponent] }).compileComponents();
    fixture = TestBed.createComponent(TablePanelComponent);
    host = fixture.nativeElement;
    fixture.componentRef.setInput('table', TABLE);
    fixture.componentRef.setInput('zones', ZONES);
    fixture.componentRef.setInput('errors', []);
    fixture.componentRef.setInput('isPublished', true);
    changes = [];
    fixture.componentInstance.changed.subscribe((change) => changes.push(change));
    fixture.detectChanges();
  });

  const input = (name: string) => host.querySelector<HTMLInputElement>(`[data-field="${name}"] input`)!;
  const type = (name: string, value: string) => {
    input(name).value = value;
    input(name).dispatchEvent(new Event('input'));
    input(name).dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    fixture.detectChanges();
  };

  it('should commit a field on Enter, without leaving it', () => {
    input('width').value = '110';
    input('width').dispatchEvent(new Event('input'));
    input('width').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(changes).toEqual([{ id: 'a', patch: { width: 1.1 } }]);
  });

  it('should show the size in centimetres', () => {
    expect(input('width').value).toBe('90');
  });

  it('should commit a field when it is left, converted to metres', () => {
    type('width', '120');
    expect(changes).toEqual([{ id: 'a', patch: { width: 1.2 } }]);
  });

  it('should commit the trimmed name', () => {
    type('name', ' Bar 3 ');
    expect(changes).toEqual([{ id: 'a', patch: { name: 'Bar 3' } }]);
  });

  it('should make a table round with a single diameter', () => {
    (host.querySelector('[data-shape="Round"]') as HTMLButtonElement).click();
    expect(changes).toEqual([{ id: 'a', patch: { shape: 'Round', height: 0.9 } }]);
  });

  it('should rotate by 15 degrees, wrapping around', () => {
    (host.querySelector('[aria-label="Tourner à gauche"]') as HTMLButtonElement).click();
    expect(changes).toEqual([{ id: 'a', patch: { rotation: 345 } }]);
  });

  it('should move the table to another room', () => {
    const select = host.querySelector('select')!;
    select.value = 'terrasse';
    select.dispatchEvent(new Event('change'));
    expect(changes).toEqual([{ id: 'a', patch: { zoneId: 'terrasse' } }]);
  });

  it('should offer to remove only a table never published', () => {
    expect(host.textContent).not.toContain('Retirer');
    fixture.componentRef.setInput('isPublished', false);
    fixture.detectChanges();
    expect(host.textContent).toContain('Retirer');
  });

  it('should show the errors under their field', () => {
    fixture.componentRef.setInput('errors', [{ field: 'name', message: 'Une autre table porte déjà ce nom' }]);
    fixture.detectChanges();
    expect(host.querySelector('[data-field="name"]')!.parentElement!.textContent).toContain('Une autre table porte déjà ce nom');
  });
});
