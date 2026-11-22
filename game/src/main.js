// Boot and the one loop for Night Shift - the game this entry hands in.
// ?seed=N fixes enemy placement. ?shot=start|play|win&seed=N stages that
// scene, paints it twice and sets window.__shotReady so a screenshot driver
// can capture a deterministic render of this game's own output.
import { createWorld } from './src/world.js';
import { createInput } from './src/input.js';
import { createRenderer } from './src/draw.js';
import { vec } from './src/vec.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '', 10) || 17;

const canvas = document.getElementById('game');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const input = createInput(canvas);

let accumulator = 0;
let last = performance.now();

const announce = (message) => { document.title = `Night Shift - ${message}`; };

const resetGuards = () => {
  for (const g of world.guards) {
    g.pos = vec(g.route[0].x, g.route[0].y);
    g.routeIndex = 0;
    g.state = 'patrol';
    g.timer = 0;
  }
  for (const c of world.cameras) {
    c.sweep = 0;
    c.angle = c.pos.x > 500 ? 0 : 3.14;
  }
  world.guides = [];
};

const startGame = () => {
  world.player = vec(140, 1000);
  world.lootTaken = false;
  world.exitOpen = false;
  world.alarm = 0;
  world.caught = false;
  world.escaped = false;
  world.screen = 'play';
  resetGuards();
  accumulator = 0;
  last = performance.now();
  announce('Playing - take the loot, then reach the exit');
};

document.title = 'Night Shift - shot:' + name;

const stageShot = (name) => {
  world.player = name === 'win' ? vec(world.exit.x, world.exit.y) : vec(140, 1000);
  world.lootTaken = name === 'win';
  world.exitOpen = world.lootTaken;
  world.alarm = name === 'play' ? 42 : 0;
  world.caught = false;
  world.escaped = name === 'win';
  world.screen = name === 'start' ? 'title' : name === 'win' ? 'escaped' : 'play';
  resetGuards();
  if (name === 'play') world.guides.push({ pos: vec(520, 560), ttl: 140 });
  for (let i = 0; i < 12; i++) world.step(input, null);
  renderer.draw(world, world.screen);
};

const frame = (now) => {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  const actions = input.takeJust();
  if (world.screen === 'title' || world.screen === 'caught' || world.screen === 'escaped') {
    if (actions.confirm || actions.action) startGame();
    renderer.draw(world, world.screen);
    return;
  }
  while (accumulator >= STEP && world.screen === 'play') {
    world.step(input, null);
    accumulator -= STEP;
  }
  renderer.draw(world, world.screen);
};

if (shot) { stageShot(shot); } else { startGame(); requestAnimationFrame(frame); }
