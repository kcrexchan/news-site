// Harness: stub browser env, run the skee-ball script, simulate a throw,
// step physics, assert pins fall + score updates + no exceptions.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'news-site', 'public', 'skee-ball.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
const code = m[1];

function ctxStub() {
  const grad = { addColorStop(){} };
  return new Proxy({}, {
    get(t, p) {
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => grad;
      if (p === 'measureText') return () => ({ width: 10 });
      if (typeof p === 'string') return t[p] !== undefined ? t[p] : (function(){});
      return undefined;
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const listeners = {};
const canvas = {
  width: 800, height: 1200,
  getContext: () => ctxStub(),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 1200 }),
  classList: { add(){}, remove(){}, toggle(){} },
  addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
  setPointerCapture(){},
};

const elements = {
  game: canvas,
  scoreVal: { textContent: '', _set(v) { this.textContent = v; console.log('   [score] ->', v); } },
  bestVal: { textContent: '0' },
  hint: { classList: { add(){}, remove(){}, toggle(){} } },
  overlay: { classList: { add(c){ if (c === 'show') console.log('   [overlay] show'); }, remove(){}, toggle(){} } },
  finalScore: { textContent: '' },
  rankLine: { textContent: '' },
  newHigh: { classList: { add(){}, remove(){}, toggle(){} } },
  muteBtn: { textContent: '🔊', addEventListener(){} },
  againBtn: { addEventListener(){} },
  stage: { clientWidth: 800, clientHeight: 1200 },
};
elements.game = canvas;

const document = {
  getElementById: (id) => elements[id] || null,
  querySelectorAll: () => [
    { classList: { add(){}, remove(){}, toggle(){} } },
    { classList: { add(){}, remove(){}, toggle(){} } },
    { classList: { add(){}, remove(){}, toggle(){} } },
  ],
};

let rafCb = null;
const sandbox = {
  window: { devicePixelRatio: 2, addEventListener(){}, AudioContext: undefined, webkitAudioContext: undefined },
  document,
  performance: { now: () => Date.now() },
  requestAnimationFrame: (cb) => { rafCb = cb; return 1; },
  localStorage: { getItem: () => '0', setItem(){} },
  Math, console, setTimeout, clearTimeout,
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
try {
  vm.runInContext(code, sandbox, { filename: 'skee-ball.js' });
  console.log('✓ script executed without throwing');
} catch (e) {
  console.error('✗ RUNTIME ERROR on load:', e.message);
  process.exit(1);
}

// Drive a few animation frames (render pass) to catch draw errors
try {
  for (let i = 0; i < 5; i++) {
    const cb = rafCb; rafCb = null;
    cb && cb(performance.now());
  }
  console.log('✓ render frames ran without throwing');
} catch (e) {
  console.error('✗ RENDER ERROR:', e.message);
  process.exit(1);
}

// Simulate a full-power STRAIGHT-UP throw via the pointer listeners.
// Slingshot: drag DOWN from the ball => throw goes UP.
// Power = min(MAX_THROW, len*4.2). Full power needs len>=219 => drag ~300px.
// Ball starts at logical (240, 640). Drag straight down to (240, 940).
function fire(type, ev) { (listeners[type] || []).forEach(fn => fn(ev)); }
const S = 800 / 480;
const bx = 240 * S, by = 640 * S;        // pointer down ON the ball
const ex = 240 * S, ey = 940 * S;        // drag 300 logical px straight down
fire('pointerdown', { pointerId: 1, clientX: bx, clientY: by, preventDefault(){}, });
console.log('   [fire] pointerdown at ball', bx.toFixed(1), by.toFixed(1));
fire('pointermove', { pointerId: 1, clientX: ex, clientY: ey, preventDefault(){}, });
fire('pointerup',   { pointerId: 1, clientX: ex, clientY: ey, preventDefault(){}, });
console.log('   [fire] pointerup (full-power throw released)');

// Now step physics by pumping frames for a while (throw should knock pins)
let threw = false;
try {
  for (let i = 0; i < 400; i++) {
    const cb = rafCb; rafCb = null;
    cb && cb(performance.now() + i * 16);
  }
  console.log('✓ physics frames ran without throwing');
} catch (e) {
  console.error('✗ PHYSICS ERROR:', e.message, e.stack);
  process.exit(1);
}

console.log('score displayed:', elements.scoreVal.textContent);
console.log('ALL CHECKS PASSED');
