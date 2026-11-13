// Browser tests for the script, the HTML-only version, the README code and the generator.
//
//   npm install
//   npx playwright install chromium
//   npm test
//
// To use a Chromium you already have: CHROMIUM_PATH=/path/to/chrome npm test
// Other engines: npx playwright install firefox webkit, then BROWSER=firefox npm test (or webkit).
// One test: npm test -- "greeting popup"
//
// Every page is served by the test itself (https://site.test/...). The jsDelivr URL is
// answered with the local dist/ file, wa.me with a stub page, and every other request is
// blocked, so the tests run offline and catch any request the script would make.
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  playwright = require('playwright-core');
}
const ENGINE = process.env.BROWSER || 'chromium';
// Safari leaves links out of the Tab order unless the user turns on "Press Tab to
// highlight each item"; buttons are still in it. Playwright's WebKit does the same on
// macOS and Windows but not on Linux, so the run asks the browser (tabsToLinks below).
let TABS_TO_LINKS = true;

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://site.test';
const CDN = 'https://cdn.jsdelivr.net/gh/Replyze/whatsapp-chat-button@1/dist/whatsapp-chat-button.min.js';
const HOST = 'whatsapp-chat-button';

// ---------------------------------------------------------------------------
// Harness

const pages = new Map();
let pageCount = 0;
let browser;
let contexts = [];

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '&#10;');
const tag = (attrs) => '<script src="' + CDN + '" ' + Object.entries(attrs).map(([k, v]) => 'data-' + k + '="' + escAttr(v) + '"').join(' ') + ' defer></script>';
const doc = (body, { head = '', title = 'Test page' } = {}) =>
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + title + '</title>' + head + '</head><body>' + body + '</body></html>';
const wa = (digits, message) => 'https://wa.me/' + digits + (message ? '?text=' + encodeURIComponent(message) : '');

async function serve(route) {
  const url = new URL(route.request().url());
  if (url.href.startsWith('https://cdn.jsdelivr.net/gh/Replyze/whatsapp-chat-button@')) {
    const rel = url.pathname.split('/').slice(4).join('/');
    // jsDelivr sends CORS headers, which <script crossorigin integrity> needs.
    return route.fulfill({ path: path.join(ROOT, rel), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  if (url.origin === ORIGIN) {
    const page = pages.get(url.pathname);
    if (page) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: page.headers || {}, body: page.html });
    const file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ path: file });
    return route.fulfill({ status: 404, body: 'Not found' });
  }
  if (url.host === 'wa.me') return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>wa.me stub</title>' });
  return route.abort();
}

async function load(html, opts = {}) {
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 1280, height: 800 },
    isMobile: !!opts.mobile,
    hasTouch: !!opts.mobile,
    reducedMotion: opts.reducedMotion || 'no-preference',
    forcedColors: opts.forcedColors || 'none',
  });
  contexts.push(context);
  await context.route('**/*', serve);
  const page = await context.newPage();
  const log = { errors: [], warnings: [], requests: [] };
  page.on('console', (m) => {
    if (m.type() === 'error') log.errors.push(m.text());
    else if (m.type() === 'warning' && !m.text().includes('chrome://juggler/')) log.warnings.push(m.text()); // Playwright's own Firefox driver
  });
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
  page.on('request', (r) => log.requests.push(r.url()));
  page.on('dialog', (d) => {
    log.errors.push('dialog: ' + d.message());
    d.dismiss();
  });
  let url = opts.url;
  if (!url) {
    url = ORIGIN + '/page-' + ++pageCount;
    pages.set(new URL(url).pathname, { html, headers: opts.headers });
  }
  await page.goto(url);
  return { page, context, log };
}

// The button is in place and its fade-in has finished.
async function settle(page) {
  await page.waitForSelector(HOST + ' .w.v', { state: 'attached', timeout: 5000 });
  await page.waitForTimeout(400);
  // On a cold or busy machine the fade-in can outlast the wait: let it finish.
  await page.evaluate(() => {
    const wrap = document.querySelector('whatsapp-chat-button').shadowRoot.querySelector('.w');
    return Promise.all(wrap.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})));
  });
}

const inShadow = (page, fn, arg) =>
  page.evaluate(([src, a]) => {
    const root = document.querySelector('whatsapp-chat-button').shadowRoot;
    return new Function('root', 'arg', 'return (' + src + ')(root, arg)')(root, a);
  }, [fn.toString(), arg]);

const focused = (page) =>
  page.evaluate(() => {
    const host = document.querySelector('whatsapp-chat-button');
    const inner = host && host.shadowRoot.activeElement;
    if (document.activeElement === host && inner) return inner.className;
    const a = document.activeElement;
    return a ? a.id || a.tagName.toLowerCase() : null;
  });

const styleOf = (page, selector, prop) => inShadow(page, (root, [s, p]) => getComputedStyle(root.querySelector(s))[p], [selector, prop]);

function clean(log, expectedWarnings = []) {
  if (log.errors.length) console.log('      errors: ' + JSON.stringify(log.errors));
  assert.deepEqual(log.errors, [], 'console errors');
  assert.equal(log.warnings.length, expectedWarnings.length, 'console warnings: ' + JSON.stringify(log.warnings));
  expectedWarnings.forEach((w, i) => assert.match(log.warnings[i], w));
}

