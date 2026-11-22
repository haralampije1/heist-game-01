// The room, its guards and cameras, the alarm, and every rule of the heist.
// Everything here is deterministic when seeded: screenshots are staged from a seed.
import { vec, dist, angleOf, angleDiff, clamp } from './vec.js';

const TILE = 40;
const ROOM_W = 26;
const ROOM_H = 16;
const SPEED = 2.6;

// Axis-aligned rectangles: {x, y, w, h} in room pixels, top-left origin.
const rects = (x, y, w, h) => ({ x, y, w, h });

// Walls: the outer border plus the fixed pillars nobody can walk through.
const walls = () => {
  const out = [];
  for (let x = 0; x <= ROOM_W; x += 2) out.push(rects(x * TILE, 0, TILE, TILE), rects(x * TILE, (ROOM_H - 1) * TILE, TILE, TILE));
  for (let y = 1; y < ROOM_H - 1; y += 2) out.push(rects(0, y * TILE, TILE, TILE), rects((ROOM_W - 1) * TILE, y * TILE, TILE, TILE));
  out.push(
    rects(340, 320, 160, 40), rects(520, 320, 40, 160),   // back counters
    rects(720, 200, 140, 40), rects(860, 200, 40, 160),   // server racks
    rects(160, 520, 100, 160), rects(300, 520, 100, 40),  // desks
    rects(620, 440, 180, 40), rects(620, 440, 40, 140),   // filing cabinets
    rects(900, 520, 120, 40), rects(980, 520, 40, 140),   // safe alcove
    rects(140, 160, 60, 200), rects(220, 160, 60, 200)    // pillars at the entrance hall
  );
  return out;
};

// Obstacles block vision and movement (the same set, cameras and guards cannot see through them).
const obstacles = walls;
const TWO_PI = Math.PI * 2;

// Seeded PRNG so staged screenshots (seed=N) are byte-stable across renditions.
const createRandom = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s >>> 8) / 16777216;
  };
};

// clamp an angle to (-PI, PI].
const norm = (a) => {
  while (a <= -Math.PI) a += TWO_PI;
  while (a > Math.PI) a -= TWO_PI;
  return a;
};

// Ray-cast against obstacles: true when some point of the segment is blocked.
const blocked = (walls, from, to, step = 10) => {
  const d = dist(from, to);
  const n = Math.max(2, Math.floor(d / step));
  const dx = (to.x - from.x) / n;
  const dy = (to.y - from.y) / n;
  for (let i = 1; i < n; i++) {
    const p = { x: from.x + dx * i, y: from.y + dy * i };
    for (const w of walls) {
      if (p.x > w.x && p.x < w.x + w.w && p.y > w.y && p.y < w.y + w.h) return true;
    }
  }
  return false;
};

// Point vs rectangle (movement collision).
const hitsRect = (p, r, pad = 8) => p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad;

// Whether the guard at g sees point p: within cone distance, inside the cone, and no obstacle between.
const sees = (guard, p, walls) => {
  if (dist(guard.pos, p) > guard.range) return false;
  const a = angleDiff(guard.angle, angleOf(guard.pos, p));
  if (Math.abs(a) > guard.cone / 2) return false;
  return !blocked(walls, guard.pos, p);
};

// Whether camera c sees point p (thin rotating beam).
const cameraSees = (camera, p, walls) => {
  if (dist(camera.pos, p) > camera.range) return false;
  const beam = angleOf(camera.pos, p);
  const d = Math.abs(angleDiff(camera.angle, beam));
  if (d > camera.width / 2) return false;
  return !blocked(walls, camera.pos, p, 6);
};

