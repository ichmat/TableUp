import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlacementMark, PlanCombination, PlanTable, TableMark, Zone } from '../../../models';
import { FloorPlanCanvasComponent, PlanPointerEvent } from './floor-plan-canvas-component';

const ZONE: Zone = { id: 'z', restaurantId: 'r', name: 'Salle', order: 0, width: 8, height: 5.5 };
const ROUND: PlanTable = { id: 'a', zoneId: 'z', name: 'T1', capacity: 2, shape: 'Round', x: 1, y: 1, width: 0.7, height: 0.7, rotation: 0 };
const RECT: PlanTable = { id: 'b', zoneId: 'z', name: 'T2', capacity: 6, shape: 'Rectangular', x: 3, y: 1, width: 1.8, height: 0.8, rotation: 90 };

describe('FloorPlanCanvasComponent', () => {
  let fixture: ComponentFixture<FloorPlanCanvasComponent>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FloorPlanCanvasComponent] }).compileComponents();
    fixture = TestBed.createComponent(FloorPlanCanvasComponent);
    host = fixture.nativeElement;
    // 9 m de large (salle + marges de 0,5 m) sur 450 px : 50 px par mètre
    host.style.width = '450px';
    host.style.height = '450px';
    fixture.componentRef.setInput('zone', ZONE);
    fixture.componentRef.setInput('tables', [ROUND, RECT]);
    fixture.detectChanges();
  });

  it('should draw a circle for a round table and a rectangle otherwise, with name and seats', () => {
    expect(host.querySelectorAll('[data-table-id] ellipse').length).toBe(1);
    expect(host.querySelectorAll('[data-table-id] rect').length).toBe(1);
    expect(host.textContent).toContain('T1');
    expect(host.textContent).toContain('6p');
  });

  it('should rotate the shape but keep the labels upright', () => {
    const table = host.querySelector('[data-table-id="b"]')!;
    expect(table.querySelector('g')!.getAttribute('transform')).toBe('rotate(90 0.9 0.4)');
    expect(table.querySelector('text')!.closest('g[transform^="rotate"]')).toBeNull();
  });

  it('should outline the selected table', () => {
    fixture.componentRef.setInput('selectedIds', ['a']);
    fixture.detectChanges();
    expect(host.querySelector('[data-table-id="a"] ellipse')!.getAttribute('class')).toContain('stroke-interactive');
  });

  it('should hide the grid when asked', () => {
    expect(host.querySelector('[data-grid]')).not.toBeNull();
    fixture.componentRef.setInput('showGrid', false);
    fixture.detectChanges();
    expect(host.querySelector('[data-grid]')).toBeNull();
  });

  it('should convert a screen position into metres', () => {
    const box = host.querySelector('svg')!.getBoundingClientRect();
    const point = fixture.componentInstance.toMetres(box.left + 50 * 1.5, box.top + box.height / 2);
    expect(point.x).toBeCloseTo(1, 1);
    expect(point.y).toBeCloseTo(2.75, 1);
  });

  const viewBoxWidth = () => Number(host.querySelector('svg')!.getAttribute('viewBox')!.split(' ')[2]);

  it('should zoom in with the wheel, and back to the whole room with "Ajuster"', () => {
    const svg = host.querySelector('svg')!;
    const before = viewBoxWidth();
    svg.dispatchEvent(new WheelEvent('wheel', { deltaY: -200, clientX: 100, clientY: 100, cancelable: true }));
    fixture.detectChanges();
    expect(viewBoxWidth()).toBeLessThan(before);

    (host.querySelector('[aria-label="Ajuster à la salle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(viewBoxWidth()).toBeCloseTo(before, 6);
  });

  it('should zoom by 25 % with the buttons and show the percentage', () => {
    (host.querySelector('[aria-label="Zoomer"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host.textContent).toContain('125 %');
  });

  it('should treat a press without movement in the void as a click, and a drag as a pan', () => {
    const clicks: unknown[] = [];
    fixture.componentInstance.backgroundClick.subscribe((p) => clicks.push(p));
    const svg = host.querySelector('svg')!;
    const press = (x: number, y: number) => svg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: x, clientY: y }));
    const move = (x: number, y: number) => window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: x, clientY: y }));
    const release = (x: number, y: number) => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: x, clientY: y }));

    press(200, 200); release(201, 200);
    expect(clicks.length).toBe(1);

    const before = host.querySelector('svg')!.getAttribute('viewBox');
    press(200, 200); move(260, 200); release(260, 200);
    fixture.detectChanges();
    expect(clicks.length).toBe(1);
    expect(host.querySelector('svg')!.getAttribute('viewBox')).not.toBe(before);
  });

  it('should draw the decor under the tables, with its label', () => {
    fixture.componentRef.setInput('decors', [
      { id: 'bar', zoneId: 'z', type: 'Bar', label: null, x: 0, y: 4, width: 3, height: 0.6, rotation: 0 },
      { id: 'wall', zoneId: 'z', type: 'Wall', label: null, x: 0, y: 0, width: 8, height: 0.15, rotation: 0 },
    ]);
    fixture.detectChanges();

    const layers = Array.from(host.querySelectorAll('[data-decor-id], [data-table-id]')).map((el) => el.hasAttribute('data-decor-id'));
    expect(layers.slice(0, 2)).toEqual([true, true]);
    expect(host.textContent).toContain('BAR');
  });

  it('should set walls and pillars apart from the slate in service, and keep the editor as it is', () => {
    fixture.componentRef.setInput('decors', [
      { id: 'wall', zoneId: 'z', type: 'Wall', label: null, x: 0, y: 0, width: 8, height: 0.15, rotation: 0 },
      { id: 'door', zoneId: 'z', type: 'Door', label: null, x: 2, y: 0, width: 0.9, height: 0.1, rotation: 0 },
    ]);
    fixture.detectChanges();
    const shape = (id: string) => host.querySelector(`[data-decor-id="${id}"] rect`)!.getAttribute('class')!;
    expect(shape('wall')).toContain('fill-slate');

    fixture.componentRef.setInput('theme', 'slate');
    fixture.detectChanges();
    expect(shape('wall')).toContain('fill-plan-decor');
    expect(shape('wall')).toContain('stroke-chalk');
    expect(shape('door')).toContain('stroke-chalk');
  });

  it('should not start a table drag with the second finger of a pinch', () => {
    const pressed: unknown[] = [];
    let pinches = 0;
    fixture.componentInstance.tablePointerDown.subscribe((e) => pressed.push(e));
    fixture.componentInstance.pinchStart.subscribe(() => pinches++);

    host.querySelector('svg')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 100, clientY: 100 }));
    host.querySelector('[data-table-id="a"]')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, clientX: 80, clientY: 80 }));

    expect(pinches).toBe(1);
    expect(pressed).toEqual([]);
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2 }));
  });

  it('should draw a combination pill at the centre of its tables', () => {
    fixture.componentRef.setInput('combinations', [{ id: 'c', name: 'T1-T2', capacity: 8, tableIds: ['a', 'b'], isActive: true }]);
    fixture.detectChanges();

    const pill = host.querySelector('[data-combination-id="c"]')!;
    expect(pill.textContent).toContain('T1-T2 · 8p');
    // boîte du groupe : x de 1 à 4,3 (la rectangulaire tournée occupe 3,5 → 4,3), y de 0,5 à 2,3
    expect(pill.getAttribute('transform')).toBe('translate(2.65 1.4)');
  });

  it('should not draw the pill of an inactive combination', () => {
    fixture.componentRef.setInput('combinations', [{ id: 'c', name: 'T1-T2', capacity: 8, tableIds: ['a', 'b'], isActive: false }]);
    fixture.detectChanges();
    expect(host.querySelector('[data-combination-id]')).toBeNull();
  });

  it('should make the pill opaque while one of its tables or the pill is hovered, or while it is selected', () => {
    fixture.componentRef.setInput('combinations', [{ id: 'c', name: 'T1-T2', capacity: 8, tableIds: ['a', 'b'], isActive: true }]);
    fixture.detectChanges();
    const pill = () => host.querySelector('[data-combination-id="c"]')!.getAttribute('class')!;
    expect(pill()).toContain('opacity-50');

    host.querySelector('[data-table-id="a"]')!.dispatchEvent(new PointerEvent('pointerenter'));
    fixture.detectChanges();
    expect(pill()).toContain('opacity-100');

    host.querySelector('[data-table-id="a"]')!.dispatchEvent(new PointerEvent('pointerleave'));
    fixture.detectChanges();
    expect(pill()).toContain('opacity-50');

    host.querySelector('[data-combination-id="c"]')!.dispatchEvent(new PointerEvent('pointerenter'));
    fixture.detectChanges();
    expect(pill()).toContain('opacity-100');
    host.querySelector('[data-combination-id="c"]')!.dispatchEvent(new PointerEvent('pointerleave'));

    fixture.componentRef.setInput('selectedIds', ['c']);
    fixture.detectChanges();
    expect(pill()).toContain('opacity-100');
  });

  it('should not draw a pill whose second table is not in this room', () => {
    fixture.componentRef.setInput('combinations', [{ id: 'c', name: 'T1-T9', capacity: 4, tableIds: ['a', 'elsewhere'], isActive: true }]);
    fixture.detectChanges();
    expect(host.querySelector('[data-combination-id]')).toBeNull();
  });

  it('should frame two tables in contact while dragging', () => {
    expect(host.querySelector('[data-contact]')).toBeNull();
    fixture.componentRef.setInput('contactIds', ['a', 'b']);
    fixture.detectChanges();
    expect(host.querySelector('[data-contact]')).not.toBeNull();
  });

  it('should emit the pressed combination', () => {
    const pressed: unknown[] = [];
    fixture.componentInstance.combinationPointerDown.subscribe((e) => pressed.push(e.item.id));
    fixture.componentRef.setInput('combinations', [{ id: 'c', name: 'T1-T2', capacity: 8, tableIds: ['a', 'b'], isActive: true }]);
    fixture.detectChanges();
    host.querySelector('[data-combination-id="c"]')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9 }));
    expect(pressed).toEqual(['c']);
  });

  it('should emit the pressed table with the point in metres', () => {
    const pressed: PlanPointerEvent<PlanTable>[] = [];
    fixture.componentInstance.tablePointerDown.subscribe((e) => pressed.push(e));

    host.querySelector('[data-table-id="a"]')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }));

    expect(pressed.length).toBe(1);
    expect(pressed[0].item.id).toBe('a');
  });

  describe('in service', () => {
    const marks = (mark: Partial<TableMark>): Record<string, TableMark> =>
      ({ [RECT.id]: { status: 'Free', late: false, label: null, allergy: false, ...mark } });
    const element = () => fixture.nativeElement as HTMLElement;
    const shape = () => element().querySelector(`[data-table-id="${RECT.id}"] rect:not([data-late]), [data-table-id="${RECT.id}"] ellipse:not([data-late])`)!;

    beforeEach(() => {
      fixture.componentRef.setInput('theme', 'slate');
      fixture.componentRef.setInput('tables', [RECT]);
    });

    it('should draw the room as a slate', () => {
      fixture.detectChanges();
      expect(element().querySelector('[data-room]')!.getAttribute('class')).toContain('fill-slate');
    });

    it('should colour each table by its status, the outline dashed only when it is to clean', () => {
      fixture.componentRef.setInput('tableMarks', marks({ status: 'Reserved' }));
      fixture.detectChanges();
      expect(shape().getAttribute('class')).toContain('stroke-plan-reserved-line');
      expect(shape().getAttribute('stroke-dasharray')).toBeNull();

      fixture.componentRef.setInput('tableMarks', marks({ status: 'ToClean' }));
      fixture.detectChanges();
      expect(shape().getAttribute('class')).toContain('stroke-plan-clean-line');
      expect(shape().getAttribute('stroke-dasharray')).not.toBeNull();
    });

    it('should ring a late table, write its guest and pin its allergy', () => {
      fixture.componentRef.setInput('tableMarks', marks({ status: 'Reserved', late: true, label: 'Moreau · 20:00', allergy: true }));
      fixture.detectChanges();

      expect(element().querySelector('[data-late]')).not.toBeNull();
      expect(element().querySelector('[data-allergy]')).not.toBeNull();
      expect(element().querySelector('[data-label]')!.textContent).toContain('Moreau · 20:00');
    });

    it('should draw nothing of the kind on a free table', () => {
      fixture.componentRef.setInput('tableMarks', marks({}));
      fixture.detectChanges();

      expect(element().querySelector('[data-late]')).toBeNull();
      expect(element().querySelector('[data-allergy]')).toBeNull();
      expect(element().querySelector('[data-label]')).toBeNull();
      expect(shape().getAttribute('class')).toContain('stroke-plan-free-line');
    });
  });
});

