// Keyboard input. WASD and arrows move the thief; action confirms menus and throws a distraction.
const MAP = {
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  Space: 'action', Enter: 'confirm', Escape: 'back'
};

export const createInput = (target) => {
  const held = {};
  const just = {};

  const press = (name, value) => { held[name] = value; if (value) just[name] = true; };
  target.addEventListener('keydown', (event) => {
    const name = MAP[event.code];
    if (name) { event.preventDefault(); press(name, true); }
  });
  target.addEventListener('keyup', (event) => {
    const name = MAP[event.code];
    if (name) { event.preventDefault(); press(name, false); }
  });
  target.addEventListener('blur', () => { for (const name of Object.keys(held)) held[name] = false; });

  return {
    direction: () => ({
      x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
      y: (held.down ? 1 : 0) - (held.up ? 1 : 0)
    }),
    justPressed: (name) => {
      const hit = just[name] === true;
      just[name] = false;
      return hit;
    },
    held: (name) => held[name] === true,
    takeJust: () => {
      const out = {};
      for (const name of Object.keys(just)) if (just[name]) out[name] = true;
      for (const name of Object.keys(out)) just[name] = false;
      return out;
    }
  };
};