async function tabsToLinks() {
  const { page } = await load(doc('<button id="first">First</button><a id="link" href="#top">Link</a>'));
  await page.focus('#first');
  await page.keyboard.press('Tab');
  return page.evaluate(() => document.activeElement.id === 'link');
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ---------------------------------------------------------------------------
// The script

test('renders one button that links to wa.me, with no requests of its own', async () => {
  const { page, log } = await load(doc(tag({ phone: '+1 (555) 123-4567', message: 'Hello 👋 & welcome #1' })));
  await settle(page);
  assert.equal(await page.locator(HOST).count(), 1);
  const a = page.locator(HOST + ' .b');
  assert.equal(await a.evaluate((e) => e.tagName), 'A');
  const href = await a.getAttribute('href');
  assert.equal(href, 'https://wa.me/15551234567?text=Hello%20%F0%9F%91%8B%20%26%20welcome%20%231');
  assert.equal(new URL(href).searchParams.get('text'), 'Hello 👋 & welcome #1');
  assert.equal(await a.getAttribute('target'), '_blank');
  assert.equal(await a.getAttribute('rel'), 'noopener');
  assert.equal(await a.getAttribute('aria-label'), 'Chat on WhatsApp');
  const box = await page.locator(HOST + ' .i').boundingBox();
  assert.deepEqual([box.width, box.height, box.x + box.width, box.y + box.height], [56, 56, 1260, 780]);
  assert.equal(await styleOf(page, '.i', 'backgroundColor'), 'rgb(37, 211, 102)');
  assert.equal(await styleOf(page, '.w', 'position'), 'fixed');
  assert.equal(await styleOf(page, '.w', 'zIndex'), '9999');
  assert.deepEqual(log.requests.filter((u) => !u.startsWith(ORIGIN + '/page-')), [CDN], 'only the script itself is requested');
  const storage = await page.evaluate(() => [document.cookie, localStorage.length, sessionStorage.length]);
  assert.deepEqual(storage, ['', 0, 0], 'no cookies, no storage');
  clean(log);
});

test('phone numbers in any format become digits; messages are URL-encoded exactly', async () => {
  const { page, log } = await load(doc(tag({ phone: '+1 555 123 4567' })));
  await settle(page);
  const phones = [
    ['+1 (555) 123-4567', '15551234567'],
    ['+44 (0)20 7946 0958', '442079460958'],
    ['0044 20 7946 0958', '442079460958'],
    ['+49 151-2345 6789', '4915123456789'],
    ['+55 11 91234-5678', '5511912345678'],
    ['+91 98765 43210', '919876543210'],
    ['+381 64 123 4567', '381641234567'],
    ['15551234567', '15551234567'],
  ];
  for (const [input, digits] of phones) {
    const href = await page.evaluate((p) => {
      WhatsAppChatButton.init({ phone: p });
      return document.querySelector('whatsapp-chat-button').shadowRoot.querySelector('.b').getAttribute('href');
    }, input);
    assert.equal(href, 'https://wa.me/' + digits, input);
  }
  const messages = [
    ['Hello 👋 & welcome #1', 'Hello%20%F0%9F%91%8B%20%26%20welcome%20%231'],
    ['100% sure? a+b=c / "quotes" <tag>', '100%25%20sure%3F%20a%2Bb%3Dc%20%2F%20%22quotes%22%20%3Ctag%3E'],
    ['Line 1\nLine 2', 'Line%201%0ALine%202'],
    ['¿Qué tal? Привет 你好 🇧🇷', encodeURIComponent('¿Qué tal? Привет 你好 🇧🇷')],
  ];
  for (const [message, encoded] of messages) {
    const href = await page.evaluate((m) => {
      WhatsAppChatButton.init({ phone: '15551234567', message: m });
      return document.querySelector('whatsapp-chat-button').shadowRoot.querySelector('.b').getAttribute('href');
    }, message);
    assert.equal(href, 'https://wa.me/15551234567?text=' + encoded, JSON.stringify(message));
    assert.equal(new URL(href).searchParams.get('text'), message);
  }
  assert.equal(await page.locator(HOST).count(), 1, 'init() replaces the button');
  clean(log);
});

test('a newline in a data- attribute (&#10;) reaches the message', async () => {
  const { page, log } = await load(doc(tag({ phone: '15551234567', message: 'Hi!\nOrder #7' })));
  await settle(page);
  assert.equal(await page.locator(HOST + ' .b').getAttribute('href'), 'https://wa.me/15551234567?text=Hi!%0AOrder%20%237');
  clean(log);
});

test('{url} and {title} are filled in when the button is used, also after an SPA route change', async () => {
  const { page, log } = await load(doc(tag({ phone: '15551234567', message: 'I want {title}: {url}' }), { title: 'Blue shoes $& co, 50% off' }));
  await settle(page);
  const text = async () => new URL(await page.locator(HOST + ' .b').getAttribute('href')).searchParams.get('text');
  assert.equal(await text(), 'I want Blue shoes $& co, 50% off: ' + page.url());
  await page.evaluate(() => {
    history.pushState({}, '', '/product/42?color=blue#top');
    document.title = 'Red hat';
  });
  await page.locator(HOST + ' .b').focus();
  assert.equal(await text(), 'I want Red hat: https://site.test/product/42?color=blue#top');
  clean(log);
});

test('a click opens exactly that wa.me URL, in a new tab or (new-tab=false) in the same one', async () => {
  const message = 'Hi & #1 👋';
  let r = await load(doc(tag({ phone: '+1 555 123 4567', message })));
  await settle(r.page);
  const [tab] = await Promise.all([r.page.waitForEvent('popup'), r.page.locator(HOST + ' .b').click()]);
  await tab.waitForLoadState();
  assert.equal(tab.url(), wa('15551234567', message));
  clean(r.log);

  r = await load(doc(tag({ phone: '+1 555 123 4567', message, 'new-tab': 'false' })));
  await settle(r.page);
  assert.equal(await r.page.locator(HOST + ' .b').getAttribute('target'), null);
  await Promise.all([r.page.waitForURL(/wa\.me/), r.page.locator(HOST + ' .b').click()]);
  assert.equal(r.page.url(), wa('15551234567', message));
});

test('position, offsets and size', async () => {
  let r = await load(doc(tag({ phone: '15551234567', position: 'left', 'offset-x': 30, 'offset-y': 40, size: 64 })));
  await settle(r.page);
  let box = await r.page.locator(HOST + ' .i').boundingBox();
  assert.deepEqual([box.x, box.y + box.height, box.width, box.height], [30, 760, 64, 64]);
  clean(r.log);

  r = await load(doc(tag({ phone: '15551234567', 'offset-x': 0, 'offset-y': 0 })));
  await settle(r.page);
  box = await r.page.locator(HOST + ' .i').boundingBox();
  assert.deepEqual([box.x + box.width, box.y + box.height], [1280, 800]);
  clean(r.log);
});

test('label next to the button, on the inner side; part of the accessible name', async () => {
  let r = await load(doc(tag({ phone: '15551234567', label: 'Chat with us' })));
  await settle(r.page);
  const lb = await r.page.locator(HOST + ' .lb').boundingBox();
  let icon = await r.page.locator(HOST + ' .i').boundingBox();
  assert.ok(lb.x + lb.width <= icon.x, 'label left of the icon');
  assert.equal(await r.page.locator(HOST + ' .lb').textContent(), 'Chat with us');
  assert.equal(await r.page.locator(HOST + ' .b').getAttribute('aria-label'), 'Chat with us, WhatsApp');
  clean(r.log);

  r = await load(doc(tag({ phone: '15551234567', label: 'Message us on WhatsApp', position: 'left' })));
  await settle(r.page);
  const lb2 = await r.page.locator(HOST + ' .lb').boundingBox();
  icon = await r.page.locator(HOST + ' .i').boundingBox();
  assert.ok(lb2.x >= icon.x + icon.width, 'label right of the icon');
  assert.equal(await r.page.locator(HOST + ' .b').getAttribute('aria-label'), 'Message us on WhatsApp');
  clean(r.log);
});

test('label-hover: the label is a tooltip on hover and keyboard focus', async () => {
  const { page, log } = await load(doc(tag({ phone: '15551234567', label: 'Chat with us', 'label-hover': '' })));
  await settle(page);
  assert.equal(await styleOf(page, '.lb', 'visibility'), 'hidden');
  const icon = await page.locator(HOST + ' .i').boundingBox();
  assert.equal(icon.x + icon.width, 1260, 'the hidden label takes no space');
  await page.locator(HOST + ' .i').hover();
  await page.waitForTimeout(300);
  assert.equal(await styleOf(page, '.lb', 'visibility'), 'visible');
  assert.equal(await styleOf(page, '.lb', 'opacity'), '1');
  await page.mouse.move(10, 10);
  await page.waitForTimeout(300);
  assert.equal(await styleOf(page, '.lb', 'visibility'), 'hidden');
  if (TABS_TO_LINKS) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);
    assert.equal(await styleOf(page, '.lb', 'visibility'), 'visible');
  }
  clean(log);
});

