// Harness: stub browser env, run the blackjack script, assert rules.
// - unit tests: cardValue / handValue / isBlackjack / dealerShouldHit
// - structural: deal invariants, full-hand balance invariants (seeded),
//   blackjack 3:2 payout, double-down, hole-card reveal.
// setTimeout is made SYNCHRONOUS so the paced dealer draws settle instantly.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'blackjack-game.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('✗ could not extract <script>'); process.exit(1); }
const code = m[1];

// ── DOM element factory (supports firstChild/lastChild/appendChild/removeChild) ──
function makeEl(attrs) {
  var e = {
    textContent: '', className: '', disabled: false, style: {},
    _children: [], _attrs: attrs || {},
    appendChild: function (c) { e._children.push(c); return c; },
    removeChild: function (c) { var i = e._children.indexOf(c); if (i >= 0) e._children.splice(i, 1); return c; },
    classList: { add: function () {}, remove: function () {}, toggle: function () {} },
    getAttribute: function (n) { return Object.prototype.hasOwnProperty.call(e._attrs, n) ? e._attrs[n] : ''; },
    setAttribute: function (n, v) { e._attrs[n] = v; },
    addEventListener: function () {}
  };
  Object.defineProperty(e, 'firstChild', { get: function () { return e._children[0] || null; }, enumerable: true });
  Object.defineProperty(e, 'lastChild', { get: function () { return e._children[e._children.length - 1] || null; }, enumerable: true });
  return e;
}

var ids = ['balanceVal','bestVal','dealerTotal','playerTotal','dealerCards','playerCards','playerArea',
  'msg','betVal','betRow','playRow','dealRow','clearBtn','hitBtn','standBtn','doubleBtn','splitBtn',
  'dealBtn','insBtn','declineBtn','insRow','insBadge','overlay','newHandBtn','rebuyBtn','muteBtn','resultText','amountText','resultSub','newHigh','brokeMsg',
  'lbBtn','accName','accLogout','accountModal','boardModal','tabCreate','tabLogin','accNameInput','accPinInput','accGoBtn','accCloseBtn','accErr','accOk','boardBody','boardFoot','boardBorrowBtn','brokeBorrowBtn','boardCloseBtn'];
var elements = {};
ids.forEach(function (id) { elements[id] = makeEl(); });

var chips = ['10','25','100','500'].map(function (v) { return makeEl({ 'data-chip': v }); });