const TABLE_AT = (id: string, x: number): PlanTable => ({ id, zoneId: 'z', name: id, capacity: 4, shape: 'Square', x, y: 1, width: 0.8, height: 0.8, rotation: 0 } as PlanTable);

describe('FloorPlanCanvasComponent placement marks', () => {
  let fixture: ComponentFixture<FloorPlanCanvasComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(FloorPlanCanvasComponent);
    fixture.componentRef.setInput('zone', { id: 'z', width: 8, height: 6 });
    fixture.componentRef.setInput('tables', [TABLE_AT('t5', 1), TABLE_AT('t6', 2.5), TABLE_AT('t7', 4)]);
  });

  it('should draw nothing of placement without marks', () => {
    fixture.detectChanges();
    expect(el().querySelector('[data-halo]')).toBeNull();
    expect(el().querySelector('[data-table-id="t5"]')!.getAttribute('class')).not.toContain('opacity-26');
  });

  it('should draw a halo and a badge per level, dim the excluded and write what comes next', () => {
    const marks: Record<string, PlacementMark> = {
      t5: { level: 'Perfect', next: 'Ensuite 22:30 · marge 30 min' },
      t6: { level: 'NotAdvised', next: null },
      t7: { level: 'Excluded', next: null },
    };
    fixture.componentRef.setInput('placementMarks', marks);
    fixture.detectChanges();

    expect(el().querySelector('[data-table-id="t5"] [data-halo]')!.getAttribute('class')).toContain('stroke-place-perfect');
    expect(el().querySelector('[data-table-id="t5"] [data-badge]')!.textContent).toContain('✓');
    expect(el().querySelector('[data-table-id="t5"] [data-next]')!.textContent).toContain('Ensuite 22:30');
    expect(el().querySelector('[data-table-id="t6"] [data-halo]')!.getAttribute('stroke-dasharray')).not.toBeNull();
    expect(el().querySelector('[data-table-id="t6"] [data-badge]')!.textContent).toContain('!');
    expect(el().querySelector('[data-table-id="t7"]')!.getAttribute('class')).toContain('opacity-26');
    expect(el().querySelector('[data-table-id="t7"] [data-halo]')).toBeNull();
  });

  it('should draw one halo around an active combination', () => {
    const combination = { id: 'c1', zoneId: 'z', name: '5-6', capacity: 8, tableIds: ['t5', 't6'], isActive: true } as PlanCombination;
    fixture.componentRef.setInput('combinations', [combination]);
    fixture.componentRef.setInput('placementMarks', { c1: { level: 'WithReserve', next: null }, t5: { level: 'Excluded', next: null }, t6: { level: 'Excluded', next: null } });
    fixture.detectChanges();

    expect(el().querySelector('[data-combination-halo="c1"]')!.getAttribute('class')).toContain('stroke-place-reserve');
  });
});
