const puppeteer = require('puppeteer-core');
const path = 'C:/Users/kcrex/news-site/public/blackjack-game.html';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await page.goto('file:///' + path, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 300));

  // Place a bet + deal to get a live hand with cards on the table
  await page.click('.chip.c100');
  await page.click('#dealBtn');
  await new Promise(r => setTimeout(r, 900));

  const m = await page.evaluate(() => {
    const docW = document.documentElement.clientWidth;
    const cards = Array.from(document.querySelectorAll('.card')).map(c => {
      const r = c.getBoundingClientRect();
      return { w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right) };
    });
    const dealer = document.querySelector('.hand.dealer .cards').getBoundingClientRect();
    const playerArea = document.getElementById('playerArea').getBoundingClientRect();
    const overflow = document.documentElement.scrollWidth > docW;
    const maxRight = cards.length ? Math.max(...cards.map(c => c.right)) : 0;
    const minLeft = cards.length ? Math.min(...cards.map(c => c.left)) : 0;
    return { docW, overflow, cardCount: cards.length, minLeft, maxRight,
             dealerW: Math.round(dealer.width), playerW: Math.round(playerArea.width) };
  });
  await page.screenshot({ path: 'C:/Users/kcrex/news-site/scripts/bj-phone-hand.png' });
  console.log(JSON.stringify(m, null, 2));
  if (errs.length) console.log(errs.join('\n'));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