// ── fetch mock: simulates /api/blackjack/leaderboard (wallet + casino loans) ──
var lbStore = {};   // name -> { pin, wallet, debt, borrows }
var LOAN = 2000, LOAN_TOTAL = 2020;
function lbApi(body) {
  var a = body.action;
  function board() {
    var rows = Object.keys(lbStore).map(function (n) { return { name: n, wallet: lbStore[n].wallet, debt: lbStore[n].debt, borrows: lbStore[n].borrows, at: '2026-08-23T00:00:00.000Z' }; });
    rows.sort(function (x, y) { return (y.wallet - x.wallet) || x.name.localeCompare(y.name); });
    return { updated: '2026-08-23T00:00:00.000Z', scores: rows.slice(0, 25) };
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
    lbStore[bn].wallet += LOAN;
    lbStore[bn].debt += LOAN_TOTAL;
    lbStore[bn].borrows += 1;
    return { ok: true, name: bn, wallet: lbStore[bn].wallet, debt: lbStore[bn].debt, borrows: lbStore[bn].borrows, loan: LOAN, interest: 20, board: board() };
  }
  if (a === 'repay') {
    var rn = (body.name || '').trim();
    if (!lbStore[rn]) return { ok: false, error: 'No such account' };
    if (lbStore[rn].pin !== body.pin) return { ok: false, error: 'Wrong PIN' };
    if (lbStore[rn].debt <= 0) return { ok: false, error: 'No debt to repay' };
    var paid = lbStore[rn].debt;
    lbStore[rn].wallet -= paid;
    lbStore[rn].debt = 0;
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
  querySelectorAll: function (sel) { return sel === '.chip' ? chips : []; },
  createElement: function () { return makeEl(); }
};

var sandbox = {
  window: { devicePixelRatio: 1, addEventListener: function () {}, AudioContext: undefined, webkitAudioContext: undefined },
  document: document,
  performance: { now: function () { return Date.now(); } },
  requestAnimationFrame: function (cb) { return 1; },
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  Math: Math, console: console,
  Date: Date,
  fetch: fetchMock,
  // SYNCHRONOUS timeouts so dealer draws + settle run to completion immediately
  setTimeout: function (cb) { try { cb(); } catch (e) { throw e; } return 0; },
  clearTimeout: function () {}
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

var BJ;
try {
  vm.runInContext(code, sandbox, { filename: 'blackjack.js' });
  BJ = sandbox.window.__BJ__;
  console.log('✓ script executed without throwing; __BJ__ handle present:', !!BJ);
} catch (e) {
  console.error('✗ RUNTIME ERROR on load:', e.message, e.stack);
  process.exit(1);
}
if (!BJ) { console.error('✗ __BJ__ handle missing'); process.exit(1); }

// ═══════════════════════════════════════════════════════════════
//  1. UNIT TESTS — pure helpers
// ═══════════════════════════════════════════════════════════════
var A = { rank: 'A', suit: '♠' }, K = { rank: 'K', suit: '♥' }, Q = { rank: 'Q', suit: '♦' },
    J = { rank: 'J', suit: '♣' }, T = { rank: '10', suit: '♠' }, N9 = { rank: '9', suit: '♥' },
    N7 = { rank: '7', suit: '♦' }, N5 = { rank: '5', suit: '♣' }, N6 = { rank: '6', suit: '♠' },
    N2 = { rank: '2', suit: '♥' };

function assert(cond, label) {
  if (cond) { console.log('   ✓', label); }
  else { console.error('   ✗ FAIL:', label); process.exit(1); }
}

console.log('— unit: cardValue —');
assert(BJ._cardValue('A') === 11, 'A = 11');
assert(BJ._cardValue('K') === 10 && BJ._cardValue('Q') === 10 && BJ._cardValue('J') === 10, 'K/Q/J = 10');
assert(BJ._cardValue('7') === 7 && BJ._cardValue('10') === 10, '7 = 7, 10 = 10');

console.log('— unit: handValue —');
assert(BJ._handValue([A, N9]) === 20, 'A,9 = 20');
assert(BJ._handValue([A, K]) === 21, 'A,K = 21');
assert(BJ._handValue([A, A, A]) === 13, 'A,A,A = 13 (ace demotes)');
assert(BJ._handValue([K, Q, J, A]) === 31, 'K,Q,J,A = 31 (bust)');
assert(BJ._handValue([A, A, K, K]) === 22, 'A,A,K,K = 22 (bust)');
assert(BJ._handValue([N5, N6, N7]) === 18, '5,6,7 = 18');

console.log('— unit: isBlackjack —');
assert(BJ._isBlackjack([A, K]) === true, 'A,K → true');
assert(BJ._isBlackjack([N9, K, N2]) === false, '9,K,2 (21, 3 cards) → false');
assert(BJ._isBlackjack([A, N5, N6]) === false, 'A,5,6 → false');
assert(BJ._isBlackjack([N9, N9, N2]) === false, '9,9,2 → false');

console.log('— unit: dealerShouldHit (S17) —');
assert(BJ._dealerShouldHit([T, N6]) === true, '10,6 (16) → hit');
assert(BJ._dealerShouldHit([T, N7]) === false, '10,7 (17) → stand (S17)');
assert(BJ._dealerShouldHit([A, N6]) === false, 'A,6 (17) → stand (S17)');
assert(BJ._dealerShouldHit([N6, N6]) === true, '6,6 (12) → hit');

console.log('— unit: insuranceAmount —');
assert(BJ._insuranceAmount(100) === 50, 'bet 100 → insurance 50');
assert(BJ._insuranceAmount(25) === 12, 'bet 25 → insurance 12 (floor)');
assert(BJ._insuranceAmount(10) === 5, 'bet 10 → insurance 5');
assert(BJ._insuranceAmount(0) === 0, 'bet 0 → insurance 0');

// ═══════════════════════════════════════════════════════════════
//  2. DEAL INVARIANTS
// ═══════════════════════════════════════════════════════════════
console.log('— deal invariants —');
BJ._setSeed(42);
BJ.rebuy();
BJ.newHand();
BJ.addChip(100);
var s0 = BJ.state();
assert(s0.bet === 100, 'bet = 100 after addChip');
assert(s0.balance === 1000, 'balance still 1000 before deal');
BJ.deal();
var s1 = BJ.state();
assert(s1.player.length === 2, 'player has 2 cards after deal (got ' + s1.player.length + ': ' + s1.player.join(' ') + ')');
assert(s1.dealer.length === 2, 'dealer has 2 cards after deal');
assert(s1.balance === 1000, 'balance unchanged by deal (bet not yet settled)');
assert(s1.phase === 'player' || s1.phase === 'insurance' || s1.phase === 'settle', 'phase is player/insurance/settle (got ' + s1.phase + ')');
console.log('   player:', s1.player.join(' '), 'dealer:', s1.dealer.join(' '), 'phase:', s1.phase);

// ═══════════════════════════════════════════════════════════════
//  3. FULL-HAND BALANCE INVARIANTS (seeded, structural)
// ═══════════════════════════════════════════════════════════════
console.log('— full-hand balance invariants (200 seeded hands, insurance declined) —');
var VALID = { 900: true, 1000: true, 1100: true, 1150: true };
var seen = { win: 0, lose: 0, push: 0, blackjack: 0 };
var insOffered = 0, holeRevealed = true;
for (var seed = 1; seed <= 200; seed++) {
  BJ._setSeed(seed);
  BJ.rebuy();      // balance -> 1000
  BJ.newHand();    // phase -> bet, bet -> 0
  BJ.addChip(100); // bet -> 100
  BJ.deal();
  var st = BJ.state();
  if (st.phase === 'insurance') { insOffered++; BJ.decline(); st = BJ.state(); }
  if (st.phase === 'player') BJ.stand(); // triggers synchronous dealer + settle
  st = BJ.state();
  if (st.phase !== 'settle') { console.error('   ✗ hand did not settle (phase=' + st.phase + ') seed=' + seed); process.exit(1); }
  if (st.holeHidden) holeRevealed = false;
  var bal = st.balance;
  if (!VALID[bal]) { console.error('   ✗ invalid balance ' + bal + ' (seed=' + seed + ', player=' + st.player.join(' ') + ' dealer=' + st.dealer.join(' ') + ')'); process.exit(1); }
  var delta = bal - 1000;
  if (delta === 100) seen.win++;
  else if (delta === -100) seen.lose++;
  else if (delta === 0) seen.push++;
  else if (delta === 150) seen.blackjack++;
}
console.log('   outcomes over 200 hands:', JSON.stringify(seen), 'insurance-offered hands=' + insOffered);
assert(seen.win > 0, 'observed at least one win (+100)');
assert(seen.lose > 0, 'observed at least one loss (-100)');
assert(seen.blackjack > 0, 'observed at least one blackjack (+150, 3:2 payout)');
assert(insOffered > 0, 'insurance was offered on at least one hand (dealer Ace)');
assert(holeRevealed, 'dealer hole card revealed after every settle');

// ═══════════════════════════════════════════════════════════════
//  4. DOUBLE-DOWN INVARIANTS
// ═══════════════════════════════════════════════════════════════
console.log('— double-down invariants —');
var DVALID = { 800: true, 1000: true, 1200: true };
var dcount = 0;
for (var dseed = 1; dseed <= 60 && dcount < 8; dseed++) {
  BJ._setSeed(1000 + dseed);
  BJ.rebuy();
  BJ.newHand();
  BJ.addChip(100);
  BJ.deal();
  var ds = BJ.state();
  if (ds.phase === 'player' && ds.player.length === 2) {
    // only double if not already a natural (natural would have settled)
    BJ.double();
    ds = BJ.state();
    if (ds.phase !== 'settle') { console.error('   ✗ double did not settle seed=' + dseed); process.exit(1); }
    if (!DVALID[ds.balance]) { console.error('   ✗ invalid double balance ' + ds.balance + ' seed=' + dseed + ' player=' + ds.player.join(' ')); process.exit(1); }
    dcount++;
  }
}
assert(dcount >= 1, 'exercised double-down at least once (' + dcount + ')');

// ═══════════════════════════════════════════════════════════════
//  5. INSURANCE MECHANICS (find a dealer-Ace / non-natural hand)
// ═══════════════════════════════════════════════════════════════
console.log('— insurance mechanics —');
function setupIns(seed) {
  BJ._setSeed(seed);
  BJ.rebuy();
  BJ.newHand();
  BJ.addChip(100);
  BJ.deal();
  return BJ.state();
}
// find a seed where dealer upcard is Ace and player is NOT a natural → insurance offered
var insSeed = 0;
for (var sc = 1; sc <= 2000 && !insSeed; sc++) {
  var ss = setupIns(sc);
  if (ss.phase === 'insurance' && ss.dealer[0][0] === 'A') insSeed = sc;
}
assert(insSeed > 0, 'found a hand offering insurance (seed ' + insSeed + ')');

// (a) decline → balance unchanged, moves to player
var da = setupIns(insSeed);
assert(da.phase === 'insurance' && da.balance === 1000, 'pre-decision balance 1000');
BJ.decline();
var dd = BJ.state();
assert(dd.phase === 'player' && dd.balance === 1000 && dd.insurance === 0, 'decline → player phase, balance 1000, no insurance');

// (b) take → balance drops by 50, insurance recorded
var tb = setupIns(insSeed);
BJ.insure();
var tt = BJ.state();
assert(tt.phase === 'player' && tt.balance === 950 && tt.insurance === 50, 'take → player phase, balance 950, insurance 50');

// (c) insurance settles correctly at end-of-hand — compute the EXPECTED final
//     balance from the actual hand and assert equality (robust, no fixed set).
function cardsFromStrings(arr) {
  return arr.map(function (s) {
    var rank = s.charAt(0) === '1' ? '10' : s.charAt(0); // '10♠'→'10', 'A♣'→'A'
    return { rank: rank, suit: s.slice(rank.length) };
  });
}
function expectedBalance(bet, ins, p, d) {
  var pBJ = BJ._isBlackjack(p), dBJ = BJ._isBlackjack(d);
  var bal = 1000 - ins;                                  // insurance paid at take
  if (ins > 0 && dBJ) bal += Math.floor(ins * 1.5);      // insurance 2:1
  if (pBJ && dBJ) { /* push */ }
  else if (pBJ) bal += Math.round(bet * 1.5);
  else if (dBJ) bal -= bet;
  else {
    var pv = BJ._handValue(p), dv = BJ._handValue(d);
    if (pv > 21) bal -= bet;
    else if (dv > 21) bal += bet;
    else if (pv > dv) bal += bet;
    else if (pv < dv) bal -= bet;
    /* else push: 0 */
  }
  return bal;
}
var insHands = 0, insTake = 0, insDecl = 0;
for (var ic = 1; ic <= 400 && insHands < 14; ic++) {
  var ist = setupIns(ic);
  if (ist.phase !== 'insurance') continue;
  if ((ic % 2) === 1) { BJ.insure(); insTake++; } else { BJ.decline(); insDecl++; }
  var mid = BJ.state();
  if (mid.phase === 'player') BJ.stand();
  var fin = BJ.state();
  if (fin.phase !== 'settle') { console.error('   ✗ insurance hand did not settle seed=' + ic); process.exit(1); }
  var p = cardsFromStrings(fin.player), d = cardsFromStrings(fin.dealer);
  var exp = expectedBalance(100, fin.insurance, p, d);
  if (fin.balance !== exp) {
    console.error('   ✗ insurance hand seed=' + ic + ' balance=' + fin.balance + ' expected=' + exp + ' player=' + fin.player.join(' ') + ' dealer=' + fin.dealer.join(' ') + ' ins=' + fin.insurance);
    process.exit(1);
  }
  insHands++;
}
assert(insHands >= 2, 'settled ' + insHands + ' insurance-offered hands');
assert(insTake >= 1 && insDecl >= 1, 'exercised both take (' + insTake + ') and decline (' + insDecl + ') insurance branches');

// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//  6. SPLIT MECHANICS
// ═══════════════════════════════════════════════════════════════
console.log('— split mechanics —');

// 6(a) canSplit: only true for a value-pair on a fresh 2-card hand
BJ._setSeed(7);
BJ.rebuy();
BJ.newHand();
BJ.addChip(100);
BJ.deal();
var cs = BJ.state();
if (cs.phase === 'insurance') { BJ.decline(); cs = BJ.state(); }
if (cs.phase === 'player') {
  var c0 = cs.hands[0].cards[0], c1 = cs.hands[0].cards[1];
  var pair = (BJ._cardValue(c0.charAt(0) === '1' ? '10' : c0.charAt(0)) ===
              BJ._cardValue(c1.charAt(0) === '1' ? '10' : c1.charAt(0)));
  assert(BJ.canSplit(0) === pair, 'canSplit(0) matches whether the two cards are a value-pair (pair=' + pair + ')');
}

// 6(b) split a pair: two hands, each own bet, balance drops by one stake,
//      then both hands settle and the final balance is exactly accounted for.
function splitExpectedBalance(hands, dealerCards, balAfterSplit) {
  var dBJ = BJ._isBlackjack(dealerCards);
  var dv = BJ._handValue(dealerCards);
  var bal = balAfterSplit; // split stake(s) already deducted; settle resolves each hand ±bet
  for (var i = 0; i < hands.length; i++) {
    var h = hands[i];
    var pv = BJ._handValue(h.cards);
    var pBJ = false; // split hands never count as a natural blackjack
    if (dBJ) bal -= h.bet;
    else if (pv > 21) bal -= h.bet;
    else if (dv > 21) bal += h.bet;
    else if (pv > dv) bal += h.bet;
    else if (pv < dv) bal -= h.bet;
    /* else push: 0 */
  }
  return bal;
}
var splitHands = 0;
for (var sp = 1; sp <= 1200 && splitHands < 12; sp++) {
  BJ._setSeed(5000 + sp);
  BJ.rebuy();
  BJ.newHand();
  BJ.addChip(100);
  BJ.deal();
  var st = BJ.state();
  if (st.phase === 'insurance') { BJ.decline(); st = BJ.state(); }
  if (st.phase !== 'player') continue;
  if (!BJ.canSplit(0)) continue;
  var balBeforeSplit = st.balance;
  BJ.split();
  var mid = BJ.state();
  if (mid.phase !== 'player' && mid.phase !== 'settle') { console.error('   ✗ split did not enter player/settle phase seed=' + sp + ' phase=' + mid.phase); process.exit(1); }
  if (mid.hands.length !== 2) { console.error('   ✗ split should create 2 hands (got ' + mid.hands.length + ') seed=' + sp); process.exit(1); }
  if (mid.phase === 'player' && mid.balance !== balBeforeSplit - 100) { console.error('   ✗ split should deduct one stake (before=' + balBeforeSplit + ' after=' + mid.balance + ') seed=' + sp); process.exit(1); }
  // stand on each hand in turn until the dealer settles (max 2 hands here)
  for (var stands = 0; stands < 4 && BJ.state().phase === 'player'; stands++) BJ.stand();
  var mid2 = BJ.state();
  if (mid2.phase !== 'settle') { console.error('   ✗ split hands did not settle seed=' + sp + ' phase=' + mid2.phase); process.exit(1); }
  var hands = mid2.hands.map(function (h) { return { cards: cardsFromStrings(h.cards), bet: h.bet }; });
  var d = cardsFromStrings(mid2.dealer);
  var exp = splitExpectedBalance(hands, d, balBeforeSplit - 100);
  if (mid2.balance !== exp) {
    console.error('   ✗ split balance seed=' + sp + ' got=' + mid2.balance + ' expected=' + exp + ' hands=' + JSON.stringify(mid2.hands) + ' dealer=' + mid2.dealer.join(' '));
    process.exit(1);
  }
  splitHands++;
}
assert(splitHands >= 2, 'settled ' + splitHands + ' split hands with exact balance accounting');

// ═══════════════════════════════════════════════════════════════
//  7. RESPLIT ACES (split aces: one card each; A+A may resplit; no hit/double)
// ═══════════════════════════════════════════════════════════════
console.log('— resplit aces —');

// 7(a) split aces that are NOT A+A auto-stand → all hands settle
var autoStand = 0;
for (var rs = 1; rs <= 4000 && autoStand < 6; rs++) {
  BJ._setSeed(7000 + rs);
  BJ.rebuy(); BJ.newHand(); BJ.addChip(100); BJ.deal();
  var st = BJ.state();
  if (st.phase === 'insurance') { BJ.decline(); st = BJ.state(); }
  if (st.phase !== 'player' || !BJ.canSplit(0)) continue;
  if (st.hands[0].cards[0].charAt(0) !== 'A') continue; // must be a pair of aces
  var balBefore = st.balance;
  BJ.split();
  var mid = BJ.state();
  if (mid.hands.length !== 2) { console.error('   ✗ split aces should make 2 hands seed=' + rs); process.exit(1); }
  if (mid.phase === 'player' && mid.balance !== balBefore - 100) { console.error('   ✗ split aces should deduct one stake seed=' + rs + ' bal=' + mid.balance + ' phase=' + mid.phase); process.exit(1); }
  if (!mid.hands[0].splitAce || !mid.hands[1].splitAce) { console.error('   ✗ both split-ace hands should be flagged splitAce seed=' + rs); process.exit(1); }
  // active hand must be A+A (resplit offered) or non-pair (auto-stand)
  var active = mid.hands[mid.activeHand];
  var isPair = (BJ._cardValue(active.cards[0].charAt(0) === '1' ? '10' : active.cards[0].charAt(0)) ===
                BJ._cardValue(active.cards[1].charAt(0) === '1' ? '10' : active.cards[1].charAt(0)));
  if (isPair) continue; // resplit case, covered by 7(b)
  // non-pair split ace → auto-stands; stand the other hand, then settle
  for (var k = 0; k < 4 && BJ.state().phase === 'player'; k++) BJ.stand();
  var fin = BJ.state();
  if (fin.phase !== 'settle') { console.error('   ✗ split-ace auto-stand did not settle seed=' + rs + ' phase=' + fin.phase); process.exit(1); }
  autoStand++;
}
assert(autoStand >= 2, 'split aces (non-A+A) auto-stand and settle (' + autoStand + ')');

// 7(b) split aces that ARE A+A may be resplit into a third hand
var resplitOk = 0;
for (var rs2 = 1; rs2 <= 6000 && resplitOk < 5; rs2++) {
  BJ._setSeed(8000 + rs2);
  BJ.rebuy(); BJ.newHand(); BJ.addChip(100); BJ.deal();
  var st = BJ.state();
  if (st.phase === 'insurance') { BJ.decline(); st = BJ.state(); }
  if (st.phase !== 'player' || !BJ.canSplit(0)) continue;
  if (st.hands[0].cards[0].charAt(0) !== 'A') continue;
  var balBefore = st.balance;
  BJ.split();
  var mid = BJ.state();
  if (mid.phase !== 'player' || !BJ.canSplit(mid.activeHand)) continue; // need an A+A resplit offer
  // resplit the active A+A hand
  var balAfterFirst = mid.balance;
  BJ.split();
  var mid2 = BJ.state();
  if (mid2.hands.length !== 3) { console.error('   ✗ resplit aces should make 3 hands (got ' + mid2.hands.length + ') seed=' + rs2); process.exit(1); }
  if (mid2.phase === 'player' && mid2.balance !== balAfterFirst - 100) { console.error('   ✗ resplit aces should deduct one more stake (before=' + balAfterFirst + ' after=' + mid2.balance + ') seed=' + rs2); process.exit(1); }
  // settle remaining hands
  for (var k2 = 0; k2 < 6 && BJ.state().phase === 'player'; k2++) BJ.stand();
  var fin2 = BJ.state();
  if (fin2.phase !== 'settle') { console.error('   ✗ resplit-ace hand did not settle seed=' + rs2 + ' phase=' + fin2.phase); process.exit(1); }
  var hands = fin2.hands.map(function (h) { return { cards: cardsFromStrings(h.cards), bet: h.bet }; });
  var d = cardsFromStrings(fin2.dealer);
  var exp = splitExpectedBalance(hands, d, balAfterFirst - 100);
  if (fin2.balance !== exp) {
    console.error('   ✗ resplit-ace balance seed=' + rs2 + ' got=' + fin2.balance + ' expected=' + exp + ' hands=' + JSON.stringify(fin2.hands) + ' dealer=' + fin2.dealer.join(' '));
    process.exit(1);
  }
  resplitOk++;
}
assert(resplitOk >= 1, 'split aces (A+A) resplit into 3 hands with exact balance (' + resplitOk + ')');

// 7(c) split-ace hands cannot hit or double (one card each).
//     A split-ace hand that sits in 'player' phase is by definition A+A
//     (non-pair split aces auto-stand); on that hand hit/double must be no-ops.
var blocked = 0;
for (var rs3 = 1; rs3 <= 6000 && blocked < 4; rs3++) {
  BJ._setSeed(9000 + rs3);
  BJ.rebuy(); BJ.newHand(); BJ.addChip(100); BJ.deal();
  var st = BJ.state();
  if (st.phase === 'insurance') { BJ.decline(); st = BJ.state(); }
  if (st.phase !== 'player' || !BJ.canSplit(0)) continue;
  if (st.hands[0].cards[0].charAt(0) !== 'A') continue;
  BJ.split();
  var mid = BJ.state();
  if (mid.phase !== 'player') continue; // non-pair split ace auto-stood; need the A+A case
  var active = mid.hands[mid.activeHand];
  if (!active.splitAce) continue;
  // active split-ace hand in player phase must be A+A (resplit offered)
  var v0 = BJ._cardValue(active.cards[0].charAt(0) === '1' ? '10' : active.cards[0].charAt(0));
  var v1 = BJ._cardValue(active.cards[1].charAt(0) === '1' ? '10' : active.cards[1].charAt(0));
  if (v0 !== v1 || v0 !== 11) { console.error('   ✗ expected A+A split-ace hand in player phase seed=' + rs3); process.exit(1); }
  // hit must be a no-op on a split-ace hand
  var cardsBefore = active.cards.length;
  var balBeforeHit = mid.balance;
  BJ.hit();
  var afterHit = BJ.state();
  if (afterHit.hands[afterHit.activeHand].cards.length !== cardsBefore) { console.error('   ✗ hit should be blocked on split-ace hand seed=' + rs3); process.exit(1); }
  if (afterHit.balance !== balBeforeHit) { console.error('   ✗ hit should not change balance on split-ace hand seed=' + rs3); process.exit(1); }
  // double must be a no-op on a split-ace hand
  BJ.double();
  var afterDbl = BJ.state();
  if (afterDbl.hands[afterDbl.activeHand].doubled) { console.error('   ✗ double should be blocked on split-ace hand seed=' + rs3); process.exit(1); }
  if (afterDbl.balance !== balBeforeHit) { console.error('   ✗ double should not change balance on split-ace hand seed=' + rs3); process.exit(1); }
  // stand still works → progresses (resplit offer remains or hand advances)
  BJ.stand();
  blocked++;
}
assert(blocked >= 1, 'split-ace (A+A) hands block hit + double but allow stand (' + blocked + ')');

// ═════════════════════════════════════════════════════════════════════
//  8. LEADERBOARD — PIN accounts with a wallet + casino loans
// ═════════════════════════════════════════════════════════════════════
console.log('— leaderboard wallet + casino loans —');
function runLB() {
  return Promise.resolve()
    .then(function () { return BJ._lbCreate('Rex', '1234'); })
    .then(function (r) {
      assert(r.ok === true && r.name === 'Rex', 'create account "Rex" succeeds');
      assert(r.wallet === 1000 && r.debt === 0 && r.borrows === 0, 'new account starts with $1000, no debt, 0 loans');
      return BJ._lbCreate('Rex', '9999').then(function (d) {
        assert(d.ok === false, 'duplicate name rejected (resolved)');
      }, function (e) {
        assert(/taken/i.test(e.message), 'duplicate name rejected (' + e.message + ')');
      });
    })
    .then(function () {
      return BJ._lbLogin('Rex', '0000').then(function (d) {
        assert(d.ok === false, 'login with wrong PIN rejected (resolved)');
      }, function (e) {
        assert(/wrong pin/i.test(e.message), 'login with wrong PIN rejected (' + e.message + ')');
      });
    })
    .then(function () { return BJ._lbLogin('Rex', '1234'); })
    .then(function (r) {
      assert(r.ok === true && r.name === 'Rex', 'login with correct PIN succeeds');
      assert(BJ._lbSession() && BJ._lbSession().name === 'Rex', 'session holds account name + PIN');
      assert(BJ._lbSession().wallet === 1000, 'session wallet matches account ($1000)');
      // A losing hand: wallet drops below the start (can go negative).
      return BJ._lbScore(-250);
    })
    .then(function (r) {
      assert(r.ok === true && r.wallet === -250, 'losing hand sets a NEGATIVE wallet (-250)');
      // Recover by borrowing $2000 (1% interest -> debt 2020).
      return BJ._lbBorrow();
    })
    .then(function (r) {
      assert(r.ok === true && r.wallet === 1750, 'borrow: wallet -250 + 2000 = 1750');
      assert(r.debt === 2020 && r.borrows === 1, 'borrow: debt 2020 (1% interest), 1 loan recorded');
      assert(BJ._lbSession().wallet === 1750 && BJ._lbSession().borrows === 1, 'session updated after borrow');
      // Unlimited borrowing: a second loan is allowed.
      return BJ._lbBorrow();
    })
    .then(function (r) {
      assert(r.wallet === 3750 && r.borrows === 2 && r.debt === 4040, 'second borrow allowed (unlimited): wallet 3750, 2 loans, debt 4040');
      return BJ._lbBoard();
    })
    .then(function (r) {
      assert(Array.isArray(r.scores) && r.scores.length >= 1, 'board returns at least the created account');
      var top = r.scores[0];
      assert(top.name === 'Rex' && top.wallet === 3750 && top.debt === 4040 && top.borrows === 2, 'board top row is Rex @ wallet 3750 / debt 4040 / 2 loans');
      BJ._lbRender(r);
      var html = elements['boardBody'].innerHTML;
      assert(html.indexOf('Rex') !== -1, 'board render writes the name into the DOM');
      assert(html.indexOf('Wallet') !== -1 && html.indexOf('Debt') !== -1 && html.indexOf('Loans') !== -1, 'board render shows Wallet / Debt / Loans columns');
      // ── REPAY: pay back the full outstanding debt (4040). Wallet drops by the same amount, debt -> 0.
      return BJ._lbRepay();
    })
    .then(function (r) {
      assert(r.ok === true && r.repaid === 4040, 'repay: repaid 4040 (full debt)');
      assert(r.wallet === 3750 - 4040 && r.debt === 0, 'repay: wallet 3750-4040 = -290, debt cleared to 0');
      assert(BJ._lbSession().debt === 0 && BJ._lbSession().wallet === -290, 'session updated after repay');
      // Repay with no debt must be rejected.
      return BJ._lbRepay().then(function (r) { assert(r.ok === false, 'repay with no debt is rejected'); return { ok: true }; },
        function (e) { assert(/debt|repay/i.test(e.message), 'repay-no-debt error message mentions debt'); return { ok: true }; });
    })
    .then(function () {
      // ── DELETE: wrong PIN must be rejected first (account still exists).
      return fetchMock('/api/blackjack/leaderboard', { body: JSON.stringify({ action: 'delete', name: 'Rex', pin: '9999' }) })
        .then(function (res) { return res.json ? res.json() : res; })
        .then(function (r) { assert(r.ok === false, 'delete with wrong PIN rejected'); });
    })
    .then(function () {
      // Then remove the account entirely (correct PIN).
      return BJ._lbLogout();
    })
    .then(function () {
      assert(BJ._lbSession() === null, 'logout clears the session');
      return fetchMock('/api/blackjack/leaderboard', { body: JSON.stringify({ action: 'delete', name: 'Rex', pin: '1234' }) })
        .then(function (res) { return res.json ? res.json() : res; });
    })
    .then(function (r) {
      assert(r.ok === true && r.deleted === true, 'delete: account removed');
      return fetchMock('/api/blackjack/leaderboard', { body: JSON.stringify({ action: 'board' }) })
        .then(function (res) { return res.json ? res.json() : res; });
    })
    .then(function (b) {
      var names = (b.scores || []).map(function (x) { return x.name; });
      assert(names.indexOf('Rex') === -1, 'board no longer lists the deleted account');
    });
}
return runLB().then(function () {
  console.log('ALL CHECKS PASSED');
});
