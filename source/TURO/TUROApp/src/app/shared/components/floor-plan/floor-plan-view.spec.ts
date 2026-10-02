import { clampView, fitView, MAX_SCALE, MIN_SCALE, panBy, zoomAt } from './floor-plan-view';

const ROOM = { width: 8, height: 5 };

describe('floor-plan-view', () => {
  it('should keep the point under the pointer still while zooming', () => {
    const anchor = { x: 2, y: 1 };
    const view = zoomAt(fitView(ROOM), ROOM, 2, anchor);
    expect(view.scale).toBe(2);
    // (ancre - centre) / largeur visible ne change pas
    expect((anchor.x - view.centreX) * view.scale).toBeCloseTo(anchor.x - 4, 6);
  });

  it('should keep the scale between 0.5 and 8', () => {
    expect(zoomAt(fitView(ROOM), ROOM, 100, { x: 4, y: 2.5 }).scale).toBe(MAX_SCALE);
    expect(zoomAt(fitView(ROOM), ROOM, 0.01, { x: 4, y: 2.5 }).scale).toBe(MIN_SCALE);
  });

  it('should pan the view opposite to the finger', () => {
    const view = panBy({ centreX: 4, centreY: 2.5, scale: 4 }, ROOM, 1, 0.5);
    expect(view.centreX).toBeCloseTo(3, 6);
    expect(view.centreY).toBeCloseTo(2, 6);
  });

  it('should never lose the room off screen: a quarter stays visible', () => {
    const view = clampView({ centreX: 100, centreY: -100, scale: 8 }, ROOM);
    const halfWidth = (ROOM.width + 1) / 8 / 2;
    expect(view.centreX).toBeCloseTo(ROOM.width * 0.75 + halfWidth, 6);
    expect(view.centreY).toBeCloseTo(ROOM.height * 0.25 - (ROOM.height + 1) / 8 / 2, 6);
  });
});
