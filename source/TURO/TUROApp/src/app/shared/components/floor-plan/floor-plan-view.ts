/** Marge visible autour de la salle quand elle est ajustée à l'écran, en mètres */
export const VIEW_MARGIN = 0.5;

export interface Size { width: number, height: number }

/**
 * Ce que montre le canevas : un centre en mètres et une échelle (1 = la salle entière tient à l'écran).
 * Le zoom et le déplacement ne font que la modifier
 */
export interface PlanView {
  centreX: number,
  centreY: number,
  scale: number,
}

export function fitView(zone: Size): PlanView {
  return { centreX: zone.width / 2, centreY: zone.height / 2, scale: 1 };
}

/** Dimensions en mètres de la zone visible, avant l'ajustement aux proportions de l'écran */
export function viewSize(view: PlanView, zone: Size): Size {
  return {
    width: (zone.width + 2 * VIEW_MARGIN) / view.scale,
    height: (zone.height + 2 * VIEW_MARGIN) / view.scale,
  };
}

export function toViewBox(view: PlanView, zone: Size): string {
  const { width, height } = viewSize(view, zone);
  return `${view.centreX - width / 2} ${view.centreY - height / 2} ${width} ${height}`;
}

/** 1 = la salle entière ; en dessous, de la marge autour ; 8 = une table occupe l'écran */
export const MIN_SCALE = 0.5;
export const MAX_SCALE = 8;
/** Facteur des boutons − / + */
export const ZOOM_STEP = 1.25;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Borne la vue : au moins un quart de la salle reste visible, on ne la perd jamais hors de l'écran */
export function clampView(view: PlanView, zone: Size): PlanView {
  const { width, height } = viewSize(view, zone);
  return {
    scale: view.scale,
    centreX: clamp(view.centreX, zone.width * 0.25 - width / 2, zone.width * 0.75 + width / 2),
    centreY: clamp(view.centreY, zone.height * 0.25 - height / 2, zone.height * 0.75 + height / 2),
  };
}

/** Zoome autour d'un point (en mètres) qui reste immobile à l'écran : sous le pointeur, entre les doigts */
export function zoomAt(view: PlanView, zone: Size, factor: number, anchor: { x: number, y: number }): PlanView {
  const scale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
  const ratio = view.scale / scale;
  return clampView({
    scale,
    centreX: anchor.x + (view.centreX - anchor.x) * ratio,
    centreY: anchor.y + (view.centreY - anchor.y) * ratio,
  }, zone);
}

/** Déplace la vue de (dx, dy) mètres dans le sens du doigt : le plan suit, le centre recule */
export function panBy(view: PlanView, zone: Size, dx: number, dy: number): PlanView {
  return clampView({ ...view, centreX: view.centreX - dx, centreY: view.centreY - dy }, zone);
}
