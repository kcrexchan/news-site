// Harness: stub browser env, run the balloon-pop script, assert rules.
// - unit: tap inflate, deflate rate + floor, pop threshold range
// - integration: lock-in scoring, pop = 0 pts, 30s expiry forfeits in-flight
// - leaderboard: create/login/score(max-keep)/board rank-by-highest/delete, wrong-PIN reject
// rAF is a no-op (game loop is driven deterministically via __BALLOON__._tick).
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'balloon-game.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('✗ could not extract <script>'); process.exit(1); }
const code = m[1];

// ── DOM element factory (same shape as test-reaction.js) ──────────
function makeEl(attrs) {
  var e = {
    textContent: '', className: '', value: '', innerHTML: '', placeholder: '',
    disabled: false, hidden: false, style: {}, tagName: 'DIV',
    _children: [], _attrs: attrs || {},
    appendChild: function (c) { e._children.push(c); return c; },
    removeChild: function (c) { var i = e._children.indexOf(c); if (i >= 0) e._children.splice(i, 1); return c; },
    remove: function () {},
    querySelectorAll: function () { return []; },
    classList: {
      _set: {},
      add: function (c) { e.classList._set[c] = 1; },
      remove: function (c) { delete e.classList._set[c]; },
      toggle: function (c, force) {
        var has = !!e.classList._set[c];
        var want = (force === undefined) ? !has : !!force;
        if (want) e.classList._set[c] = 1; else delete e.classList._set[c];
        return want;
      },
      contains: function (c) { return !!e.classList._set[c]; }
    },
    getAttribute: function (n) { return Object.prototype.hasOwnProperty.call(e._attrs, n) ? e._attrs[n] : ''; },
    setAttribute: function (n, v) { e._attrs[n] = v; },
    addEventListener: function () {},
    focus: function () {}
  };
  return e;
}

var ids = ['stage','balloon','popFlash','hint',
  'timeVal','sizeVal','scoreVal','bankedVal',
  'accChip','accNameEl','accLogoutEl','lbBtn',
  'lockBtn','overOverlay','finalScore','finalStats','againBtn','saveBtn',
  'accountModal','boardModal','tabCreate','tabLogin','accErr','accOk',
  'accNameInput','accPinInput','accGoBtn','accCloseBtn',
  'boardBody','boardFoot','boardCloseBtn'];
var elements = {};
ids.forEach(function (id) { elements[id] = makeEl(); });

// ── fetch mock: mirrors /api/balloon/leaderboard (ranked by HIGHEST score) ──
var lbStore = {}; // name(lower) -> { name, pin, best }
var MIN_BEST = 0, MAX_BEST = 999999;
function coerceBest(v) { var n = Math.floor(Number(v)); if (!Number.isFinite(n)) return null; return Math.max(MIN_BEST, Math.min(MAX_BEST, n)); }
function board() {
  var rows = Object.keys(lbStore).map(function (k) {
    var a = lbStore[k];
    return { name: a.name, best: a.best, at: '2026-08-27T00:00:00.000Z' };
  });
  rows.sort(function (x, y) {
    var bx = x.best == null ? -1 : x.best;
    var by = y.best == null ? -1 : y.best;
    if (bx !== by) return by - bx;
    return x.name.localeCompare(y.name);
  });
  return { updated: '2026-08-27T00:00:00.000Z', scores: rows.slice(0, 10) };
}
function lbApi(body) {
  var a = body.action;
  var key = String(body.name || '').trim().toLowerCase();
  if (a === 'board') { var b = board(); return { ok: true, scores: b.scores, updated: b.updated }; }
  if (a === 'create') {
    var name = String(body.name || '').trim();
    if (!/^\d{4}$/.test(String(body.pin))) return { ok: false, error: 'PIN must be exactly 4 digits' };
    if (lbStore[key]) return { ok: false, error: 'That name is already taken' };
    lbStore[key] = { name: name, pin: body.pin, best: null };
    return { ok: true, name: name, best: null, board: board() };
  }
  if (a === 'login') {
    if (!lbStore[key]) return { ok: false, error: 'No such account' };
    if (lbStore[key].pin !== body.pin) return { ok: false, error: 'Wrong PIN' };
    return { ok: true, name: lbStore[key].name, best: lbStore[key].best, board: board() };
  }
  if (a === 'score') {
    if (!lbStore[key]) return { ok: false, error: 'No such account' };
    if (lbStore[key].pin !== body.pin) return { ok: false, error: 'Wrong PIN' };
    var sub = coerceBest(body.best);
    if (sub == null) return { ok: false, error: 'A score is required' };
    lbStore[key].best = lbStore[key].best == null ? sub : Math.max(lbStore[key].best, sub);
    return { ok: true, name: lbStore[key].name, best: lbStore[key].best, board: board() };
  }
  if (a === 'delete') {
    if (!lbStore[key]) return { ok: false, error: 'No such account' };
    if (lbStore[key].pin !== body.pin) return { ok: false, error: 'Wrong PIN' };
    delete lbStore[key];
    return { ok: true, name: 'deleted', deleted: true, board: board() };
  }
  return { ok: false, error: 'Unknown action' };
}
var fetchMock = function (url, opts) {
  var body = opts && opts.body ? JSON.parse(opts.body) : {};
  var res = lbApi(body);
  var ok = res.ok !== false;
  return Promise.resolve({ ok: ok, status: ok ? 200 : 400, json: function () { return Promise.resolve(res); } });
};

