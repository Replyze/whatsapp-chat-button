/*! whatsapp-chat-button v1.0.0 | MIT License | https://github.com/Replyze/whatsapp-chat-button */
// A floating button that opens a WhatsApp chat with your number (https://wa.me/<number>).
// No dependencies, no cookies, no storage, no network requests. Not affiliated with WhatsApp or Meta.
((w, d) => {
  if (w.WhatsAppChatButton) return; // loaded twice: the first one stays

  const TAG = 'whatsapp-chat-button';
  // The WhatsApp glyph, unmodified (path data from Simple Icons, CC0). Always white.
  const GLYPH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';

  // Every option with its default. The default's type (boolean, number, string) is the option's type.
  // data-offset-x on the script tag arrives here as offsetX (the browser's dataset naming).
  const DEFAULTS = {
    phone: '',
    message: '',
    position: 'right',
    offsetX: 20,
    offsetY: 20,
    size: 56,
    color: '#25D366',
    label: '',
    labelHover: false,
    greeting: '',
    name: '',
    subtitle: '',
    avatar: '',
    cta: 'Start chat',
    popupDelay: 0,
    showAfter: 0,
    showOnScroll: '',
    hideOnMobile: false,
    hideOnDesktop: false,
    breakpoint: 768,
    zIndex: 9999,
    newTab: true,
    ariaLabel: 'Chat on WhatsApp',
    closeLabel: 'Close',
  };

  // Lives in a shadow root, so the page's CSS can't reach it and it can't reach the page.
  const STYLE =
    ':host{all:initial!important}' +
    '*{box-sizing:border-box}' +
    '.w{position:fixed;bottom:calc(var(--y) + env(safe-area-inset-bottom,0px));display:flex;font:15px/1.4 system-ui,sans-serif;color:#111b21;visibility:hidden;opacity:0;transform:translateY(12px);transition:.3s}' +
    '.r{right:var(--x)}.l{left:var(--x)}' +
    '.v{visibility:visible;opacity:1;transform:none}' +
    '.b{position:relative;display:flex;align-items:center;gap:12px;margin:0;padding:0;border:0;border-radius:99px;background:none;font:inherit;color:inherit;text-decoration:none;cursor:pointer}' +
    '.l .b{flex-direction:row-reverse}' +
    '.i{display:grid;place-items:center;flex:none;width:var(--s);height:var(--s);border-radius:50%;background:var(--c);box-shadow:0 4px 16px rgba(0,0,0,.2);transition:.2s}' +
    '.i svg{width:54%;fill:#fff}' +
    '.b:hover .i{transform:scale(1.06)}' +
    '.lb{max-width:65vw;padding:9px 14px;border-radius:10px;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,.2);font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:.2s}' +
    '.lh .lb{position:absolute;right:calc(100% + 12px);opacity:0;visibility:hidden}' +
    '.lh.l .lb{right:auto;left:calc(100% + 12px)}' +
    '.lh .b:hover .lb,.lh .b:focus-visible .lb{opacity:1;visibility:visible}' +
    ':focus-visible{outline:2px solid transparent;box-shadow:0 0 0 3px #fff,0 0 0 6px #111b21}' +
    // The popup becomes visible at once on open (so focus can move into it) and hidden after the fade on close.
    '.p{position:absolute;bottom:calc(100% + 14px);width:min(340px,calc(100vw - 2*var(--x)));border-radius:16px;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.25);overflow:hidden;visibility:hidden;opacity:0;transform:translateY(8px);transition:opacity .2s,transform .2s,visibility 0s .2s}' +
    '.r .p{right:0}.l .p{left:0}' +
    '.o .p{visibility:visible;opacity:1;transform:none;transition-delay:0s}' +
    '.h{display:flex;align-items:center;gap:12px;padding:14px 12px 14px 16px;background:var(--c);color:var(--t)}' +
    '.av{display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:50%;overflow:hidden;background:#fff;color:#111b21;font-size:18px;font-weight:600}' +
    '.av img{width:100%;height:100%;object-fit:cover}' +
    '.n{flex:1;overflow-wrap:anywhere}' +
    '.n b{display:block;font-size:16px}.n small{font-size:13px;opacity:.85}' +
    '.x{display:flex;padding:6px;margin:0;border:0;border-radius:50%;background:none;color:inherit;cursor:pointer}' +
    '.x svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round}' +
    '.g{padding:20px 16px;background:#f0f2f5}' +
    '.g p{width:fit-content;max-width:85%;margin:0;padding:10px 14px;border-radius:0 12px 12px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.1);white-space:pre-line;overflow-wrap:anywhere}' +
    '.c{display:block;margin:14px 16px 16px;padding:12px;border-radius:99px;background:var(--c);color:var(--t);font-weight:600;text-align:center;text-decoration:none}' +
    '@media (prefers-reduced-motion:reduce){*{transition:none!important}}' +
    '@media (forced-colors:active){.i{border:2px solid}.i svg{fill:CanvasText}}' +
    '@media print{.w{display:none}}';

  let o, host, root, wrap, btn, pop, cta, num, isOpen, shown, touched, stopScroll;
  let timers = [];
  let cleanups = [];

  const warn = (msg) => console.warn('[' + TAG + '] ' + msg);

  // Config values only ever become text (textContent) or attributes, never HTML.
  const el = (tag, cls, text) => {
    const e = d.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };

  const icon = (path) => {
    const ns = 'http://www.w3.org/2000/svg';
    const s = d.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.appendChild(d.createElementNS(ns, 'path')).setAttribute('d', path);
    return s;
  };

  const on = (target, type, fn) => {
    target.addEventListener(type, fn);
    cleanups.push(() => target.removeEventListener(type, fn));
  };

  const later = (fn, seconds) => timers.push(setTimeout(fn, seconds * 1000));

  // Takes the options from data- attributes or a JS object, each coerced to its default's type.
  const read = (src) => {
    const out = {};
    for (const k in DEFAULTS) {
      const def = DEFAULTS[k];
      const v = src[k];
      out[k] = v == null ? def
        : typeof def == 'boolean' ? v === true || v === '' || v === 'true' || v === '1'
        : typeof def == 'number' ? (v !== '' && isFinite(v) ? +v : def)
        : String(v);
    }
    return out;
  };

  // https://wa.me/<digits>?text=<message>, with {url} and {title} filled in when clicked.
  const link = () => {
    const m = o.message.replace(/\{(url|title)\}/g, (_, k) => (k == 'url' ? location.href : d.title));
    return 'https://wa.me/' + num + (m ? '?text=' + encodeURIComponent(m) : '');
  };

  const setLink = (a) => {
    const update = () => { a.href = link(); };
    update();
    if (o.newTab) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    ['click', 'focus', 'pointerenter'].forEach((type) => a.addEventListener(type, update));
  };

  // White or dark text on the button colour, whichever contrasts more. The colour's
  // relative luminance (WCAG 2, with gamma 2.2) is above 0.179 when dark text wins.
  const textOn = (color) => {
    const ctx = d.createElement('canvas').getContext('2d') || {};
    ctx.fillStyle = color;
    const h = ctx.fillStyle; // the browser's "#rrggbb" or "rgba(r, g, b, a)"
    const v = h[0] == '#' ? [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16)) : h.match(/\d+/g) || [];
    const L = [0.2126, 0.7152, 0.0722].reduce((sum, k, i) => sum + k * (v[i] / 255) ** 2.2, 0);
    return L > 0.179 ? '#111b21' : '#fff';
  };

  const setOpen = (open, focus) => {
    if (!pop || !shown || open == isOpen) return;
    isOpen = open;
    wrap.classList.toggle('o', open);
    btn.setAttribute('aria-expanded', open);
    if (focus) (open ? cta : btn).focus();
  };

  const reveal = () => {
    if (!host || shown) return;
    shown = 1;
    if (stopScroll) stopScroll();
    wrap.getBoundingClientRect(); // style the hidden state first, so the button fades in
    wrap.classList.add('v');
    if (pop && o.popupDelay > 0) later(() => touched || setOpen(true), o.popupDelay);
  };

  const destroy = () => {
    if (!host) return;
    timers.forEach(clearTimeout);
    cleanups.forEach((fn) => fn());
    host.remove();
    host = pop = stopScroll = null;
    timers = [];
    cleanups = [];
    isOpen = shown = touched = 0;
  };

  const start = (cfg) => {
    destroy();
    o = read(cfg || {});
    // "+44 (0)20 7946 0958", "0044 20 7946 0958" and "442079460958" all become 442079460958.
    num = o.phone.replace(/\(0\)/g, '').replace(/\D/g, '').replace(/^00/, '');
    if (!num) return warn('Set a phone number: data-phone="15551234567"');
    if (num[0] == '0' || num.length < 7 || num.length > 15) {
      warn('"' + o.phone + '" is not an international number. Start with the country code: 15551234567');
    }
    let color = o.color;
    if (!CSS.supports('color', color)) {
      warn('"' + color + '" is not a colour');
      color = DEFAULTS.color;
    }

    host = d.createElement(TAG);
    root = host.attachShadow({ mode: 'open' });
    const bp = o.breakpoint;
    const css = STYLE + '@media (max-width:' + (bp - 0.02) + 'px){.hm{display:none}}@media (min-width:' + bp + 'px){.hd{display:none}}';
    try {
      // A constructed stylesheet needs no style-src 'unsafe-inline' in a Content-Security-Policy.
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      if (!root.adoptedStyleSheets) throw 0;
      root.adoptedStyleSheets = [sheet];
    } catch (e) {
      root.appendChild(el('style', 0, css));
    }

    wrap = el('div', 'w ' + (o.position == 'left' ? 'l' : 'r') + (o.labelHover ? ' lh' : '') + (o.hideOnMobile ? ' hm' : '') + (o.hideOnDesktop ? ' hd' : ''));
    const st = wrap.style;
    st.setProperty('--x', o.offsetX + 'px');
    st.setProperty('--y', o.offsetY + 'px');
    st.setProperty('--s', Math.min(96, Math.max(32, o.size)) + 'px');
    st.setProperty('--c', color);
    st.setProperty('--t', textOn(color));
    st.zIndex = Math.round(o.zIndex);

    // A label in view is part of the accessible name (WCAG 2.5.3).
    const label = o.label;
    btn = el(o.greeting ? 'button' : 'a', 'b');
    btn.setAttribute('aria-label', !label ? o.ariaLabel : /whatsapp/i.test(label) ? label : label + ', WhatsApp');
    if (label) btn.appendChild(el('span', 'lb', label));
    btn.appendChild(el('span', 'i')).appendChild(icon(GLYPH));

    if (o.greeting) {
      // Greeting popup: the button opens it, its "Start chat" link opens WhatsApp.
      pop = wrap.appendChild(el('div', 'p'));
      pop.id = 'p';
      pop.setAttribute('role', 'dialog');
      pop.setAttribute('aria-label', o.name || o.ariaLabel);
      btn.type = 'button';
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.setAttribute('aria-controls', 'p');
      btn.setAttribute('aria-expanded', 'false');
      btn.onclick = () => {
        touched = 1;
        setOpen(!isOpen, 1);
      };

      const head = pop.appendChild(el('div', 'h'));
      if (o.avatar || o.name) {
        const av = head.appendChild(el('span', 'av'));
        // http(s), data: and relative URLs only.
        if (o.avatar && (/^(https?|data):/i.test(o.avatar) || !/^[a-z][\w+.-]*:/i.test(o.avatar))) {
          const img = av.appendChild(el('img'));
          img.alt = '';
          img.src = o.avatar;
        } else {
          av.textContent = Array.from(o.name.trim())[0] || '';
        }
      }
      const names = head.appendChild(el('div', 'n'));
      if (o.name) names.appendChild(el('b', 0, o.name));
      if (o.subtitle) names.appendChild(el('small', 0, o.subtitle));
      const close = head.appendChild(el('button', 'x'));
      close.type = 'button';
      close.setAttribute('aria-label', o.closeLabel);
      close.appendChild(icon('M18 6 6 18M6 6l12 12'));
      close.onclick = () => setOpen(false, 1);

      pop.appendChild(el('div', 'g')).appendChild(el('p', 0, o.greeting));
      cta = pop.appendChild(el('a', 'c', o.cta));
      setLink(cta);
      cta.addEventListener('click', () => setTimeout(setOpen, 0, false));

      on(d, 'keydown', (e) => {
        if (e.key == 'Escape' && isOpen) setOpen(false, !!root.activeElement);
      });
    } else {
      setLink(btn);
    }

    root.appendChild(wrap).appendChild(btn);
    (d.body || d.documentElement).appendChild(host);

    // When to show it: after N seconds, after scrolling (whichever comes first), or right away.
    let waits = 0;
    if (o.showAfter > 0) {
      waits = 1;
      later(reveal, o.showAfter);
    }
    if (o.showOnScroll) {
      waits = 1;
      const amount = parseFloat(o.showOnScroll) || 0;
      const percent = /%/.test(o.showOnScroll);
      const check = () => {
        const max = d.documentElement.scrollHeight - innerHeight;
        if (scrollY >= Math.min(percent ? (max * amount) / 100 : amount, max)) reveal();
      };
      on(w, 'scroll', check);
      stopScroll = () => w.removeEventListener('scroll', check);
      check();
    }
    if (!waits) reveal();
  };

  w.WhatsAppChatButton = {
    version: '1.0.0',
    init: start,
    open: () => {
      if (!host) return;
      reveal();
      if (pop) {
        touched = 1;
        setOpen(true, 1);
      } else {
        btn.click();
      }
    },
    close: () => setOpen(false),
    show: reveal,
    hide: () => {
      if (!host) return;
      setOpen(false);
      shown = 0;
      wrap.classList.remove('v');
    },
    destroy,
  };

  // Options: data- attributes on this script tag, then window.WhatsAppChatButtonConfig (wins on conflicts).
  const script = d.currentScript || d.querySelector('script[data-phone]');
  const boot = () => {
    const cfg = Object.assign({}, script && script.dataset, w.WhatsAppChatButtonConfig);
    if ('phone' in cfg) start(cfg);
  };
  if (d.readyState == 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
