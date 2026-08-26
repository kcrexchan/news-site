// Harness: stub browser env, run the reaction-time script, assert rules.
// - unit: rankFor() banding (lightning → sleepy)
// - integration: 5-round run records deterministic ms, best/avg correct, false-start retry
// - leaderboard: create/login/score(min-keep)/board rank-by-lowest-ms/delete, wrong-PIN reject
// Timers are QUEUED (not run) so we can hold the 'armed' phase to test false starts,
// and performance.now is a controllable clock so reaction ms are exact.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'reaction-game.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('✗ could not extract <script>'); process.exit(1); }
const code = m[1];

// ── DOM element factory ─────────────────────────────────────────────
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

var ids = ['pad','padBig','padSub','roundVal','bestVal','avgVal','rounds','roundLabel',
  'summary','sumBest','sumAvg','sumLast','saveRow','restartBtn','saveBtn',
  'accChip','accNameEl','accLogoutEl','lbBtn','accountModal','boardModal',
  'tabCreate','tabLogin','accErr','accOk','accNameInput','accPinInput',
  'accGoBtn','accCloseBtn','boardBody','boardFoot','boardCloseBtn'];
var elements = {};
ids.forEach(function (id) { elements[id] = makeEl(); });

// ── fetch mock: mirrors /api/reaction/leaderboard (ranked by LOWEST ms) ──
var lbStore = {}; // name(lower) -> { name, pin, best }
var MIN_BEST = 100, MAX_BEST = 5000;
function coerceBest(v) { var n = Math.floor(Number(v)); if (!Number.isFinite(n)) return null; return Math.max(MIN_BEST, Math.min(MAX_BEST, n)); }
function board() {
  var rows = Object.keys(lbStore).map(function (k) {
    var a = lbStore[k];
    return { name: a.name, best: a.best, at: '2026-08-26T00:00:00.000Z' };
  });
  rows.sort(function (x, y) {
    var bx = x.best == null ? Infinity : x.best;
    var by = y.best == null ? Infinity : y.best;
    if (bx !== by) return bx - by;
    return x.name.localeCompare(y.name);
  });
  return { updated: '2026-08-26T00:00:00.000Z', scores: rows.slice(0, 10) };
}
function lbApi(body) {
  var a = body.action;
  var key = String(body.name || '').trim().toLowerCase();
  if (a === 'board') return { ok: true, scores: board().scores, updated: board().updated };
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
    if (sub == null) return { ok: false, error: 'A reaction time is required' };
    lbStore[key].best = lbStore[key].best == null ? sub : Math.min(lbStore[key].best, sub);
    return { ok: true, name: lbStore[key].name, best: lbStore[key].best, board: board() };
  }
  if (a === 'delete') {
    if (!lbStore[key]) return { ok: false, error: 'No such account' };
    if (lbStore[key].pin !== body.pin) return { ok: false, error: 'Wrong PIN' };
    delete lbStore[key];
    return { ok: true, name: lbStore[key] ? '' : 'deleted', deleted: true, board: board() };
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

// Controllable clock for exact reaction ms.
var clock = 1000;
var timers = [];
var sandbox = {
  window: { PointerEvent: undefined, addEventListener: function () {} },
  document: document,
  performance: { now: function () { return clock; } },
  requestAnimationFrame: function (cb) { try { cb(); } catch (e) { throw e; } return 1; },
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  Math: Math, console: console, Date: Date,
  fetch: fetchMock,
  // QUEUED timeouts: we decide when callbacks fire (lets us hold 'armed').
  setTimeout: function (cb, delay) { timers.push({ cb: cb, delay: delay || 0, cancelled: false }); return timers.length; },
  clearTimeout: function (id) { if (id && timers[id - 1]) timers[id - 1].cancelled = true; }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function flushTimers() {
  var q = timers; timers = [];
  for (var i = 0; i < q.length; i++) { if (!q[i].cancelled) q[i].cb(); }
}
function advanceToGo(S) {
  var guard = 0;
  while (S.state().phase !== 'go' && guard++ < 6) {
    if (!timers.length) break;
    flushTimers();
  }
}
function flushMicro(n) {
  var p = Promise.resolve();
  for (var i = 0; i < (n || 8); i++) p = p.then(function () {});
  return p;
}

var S;
try {
  vm.runInContext(code, sandbox, { filename: 'reaction.js' });
  S = sandbox.window.__RX__;
  console.log('✓ script executed without throwing; __RX__ handle present:', !!S);
} catch (e) {
  console.error('✗ RUNTIME ERROR on load:', e.message, e.stack);
  process.exit(1);
}
if (!S) { console.error('✗ __RX__ handle missing'); process.exit(1); }

function assert(cond, label) {
  if (cond) { console.log('   ✓', label); }
  else { console.error('   ✗ FAIL:', label); process.exit(1); }
}

async function main() {
  S._setDelayRange(100, 200);

  // ═══════════════════════════════════════════════════════════════
  //  1. UNIT — rankFor() banding
  // ═══════════════════════════════════════════════════════════════
  console.log('— unit: rankFor —');
  assert(S.rankFor(150).label === '⚡ Lightning', '150ms → Lightning');
  assert(S.rankFor(200).label === '🔥 Blazing', '200ms → Blazing');
  assert(S.rankFor(250).label === '🚀 Sharp', '250ms → Sharp');
  assert(S.rankFor(300).label === '🙂 Quick', '300ms → Quick');
  assert(S.rankFor(380).label === '😐 Average', '380ms → Average');
  assert(S.rankFor(450).label === '🐢 A bit slow', '450ms → A bit slow');
  assert(S.rankFor(600).label === '🦥 Sleepy', '600ms → Sleepy');

  // ═══════════════════════════════════════════════════════════════
  //  2. INTEGRATION — full 5-round run, deterministic ms
  // ═══════════════════════════════════════════════════════════════
  console.log('— integration: 5-round run —');
  assert(S.state().phase === 'idle', 'starts idle');
  S.handleTap();               // idle → armed (fireGo queued)
  assert(S.state().phase === 'armed', 'first tap arms round 1');

  var deltas = [150, 200, 180, 220, 160];
  for (var r = 0; r < 5; r++) {
    if (r > 0) advanceToGo(S); // startRound(fireGo) queued from previous result
    advanceToGo(S);            // ensure we are in 'go'
    clock += deltas[r];
    S.handleTap();             // record the reaction
  }
  var st = S.state();
  assert(st.results.length === 5, '5 rounds recorded');
  assert(JSON.stringify(st.results) === JSON.stringify(deltas), 'results = ' + JSON.stringify(deltas));
  assert(st.best === 150, 'best = 150 (lowest)');
  assert(st.avg === 182, 'avg = 182 (mean of 910/5)');
  assert(st.phase === 'done', 'phase = done after 5 rounds');
  assert(st.sessionBest === 150, 'sessionBest = 150 (ready to save)');

  // ═══════════════════════════════════════════════════════════════
  //  3. FALSE START — tap during 'armed' is rejected, then retry
  // ═══════════════════════════════════════════════════════════════
  console.log('— false start + retry —');
  S.resetRun();
  assert(S.state().phase === 'idle', 'resetRun → idle');
  S.handleTap();               // idle → armed
  assert(S.state().phase === 'armed', 'armed again');
  S.handleTap();               // tap too soon
  assert(S.state().phase === 'false', 'early tap → false start (no result recorded)');
  assert(S.state().results.length === 0, 'no ms recorded on false start');
  S.handleTap();               // retry → armed
  assert(S.state().phase === 'armed', 'retry re-arms the round');
  advanceToGo(S);
  assert(S.state().phase === 'go', 'go fires after retry');
  clock += 210;
  S.handleTap();
  assert(S.state().results[0] === 210, 'retried round records 210ms');

  // ═══════════════════════════════════════════════════════════════
  //  4. LEADERBOARD — create / login / score(min-keep) / rank / delete
  // ═══════════════════════════════════════════════════════════════
  console.log('— leaderboard: PIN accounts ranked by lowest ms —');

  var c1 = await S._lbCreate('Bolt', '1234');
  assert(c1.name === 'Bolt', 'create Bolt');
  assert(S._lbSession().name === 'Bolt', 'session = Bolt');

  var c2 = await S._lbCreate('Nova', '4321');
  assert(c2.name === 'Nova', 'create Nova');

  // duplicate name rejected
  var dup = false;
  try { await S._lbCreate('bolt', '9999'); } catch (e) { dup = true; }
  assert(dup === true, 'duplicate name (case-insensitive) rejected');

  // score keeps the LOWER (faster) value — must log in as the player first
  await S._lbLogin('Bolt', '1234');
  var s1 = await S._lbScore(250);
  assert(s1.best === 250, 'Bolt first score 250');
  await S._lbLogin('Bolt', '1234');
  var s2 = await S._lbScore(300);
  assert(s2.best === 250, 'Bolt 300 ignored — keeps faster 250');
  await S._lbLogin('Bolt', '1234');
  var s3 = await S._lbScore(150);
  assert(s3.best === 150, 'Bolt 150 beats 250 — best now 150');

  // wrong PIN rejected on login
  var wrong = false;
  try { await S._lbLogin('Bolt', '0000'); } catch (e) { wrong = true; }
  assert(wrong === true, 'wrong PIN login rejected');

  // log in as Nova, score 180
  await S._lbLogin('Nova', '4321');
  var sn = await S._lbScore(180);
  assert(sn.best === 180, 'Nova score 180');

  // board ranked by lowest ms: Bolt 150 < Nova 180
  var b = await S._lbBoard();
  assert(b.scores.length === 2, 'board has 2 entries');
  assert(b.scores[0].name === 'Bolt' && b.scores[0].best === 150, 'board #1 = Bolt @150');
  assert(b.scores[1].name === 'Nova' && b.scores[1].best === 180, 'board #2 = Nova @180');

  // an unscored account ranks last
  await S._lbCreate('Zed', '7777');
  var b2 = await S._lbBoard();
  assert(b2.scores.length === 3, 'board now 3 entries');
  assert(b2.scores[2].name === 'Zed' && b2.scores[2].best === null, 'unscored Zed ranks last (best null)');

  // delete Nova (direct API call — game has no delete UI)
  var del = await fetchMock('/api/reaction/leaderboard', { body: JSON.stringify({ action: 'delete', name: 'Nova', pin: '4321' }) }).then(function (r) { return r.json(); });
  assert(del.deleted === true, 'delete Nova');
  var b3 = await S._lbBoard();
  assert(b3.scores.length === 2, 'board back to 2 after delete');

  console.log('\n✅ ALL REACTION TESTS PASSED');
}

main().catch(function (e) {
  console.error('✗ UNCAUGHT ERROR:', e && e.message, e && e.stack);
  process.exit(1);
});
