// Takes the README images: assets/preview.png (button and popup) and assets/generator.png.
//   npm run screenshots          (CHROMIUM_PATH=/path/to/chrome to use an existing Chromium)
'use strict';

const fs = require('fs');
const path = require('path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require('playwright-core'));
}

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets');

// A made-up shop, drawn with CSS only.
const SITE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sample shop</title><style>
  *{box-sizing:border-box}
  body{margin:0;font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1c1917;background:#faf7f2}
  header{display:flex;align-items:center;gap:28px;padding:22px 48px}
  .logo{font-weight:800;font-size:20px;letter-spacing:-.02em}
  nav{display:flex;gap:24px;color:#57534e;font-size:15px}
  .cart{margin-left:auto;padding:8px 16px;border:1px solid #d6d3d1;border-radius:99px;font-size:14px}
  main{display:grid;grid-template-columns:1.05fr 1fr;gap:40px;align-items:center;padding:28px 48px 0}
  h1{margin:0 0 14px;font-size:46px;line-height:1.08;letter-spacing:-.03em}
  p{margin:0 0 22px;color:#57534e;font-size:18px;max-width:440px}
  .cta{display:inline-block;padding:13px 22px;border-radius:12px;background:#1c1917;color:#fff;font-weight:600}
  .art{height:340px;border-radius:24px;background:radial-gradient(circle at 30% 35%,#f3d9b1 0 18%,transparent 19%),radial-gradient(circle at 68% 62%,#c9b8a6 0 22%,transparent 23%),linear-gradient(135deg,#e7ded2,#d8c8b6)}
  .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;padding:36px 48px}
  .card{height:120px;border-radius:18px;background:#efe8de}
</style></head><body>
<header><span class="logo">Clay &amp; Co.</span><nav><span>Shop</span><span>Workshops</span><span>About</span></nav><span class="cart">Cart (0)</span></header>
<main><div><h1>Handmade ceramics for every day</h1><p>Small-batch cups, plates and vases, glazed by hand in our studio.</p><span class="cta">Shop the collection</span></div><div class="art"></div></main>
<div class="cards"><div class="card"></div><div class="card"></div><div class="card"></div></div>
<script src="/dist/whatsapp-chat-button.min.js"
  data-phone="+1 555 123 4567"
  data-message="Hi! I have a question."
  data-label="Chat with us"
  data-name="Clay &amp; Co. studio"
  data-subtitle="Typically replies within an hour"
  data-greeting="Hi there 👋&#10;Questions about an order or a workshop? We're happy to help."
  defer></script>
</body></html>`;

async function serve(route) {
  const url = new URL(route.request().url());
  if (url.origin !== 'https://site.test') return route.abort();
  if (url.pathname === '/shop') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: SITE });
  return route.fulfill({ path: path.join(ROOT, decodeURIComponent(url.pathname)) });
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const context = await browser.newContext({ viewport: { width: 1100, height: 660 }, deviceScaleFactor: 2 });
  await context.route('**/*', serve);
  const page = await context.newPage();

  await page.goto('https://site.test/shop');
  await page.waitForSelector('whatsapp-chat-button .w.v', { state: 'attached' });
  await page.locator('whatsapp-chat-button .b').click();
  await page.mouse.move(600, 300);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'preview.png') });

  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('https://site.test/index.html');
  await page.fill('#label', 'Chat with us');
  await page.evaluate(() => { document.activeElement.blur(); scrollTo(0, 0); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'generator.png') });

  await browser.close();
  for (const f of ['preview.png', 'generator.png']) console.log('assets/' + f + ': ' + fs.statSync(path.join(OUT, f)).size + ' B');
})();
