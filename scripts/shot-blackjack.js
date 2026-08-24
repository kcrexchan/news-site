const puppeteer = require('puppeteer-core');
const path = 'C:/Users/kcrex/news-site/public/blackjack-game.html';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  async function shoot(name, w, h) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
    await page.goto('file:///' + path, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 400));

    // measure key layout metrics
    const metrics = await page.evaluate(() => {
      const g = id => document.getElementById(id);
      const rect = el => el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height), right: Math.round(el.getBoundingClientRect().right) } : null;
      const docW = document.documentElement.clientWidth;
      const hud = rect(g('hud'));
      const controls = rect(g('controls'));
      const table = rect(g('table'));
      const betRow = rect(g('betRow'));
      const playRow = rect(g('playRow'));
      return { docW, hud, controls, table, betRow, playRow,
               bodyOverflowX: document.documentElement.scrollWidth > docW };
    });
    await page.screenshot({ path: 'C:/Users/kcrex/news-site/scripts/' + name + '.png', fullPage: false });
    console.log('== ' + name + ' (' + w + 'x' + h + ') ==');
    console.log(JSON.stringify(metrics, null, 0));
    if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
    await page.close();
  }

  await shoot('bj-phone', 390, 844);   // iPhone 13/14
  await shoot('bj-phone-landscape', 844, 390);
  await shoot('bj-desktop', 1280, 800);

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