test('greeting popup: mouse, keyboard, focus and Esc', async () => {
  const greeting = 'Hi there 👋\nHow can we help?';
  const { page, log } = await load(doc(tag({ phone: '+1 555 123 4567', message: 'Hi', greeting, name: 'Support team', subtitle: 'Replies in minutes' })));
  await settle(page);
  const b = page.locator(HOST + ' .b');
  assert.equal(await b.evaluate((e) => e.tagName), 'BUTTON');
  assert.equal(await b.getAttribute('aria-expanded'), 'false');
  assert.equal(await b.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(await b.getAttribute('aria-controls'), 'p');
  assert.equal(await styleOf(page, '.p', 'visibility'), 'hidden');
  assert.equal(await page.locator(HOST + ' .p').getAttribute('role'), 'dialog');
  assert.equal(await page.locator(HOST + ' .p').getAttribute('aria-label'), 'Support team');
  assert.equal(await page.locator(HOST + ' .n b').textContent(), 'Support team');
  assert.equal(await page.locator(HOST + ' .n small').textContent(), 'Replies in minutes');
  assert.equal(await page.locator(HOST + ' .g p').textContent(), greeting);
  assert.equal(await page.locator(HOST + ' .av').textContent(), 'S');
  assert.equal(await page.locator(HOST + ' .c').textContent(), 'Start chat');
  assert.equal(await page.locator(HOST + ' .c').getAttribute('href'), 'https://wa.me/15551234567?text=Hi');

  // Keyboard: Tab reaches the button (the closed popup is not focusable), Enter opens it.
  await page.keyboard.press('Tab');
  assert.equal(await focused(page), 'b');
  assert.match(await styleOf(page, '.b', 'boxShadow'), /rgb\(17, 27, 33\)/, 'visible focus ring');
  await page.keyboard.press('Enter');
  assert.equal(await b.getAttribute('aria-expanded'), 'true');
  assert.equal(await styleOf(page, '.p', 'visibility'), 'visible');
  assert.equal(await focused(page), 'c', 'focus moves to "Start chat"');
  await page.keyboard.press('Escape');
  assert.equal(await b.getAttribute('aria-expanded'), 'false');
  assert.equal(await focused(page), 'b', 'Esc returns focus to the button');
  await page.waitForTimeout(300);
  assert.equal(await styleOf(page, '.p', 'visibility'), 'hidden');

  // Space opens it too; Shift+Tab reaches the close button; Tab from "Start chat" goes back to the button.
  await page.keyboard.press('Space');
  assert.equal(await focused(page), 'c');
  await page.keyboard.press('Tab');
  assert.equal(await focused(page), 'b');
  if (TABS_TO_LINKS) {
    await page.keyboard.press('Shift+Tab');
    assert.equal(await focused(page), 'c');
  }
  await page.keyboard.press('Shift+Tab');
  assert.equal(await focused(page), 'x');
  assert.equal(await page.locator(HOST + ' .x').getAttribute('aria-label'), 'Close');
  await page.keyboard.press('Enter');
  assert.equal(await b.getAttribute('aria-expanded'), 'false');
  assert.equal(await focused(page), 'b');

  // Mouse.
  await b.click();
  assert.equal(await b.getAttribute('aria-expanded'), 'true');
  await page.locator(HOST + ' .x').click();
  assert.equal(await b.getAttribute('aria-expanded'), 'false');
  await b.click();
  await page.waitForTimeout(250);
  const [tab] = await Promise.all([page.waitForEvent('popup'), page.locator(HOST + ' .c').click()]);
  await tab.waitForLoadState();
  assert.equal(tab.url(), 'https://wa.me/15551234567?text=Hi');
  await page.waitForTimeout(50);
  assert.equal(await b.getAttribute('aria-expanded'), 'false', '"Start chat" closes the popup');
  clean(log);
});

test('popup-delay opens the popup by itself, without taking focus; Esc closes it', async () => {
  let r = await load(doc('<input id="q" aria-label="Search">' + tag({ phone: '15551234567', greeting: 'Hello', 'popup-delay': 1 })));
  await settle(r.page);
  await r.page.focus('#q');
  assert.equal(await r.page.locator(HOST + ' .b').getAttribute('aria-expanded'), 'false');
  await r.page.waitForTimeout(1000);
  assert.equal(await r.page.locator(HOST + ' .b').getAttribute('aria-expanded'), 'true');
  assert.equal(await focused(r.page), 'q', 'focus stays where the visitor is');
  await r.page.keyboard.press('Escape');
  assert.equal(await r.page.locator(HOST + ' .b').getAttribute('aria-expanded'), 'false');
  assert.equal(await focused(r.page), 'q');
  clean(r.log);

  // Opened and closed by the visitor before the delay: it doesn't pop up again.
  r = await load(doc(tag({ phone: '15551234567', greeting: 'Hello', 'popup-delay': 1 })));
  await r.page.waitForSelector(HOST + ' .w.v', { state: 'attached' });
  await r.page.locator(HOST + ' .b').click();
  await r.page.locator(HOST + ' .b').click();
  await r.page.waitForTimeout(1300);
  assert.equal(await r.page.locator(HOST + ' .b').getAttribute('aria-expanded'), 'false');
  clean(r.log);
});

test('show-after: hidden (and not focusable) until N seconds have passed', async () => {
  const { page, log } = await load(doc('<input id="q" aria-label="Search">' + tag({ phone: '15551234567', 'show-after': 1 })));
  await page.waitForSelector(HOST, { state: 'attached' });
  assert.equal(await styleOf(page, '.w', 'visibility'), 'hidden');
  assert.equal(await page.locator(HOST + ' .b').isVisible(), false);
  await page.focus('#q');
  await page.keyboard.press('Tab');
  assert.notEqual(await focused(page), 'b', 'not reachable with Tab while hidden');
  await page.waitForTimeout(1200);
  assert.equal(await styleOf(page, '.w', 'visibility'), 'visible');
  assert.equal(await page.locator(HOST + ' .b').isVisible(), true);
  clean(log);
});

test('show-on-scroll: after a percentage or a number of pixels; at once on a page too short to scroll that far', async () => {
  const tall = '<div style="height:4000px"></div>';
  let r = await load(doc(tall + tag({ phone: '15551234567', 'show-on-scroll': '50%' })));
  await r.page.waitForSelector(HOST, { state: 'attached' });
  const max = await r.page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await r.page.evaluate((y) => scrollTo(0, y), Math.round(max * 0.3));
  await r.page.waitForTimeout(200);
  assert.equal(await r.page.locator(HOST + ' .w.v').count(), 0);
  await r.page.evaluate((y) => scrollTo(0, y), Math.round(max * 0.6));
  await r.page.waitForTimeout(200);
  assert.equal(await r.page.locator(HOST + ' .w.v').count(), 1);
  clean(r.log);

  r = await load(doc(tall + tag({ phone: '15551234567', 'show-on-scroll': 300 })));
  await r.page.waitForSelector(HOST, { state: 'attached' });
  await r.page.evaluate(() => scrollTo(0, 200));
  await r.page.waitForTimeout(200);
  assert.equal(await r.page.locator(HOST + ' .w.v').count(), 0);
  await r.page.evaluate(() => scrollTo(0, 350));
  await r.page.waitForTimeout(200);
  assert.equal(await r.page.locator(HOST + ' .w.v').count(), 1);
  clean(r.log);

  r = await load(doc('<p>Short page</p>' + tag({ phone: '15551234567', 'show-on-scroll': 2000 })));
  await settle(r.page);
  clean(r.log);
});

test('hide-on-mobile and hide-on-desktop, with the default and a custom breakpoint', async () => {
  const shown = async (attrs, opts) => {
    const { page, log } = await load(doc(tag(Object.assign({ phone: '15551234567' }, attrs))), opts);
    await page.waitForSelector(HOST + ' .w.v', { state: 'attached' });
    const display = await styleOf(page, '.w', 'display');
    clean(log);
    return display !== 'none';
  };
  const phone = { viewport: { width: 390, height: 844 }, mobile: true };
  assert.equal(await shown({ 'hide-on-desktop': '' }), false, 'desktop, hide-on-desktop');
  assert.equal(await shown({ 'hide-on-mobile': '' }), true, 'desktop, hide-on-mobile');
  assert.equal(await shown({ 'hide-on-mobile': '' }, phone), false, 'phone, hide-on-mobile');
  assert.equal(await shown({ 'hide-on-desktop': '' }, phone), true, 'phone, hide-on-desktop');
  assert.equal(await shown({ 'hide-on-mobile': 'true', breakpoint: 1400 }), false, '1280px wide is "mobile" below a 1400 breakpoint');
  assert.equal(await shown({ 'hide-on-mobile': 'false' }, phone), true, '"false" means false');
});

test('phone viewport: tap opens the popup, which fits the screen; no sideways scroll', async () => {
  const { page, log } = await load(
    doc('<p>Page</p>' + tag({ phone: '15551234567', label: 'A very long label that would not fit on a small phone screen at all', greeting: 'Hello! '.repeat(30), name: 'A name that is quite long for the header of the popup' })),
    { viewport: { width: 360, height: 740 }, mobile: true }
  );
  await settle(page);
  const lb = await page.locator(HOST + ' .lb').boundingBox();
  assert.ok(lb.x >= 0, 'label stays on screen');
  await page.locator(HOST + ' .i').tap();
  await page.waitForTimeout(300);
  assert.equal(await page.locator(HOST + ' .b').getAttribute('aria-expanded'), 'true');
  const p = await page.locator(HOST + ' .p').boundingBox();
  assert.ok(p.x >= 0 && p.x + p.width <= 360 && p.y >= 0, 'popup on screen: ' + JSON.stringify(p));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll');
  clean(log);
});

test('z-index option', async () => {
  const { page, log } = await load(doc(tag({ phone: '15551234567', 'z-index': 123 })));
  await settle(page);
  assert.equal(await styleOf(page, '.w', 'zIndex'), '123');
  clean(log);
});

test('reduced motion: no transitions', async () => {
  const { page, log } = await load(doc(tag({ phone: '15551234567', greeting: 'Hi' })), { reducedMotion: 'reduce' });
  await page.waitForSelector(HOST + ' .w.v', { state: 'attached' });
  assert.equal(await styleOf(page, '.w', 'transitionDuration'), '0s');
  assert.match(await styleOf(page, '.p', 'transitionDuration'), /^0s(, 0s)*$/);
  assert.match(await styleOf(page, '.i', 'transitionDuration'), /^0s/);
  clean(log);
});

test('forced colours (Windows high contrast): the icon and the focus ring stay visible', async () => {
  if (ENGINE !== 'chromium') return; // Playwright emulates forced colours in Chromium
  const { page, log } = await load(doc(tag({ phone: '15551234567' })), { forcedColors: 'active' });
  await settle(page);
  await page.keyboard.press('Tab');
  assert.equal(await focused(page), 'b');
  assert.equal(await styleOf(page, '.b', 'outlineStyle'), 'solid');
  assert.notEqual(await styleOf(page, '.b', 'outlineColor'), 'rgba(0, 0, 0, 0)', 'the transparent outline becomes a system colour');
  assert.equal(await styleOf(page, '.i', 'borderTopStyle'), 'solid');
  assert.notEqual(await inShadow(page, (root) => getComputedStyle(root.querySelector('.i svg')).fill), await styleOf(page, '.i', 'backgroundColor'));
  clean(log);
});

test('options from window.WhatsAppChatButtonConfig win over data- attributes', async () => {
  const { page, log } = await load(doc(
    '<script>window.WhatsAppChatButtonConfig = { message: "from the object", position: "left" };</script>' +
    tag({ phone: '15551234567', message: 'from the attribute', label: 'Hi' })
  ));
  await settle(page);
  assert.equal(await page.locator(HOST + ' .b').getAttribute('href'), wa('15551234567', 'from the object'));
  assert.equal(await page.locator(HOST + ' .w.l').count(), 1);
  assert.equal(await page.locator(HOST + ' .lb').textContent(), 'Hi');
  clean(log);
});

test('JavaScript API: init, open, close, hide, show, destroy; loading the script twice', async () => {
  const { page, log } = await load(doc(tag({ phone: '15551234567' }) + '<script src="' + CDN + '" data-phone="999999999" defer></script>'));
  await settle(page);
  assert.equal(await page.locator(HOST).count(), 1, 'one button when the script is on the page twice');
  assert.equal(await page.locator(HOST + ' .b').getAttribute('href'), 'https://wa.me/15551234567');
  assert.equal(await page.evaluate(() => WhatsAppChatButton.version), '1.0.0');

  const [tab] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => WhatsAppChatButton.open())]);
  assert.equal(tab.url(), 'https://wa.me/15551234567', 'open() without a popup opens WhatsApp');
  await tab.close();
  await page.bringToFront(); // a background tab doesn't run CSS transitions

  await page.evaluate(() => WhatsAppChatButton.init({ phone: '15551234567', greeting: 'Hello' }));
  await settle(page);
  await page.evaluate(() => WhatsAppChatButton.open());
  assert.equal(await page.locator(HOST + ' .b').getAttribute('aria-expanded'), 'true');
  assert.equal(await focused(page), 'c');
  await page.evaluate(() => WhatsAppChatButton.close());
  assert.equal(await page.locator(HOST + ' .b').getAttribute('aria-expanded'), 'false');
  await page.evaluate(() => WhatsAppChatButton.hide());
  await page.waitForTimeout(400);
  assert.equal(await page.locator(HOST + ' .b').isVisible(), false);
  await page.evaluate(() => WhatsAppChatButton.show());
  await page.waitForTimeout(400);
  assert.equal(await page.locator(HOST + ' .b').isVisible(), true);
  await page.evaluate(() => WhatsAppChatButton.destroy());
  assert.equal(await page.locator(HOST).count(), 0);
  await page.evaluate(() => WhatsAppChatButton.destroy()); // twice is fine
  await page.evaluate(() => WhatsAppChatButton.init({ phone: '442079460958' }));
  await settle(page);
  assert.equal(await page.locator(HOST + ' .b').getAttribute('href'), 'https://wa.me/442079460958');
  clean(log);
});

