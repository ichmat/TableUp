import { PlanCombination, PlanTable } from '../../models';
import { LayoutDrop, LayoutEdit, LayoutScene, movedMessage } from './layout-edit';

const TABLE = (id: string, x: number): PlanTable => ({ id, zoneId: 'z1', name: id, capacity: 4, shape: 'Square', x, y: 1, width: 0.8, height: 0.8, rotation: 0 });
const pointer = (type: string, clientX: number) => new PointerEvent(type, { pointerId: 1, clientX, clientY: 0 });

describe('LayoutEdit', () => {
  const t12 = TABLE('12', 1);
  const t13 = TABLE('13', 3);
  const scene = (combinations: PlanCombination[] = [], tables: PlanTable[] = [t12, t13]): LayoutScene => ({
    zone: { id: 'z1', width: 8, height: 6 }, tables, decors: [], combinations,
    // 100 px par mètre
    toMetres: (clientX) => ({ x: clientX / 100, y: 1.4 }),
  });

  it('should ignore a press that does not move', () => {
    const edit = new LayoutEdit();
    const drops: LayoutDrop[] = [];
    edit.pressTable(pointer('pointerdown', 140), { x: 1.4, y: 1.4 }, t12, scene(), (drop) => drops.push(drop));
    window.dispatchEvent(pointer('pointermove', 143));
    window.dispatchEvent(pointer('pointerup', 143));

    expect(drops).toEqual([]);
    expect(edit.preview()).toBeNull();
  });

  it('should move a table against another and propose to glue them', () => {
    const edit = new LayoutEdit();
    const drops: LayoutDrop[] = [];
    edit.pressTable(pointer('pointerdown', 140), { x: 1.4, y: 1.4 }, t12, scene(), (drop) => drops.push(drop));
    // la 13 commence à 3,00 m ; la 12 fait 0,80 m : l'aimant la pose à 2,20 m
    window.dispatchEvent(pointer('pointermove', 258));
    expect(edit.contactIds()).toEqual(['12', '13']);
    window.dispatchEvent(pointer('pointerup', 258));

    expect(drops.length).toBe(1);
    expect(drops[0].moves).toEqual([{ tableId: '12', x: 2.2, y: 1 }]);
    expect(drops[0].accolage?.tableIds).toEqual(['12', '13']);
    expect(edit.preview()!.get('12')).toEqual({ x: 2.2, y: 1 });
  });

  it('should propose to separate a table pulled away from its glued combination, once per session', () => {
    const glued: PlanCombination = { id: 'c', name: '12-13', capacity: 8, tableIds: ['12', '13'], isActive: true };
    const touching = { ...t12, x: 2.2 };
    const edit = new LayoutEdit();
    const drops: LayoutDrop[] = [];
    const sceneGlued = scene([glued], [touching, t13]);

    edit.pressTable(pointer('pointerdown', 260), { x: 2.6, y: 1.4 }, touching, sceneGlued, (drop) => drops.push(drop));
    window.dispatchEvent(pointer('pointermove', 100));
    window.dispatchEvent(pointer('pointerup', 100));
    expect(drops[0].separation?.combinationId).toBe('c');

    edit.keep(drops[0].separation!);
    edit.pressTable(pointer('pointerdown', 260), { x: 2.6, y: 1.4 }, touching, sceneGlued, (drop) => drops.push(drop));
    window.dispatchEvent(pointer('pointermove', 100));
    window.dispatchEvent(pointer('pointerup', 100));
    expect(drops[1].separation).toBeNull();
  });

  it('should still drop the move when the preview is cleared by a reload before the release', () => {
    const edit = new LayoutEdit();
    const drops: LayoutDrop[] = [];
    edit.pressTable(pointer('pointerdown', 140), { x: 1.4, y: 1.4 }, t12, scene(), (drop) => drops.push(drop));
    window.dispatchEvent(pointer('pointermove', 258));
    expect(edit.isDragging()).toBeTrue();
    edit.clear();
    window.dispatchEvent(pointer('pointerup', 258));

    expect(drops[0].moves).toEqual([{ tableId: '12', x: 2.2, y: 1 }]);
    expect(edit.preview()!.get('12')).toEqual({ x: 2.2, y: 1 });
    expect(edit.isDragging()).toBeFalse();
  });

  it('should name what moved', () => {
    expect(movedMessage([{ tableId: '12', x: 1, y: 1 }], [t12])).toBe('Table 12 déplacée');
    expect(movedMessage([{ tableId: '12', x: 1, y: 1 }, { tableId: '13', x: 2, y: 1 }], [t12, t13])).toBe('2 tables déplacées');
  });
});