var document = {
  getElementById: function (id) { return elements[id] || null; },
  querySelectorAll: function () { return []; },
  createElement: function () { return makeEl(); },
  activeElement: null
};

var sandbox = {
  window: { PointerEvent: undefined, addEventListener: function () {} },
  document: document,
  navigator: { vibrate: function () {} },
  performance: { now: function () { return 1000; } },
  requestAnimationFrame: function () { return 1; },   // no-op: game loop driven via _tick
  cancelAnimationFrame: function () {},
  setTimeout: function (cb) { try { cb(); } catch (e) { throw e; } return 1; },
  clearTimeout: function () {},
  Math: Math, console: console, Date: Date,
  fetch: fetchMock
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

var S;
try {
  vm.runInContext(code, sandbox, { filename: 'balloon.js' });
  S = sandbox.window.__BALLOON__;
  console.log('✓ script executed without throwing; __BALLOON__ handle present:', !!S);
} catch (e) {
  console.error('✗ RUNTIME ERROR on load:', e.message, e.stack);
  process.exit(1);
}
if (!S) { console.error('✗ __BALLOON__ handle missing'); process.exit(1); }

var failures = 0;
function assert(cond, label) {
  if (cond) { console.log('   ✓', label); }
  else { console.error('   ✗ FAIL:', label); failures++; }
}

async function main() {
  // ═══════════════════════════════════════════════════════════════
  //  1. UNIT — start state
  // ═══════════════════════════════════════════════════════════════
  console.log('— unit: start state —');
  assert(S.state().phase === 'idle', 'starts idle');
  S._setSeed(42);
  S.start();
  var st = S.state();
  assert(st.phase === 'playing', 'start() → playing');
  assert(st.timeLeft === 30, '30s clock');
  assert(st.size === 100, 'balloon starts at BASE_SIZE (100)');
  assert(st.threshold >= 150 && st.threshold <= 220, 'pop threshold in [150,220]');

  // ═══════════════════════════════════════════════════════════════
  //  2. UNIT — tap inflates
  // ═══════════════════════════════════════════════════════════════
  console.log('— unit: tap inflates —');
  var before = S.state().size;
  S.tap();
  assert(S.state().size === before + 7, 'tap adds TAP_INFLATE (7)');

  // ═══════════════════════════════════════════════════════════════
  //  3. UNIT — deflate rate (slower than inflate)
  // ═══════════════════════════════════════════════════════════════
  console.log('— unit: deflate —');
  S._setSeed(42); S.start();
  S.tap(); S.tap(); // 114
  S._tick(1000);
  assert(Math.abs(S.state().size - (114 - 2.5)) < 0.01, 'deflates 2.5/sec while idle');

  // ═══════════════════════════════════════════════════════════════
  //  4. UNIT — deflate floor (60), game still running
  // ═══════════════════════════════════════════════════════════════
  console.log('— unit: deflate floor —');
  S._setSeed(42); S.start();
  S._tick(16000); // 100 - 2.5*16 = 60 exactly; timeLeft = 14
  assert(S.state().size === 60, 'deflates to floor 60');
  assert(S.state().phase === 'playing', 'still playing at 14s left');
  S._tick(1000);
  assert(S.state().size === 60, 'floor holds — never deflates below 60');

  // ═══════════════════════════════════════════════════════════════
  //  5. UNIT — lock-in banks score + spawns fresh balloon
  // ═══════════════════════════════════════════════════════════════
  console.log('— unit: lock-in —');
  S._setSeed(42); S.start();
  S.tap(); S.tap(); S.tap(); S.tap(); S.tap(); // 135
  S.lockIn();
  st = S.state();
  assert(st.score === 135, 'score = banked size (135)');
  assert(st.banked === 1, 'banked count = 1');
  assert(st.size === 100, 'fresh balloon at BASE_SIZE');
  assert(st.threshold >= 150 && st.threshold <= 220, 'fresh balloon has a valid threshold');

  // ═══════════════════════════════════════════════════════════════
  //  6. UNIT — over-inflate pops: 0 points, fresh balloon
  // ═══════════════════════════════════════════════════════════════
  console.log('— unit: pop —');
  S._setSeed(42); S.start();
  var th = S.state().threshold;
  var guard = 0;
  while (S.state().popped === 0 && guard++ < 50) S.tap();
  st = S.state();
  assert(st.popped === 1, 'pop registered');
  assert(st.score === 0, 'popped balloon scores 0');
  assert(st.size === 100, 'fresh balloon after pop');

  // ═══════════════════════════════════════════════════════════════
  //  7. UNIT — seeded thresholds: deterministic per seed, vary per balloon
  // ═══════════════════════════════════════════════════════════════
  console.log('— unit: threshold determinism —');
  S._setSeed(7); S.start(); var t1 = S.state().threshold;
  S._setSeed(7); S.start(); S.tap(); S.lockIn(); var t2 = S.state().threshold;
  S._setSeed(7); S.start(); var t3 = S.state().threshold;
  S._setSeed(7); S.start(); S.tap(); S.lockIn(); var t4 = S.state().threshold;
  assert(t1 === t3, 'same seed → same first threshold');
  assert(t2 === t4, 'same seed → same second threshold');
  assert(t1 !== t2, 'consecutive balloons pop at different sizes');

  // ═══════════════════════════════════════════════════════════════
  //  8. INTEGRATION — 30s expiry ends the game; in-flight forfeited
  // ═══════════════════════════════════════════════════════════════
  console.log('— integration: 30s expiry —');
  S._setSeed(42); S.start();
  S.tap(); S.tap(); S.tap(); // 121 in flight, unbanked
  S._tick(30000);
  st = S.state();
  assert(st.phase === 'over', 'game over at 0s');
  assert(st.score === 0, 'unbanked balloon forfeited on expiry');
  assert(st.finalScore === 0, 'finalScore exposed = 0');

  // ═══════════════════════════════════════════════════════════════
  //  9. INTEGRATION — full round: banked sum only
  // ═══════════════════════════════════════════════════════════════
  console.log('— integration: full round —');
  S._setSeed(99); S.start();
  for (var i = 0; i < 4; i++) { S.tap(); S.tap(); S.tap(); S.lockIn(); } // 4 x 121 = 484
  S.tap(); S.tap(); // 114 in flight
  S._tick(30000);
  st = S.state();
  assert(st.phase === 'over', 'round ends at 0s');
  assert(st.banked === 4, '4 balloons banked');
  assert(st.finalScore === 484, 'finalScore = sum of banked sizes (484)');

  // ═══════════════════════════════════════════════════════════════
  //  10. LEADERBOARD — create / login / score(max-keep) / rank / delete
  // ═══════════════════════════════════════════════════════════════
  console.log('— leaderboard: PIN accounts ranked by highest score —');

  var c1 = await S._lbCreate('Bolt', '1234');
  assert(c1.name === 'Bolt', 'create Bolt');
  assert(S._lbSession().name === 'Bolt', 'session = Bolt');

  await S._lbCreate('Nova', '4321');
  assert(true, 'create Nova');

  var dup = false;
  try { await S._lbCreate('bolt', '9999'); } catch (e) { dup = true; }
  assert(dup === true, 'duplicate name (case-insensitive) rejected');

  await S._lbLogin('Bolt', '1234');
  var s1 = await S._lbScore(250);
  assert(s1.best === 250, 'Bolt first score 250');
  await S._lbLogin('Bolt', '1234');
  var s2 = await S._lbScore(180);
  assert(s2.best === 250, 'Bolt 180 ignored — keeps higher 250');
  await S._lbLogin('Bolt', '1234');
  var s3 = await S._lbScore(420);
  assert(s3.best === 420, 'Bolt 420 beats 250 — best now 420');

  var wrong = false;
  try { await S._lbLogin('Bolt', '0000'); } catch (e) { wrong = true; }
  assert(wrong === true, 'wrong PIN login rejected');

  await S._lbLogin('Nova', '4321');
  var sn = await S._lbScore(300);
  assert(sn.best === 300, 'Nova score 300');

  var b = await S._lbBoard();
  assert(b.scores.length === 2, 'board has 2 entries');
  assert(b.scores[0].name === 'Bolt' && b.scores[0].best === 420, 'board #1 = Bolt @420');
  assert(b.scores[1].name === 'Nova' && b.scores[1].best === 300, 'board #2 = Nova @300');

  await S._lbCreate('Zed', '7777');
  var b2 = await S._lbBoard();
  assert(b2.scores.length === 3, 'board now 3 entries');
  assert(b2.scores[2].name === 'Zed' && b2.scores[2].best === null, 'unscored Zed ranks last (best null)');

  var del = await fetchMock('/api/balloon/leaderboard', { body: JSON.stringify({ action: 'delete', name: 'Nova', pin: '4321' }) }).then(function (r) { return r.json(); });
  assert(del.deleted === true, 'delete Nova');
  var b3 = await S._lbBoard();
  assert(b3.scores.length === 2, 'board back to 2 after delete');

  if (failures) {
    console.error('\n✗ ' + failures + ' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\n✅ ALL BALLOON TESTS PASSED');
}

main().catch(function (e) {
  console.error('✗ UNCAUGHT ERROR:', e && e.message, e && e.stack);
  process.exit(1);
});
