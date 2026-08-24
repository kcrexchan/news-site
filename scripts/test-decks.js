const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync('public/blackjack-game.html', 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

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
  return e;
}
var ids = ['balanceVal','bestVal','shoeCount','shoeVisual','dealerTotal','playerTotal','dealerCards','playerCards','playerArea',
  'msg','betVal','betRow','playRow','dealRow','clearBtn','hitBtn','standBtn','doubleBtn','splitBtn',
  'dealBtn','insBtn','declineBtn','insRow','insBadge','overlay','newHandBtn','rebuyBtn','muteBtn','resultText','amountText','resultSub','newHigh','brokeMsg','deckGroup',
  'lbBtn','accName','accLogout','accountModal','boardModal','tabCreate','tabLogin','accNameInput','accPinInput','accGoBtn','accCloseBtn','accErr','accOk','boardBody','boardFoot','boardBorrowBtn','brokeBorrowBtn','boardCloseBtn'];
var elements = {};
ids.forEach(function (id) { elements[id] = makeEl(); });
var chips = ['10','25','100','500'].map(function (v) { return makeEl({ 'data-chip': v }); });
var deckBtns = ['1','2','4','6','8'].map(function (v) { return makeEl({ 'data-decks': v }); });
var document = {
  getElementById: function (id) { return elements[id] || null; },
  querySelectorAll: function (sel) { if (sel === '.chip') return chips; if (sel === '.deck-btn') return deckBtns; return []; },
  createElement: function () { return makeEl(); }
};
var sandbox = {
  window: { devicePixelRatio: 1, addEventListener: function () {}, AudioContext: undefined, webkitAudioContext: undefined },
  document: document,
  performance: { now: function () { return Date.now(); } },
  requestAnimationFrame: function (cb) { return 1; },
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  Math: Math, console: console, Date: Date,
  setTimeout: function (fn) { fn(); return 1; },
  clearTimeout: function () {},
  fetch: function () { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } }); },
  Promise: Promise
};
sandbox.window.__BJ__ = null;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
var bj = sandbox.window.__BJ__;

var pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name); }
}
function decks() { return bj.state().decks; }

console.log('=== Deck count feature ===');

// default is 6 decks
check('default deck count is 6', decks() === 6);
check('default shoe length = 312', bj._shoeLength() === 312);

// switch to 1 deck
bj._setDecks(1);
check('after setDeckCount(1): decks=1', decks() === 1);
check('after setDeckCount(1): shoe=52', bj._shoeLength() === 52);

// switch to 8 decks
bj._setDecks(8);
check('after setDeckCount(8): decks=8', decks() === 8);
check('after setDeckCount(8): shoe=416', bj._shoeLength() === 416);

// switch back to 2 decks
bj._setDecks(2);
check('after setDeckCount(2): decks=2', decks() === 2);
check('after setDeckCount(2): shoe=104', bj._shoeLength() === 104);

// invalid values should be ignored
bj._setDecks(3);
check('setDeckCount(3) ignored (not in [1,2,4,6,8])', decks() === 2);
bj._setDecks(0);
check('setDeckCount(0) ignored', decks() === 2);
bj._setDecks(100);
check('setDeckCount(100) ignored', decks() === 2);

// same value is a no-op
bj._setDecks(2);
check('setDeckCount(2) when already 2: no-op', decks() === 2);

// shoe still runs down correctly with 1 deck
bj._setDecks(1);
bj._setSeed(42);
bj.newHand();
bj.addChip(10);
bj.deal();
var afterDeal = bj._shoeLength();
check('1-deck shoe after deal: 52 -> ' + afterDeal, afterDeal === 48); // 4 cards dealt

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
