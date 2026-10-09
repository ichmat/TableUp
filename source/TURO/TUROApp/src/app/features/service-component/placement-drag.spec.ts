import { DRAG_THRESHOLD_PX, PlacementDrag } from './placement-drag';

describe('PlacementDrag', () => {
  let hit: Element | null;
  let drag: PlacementDrag;
  let onStart: jasmine.Spy;
  let onDrop: jasmine.Spy;
  const pointer = (type: string, x: number, y: number) => new PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true });

  beforeEach(() => {
    hit = null;
    drag = new PlacementDrag(() => hit);
    onStart = jasmine.createSpy('onStart');
    onDrop = jasmine.createSpy('onDrop');
  });

  afterEach(() => {
    drag.cancel();
    document.body.classList.remove('placement-dragging');
  });

  it('should treat a small move as a touch', () => {
    drag.press(pointer('pointerdown', 10, 10), 'Moreau · 4p', { onStart, onDrop });
    window.dispatchEvent(pointer('pointermove', 10 + DRAG_THRESHOLD_PX - 1, 10));
    window.dispatchEvent(pointer('pointerup', 12, 10));

    expect(onStart).not.toHaveBeenCalled();
    expect(onDrop).not.toHaveBeenCalled();
    expect(drag.ghost()).toBeNull();
  });

  it('should follow the pointer past the threshold, freeze the rail, and drop on the table under it', () => {
    const table = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    table.setAttribute('data-table-id', 't5');
    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    table.appendChild(inner);

    drag.press(pointer('pointerdown', 10, 10), 'Moreau · 4p', { onStart, onDrop });
    window.dispatchEvent(pointer('pointermove', 30, 40));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(drag.ghost()).toEqual({ label: 'Moreau · 4p', x: 30, y: 40 });
    expect(document.body.classList).toContain('placement-dragging');

    hit = inner;
    window.dispatchEvent(pointer('pointerup', 50, 60));

    expect(onDrop).toHaveBeenCalledOnceWith({ tableId: 't5' });
    expect(drag.ghost()).toBeNull();
    expect(document.body.classList).not.toContain('placement-dragging');
  });

  it('should drop on a combination pill, or on nothing', () => {
    const pill = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pill.setAttribute('data-combination-id', 'c1');

    drag.press(pointer('pointerdown', 0, 0), 'x', { onStart, onDrop });
    window.dispatchEvent(pointer('pointermove', 20, 0));
    hit = pill;
    window.dispatchEvent(pointer('pointerup', 20, 0));
    expect(onDrop).toHaveBeenCalledWith({ combinationId: 'c1' });

    drag.press(pointer('pointerdown', 0, 0), 'x', { onStart, onDrop });
    window.dispatchEvent(pointer('pointermove', 20, 0));
    hit = document.body;
    window.dispatchEvent(pointer('pointerup', 20, 0));
    expect(onDrop).toHaveBeenCalledWith(null);
  });
});