// The README's React component: its useEffect body, run the way React runs it.
async function reactPage() {
  const block = readmeBlock('react');
  const src = block.match(/const SRC = '([^']+)'/)[1];
  const body = block.match(/useEffect\(\(\) => \{\n([\s\S]*?)\n {2}\}, \[options\]\);/)[1];
  assert.equal(src, CDN);
  const r = await load(doc('<div id="root"></div>'));
  // effect(props) does what React does on mount: options = JSON.stringify(props), then the effect.
  await r.page.evaluate(([SRC, code]) => {
    const effect = new Function('SRC', 'options', code);
    window.__effect = (props) => effect(SRC, JSON.stringify(props));
  }, [src, body]);
  return r;
}

test('React component from the README: Strict Mode mount, unmount, mount; new props; unmount', async () => {
  const { page, log } = await reactPage();
  await page.evaluate(() => {
    const cleanup = window.__effect({ phone: '15551234567', message: 'Hi' });
    cleanup();
    window.__cleanup = window.__effect({ phone: '15551234567', message: 'Hi' });
  });
  await settle(page);
  assert.equal(await page.locator(HOST).count(), 1);
  assert.equal(await page.locator('script[src="' + CDN + '"]').count(), 1);
  assert.equal(await page.locator(HOST + ' .b').getAttribute('href'), 'https://wa.me/15551234567?text=Hi');
  await page.evaluate(() => {
    window.__cleanup();
    window.__cleanup = window.__effect({ phone: '15551234567', message: 'Changed', label: 'Chat with us' });
  });
  await settle(page);
  assert.equal(await page.locator(HOST).count(), 1);
  assert.equal(await page.locator(HOST + ' .b').getAttribute('href'), 'https://wa.me/15551234567?text=Changed');
  assert.equal(await page.locator(HOST + ' .lb').textContent(), 'Chat with us');
  await page.evaluate(() => window.__cleanup());
  assert.equal(await page.locator(HOST).count(), 0, 'unmount removes the button');
  clean(log);
});

