// The renderer: room, light, guards with vision cones, cameras, loot, alarm meter, overlays.
// It only paints whatever state the world holds - no game logic lives here.
import { vec, dist, angleOf, clamp } from './vec.js';

const WALL = '#9aa3b2';
const FLOOR = '#0e1119';
const EDGE = '#1f2633';
const PLAYER = '#7ee08a';
const LOOT = '#f4d03f';
const EXIT = '#7dd3fc';
const GUARD = '#ff6b6b';
const CAMERA = '#d65db1';
const CONE = 'rgba(255, 107, 107, 0.14)';
const BEAM = 'rgba(214, 93, 177, 0.35)';
const TEXT = '#dfe6ee';

// Fill a vision cone as a thin sector approximated by a triangle fan.
const cone = (ctx, guard) => {
  const c = guard.pos;
  const half = guard.cone / 2;
  const left = guard.angle - half;
  const right = guard.angle + half;
  const steps = 9;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  for (let i = 0; i <= steps; i++) {
    const a = left + (right - left) * (i / steps);
    ctx.lineTo(c.x + Math.cos(a) * guard.range, c.y + Math.sin(a) * guard.range);
  }
  ctx.closePath();
  ctx.fill();
};

// Rotating camera beam as a thin wedge.
const beam = (ctx, camera) => {
  const c = camera.pos;
  const half = camera.width / 2;
  const left = camera.angle - half;
  const right = camera.angle + half;
  const steps = 6;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  for (let i = 0; i <= steps; i++) {
    const a = left + (right - left) * (i / steps);
    ctx.lineTo(c.x + Math.cos(a) * camera.range, c.y + Math.sin(a) * camera.range);
  }
  ctx.closePath();
  ctx.fill();
};

const rect = (ctx, r, fill) => {
  ctx.fillStyle = fill;
  ctx.fillRect(r.x, r.y, r.w, r.h);
};

export const createRenderer = (canvas) => {
  const ctx = canvas.getContext('2d');

  const fit = () => {
    canvas.width = Math.max(640, Math.min(1280, canvas.parentElement ? canvas.parentElement.clientWidth : 1200));
    canvas.height = Math.max(360, Math.min(768, canvas.parentElement ? canvas.parentElement.clientHeight : 768));
  };

  return {
    draw(state, screen, best = 0) {
      fit();
      const { width: W, height: H } = canvas;
      ctx.fillStyle = FLOOR;
      ctx.fillRect(0, 0, W, H);

      // Floor grid so the room reads as one space at a glance.
      const g = 40;
      ctx.strokeStyle = EDGE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = g; x < W; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = g; y < H; y += g) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();

      const walls = state.walls;
      for (const w of walls) rect(ctx, w, WALL);

      // Exit door (opens once the loot is taken).
      rect(ctx, { x: state.exit.x - 10, y: state.exit.y - 24, w: 20, h: 48 }, state.exitOpen ? '#6fd183' : '#3a4252');
      ctx.strokeStyle = state.exitOpen ? '#b8eeb1' : '#8a93a3';
      ctx.lineWidth = 2;
      ctx.strokeRect(state.exit.x - 10, state.exit.y - 24, 20, 48);

      // Camera beams and vision cones (danger readable at a glance).
      for (const c of state.cameras) {
        ctx.fillStyle = BEAM;
        beam(ctx, c);
        ctx.fillStyle = CAMERA;
        ctx.beginPath();
        ctx.arc(c.pos.x, c.pos.y, 7, 0, TWO_PI);
        ctx.fill();
      }
      for (const g of state.guards) {
        ctx.fillStyle = CONE;
        cone(ctx, g);
        ctx.fillStyle = GUARD;
        ctx.beginPath();
        ctx.arc(g.pos.x, g.pos.y, 11, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(g.pos.x - 4, g.pos.y - 3, 3, 0, TWO_PI);
        ctx.fill();
      }

      // Loot target.
      if (!state.lootTaken) {
        ctx.fillStyle = LOOT;
        ctx.beginPath();
        ctx.arc(state.loot.x, state.loot.y, 10, 0, TWO_PI);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(state.loot.x, state.loot.y - 12);
        ctx.lineTo(state.loot.x + 7, state.loot.y + 4);
        ctx.moveTo(state.loot.x - 7, state.loot.y + 4);
        ctx.lineTo(state.loot.x + 7, state.loot.y + 4);
        ctx.stroke();
      }

      // Distraction markers in flight.
      for (const m of state.guides) {
        ctx.fillStyle = '#ffef9a';
        ctx.beginPath();
        ctx.arc(m.pos.x, m.pos.y, 5, 0, TWO_PI);
        ctx.fill();
      }

      // The thief.
      ctx.fillStyle = PLAYER;
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, 9, 0, TWO_PI);
      ctx.fill();
      ctx.strokeStyle = '#0b0e14';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(state.player.x, state.player.y);
      ctx.lineTo(state.player.x + Math.cos(state.dir) * 14, state.player.y + Math.sin(state.dir) * 14);
      ctx.stroke();

      // HUD: alarm meter and objective.
      ctx.fillStyle = '#0e1119';
      ctx.fillRect(18, 14, 220, 16);
      ctx.fillStyle = state.alarm > 70 ? '#ff6b6b' : state.alarm > 35 ? '#f4d03f' : '#7ee08a';
      ctx.fillRect(20, 16, clamp(state.alarm, 0, 200) * 2, 12);
      ctx.strokeStyle = '#1f2633';
      ctx.strokeRect(18, 14, 220, 16);
      ctx.fillStyle = TEXT;
      ctx.font = '14px ui-monospace, monospace';
      ctx.fillText(`ALARM ${state.alarm | 0}%  ${state.lootMsg || state.lootTaken ? 'Head for the exit' : 'Take the loot'}`, 22, 26);

      if (state.screen === 'title') {
        overlay(ctx, W, H, 'NIGHT SHIFT', 'Take the loot, reach the exit, keep the alarm down.', 'Arrows or WASD to move  -  Space to distract  -  Enter to start');
      } else if (state.screen === 'caught') {
        overlay(ctx, W, H, state.lootTaken ? 'LOST AT THE DOORSTEP' : 'CAUGHT', 'The alarm hit 100 or a guard closed in.', 'Enter to try again');
      } else if (state.screen === 'escaped') {
        overlay(ctx, W, H, 'GETAWAY CLEAN', state.lootMsg, `Best: ${best | 0}  -  Enter to play again`);
      }
    }
  };
};

const TWO_PI = Math.PI * 2;

const overlay = (ctx, W, H, title, line, hint) => {
  ctx.fillStyle = 'rgba(7, 9, 14, 0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 34px ui-monospace, monospace';
  ctx.fillText(title, W / 2 - ctx.measureText(title).width / 2, H / 2 - 40);
  ctx.font = '16px ui-monospace, monospace';
  ctx.fillText(line, W / 2 - ctx.measureText(line).width / 2, H / 2 + 6);
  ctx.font = '14px ui-monospace, monospace';
  ctx.fillText(hint, W / 2 - ctx.measureText(hint).width / 2, H / 2 + 42);
};
