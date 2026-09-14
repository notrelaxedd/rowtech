// The stroke chart's frame, shared by the example curve and the live one so
// switching between them never moves the axes.
export const W = 640;
export const H = 300;
export const PX0 = 44;
export const PX1 = 624;
export const PY0 = 262;
export const PY1 = 18;
export const KG0 = -4;
export const KG1 = 70;
export const KG_GRID = [0, 20, 40, 60];

export const y = (kg: number) => PY0 + ((kg - KG0) / (KG1 - KG0)) * (PY1 - PY0);
/** Inverse of y(): the force at a height in the viewBox. */
export const kgAtY = (py: number) => KG0 + ((py - PY0) / (PY1 - PY0)) * (KG1 - KG0);
