// Tiny 2D vector helpers used by the world and the renderer. No dependencies.
export const vec = (x = 0, y = 0) => ({ x, y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const len = (a) => Math.hypot(a.x, a.y);
export const dist = (a, b) => len(sub(a, b));
export const angleOf = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

// Angle difference in (-PI, PI].
export const angleDiff = (a, b) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  return d < -Math.PI ? d + Math.PI * 2 : d;
};
