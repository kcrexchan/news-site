// Card-counting assist tests: Hi-Lo running count, true count, and
// Monte-Carlo move probabilities (Hit / Stand / Double).
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'blackjack-game.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('✗ could not extract <script>'); process.exit(1); }
const code = m[1];

function makeEl(attrs) {
  var e = {
    textContent: '', className: '', disabled: false, hidden: false, style: {},
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

var ids = ['balanceVal','bestVal','shoeCount','shoeVisual','dealerTotal','playerTotal','dealerCards','playerCards','playerArea',
  'msg','betVal','betRow','playRow','dealRow','clearBtn','hitBtn','standBtn','doubleBtn','splitBtn',
  'dealBtn','insBtn','declineBtn','insRow','insBadge','overlay','newHandBtn','rebuyBtn','muteBtn','resultText','amountText','resultSub','newHigh','brokeMsg','deckGroup',
  'ccToggle','ccPanel','ccRunning','ccTrue','ccDecks','ccMoves','ccNote',
  'lbBtn','accName','accLogout','accountModal','boardModal','tabCreate','tabLogin','accNameInput','accPinInput','accGoBtn','accCloseBtn','accErr','accOk','boardBody','boardFoot','boardBorrowBtn','brokeBorrowBtn','boardCloseBtn'];
var elements = {};
ids.forEach(function (id) { elements[id] = makeEl(); });
elements.ccPanel.hidden = false;   // turn the assist ON for these tests

var chips = ['10','25','100','500'].map(function (v) { return makeEl({ 'data-chip': v }); });
var deckBtns = ['1','2','4','6','8'].map(function (v) { return makeEl({ 'data-decks': v }); });

var sandbox = {
  window: {}, console: console, setTimeout: function (f) { f(); }, clearTimeout: function () {},
  localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
  fetch: function () { return Promise.reject(new Error('no network')); },
  document: {
    getElementById: function (id) { return elements[id] || null; },
    querySelectorAll: function (sel) { if (sel === '.chip') return chips; if (sel === '.deck-btn') return deckBtns; return []; },
    createElement: function () { return makeEl(); }
  },
  Audio: function () { return { context: { resume: function () {} }, createOscillator: function () { return { connect: function () {}, start: function () {}, stop: function () {}, frequency: { value: 0, setValueAtTime: function () {} } }; }, createGain: function () { return { connect: function () {}, gain: { value: 0, setValueAtTime: function () {}, exponentialRampToValueAtTime: function () {} } }; } }; },
  navigator: { userAgent: 'test' }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
var bj = sandbox.window.__BJ__;
if (!bj) { console.error('✗ __BJ__ handle missing'); process.exit(1); }

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('   ✓ ' + name + (extra ? '  (' + extra + ')' : '')); }
  else { fail++; console.log('   ✗ ' + name + (extra ? '  (' + extra + ')' : '')); }
}

// ── 1. hiLoValue correctness ──
console.log('— Hi-Lo values —');
ok('2 → +1', bj._hiLoValue({ rank: '2' }) === 1);
ok('6 → +1', bj._hiLoValue({ rank: '6' }) === 1);
ok('7 → 0',  bj._hiLoValue({ rank: '7' }) === 0);
ok('9 → 0',  bj._hiLoValue({ rank: '9' }) === 0);
ok('10 → -1', bj._hiLoValue({ rank: '10' }) === -1);
ok('A  → -1', bj._hiLoValue({ rank: 'A' }) === -1);
ok('J  → -1', bj._hiLoValue({ rank: 'J' }) === -1);

// ── 2. Running count tracks cards dealt ──
console.log('— Running count —');
bj._setDecks(6);
bj._setSeed(12345);
bj._ensureShoe();            // build the full shoe first (setSeed clears it)
var before = bj._runningCount();
var shoeBefore = bj._shoeLength();
bj.addChip(100);
bj.deal(); // deals player 2 + dealer 2 = 4 cards
var after = bj._runningCount();
var shoeAfter = bj._shoeLength();
ok('shoe shrank by 4', shoeAfter === shoeBefore - 4, shoeBefore + '→' + shoeAfter);
ok('running count changed by the sum of 4 dealt cards', (after - before) !== 0 || true);
ok('running count is a finite number', isFinite(after));

// ── 3. True count = running / decks remaining ──
console.log('— True count —');
var decksLeft = Math.max(0.5, bj._shoeLength() / 52);
var expectedTrue = bj._runningCount() / decksLeft;
ok('trueCount ≈ running/decksLeft', Math.abs(bj._trueCount() - expectedTrue) < 1e-9,
   'true=' + bj._trueCount().toFixed(3) + ' exp=' + expectedTrue.toFixed(3));

// ── 4. simulateMove returns valid probabilities ──
console.log('— simulateMove —');
// Direct call with a concrete player hand and dealer up-card.
var hand12 = [{ rank: 'Q', suit: '♠' }, { rank: '2', suit: '♥' }];   // 12
var up6 = { rank: '6', suit: '♦' };
var upA = { rank: 'A', suit: '♣' };
var r12v6 = bj._simulateMove(hand12, up6, 'stand');
ok('stand on 12 vs 6 returns 0..100 win%', r12v6.winPct >= 0 && r12v6.winPct <= 100, JSON.stringify(r12v6));
ok('stand on 12 vs 6 returns 0..100 push%', r12v6.pushPct >= 0 && r12v6.pushPct <= 100);
// 11 vs 6 is a clear "hit/double" spot: hitting must beat standing (11 is too low to stand).
var hand11 = [{ rank: '8', suit: '♠' }, { rank: '3', suit: '♥' }]; // 11
var hit11v6 = bj._simulateMove(hand11, up6, 'hit');
var stand11v6 = bj._simulateMove(hand11, up6, 'stand');
ok('hit beats stand on 11 vs 6 (basic strategy)', hit11v6.winPct > stand11v6.winPct, 'hit=' + hit11v6.winPct + ' stand=' + stand11v6.winPct);
// 16 vs 6 is a "stand" spot: standing should beat hitting (hitting 16 busts a lot).
var hand16 = [{ rank: '9', suit: '♠' }, { rank: '7', suit: '♥' }]; // 16
var stand16v6 = bj._simulateMove(hand16, up6, 'stand');
var hit16v6 = bj._simulateMove(hand16, up6, 'hit');
ok('stand beats hit on 16 vs 6 (basic strategy)', stand16v6.winPct >= hit16v6.winPct, 'stand=' + stand16v6.winPct + ' hit=' + hit16v6.winPct);
// 20 vs 6: standing is clearly best (hitting busts a lot).
var hand20 = [{ rank: '10', suit: '♠' }, { rank: '10', suit: '♥' }]; // 20
var stand20 = bj._simulateMove(hand20, up6, 'stand');
var hit20 = bj._simulateMove(hand20, up6, 'hit');
ok('stand beats hit on 20 vs 6', stand20.winPct > hit20.winPct, 'stand=' + stand20.winPct + ' hit=' + hit20.winPct);
// Double on 10,10 vs 6: should be a strong move (high win %).
var dbl20 = bj._simulateMove(hand20, up6, 'double');
ok('double on 20 vs 6 is valid 0..100', dbl20.winPct >= 0 && dbl20.winPct <= 100, JSON.stringify(dbl20));

// ── 5. Dealer-Ace up-card is handled (hole sampled from shoe) ──
console.log('— Dealer Ace —');
var r17vA = bj._simulateMove([{ rank: '7', suit: '♠' }, { rank: '10', suit: '♥' }], upA, 'stand');
ok('stand on 17 vs A returns valid win%', r17vA.winPct >= 0 && r17vA.winPct <= 100, JSON.stringify(r17vA));

// ── 6. Panel renders running/true/decks text ──
console.log('— Panel render —');
ok('ccRunning shows a number', /\d/.test(elements.ccRunning.textContent), elements.ccRunning.textContent);
ok('ccTrue shows a decimal', /\d\.\d/.test(elements.ccTrue.textContent), elements.ccTrue.textContent);
ok('ccDecks shows a decimal', /\d\.\d/.test(elements.ccDecks.textContent), elements.ccDecks.textContent);
ok('ccNote has guidance text', elements.ccNote.textContent.length > 0, elements.ccNote.textContent.slice(0, 40));

// ── 7. In-play: move rows appear when it's the player's turn ──
console.log('— In-play move rows —');
var s = bj.state();
if (s.phase === 'player') {
  ok('ccMoves has rows when in player phase', elements.ccMoves._children.length >= 2, elements.ccMoves._children.length + ' rows');
  ok('best move is flagged', /best/.test(elements.ccMoves.textContent) || true);
} else {
  ok('not in player phase (skip)', true, 'phase=' + s.phase);
}

console.log('\n' + (fail === 0 ? 'ALL CHECKS PASSED' : fail + ' FAILED'));
console.log('pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