test('React component from the README: unmounted before the script loaded, no button appears', async () => {
  const { page, log } = await reactPage();
  await page.evaluate(() => window.__effect({ phone: '15551234567' })());
  await page.waitForFunction(() => window.WhatsAppChatButton);
  await page.waitForTimeout(300);
  assert.equal(await page.locator(HOST).count(), 0);
  clean(log);
});

test('a script tag added by JavaScript (as next/script does) reads its data- attributes', async () => {
  const { page, log } = await load(doc('<main>App</main>'));
  await page.evaluate((src) => {
    const s = document.createElement('script');
    s.src = src;
    s.setAttribute('data-phone', '+1 555 123 4567');
    s.setAttribute('data-message', 'Hi! I have a question.');
    document.body.appendChild(s);
  }, CDN);
  await settle(page);
  assert.equal(await page.locator(HOST + ' .b').getAttribute('href'), 'https://wa.me/15551234567?text=Hi!%20I%20have%20a%20question.');
  clean(log);
});

test('bad input: no number, a local number, a bad colour, a non-number offset', async () => {
  let r = await load(doc(tag({ phone: '', message: 'Hi' })));
  await r.page.waitForTimeout(300);
  assert.equal(await r.page.locator(HOST).count(), 0);
  clean(r.log, [/Set a phone number/]);

  r = await load(doc(tag({ phone: '0612345678' })));
  await settle(r.page);
  assert.equal(await r.page.locator(HOST + ' .b').getAttribute('href'), 'https://wa.me/0612345678');
  clean(r.log, [/is not an international number/]);

  r = await load(doc(tag({ phone: '15551234567', color: 'not-a-colour', 'offset-x': 'calc(100%)' })));
  await settle(r.page);
  assert.equal(await styleOf(r.page, '.i', 'backgroundColor'), 'rgb(37, 211, 102)');
  const box = await r.page.locator(HOST + ' .i').boundingBox();
  assert.equal(box.x + box.width, 1260, 'offset falls back to 20');
  clean(r.log, [/is not a colour/]);

  r = await load(doc('<p>No options: waits for WhatsAppChatButton.init()</p><script src="' + CDN + '" defer></script>'));
  await r.page.waitForTimeout(300);
  assert.equal(await r.page.locator(HOST).count(), 0);
  clean(r.log);
});