export const createWorld = (seed) => {
  const random = createRandom(seed);
  const wallList = walls();

  const guard = (x, y, route, facing, delay = 0) => ({
    pos: vec(x, y),
    route,
    routeIndex: 0,
    routeTimer: delay,
    angle: facing,
    cone: 1.05,       // vision cone ~ 60 degrees
    range: 180,
    state: 'patrol',  // patrol | inspect | chase
    timer: 0
  });

  return {
    seed,
    walls: wallList,
    player: vec(140, 1000),
    velocity: vec(0, 0),
    dir: 0,
    loot: vec(1020, 140),
    lootTaken: false,
    exit: vec(140, 40),
    exitOpen: false,
    alarm: 0,
    caught: false,
    escaped: false,
    screen: 'title',
    lootMsg: '',
    guides: [],      // active distraction markers {pos, ttl}
    guards: [
      guard(760, 360, [vec(760, 360), vec(900, 360)], 0),
      guard(240, 720, [vec(240, 720), vec(420, 640)], 3.14, 30)
    ],
    cameras: [
      { pos: vec(940, 240), angle: 0, sweep: 0, width: 0.5, range: 220 },
      { pos: vec(180, 180), angle: 3.14, sweep: 0, width: 0.5, range: 200 }
    ],
    random,
    step(input, shot) {
      const walls = this.walls;
      const wanted = input.direction();
      if (this.screen === 'play') {
        const move = { x: wanted.x * SPEED, y: wanted.y * SPEED };
        const trial = vec(this.player.x + move.x, this.player.y);
        if (!walls.some((w) => hitsRect(trial, w))) this.player.x = trial.x;
        const trial2 = vec(this.player.x, this.player.y + move.y);
        if (!walls.some((w) => hitsRect(trial2, w))) this.player.y = trial2.y;
        this.dir = wanted.x !== 0 || wanted.y !== 0 ? Math.atan2(wanted.y, wanted.x) : this.dir;

        if (input.justPressed('action') && this.guides.length < 3 && !this.lootTaken) {
          this.guides.push({ pos: vec(this.player.x, this.player.y), ttl: 180 });
        }

        if (!this.lootTaken && dist(this.player, this.loot) < 26) {
          this.lootTaken = true;
          this.lootMsg = 'LOOT SECURED - head for the exit';
          this.exitOpen = true;
        }
        if (this.lootTaken && !this.escaped && dist(this.player, this.exit) < 26) {
          this.escaped = true;
          this.screen = 'escaped';
        }

        // Guards patrol their routes, divert toward fresh distractions, then resume.
        for (const g of this.guards) {
          let target = g.route[g.routeIndex];
          const bait = this.guides.reduce((best, m) => (dist(g.pos, m.pos) < dist(g.pos, best.pos) ? m : best), null);
          if (g.state === 'inspect' && bait) target = bait.pos;
          const step_ = g.state === 'chase' ? 3.4 : 1.0;
          const d = dist(g.pos, target);
          if (d > 1.5) {
            const a = angleOf(g.pos, target);
            g.pos.x += Math.cos(a) * step_;
            g.pos.y += Math.sin(a) * step_;
            g.angle = a;
          } else if (!bait) {
            g.routeIndex = (g.routeIndex + 1) % g.route.length;
          }
          g.state = 'patrol';

          if (sees(g, this.player, walls)) {
            this.alarm = clamp(this.alarm + 1.6, 0, 100);
          } else if (this.alarm > 0) {
            this.alarm = Math.max(0, this.alarm - 0.7);
          }
          if (dist(g.pos, this.player) < 24) this.caught = true;
        }

        for (const c of this.cameras) {
          c.sweep += 0.014;
          c.angle = Math.sin(c.sweep) * 1.9 + (c.pos.x > 500 ? 0 : 3.14);
          if (cameraSees(c, this.player, walls)) this.alarm = clamp(this.alarm + 1.1, 0, 100);
        }

        // Distractions pull guards toward them for a moment.
        for (let i = this.guides.length - 1; i >= 0; i--) {
          const m = this.guides[i];
          m.ttl -= 1;
          if (m.ttl <= 0) this.guides.splice(i, 1);
          for (const g of this.guards) {
            if (dist(g.pos, m.pos) < 120) { g.state = 'inspect'; g.angle = angleOf(g.pos, m.pos); }
          }
        }

        if (this.alarm >= 100 && !this.caught) {
          this.caught = true;
          this.screen = 'caught';
        }
        if (this.caught) this.screen = 'caught';
      }
    }
  };
};
