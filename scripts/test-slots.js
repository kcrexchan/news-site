// Harness: stub browser env, run the slots script, assert rules.
// - unit tests: payout() pure helper (3-of-a-kind, wilds, two-cherries, no-win)
// - integration: seeded spin balance invariants (stake deducted, win credited)
// - account flow: create → lose into broke → wallet sync → borrow → repay
// setTimeout is made SYNCHRONOUS and window.__SLOTS_TEST__ forces instant settle.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'slots-game.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('✗ could not extract <script>'); process.exit(1); }
const code = m[1];

// ── DOM element factory ─────────────────────────────────────────────
function makeEl(attrs) {
  var e = {
    textContent: '', className: '', value: '', innerHTML: '', placeholder: '',
    disabled: false, hidden: false, style: {},
    _children: [], _attrs: attrs || {},
    appendChild: function (c) { e._children.push(c); return c; },
    removeChild: function (c) { var i = e._children.indexOf(c); if (i >= 0) e._children.splice(i, 1); return c; },
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

// Reel elements need .querySelectorAll('.reel-cell') → 3 cells (array w/ forEach).
function makeReel() {
  var r = makeEl();
  var cells = [makeEl(), makeEl(), makeEl()];
  r.querySelectorAll = function (sel) { if (sel === '.reel-cell') return cells; return []; };
  return r;
}

var ids = ['balanceVal','betVal','msg','clearBtn','spinBtn','muteBtn','resultBar',
  'paytableBody',
  'paytable','paytableToggle','paytableBodyWrap',
  'lbBtn','accName','accNameTxt','accLogout','accountModal','boardModal','tabCreate','tabLogin',
  'accNameInput','accPinInput','accGoBtn','accCloseBtn','accErr','accOk','boardBody','boardFoot',
  'boardBorrowBtn','boardRepayBtn','boardCloseBtn'];
var elements = {};
ids.forEach(function (id) { elements[id] = makeEl(); });
['reel1','reel2','reel3'].forEach(function (id) { elements[id] = makeReel(); });

var chips = ['10','25','50','100'].map(function (v) { return makeEl({ 'data-chip': v }); });

// ── fetch mock: mirrors /api/blackjack/leaderboard (wallet + casino loans) ──
var lbStore = {};   // name -> { pin, wallet, debt, borrows }
var LOAN = 2000, LOAN_TOTAL = 2020, MIN_BET = 10;
function lbApi(body) {
  var a = body.action;
  function board() {
    var rows = Object.keys(lbStore).map(function (n) { return { name: n, wallet: lbStore[n].wallet, debt: lbStore[n].debt, borrows: lbStore[n].borrows, at: '2026-08-25T00:00:00.000Z' }; });
    rows.sort(function (x, y) { return (y.wallet - x.wallet) || x.name.localeCompare(y.name); });
    return { updated: '2026-08-25T00:00:00.000Z', scores: rows.slice(0, 25) };
  }
  if (a === 'board') return board();
  if (a === 'create') {
    var n = (body.name || '').trim();
    if (!n) return { ok: false, error: 'Name required' };
    if (lbStore[n]) return { ok: false, error: 'Name already taken' };
    lbStore[n] = { pin: body.pin, wallet: 1000, debt: 0, borrows: 0 };
    return { ok: true, name: n, wallet: 1000, debt: 0, borrows: 0, board: board() };
  }
  if (a === 'login') {
    var ln = (body.name || '').trim();
    if (!lbStore[ln]) return { ok: false, error: 'No such account' };
    if (lbStore[ln].pin !== body.pin) return { ok: false, error: 'Wrong PIN' };
    return { ok: true, name: ln, wallet: lbStore[ln].wallet, debt: lbStore[ln].debt, borrows: lbStore[ln].borrows, board: board() };
  }
  if (a === 'score') {
    var sn = (body.name || '').trim();
    if (!lbStore[sn]) return { ok: false, error: 'No such account' };
    if (lbStore[sn].pin !== body.pin) return { ok: false, error: 'Wrong PIN' };
    lbStore[sn].wallet = Math.floor(Number(body.wallet) || 0);   // can be negative
    return { ok: true, name: sn, wallet: lbStore[sn].wallet, board: board() };
  }
  if (a === 'borrow') {
    var bn = (body.name || '').trim();
    if (!lbStore[bn]) return { ok: false, error: 'No such account' };
    if (lbStore[bn].pin !== body.pin) return { ok: false, error: 'Wrong PIN' };
    if (lbStore[bn].wallet >= MIN_BET) return { ok: false, error: "You can still cover a minimum bet — borrow only when you can't start a hand" };
    lbStore[bn].wallet += LOAN; lbStore[bn].debt += LOAN_TOTAL; lbStore[bn].borrows += 1;
    return { ok: true, name: bn, wallet: lbStore[bn].wallet, debt: lbStore[bn].debt, borrows: lbStore[bn].borrows, loan: LOAN, interest: 20, board: board() };
  }
  if (a === 'repay') {
    var rn = (body.name || '').trim();
    if (!lbStore[rn]) return { ok: false, error: 'No such account' };
    if (lbStore[rn].pin !== body.pin) return { ok: false, error: 'Wrong PIN' };
    if (lbStore[rn].debt <= 0) return { ok: false, error: 'No debt to repay' };
    if (lbStore[rn].wallet < lbStore[rn].debt) return { ok: false, error: "Wallet can't cover the full debt" };
    var paid = lbStore[rn].debt;
    lbStore[rn].wallet -= paid; lbStore[rn].debt = 0;
    return { ok: true, name: rn, wallet: lbStore[rn].wallet, debt: 0, borrows: lbStore[rn].borrows, repaid: paid, board: board() };
  }
  if (a === 'delete') {
    var dn = (body.name || '').trim();
    if (!lbStore[dn]) return { ok: false, error: 'No such account' };
    if (lbStore[dn].pin !== body.pin) return { ok: false, error: 'Wrong PIN' };
    delete lbStore[dn];
    return { ok: true, name: dn, deleted: true, board: board() };
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
  querySelectorAll: function (sel) { if (sel === '.chip') return chips; return []; },
  createElement: function () { return makeEl(); }
};

var sandbox = {
  window: { __SLOTS_TEST__: true, devicePixelRatio: 1, addEventListener: function () {}, AudioContext: undefined, webkitAudioContext: undefined },
  document: document,
  performance: { now: function () { return Date.now(); } },
  requestAnimationFrame: function (cb) { return 1; },
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  Math: Math, console: console, Date: Date,
  fetch: fetchMock,
  // SYNCHRONOUS timeouts so the reel animation settles instantly
  setTimeout: function (cb) { try { cb(); } catch (e) { throw e; } return 0; },
  clearTimeout: function () {}
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

var S;
try {
  vm.runInContext(code, sandbox, { filename: 'slots.js' });
  S = sandbox.window.__SLOTS__;
  console.log('✓ script executed without throwing; __SLOTS__ handle present:', !!S);
} catch (e) {
  console.error('✗ RUNTIME ERROR on load:', e.message, e.stack);
  process.exit(1);
}
if (!S) { console.error('✗ __SLOTS__ handle missing'); process.exit(1); }

function assert(cond, label) {
  if (cond) { console.log('   ✓', label); }
  else { console.error('   ✗ FAIL:', label); process.exit(1); }
}

// Flush the microtask queue so the game's async wallet-sync promise chains
// (lbSyncWallet / lbFetch → r.json().then(...)) settle before we assert.
function flush(n) {
  var p = Promise.resolve();
  for (var i = 0; i < (n || 8); i++) p = p.then(function () {});
  return p;
}

async function main() {
  // ═══════════════════════════════════════════════════════════════
  //  1. UNIT — payout() (pure, no seed needed)
  // ═══════════════════════════════════════════════════════════════
  console.log('— unit: payout —');
  assert(S._payout(['seven','seven','seven']) === 250, '7,7,7 → 250×');
  assert(S._payout(['wild','wild','wild']) === 500, 'wild×3 → 500×');
  assert(S._payout(['bell','bell','bell']) === 25, 'bell×3 → 25×');
  assert(S._payout(['diam','diam','diam']) === 100, 'diamond×3 → 100×');
  assert(S._payout(['star','star','star']) === 50, 'star×3 → 50×');
  assert(S._payout(['grape','grape','grape']) === 15, 'grape×3 → 15×');
  assert(S._payout(['orange','orange','orange']) === 10, 'orange×3 → 10×');
  assert(S._payout(['lemon','lemon','lemon']) === 8, 'lemon×3 → 8×');
  assert(S._payout(['cherry','cherry','cherry']) === 5, 'cherry×3 → 5× (not 2)');
  assert(S._payout(['wild','wild','cherry']) === 5, 'wild,wild,cherry → cherry 5×');
  assert(S._payout(['cherry','cherry','wild']) === 5, 'cherry,cherry,wild → cherry 5×');
  assert(S._payout(['diam','diam','wild']) === 100, 'diamond,diamond,wild → 100×');
  assert(S._payout(['cherry','cherry','lemon']) === 2, 'two cherries + lemon → 2×');
  assert(S._payout(['cherry','lemon','cherry']) === 2, 'cherry,lemon,cherry → 2×');
  assert(S._payout(['cherry','lemon','orange']) === 0, 'three distinct → 0');
  assert(S._payout(['wild','cherry','lemon']) === 0, 'wild + cherry + lemon → 0 (no 3-match)');
  assert(S._payout(['lemon','orange','star']) === 0, 'lemon,orange,star → 0');

  // ═══════════════════════════════════════════════════════════════
  //  2. INTEGRATION — seeded spin: stake deducted, win credited
  // ═══════════════════════════════════════════════════════════════
  console.log('— integration: spin balance invariants —');
  S._setSeed(1234);
  S.rebuy();            // balance 1000, bet 0
  S.addChip(100);       // bet 100
  assert(S.state().balance === 1000, 'balance 1000 before spin');
  assert(S.state().bet === 100, 'bet 100 placed');
  S.spin();             // synchronous settle
  var st = S.state();
  var exp = 100 * S._payout(st.reels);
  assert(st.phase === 'settle', 'phase = settle after spin');
  assert(st.lastWin === exp, 'lastWin = bet × payout (' + exp + ')');
  assert(st.balance === 1000 - 100 + exp, 'balance = 1000 − 100 + win (' + st.balance + ')');
  assert(st.reels.length === 3, 'three reels drawn');

  // Minimum-bet guard
  S.newSpin();
  S.clearBet();         // drop the remembered last-bet so we start clean
  S.addChip(5);
  var before = S.state().balance;
  S.spin();             // bet 5 < MIN_BET 10 → rejected, no state change
  assert(S.state().phase === 'bet', 'sub-min bet rejected (still in bet phase)');
  assert(S.state().balance === before, 'balance unchanged on rejected spin');

  // ═══════════════════════════════════════════════════════════════
  //  3. ACCOUNT FLOW — create → lose into broke → sync → borrow → repay
  // ═══════════════════════════════════════════════════════════════
  console.log('— account: create / broke / borrow / repay —');
  var created = await S._lbCreate('Alice', '1234');
  assert(created.wallet === 1000, 'new account wallet = 1000');
  assert(S.state().balance === 1000, 'game balance synced to wallet (1000)');
  assert(S._lbSession().name === 'Alice', 'session name = Alice');

  // Drive into "broke": bet the whole bankroll and land a losing spin.
  var brokeSeed = null;
  for (var s = 1; s <= 500; s++) {
    S._setSeed(s);
    S.rebuy();            // balance 1000, bet 0
    S.newSpin();          // phase → bet, bet 0
    S.addChip(1000);      // bet the full bankroll
    S.spin();             // settle (sync); lbSyncWallet pushes balance to server
    await flush();        // let the async wallet sync land before the next spin
    var ss = S.state();
    if (ss.balance < MIN_BET && ss.lastWin === 0) { brokeSeed = s; break; }
  }
  assert(brokeSeed !== null, 'found a losing full-bet spin (broke) at seed ' + brokeSeed);
  assert(S.state().balance < MIN_BET, 'game balance < 10 (broke)');
  assert(S._lbSession().wallet < MIN_BET, 'wallet synced to < 10 after losing spin');

  // Broke result-bar: account player sees the casino-loan button, not a free rebuy.
  var rbHtml = elements.resultBar.innerHTML;
  assert(rbHtml.indexOf('Borrow $2,000') !== -1, 'broke bar offers casino loan (account player)');
  assert(rbHtml.indexOf('id="rebuyBtn"') === -1, 'free rebuy hidden (account player)');

  // Borrow: wallet < 10 → loan allowed; wallet += 2000, debt += 2020.
  var br = await S._lbBorrow();
  await flush();
  assert(br.wallet === 2000, 'after borrow wallet = 2000');
  assert(br.debt === 2020, 'after borrow debt = 2020 (1% interest)');
  assert(br.borrows === 1, 'borrow count = 1');
  assert(S.state().balance === 2000, 'game balance synced to 2000 after borrow');
  assert(S._lbSession().debt === 2020, 'session debt = 2020');

  // Repay is refused while the wallet can't cover the full debt.
  var repayBlocked = false;
  try { await S._lbRepay(); } catch (e) { repayBlocked = true; }
  assert(repayBlocked === true, 'repay refused while wallet (2000) < debt (2020)');

  // Top up the wallet (simulate a win) so it covers the debt, then repay.
  await S._lbScore(3000);
  await flush();
  assert(S._lbSession().wallet === 3000, 'wallet set to 3000 (covers debt)');
  var rp = await S._lbRepay();
  await flush();
  assert(rp.wallet === 980, 'after repay wallet = 3000 − 2020 = 980');
  assert(rp.debt === 0, 'debt cleared to 0');
  assert(rp.repaid === 2020, 'repaid amount = 2020');
  assert(S.state().balance === 980, 'game balance synced to 980 after repay');

  // Borrow is refused when the wallet can still cover the minimum bet.
  var borrowBlocked = false;
  try { await S._lbBorrow(); } catch (e) { borrowBlocked = true; }
  assert(borrowBlocked === true, 'borrow refused when wallet (980) >= 10');

  // ═══════════════════════════════════════════════════════════════
  //  4. UI — collapsible paytable (default open, toggle, aria)
  // ═══════════════════════════════════════════════════════════════
  console.log('— ui: collapsible paytable —');
  assert(S._paytableCollapsed() === false, 'paytable starts expanded (default)');
  assert(elements.paytable.classList.contains('collapsed') === false, 'no .collapsed class initially');

  S._paytableToggle(true);
  assert(S._paytableCollapsed() === true, 'collapse() → collapsed');
  assert(elements.paytable.classList.contains('collapsed') === true, '.collapsed class set');
  assert(elements.paytableToggle.getAttribute('aria-expanded') === 'false', 'aria-expanded=false when collapsed');

  S._paytableToggle(false);
  assert(S._paytableCollapsed() === false, 'expand() → expanded');
  assert(elements.paytable.classList.contains('collapsed') === false, '.collapsed class cleared');
  assert(elements.paytableToggle.getAttribute('aria-expanded') === 'true', 'aria-expanded=true when expanded');

  // Flip (no force) toggles the current state.
  S._paytableToggle(false);   // ensure expanded
  S._paytableToggle();        // flip → collapsed
  assert(S._paytableCollapsed() === true, 'flip from expanded → collapsed');
  S._paytableToggle();        // flip → expanded
  assert(S._paytableCollapsed() === false, 'flip from collapsed → expanded');

  console.log('\n✅ ALL SLOTS TESTS PASSED');
}

main().catch(function (e) {
  console.error('✗ UNCAUGHT ERROR:', e && e.message, e && e.stack);
  process.exit(1);
});