test('config values are text, never HTML or CSS', async () => {
  const payload = {
    phone: '15551234567',
    message: '"><script>window.__xss=1</script>',
    label: '<img src=x onerror="window.__xss=1">',
    greeting: '<script>window.__xss=1</script><b>bold</b>',
    name: '"><svg onload="window.__xss=1">',
    subtitle: '<i>x</i>',
    cta: '<a href="javascript:window.__xss=1">go</a>',
    'close-label': '" onclick="window.__xss=1',
    color: 'red;}*{display:none',
    avatar: 'javascript:window.__xss=1',
  };
  const { page, log } = await load(doc(tag(payload)));
  await settle(page);
  await page.locator(HOST + ' .b').click();
  await page.waitForTimeout(300);
  await page.locator(HOST + ' .x').click();
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.locator(HOST + ' .lb').textContent(), payload.label);
  assert.equal(await page.locator(HOST + ' .g p').textContent(), payload.greeting);
  assert.equal(await page.locator(HOST + ' .n b').textContent(), payload.name);
  assert.equal(await page.locator(HOST + ' .c').textContent(), payload.cta);
  assert.equal(await page.locator(HOST + ' .x').getAttribute('aria-label'), payload['close-label']);
  const tags = await inShadow(page, (root) => [...root.querySelectorAll('*')].map((e) => e.tagName.toLowerCase()).sort().join(','));
  assert.equal(tags, 'a,b,button,button,div,div,div,div,div,p,path,path,small,span,span,span,svg,svg', 'no img: a javascript: avatar is dropped');
  assert.equal(await page.locator(HOST + ' .c').getAttribute('href'), wa('15551234567', payload.message));
  assert.equal(await styleOf(page, '.i', 'backgroundColor'), 'rgb(37, 211, 102)');
  assert.equal(await page.locator('body > p, body > img, body > svg').count(), 0);
  clean(log, [/is not a colour/]);
});

test('strict Content-Security-Policy with Trusted Types: works, no violations', async () => {
  const csp = "default-src 'none'; script-src https://cdn.jsdelivr.net; img-src https://site.test; require-trusted-types-for 'script'; trusted-types 'none'";
  const { page, log } = await load(doc(tag({ phone: '15551234567', label: 'Chat with us', greeting: 'Hello', name: 'Ana', avatar: 'https://site.test/tests/avatar.svg' })), { headers: { 'Content-Security-Policy': csp } });
  await settle(page);
  assert.equal(await styleOf(page, '.i', 'backgroundColor'), 'rgb(37, 211, 102)', 'styles applied without style-src');
  assert.equal(await styleOf(page, '.w', 'position'), 'fixed');
  await page.locator(HOST + ' .b').click();
  await page.waitForTimeout(300);
  assert.equal(await styleOf(page, '.p', 'visibility'), 'visible');
  assert.equal(await inShadow(page, (root) => root.querySelector('.av img').getAttribute('src')), 'https://site.test/tests/avatar.svg');
  clean(log);
});

test("the page's own CSS can't break it, even with !important", async () => {
  const hostile =
    '<style>' +
    'body > * { display: none !important; opacity: 0 !important; transform: scale(0) !important; position: static !important; }' +
    '* { font-size: 40px !important; color: red !important; box-sizing: content-box !important; }' +
    'a, button, svg, span, div, p { all: unset !important; display: none !important; }' +
    '</style>';
  const { page, log } = await load(doc(hostile + '<main>Site</main>' + tag({ phone: '15551234567', label: 'Chat with us' })));
  await settle(page);
  assert.equal(await page.locator(HOST + ' .b').isVisible(), true);
  const icon = await page.locator(HOST + ' .i').boundingBox();
  assert.deepEqual([icon.width, icon.height, icon.x + icon.width, icon.y + icon.height], [56, 56, 1260, 780]);
  const glyph = await page.locator(HOST + ' .i svg').boundingBox();
  assert.ok(glyph.width > 25 && glyph.width < 35, 'glyph size ' + glyph.width);
  assert.equal(await styleOf(page, '.lb', 'fontSize'), '14px');
  assert.equal(await styleOf(page, '.lb', 'color'), 'rgb(17, 27, 33)');
  clean(log);
});

test('the popup header and "Start chat" text pick white or dark for contrast', async () => {
  const pick = async (color) => {
    const { page, log } = await load(doc(tag({ phone: '15551234567', greeting: 'Hi', color })));
    await settle(page);
    const c = await styleOf(page, '.c', 'color');
    clean(log);
    return c;
  };
  const dark = 'rgb(17, 27, 33)';
  const white = 'rgb(255, 255, 255)';
  assert.equal(await pick('#25D366'), dark);
  assert.equal(await pick('#075E54'), white);
  assert.equal(await pick('rebeccapurple'), white);
  assert.equal(await pick('hsl(48 100% 50%)'), dark);
  assert.equal(await pick('#000'), white);
});

// ---------------------------------------------------------------------------
// HTML-only version, README code, generator

const readme = () => fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
// Code blocks marked <!-- test: name --> in the README.
function readmeBlock(name) {
  const m = readme().match(new RegExp('<!-- test: ' + name + ' -->\\s*```[a-z]*\\n([\\s\\S]*?)\\n```'));
  assert.ok(m, 'README block "' + name + '"');
  return m[1];
}
const exampleSnippet = () => {
  const html = fs.readFileSync(path.join(ROOT, 'examples', 'html-only.html'), 'utf8');
  return html.slice(html.indexOf('<a class="whatsapp-float"'), html.indexOf('</style>', html.indexOf('<a class="whatsapp-float"')) + 8);
};

test('HTML-only version: a fixed link with the exact URL, no requests, no errors', async () => {
  const { page, log } = await load(null, { url: ORIGIN + '/examples/html-only.html' });
  const a = page.locator('a.whatsapp-float');
  assert.equal(await a.getAttribute('href'), 'https://wa.me/15551234567?text=Hi!%20I%20have%20a%20question.');
  assert.equal(await a.getAttribute('aria-label'), 'Chat on WhatsApp');
  assert.equal(await a.evaluate((e) => getComputedStyle(e).position), 'fixed');
  const icon = await page.locator('.whatsapp-float-icon').boundingBox();
  assert.deepEqual([icon.width, icon.height, icon.x + icon.width, icon.y + icon.height], [56, 56, 1260, 780]);
  const glyph = await page.locator('.whatsapp-float-icon svg').boundingBox();
  assert.deepEqual([glyph.width, glyph.height], [30, 30]);
  assert.deepEqual(log.requests, [ORIGIN + '/examples/html-only.html']);
  if (TABS_TO_LINKS) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'whatsapp-float');
  }
  clean(log);
});

test('examples/basic.html and examples/popup.html work', async () => {
  let r = await load(null, { url: ORIGIN + '/examples/basic.html' });
  await settle(r.page);
  const title = await r.page.title();
  await r.page.locator(HOST + ' .b').focus();
  assert.equal(await r.page.locator(HOST + ' .b').getAttribute('href'), wa('15551234567', 'Hi! I have a question about ' + title));
  assert.equal(await r.page.locator(HOST + ' .lb').textContent(), 'Chat with us');
  clean(r.log);

  r = await load(null, { url: ORIGIN + '/examples/popup.html' });
  await settle(r.page);
  await r.page.locator(HOST + ' .b').click();
  assert.equal(await r.page.locator(HOST + ' .g p').textContent(), 'Hi there 👋\nHow can we help you?');
  assert.equal(await r.page.locator(HOST + ' .c').getAttribute('href'), wa('442079460958', 'Hi! I am on ' + r.page.url()));
  assert.equal(await r.page.locator(HOST + ' .w.l').count(), 1);
  clean(r.log);
});

test('README: the HTML-only code is the example file and the generator output', async () => {
  const fromReadme = readmeBlock('html-only').trim();
  assert.equal(fromReadme, exampleSnippet().trim(), 'README matches examples/html-only.html');
  const { page, log } = await load(null, { url: ORIGIN + '/index.html' });
  await page.click('[data-tab=html]');
  assert.equal((await page.textContent('#code')).trim(), fromReadme, 'README matches the generator');
  clean(log);
});

test('README: every marked snippet runs and links to the right number', async () => {
  const hi = 'https://wa.me/15551234567?text=Hi!%20I%20have%20a%20question.';
  const cases = [
    // [block, launcher tag, the link (on the button, or on "Start chat" when there is a popup)]
    ['quick-start', 'a', hi],
    ['pinned', 'a', 'https://wa.me/15551234567'],
    ['config-object', 'button', (title, url) => wa('442079460958', 'Hi! I am looking at ' + title + ': ' + url)],
    ['popup', 'button', hi],
    ['gtm', 'a', hi],
  ];
  for (const [name, kind, expected] of cases) {
    const { page, log } = await load(doc('<main>Page</main>\n' + readmeBlock(name)));
    await settle(page);
    assert.equal(await page.locator(HOST).count(), 1, name);
    assert.equal(await page.locator(HOST + ' .b').evaluate((e) => e.tagName.toLowerCase()), kind, name);
    const link = page.locator(HOST + (kind === 'a' ? ' .b' : ' .c'));
    await link.focus(); // fills in {url} and {title}
    const href = typeof expected === 'function' ? expected(await page.title(), page.url()) : expected;
    assert.equal(await link.getAttribute('href'), href, name);
    clean(log);
  }
});

test('README: the pinned tag carries the SRI hash of dist/', async () => {
  const hash = 'sha384-' + require('crypto').createHash('sha384').update(fs.readFileSync(path.join(ROOT, 'dist', 'whatsapp-chat-button.min.js'))).digest('base64');
  assert.match(readmeBlock('pinned'), new RegExp('integrity="' + hash.replace(/[+/]/g, '\\$&') + '"'));
  // And a wrong hash is refused, so the check above means something.
  const { page, log } = await load(doc(readmeBlock('pinned').replace(/integrity="[^"]+"/, 'integrity="sha384-AAAA"')));
  await page.waitForTimeout(500);
  assert.equal(await page.locator(HOST).count(), 0);
  assert.ok(log.errors.length > 0);
});

test('README: the business-hours example shows the button only between 9:00 and 17:00 in New York', async () => {
  const { page, log } = await load(doc('<main>Page</main>\n' + readmeBlock('hours')));
  await page.waitForTimeout(600);
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/New_York' }).format(new Date()));
  assert.equal(await page.locator(HOST).count(), hour >= 9 && hour < 17 ? 1 : 0);
  clean(log);
});

test('generator: the copied snippet works on a fresh page', async () => {
  const { page, log, context } = await load(null, { url: ORIGIN + '/index.html' });
  const clipboard = ENGINE === 'chromium'; // reading the clipboard back needs Chromium's permission
  if (clipboard) await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  assert.equal(
    (await page.textContent('#code')).trim(),
    '<script src="' + CDN + '"\n  data-phone="15551234567"\n  data-message="Hi! I have a question."\n  defer></script>'
  );
  // Preview: the generated button inside the iframe.
  await page.frameLocator('#preview').locator(HOST + ' .b').waitFor({ state: 'attached' });

  const message = 'Hi! 👋 Order #42 & "more"\nThanks';
  await page.fill('#phone', '+44 (0)20 7946 0958');
  await page.fill('#message', message);
  await page.check('#position-left', { force: true });
  await page.fill('#color-text', '#0F766E');
  await page.fill('#label', 'Questions? Chat with us');
  await page.check('#popup');
  await page.fill('#name', 'Ana <Support>');
  await page.fill('#greeting', 'Hi! How can we help?');
  await page.click('summary');
  await page.fill('#offset-y', '90');
  await page.click('#copy');
  const code = await page.textContent('#code');
  if (clipboard) {
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(clip.replace(/\r\n/g, '\n'), code, 'Copy puts the code on the clipboard'); // Windows adds \r
    assert.match(await page.textContent('#copied'), /Copied/);
  }
  await page.waitForTimeout(400);
  assert.equal(await page.frameLocator('#preview').locator(HOST + ' .w.l').count(), 1, 'preview follows the form');
  clean(log);

  const fresh = await load(doc('<main>My site</main>\n' + code));
  await settle(fresh.page);
  const b = fresh.page.locator(HOST + ' .b');
  assert.equal(await b.evaluate((e) => e.tagName), 'BUTTON');
  assert.equal(await b.getAttribute('aria-label'), 'Questions? Chat with us, WhatsApp');
  const icon = await fresh.page.locator(HOST + ' .i').boundingBox();
  assert.deepEqual([icon.x, icon.y + icon.height], [20, 710]);
  assert.equal(await styleOf(fresh.page, '.i', 'backgroundColor'), 'rgb(15, 118, 110)');
  await b.click();
  assert.equal(await fresh.page.locator(HOST + ' .n b').textContent(), 'Ana <Support>');
  assert.equal(await fresh.page.locator(HOST + ' .c').getAttribute('href'), wa('442079460958', message));
  clean(fresh.log);

  await page.click('[data-tab=html]');
  const html = await page.textContent('#code');
  const plain = await load(doc('<main>My site</main>\n' + html));
  assert.equal(await plain.page.locator('a.whatsapp-float').getAttribute('href'), wa('442079460958', message));
  assert.equal(await plain.page.locator('.whatsapp-float-label').textContent(), 'Questions? Chat with us');
  const pIcon = await plain.page.locator('.whatsapp-float-icon').boundingBox();
  assert.deepEqual([pIcon.x, pIcon.y + pIcon.height], [20, 710]);
  clean(plain.log);

  await page.click('[data-tab=link]');
  assert.equal(await page.textContent('#code'), wa('442079460958', message));
  assert.equal(await page.getAttribute('#test-link', 'href'), wa('442079460958', message));

  await page.fill('#phone', '020 7946 0958');
  assert.match(await page.getAttribute('#phone-status', 'class'), /warn/);
  clean(log);
});

test('generator: fits a phone screen', async () => {
  const { page, log } = await load(null, { url: ORIGIN + '/index.html', viewport: { width: 375, height: 812 }, mobile: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll');
  await page.click('[data-device=mobile]');
  await page.frameLocator('#preview').locator(HOST + ' .b').waitFor({ state: 'attached' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll with the phone preview');
  clean(log);
});

// ---------------------------------------------------------------------------

(async () => {
  browser = await playwright[ENGINE].launch({ executablePath: (ENGINE === 'chromium' && process.env.CHROMIUM_PATH) || undefined });
  TABS_TO_LINKS = await tabsToLinks();
  await Promise.all(contexts.map((c) => c.close().catch(() => {})));
  contexts = [];
  console.log(ENGINE + ' ' + browser.version() + (TABS_TO_LINKS ? '' : ' (Tab skips links)') + '\n');
  const only = process.argv[2];
  let failed = 0;
  let run = 0;
  for (const t of tests) {
    if (only && !t.name.includes(only)) continue;
    run++;
    const started = Date.now();
    try {
      await t.fn();
      console.log('ok    ' + t.name + ' (' + (Date.now() - started) + ' ms)');
    } catch (e) {
      failed++;
      const lines = String(e.stack || e).split('\n');
      const where = lines.filter((l) => l.includes('browser.test.cjs')).slice(0, 2);
      console.log('FAIL  ' + t.name + '\n      ' + lines.slice(0, 4).concat(where).join('\n      '));
    }
    await Promise.all(contexts.map((c) => c.close().catch(() => {})));
    contexts = [];
  }
  await browser.close();
  console.log('\n' + (run - failed) + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
