/* ============================================================
   The Airstream Archive — app.js
   Loads data/airstream.json and renders the interactive catalog.
   ============================================================ */
(function () {
  'use strict';

  var DATA = null;
  var ADS = [];
  var BOOKS = { books: [], categories: [], meta: {} };
  var CONTEXT = { years: {} };
  var EXTRAS = { caravans: [], glossary: [] };

  /* U.S. CPI-U (annual average, 1982-84 = 100) for inflation adjustment.
     REF is the reference "today" value used to convert historical prices. */
  var CPI_REF = 322.0; // ~2025 average
  var CPI = {
    1931: 15.2, 1932: 13.7, 1933: 13.0, 1934: 13.4, 1935: 13.7, 1936: 13.9, 1937: 14.4,
    1938: 14.1, 1939: 13.9, 1940: 14.0, 1941: 14.7, 1942: 16.3, 1943: 17.3, 1944: 17.6,
    1945: 18.0, 1946: 19.5, 1947: 22.3, 1948: 24.1, 1949: 23.8, 1950: 24.1, 1951: 26.0,
    1952: 26.5, 1953: 26.7, 1954: 26.9, 1955: 26.8, 1956: 27.2, 1957: 28.1, 1958: 28.9,
    1959: 29.1, 1960: 29.6, 1961: 29.9, 1962: 30.2, 1963: 30.6, 1964: 31.0, 1965: 31.5,
    1966: 32.4, 1967: 33.4, 1968: 34.8, 1969: 36.7, 1970: 38.8, 1971: 40.5, 1972: 41.8,
    1973: 44.4, 1974: 49.3, 1975: 53.8, 1976: 56.9, 1977: 60.6, 1978: 65.2, 1979: 72.6,
    1980: 82.4, 1981: 90.9, 1982: 96.5, 1983: 99.6, 1984: 103.9, 1985: 107.6, 1986: 109.6,
    1987: 113.6, 1988: 118.3, 1989: 124.0, 1990: 130.7, 1991: 136.2, 1992: 140.3, 1993: 144.5,
    1994: 148.2, 1995: 152.4, 1996: 156.9, 1997: 160.5, 1998: 163.0, 1999: 166.6, 2000: 172.2,
    2001: 177.1, 2002: 179.9, 2003: 184.0, 2004: 188.9, 2005: 195.3, 2006: 201.6, 2007: 207.3,
    2008: 215.3, 2009: 214.5, 2010: 218.1, 2011: 224.9, 2012: 229.6, 2013: 233.0, 2014: 236.7,
    2015: 237.0, 2016: 240.0, 2017: 245.1, 2018: 251.1, 2019: 255.7, 2020: 258.8, 2021: 271.0,
    2022: 292.7, 2023: 304.7, 2024: 313.7, 2025: 322.0
  };

  /* Genuine Wally Byam quotes — shown as an evocative pull-quote on year pages. */
  var BYAM_QUOTES = [
    "Adventure is where you find it — any place, every place, except at home in a rocking chair.",
    "Don't stop. Keep right on going. Hitch up your trailer and go to Canada or down to Old Mexico. Head for Europe if you can afford it, or go to Timbuktu. But go!",
    "To place the great wide world at your doorstep for you who yearn to travel with all the comforts of home.",
    "Let's travel the world over, and be at home wherever we are."
  ];
  var state = { era: 'all', type: 'all', query: '' };
  var adState = { decade: 'all', cat: 'all' };

  /* Multi-page site: figure out the site root from this script's own URL so
     assets, data and cross-page links work from any folder depth, on any host. */
  var SCRIPT = document.currentScript ||
    (function () { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
  var ROOT = (SCRIPT && SCRIPT.src ? SCRIPT.src : '').replace(/js\/app\.js(\?.*)?$/, '');
  var PAGE = (document.body && document.body.getAttribute('data-page')) || 'home';
  function pageUrl(p) { return ROOT + (p ? p + '/' : ''); }
  function modelUrl(id) { return ROOT + 'models/#/model/' + encodeURIComponent(id); }
  function modelYearUrl(id, y) { return ROOT + 'models/#/model/' + encodeURIComponent(id) + '/' + y; }

  /* An image reference is "local" if it's a URL or contains a path separator
     (e.g. "assets/ads/1961.jpg"); otherwise it's treated as a bare Wikimedia
     Commons File name. This lets the same rendering code serve both. */
  function isLocal(file) { return /^https?:/i.test(file) || /\//.test(file); }

  /* Build a stable, resized Wikimedia Commons image URL from a File name. */
  function commonsImg(file, width) {
    var name = String(file).replace(/^File:/, '');
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/' +
      encodeURIComponent(name) + '?width=' + (width || 900);
  }
  function commonsFull(file) {
    var name = String(file).replace(/^File:/, '');
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(name);
  }
  function commonsPage(file) {
    var name = String(file).replace(/^File:/, '');
    return 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(name.replace(/ /g, '_'));
  }

  /* Resolve a local reference against the site ROOT so relative paths like
     "assets/ads/x.jpg" work from any sub-page (/caravans/, /models/, …).
     Absolute http(s) URLs pass through unchanged. */
  function localURL(file) { return /^https?:\/\//i.test(file) ? file : ROOT + String(file).replace(/^\//, ''); }

  /* Unified resolvers: display (resized), original (biggest), and source page.
     Local files resolve against ROOT; Commons names build Commons URLs. */
  function imgURL(file, width) { return isLocal(file) ? localURL(file) : commonsImg(file, width); }
  function origURL(file) { return isLocal(file) ? localURL(file) : commonsFull(file); }
  function srcPage(file) { return isLocal(file) ? localURL(file) : commonsPage(file); }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------------- Data load ---------------- */
  var noCache = { cache: 'no-cache' };
  function dataURL(f) { return ROOT + 'data/' + f; }
  Promise.all([
    fetch(dataURL('airstream.json'), noCache).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
    }),
    fetch(dataURL('ads.json'), noCache).then(function (r) { return r.ok ? r.json() : { ads: [] }; })
      .catch(function () { return { ads: [] }; }),
    fetch(dataURL('books.json'), noCache).then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; }),
    fetch(dataURL('context.json'), noCache).then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; }),
    fetch(dataURL('extras.json'), noCache).then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
  ])
    .then(function (results) {
      DATA = results[0];
      ADS = (results[1] && results[1].ads) || [];
      if (results[2]) BOOKS = results[2];
      if (results[3]) CONTEXT = results[3];
      if (results[4]) EXTRAS = results[4];
      init();
    })
    .catch(function (err) {
      var host = document.getElementById('model-grid') || document.querySelector('main .wrap') || document.body;
      host.innerHTML = '<p style="color:#c85f1e;padding:24px;">Could not load the archive data (' +
        esc(err.message) + '). If you opened this file directly, run a local server instead ' +
        '(e.g. <code>python3 -m http.server</code>).</p>';
    });

  function eraById(id) {
    for (var i = 0; i < DATA.eras.length; i++) if (DATA.eras[i].id === id) return DATA.eras[i];
    return { name: id, years: '' };
  }
  function modelsInEra(id) {
    return DATA.models.filter(function (m) { return m.era === id; });
  }

  /* ---------------- Shared shell (header / footer / lightbox) ---------------- */
  var NAV = [
    ['', 'Timeline'], ['models', 'Models'], ['stoves', 'Stoves'],
    ['caravans', 'Caravans'], ['find', 'Find Yours']
  ];
  var NAV_MORE = [
    ['ads', 'Vintage Ads'], ['books', 'Books'], ['glossary', 'Glossary'], ['about', 'About']
  ];
  function navLinkHTML(item) {
    var pageId = item[0], on = (pageId === '' ? PAGE === 'home' : PAGE === pageId);
    return '<li><a href="' + esc(pageUrl(pageId)) + '"' + (on ? ' class="nav-active" aria-current="page"' : '') + '>' + esc(item[1]) + '</a></li>';
  }
  function buildShell() {
    var header = el('header', 'site-header');
    header.innerHTML =
      '<div class="wrap header-inner">' +
        '<a href="' + esc(ROOT) + '" class="brand" aria-label="The Airstream Archive home">' +
          '<span class="brand-mark" aria-hidden="true"></span>' +
          '<span class="brand-text"><span class="brand-title">The Airstream Archive</span>' +
          '<span class="brand-sub">Every model · every era · since 1931</span></span></a>' +
        '<button class="nav-toggle" id="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="nav-menu"><span></span><span></span><span></span></button>' +
        '<nav class="top-nav" aria-label="Primary"><ul class="nav-menu" id="nav-menu">' +
          NAV.map(navLinkHTML).join('') +
          '<li class="nav-has-sub"><button type="button" class="nav-more" id="nav-more" aria-expanded="false" aria-haspopup="true">More <span aria-hidden="true">▾</span></button>' +
          '<ul class="nav-sub" id="nav-sub">' + NAV_MORE.map(navLinkHTML).join('') + '</ul></li>' +
        '</ul></nav>' +
      '</div>';
    document.body.insertBefore(header, document.body.firstChild);

    var footer = el('footer', 'site-footer');
    footer.innerHTML = '<div class="wrap">' +
      '<p>The Airstream Archive is an independent, non-commercial history project. “Airstream” and model names are trademarks of their owner and are used here for identification and educational purposes only.</p>' +
      '<p class="footer-meta">Photographs are courtesy of their respective owners; vintage advertising is from a private collection. Built as an open, extensible catalog.</p>' +
      '</div>';
    document.body.appendChild(footer);

    var lb = el('div', 'lightbox');
    lb.id = 'lightbox'; lb.hidden = true;
    lb.innerHTML =
      '<button class="lightbox-close" data-lb-close aria-label="Close image">&times;</button>' +
      '<button class="lb-nav lb-prev" id="lb-prev" aria-label="Previous image">&#8249;</button>' +
      '<button class="lb-nav lb-next" id="lb-next" aria-label="Next image">&#8250;</button>' +
      '<figure class="lightbox-fig"><img id="lightbox-img" src="" alt="" /><figcaption id="lightbox-cap"></figcaption></figure>';
    document.body.appendChild(lb);
  }

  /* ---------------- Init (per-page dispatch) ---------------- */
  function init() {
    buildShell();
    switch (PAGE) {
      case 'home': renderHome(); break;
      case 'models':
        var eraParam = new URLSearchParams(location.search).get('era');
        if (eraParam) state.era = eraParam;
        buildFilters(); render(); wireModelControls();
        window.addEventListener('hashchange', route); route();
        break;
      case 'caravans': renderCaravans(); break;
      case 'stoves': renderStoves(); break;
      case 'find': buildQuiz(); buildCompare(); break;
      case 'ads': buildAdArchive(); break;
      case 'books': renderBooks(); break;
      case 'glossary': renderGlossary(); break;
      case 'about': renderAbout(); break;
    }
    wireGlobalEvents();
    wireNav();
  }

  function renderHome() {
    var tag = document.getElementById('hero-tagline');
    if (tag) tag.textContent = DATA.meta.tagline;
    var hs = document.getElementById('hero-stats');
    if (hs) {
      var minY = Math.min.apply(null, DATA.models.map(function (m) { return m.yearStart; }));
      [['', DATA.models.length, 'Model lines'], ['', DATA.eras.length, 'Eras'],
       ['', minY, 'Building since'], ['', uniqueTypes().length, 'Vehicle types']].forEach(function (s) {
        hs.appendChild(el('div', 'stat', '<b>' + s[1] + '</b><span>' + esc(s[2]) + '</span>'));
      });
    }
    buildTimeline();
  }

  function renderAbout() {
    var ai = document.getElementById('about-images'); if (ai) ai.textContent = DATA.meta.imageSource;
    var an = document.getElementById('about-note'); if (an) an.textContent = DATA.meta.note;
    var al = document.getElementById('ad-archives');
    if (al) DATA.meta.adArchives.forEach(function (a) {
      al.appendChild(el('li', null, '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.label) + '</a>'));
    });
  }

  /* ---------------- The Wally Byam caravans ---------------- */
  function renderCaravans() {
    var list = document.getElementById('caravan-list');
    if (!EXTRAS.caravans || !EXTRAS.caravans.length) { document.getElementById('caravans').hidden = true; return; }
    document.getElementById('caravans-intro').textContent = EXTRAS.caravansIntro || '';
    list.innerHTML = '';
    EXTRAS.caravans.forEach(function (c, i) {
      var card = el('article', 'caravan-card' + (i % 2 ? ' flip' : ''));
      var imgs = (c.images || []);
      var media = imgs.length
        ? '<div class="caravan-media">' + imgs.map(function (im) {
            var u = localURL(im.file);
            return '<img loading="lazy" src="' + esc(u) + '" alt="' + esc(im.caption || c.name) + '" ' +
              'data-full="' + esc(u) + '" data-original="' + esc(u) + '" data-cap="' + esc(im.caption || '') + '">';
          }).join('') + '</div>'
        : '';
      card.innerHTML = media +
        '<div class="caravan-body">' +
          '<div class="caravan-years">' + esc(c.years) + '</div>' +
          '<h3 class="caravan-name">' + esc(c.name) + '</h3>' +
          (c.route ? '<div class="caravan-route">' + esc(c.route) + '</div>' : '') +
          '<p class="caravan-blurb">' + esc(c.blurb) + '</p>' +
        '</div>';
      list.appendChild(card);
    });
    // lightbox with prev/next across each caravan's photos
    EXTRAS.caravans.forEach(function (c, ci) {
      var cardEl = list.children[ci];
      var imgs = [].slice.call(cardEl.querySelectorAll('.caravan-media img'));
      var set = imgs.map(function (img) {
        return { display: img.getAttribute('data-full'), original: img.getAttribute('data-original'), cap: img.getAttribute('data-cap'), page: null, credit: null };
      });
      imgs.forEach(function (img, i) { img.style.cursor = 'zoom-in'; img.addEventListener('click', function () { openLightboxSet(set, i); }); });
    });
  }

  /* ---------------- Navigator stoves feature ---------------- */
  function renderStoves() {
    var s = EXTRAS.stoves;
    if (!s || !s.models || !s.models.length) { document.getElementById('stoves').hidden = true; return; }
    document.getElementById('stoves-eyebrow').textContent = s.eyebrow || '';
    document.getElementById('stoves-company').textContent = s.company || '';
    document.getElementById('stoves-intro').textContent = s.intro || '';
    document.getElementById('stoves-why').textContent = s.why || '';
    document.getElementById('stoves-safety').textContent = s.safety || '';
    document.getElementById('stoves-credit').textContent = s.credit || '';
    if (s.love) {
      document.getElementById('stoves-love').hidden = false;
      document.getElementById('stoves-love-h').textContent = s.loveHeading || 'Why we love these';
      document.getElementById('stoves-love-body').innerHTML = esc(s.love) +
        (s.disclosure ? '<span class="stoves-disclosure">' + esc(s.disclosure) + '</span>' : '');
    }
    document.getElementById('stoves-links').innerHTML = (s.links || []).map(function (l) {
      return '<a class="stoves-link" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + ' ↗</a>';
    }).join('');

    var grid = document.getElementById('stove-grid');
    grid.innerHTML = s.models.map(function (m) {
      var imgs = m.images || [];
      var media = imgs.length
        ? '<div class="stove-media">' + imgs.map(function (im) {
            var u = localURL(im.file);
            return '<img loading="lazy" src="' + esc(u) + '" alt="' + esc(m.name + ' stove — ' + (im.caption || '')) + '" ' +
              'data-full="' + esc(u) + '" data-original="' + esc(u) + '" data-cap="' + esc(m.name + ' — ' + (im.caption || '')) + '" ' +
              'onerror="this.style.display=\'none\'">';
          }).join('') + '</div>'
        : '';
      var specs = [
        ['Size', m.dims], ['Fuel', m.fuel], ['Heat', m.btu]
      ].filter(function (r) { return r[1]; }).map(function (r) {
        return '<div class="stove-spec"><span class="ss-k">' + esc(r[0]) + '</span><span class="ss-v">' + esc(r[1]) + '</span></div>';
      }).join('');
      return '<article class="stove-card">' + media +
        '<div class="stove-body">' +
          '<div class="stove-head"><h3 class="stove-name">' + esc(m.name) + '</h3>' +
            (m.price ? '<span class="stove-price">' + esc(m.price) + '</span>' : '') + '</div>' +
          (m.tagline ? '<div class="stove-tagline">' + esc(m.tagline) + '</div>' : '') +
          '<div class="stove-specs">' + specs + '</div>' +
          '<p class="stove-blurb">' + esc(m.blurb) + '</p>' +
          (m.url ? '<a class="stove-cta" href="' + esc(m.url) + '" target="_blank" rel="noopener">See the ' + esc(m.name) + ' at Navigator ↗</a>' : '') +
        '</div></article>';
    }).join('');

    // lightbox: each stove's photos as a navigable set
    [].slice.call(grid.querySelectorAll('.stove-media')).forEach(function (media) {
      var imgs = [].slice.call(media.querySelectorAll('img'));
      var set = imgs.map(function (img) {
        return { display: img.getAttribute('data-full'), original: img.getAttribute('data-original'), cap: img.getAttribute('data-cap'), page: null, credit: null };
      });
      imgs.forEach(function (img, i) { img.style.cursor = 'zoom-in'; img.addEventListener('click', function () { openLightboxSet(set, i); }); });
    });
  }

  /* ---------------- Glossary ---------------- */
  function renderGlossary() {
    var grid = document.getElementById('glossary-grid');
    if (!EXTRAS.glossary || !EXTRAS.glossary.length) { document.getElementById('glossary').hidden = true; return; }
    document.getElementById('glossary-intro').textContent = EXTRAS.glossaryIntro || '';
    grid.innerHTML = EXTRAS.glossary.slice().sort(function (a, b) {
      return a.term.toLowerCase() < b.term.toLowerCase() ? -1 : 1;
    }).map(function (g) {
      return '<div class="glossary-item"><dt>' + esc(g.term) + '</dt><dd>' + esc(g.def) + '</dd></div>';
    }).join('');
  }

  /* ---------------- Compare tool ---------------- */
  function buildCompare() {
    var a = document.getElementById('compare-a'), b = document.getElementById('compare-b');
    var opts = DATA.models.slice().sort(function (x, y) { return x.name < y.name ? -1 : 1; })
      .map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name) + ' (' + yearLabel(m) + ')</option>'; }).join('');
    a.innerHTML = opts; b.innerHTML = opts;
    a.selectedIndex = 0;
    b.selectedIndex = Math.min(1, DATA.models.length - 1);
    a.addEventListener('change', renderCompare);
    b.addEventListener('change', renderCompare);
    renderCompare();
  }
  function renderCompare() {
    var ma = modelById(document.getElementById('compare-a').value);
    var mb = modelById(document.getElementById('compare-b').value);
    if (!ma || !mb) return;
    function cell(m, val) { return '<td>' + val + '</td>'; }
    function mk(m) { return marketFor(m) || {}; }
    var rows = [
      ['', function (m) { return '<a class="compare-link" href="' + esc(modelUrl(m.id)) + '">' + esc(m.name) + ' →</a>'; }],
      ['Years', function (m) { return esc(yearLabel(m)); }],
      ['Era', function (m) { return esc(eraById(m.era).name); }],
      ['Type', function (m) { return esc(m.type); }],
      ['Length(s)', function (m) { return esc((m.lengths || []).join(', ') || '—'); }],
      ['Sleeps', function (m) { return esc(m.sleeps || '—'); }],
      ['Price when new', function (m) { return esc(m.priceNew || '—'); }],
      ['Dry weight', function (m) { return esc(mk(m).dry || (mk(m).motorhome ? 'motorhome' : '—')); }],
      ['GVWR', function (m) { return esc(mk(m).gvwr || '—'); }],
      ['Rarity', function (m) { return mk(m).level ? rarityMeter(mk(m).level) + ' ' + esc(mk(m).rarity || '') : '—'; }],
      ['Value today', function (m) { return esc(mk(m).value || '—'); }]
    ];
    document.getElementById('compare-table').innerHTML = '<table><tbody>' + rows.map(function (r) {
      return '<tr><th>' + r[0] + '</th>' + cell(ma, r[1](ma)) + cell(mb, r[1](mb)) + '</tr>';
    }).join('') + '</tbody></table>';
  }

  /* ---------------- Find-your-Airstream quiz ---------------- */
  var QUIZ = [
    { key: 'size', q: 'How big do you want to go?', opts: [
      { label: 'Compact (≤ 19 ft)', v: 'compact' }, { label: 'Mid-size (20–25 ft)', v: 'mid' },
      { label: 'Large (26 ft +)', v: 'large' }, { label: 'A motorhome', v: 'motor' } ] },
    { key: 'use', q: 'What will you mostly do?', opts: [
      { label: 'Weekend getaways', v: 'weekend' }, { label: 'Full-time / long trips', v: 'fulltime' },
      { label: 'Off-grid adventures', v: 'offgrid' }, { label: 'Haul bikes & gear', v: 'gear' } ] },
    { key: 'era', q: 'Vintage or modern?', opts: [
      { label: 'Vintage classic', v: 'vintage' }, { label: 'Modern & new', v: 'modern' }, { label: 'Either', v: 'either' } ] }
  ];
  var quizState = {};
  function maxLen(m) {
    var mx = 0; (m.lengths || []).forEach(function (l) { var n = parseInt(String(l).replace(/[^0-9]/g, ''), 10); if (n > mx) mx = n; });
    return mx;
  }
  function isMotorhome(m) { return /Motorhome/.test(m.type); }
  function isModernModel(m) { return (m.yearEnd || m.yearStart) >= 2015; }
  function scoreModel(m) {
    var s = 0, len = maxLen(m);
    if (quizState.size === 'motor') { if (isMotorhome(m)) s += 5; else s -= 4; }
    else {
      if (isMotorhome(m)) s -= 3;
      if (quizState.size === 'compact') s += (len && len <= 19) ? 4 : (len <= 22 ? 1 : -2);
      if (quizState.size === 'mid') s += (len >= 20 && len <= 25) ? 4 : -1;
      if (quizState.size === 'large') s += (len >= 26) ? 4 : -2;
    }
    if (quizState.use === 'weekend') s += (len && len <= 22 && !isMotorhome(m)) ? 3 : 0;
    if (quizState.use === 'fulltime') s += (len >= 25 || isMotorhome(m)) ? 3 : 0;
    if (quizState.use === 'offgrid') s += /basecamp|trade-wind-modern|bambi/.test(m.id) ? 4 : 0;
    if (quizState.use === 'gear') s += /basecamp/.test(m.id) ? 5 : 0;
    if (quizState.era === 'vintage') s += !isModernModel(m) ? 3 : -3;
    if (quizState.era === 'modern') s += isModernModel(m) ? 3 : -3;
    return s;
  }
  function buildQuiz() {
    var q = document.getElementById('quiz');
    q.innerHTML = QUIZ.map(function (item) {
      return '<div class="quiz-q" data-key="' + item.key + '"><p class="quiz-prompt">' + esc(item.q) + '</p>' +
        '<div class="quiz-opts">' + item.opts.map(function (o) {
          return '<button type="button" class="quiz-opt" data-key="' + item.key + '" data-v="' + o.v + '">' + esc(o.label) + '</button>';
        }).join('') + '</div></div>';
    }).join('') + '<div class="quiz-result" id="quiz-result"></div>';
    q.querySelectorAll('.quiz-opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-key');
        quizState[key] = btn.getAttribute('data-v');
        q.querySelectorAll('.quiz-opt[data-key="' + key + '"]').forEach(function (b) { b.classList.remove('sel'); });
        btn.classList.add('sel');
        renderQuizResult();
      });
    });
  }
  function renderQuizResult() {
    var res = document.getElementById('quiz-result');
    if (Object.keys(quizState).length < QUIZ.length) {
      res.innerHTML = '<p class="quiz-hint">Answer all three to see your matches.</p>';
      return;
    }
    var ranked = DATA.models.map(function (m) { return { m: m, s: scoreModel(m) }; })
      .sort(function (a, b) { return b.s - a.s || a.m.yearStart - b.m.yearStart; })
      .filter(function (x) { return x.s > 0; }).slice(0, 3);
    if (!ranked.length) { res.innerHTML = '<p class="quiz-hint">No strong match — try different answers.</p>'; return; }
    res.innerHTML = '<h4 class="quiz-rh">Your top matches</h4><div class="quiz-matches">' +
      ranked.map(function (x) {
        var m = x.m, mk = marketFor(m) || {};
        return '<a class="quiz-match" href="' + esc(modelUrl(m.id)) + '">' +
          '<span class="qm-name">' + esc(m.name) + '</span>' +
          '<span class="qm-meta">' + esc(yearLabel(m)) + ' · ' + esc((m.lengths || []).join(', ') || m.type) + '</span>' +
          (mk.value ? '<span class="qm-val">' + esc(mk.value) + '</span>' : '') +
          '<span class="qm-go">View every year →</span></a>';
      }).join('') + '</div>';
  }

  /* ---------------- The Airstream bookshelf ---------------- */
  function amazonURL(b) {
    var tag = (BOOKS.meta && BOOKS.meta.amazonTag) ? String(BOOKS.meta.amazonTag).trim() : '';
    if (b.asin) {
      return 'https://www.amazon.com/dp/' + encodeURIComponent(b.asin) +
        (tag ? '?tag=' + encodeURIComponent(tag) : '');
    }
    return 'https://www.amazon.com/s?k=' + encodeURIComponent(b.title + ' ' + b.authors) +
      '&i=stripbooks' + (tag ? '&tag=' + encodeURIComponent(tag) : '');
  }
  function renderBooks() {
    if (!BOOKS.books || !BOOKS.books.length) { document.getElementById('books').hidden = true; return; }
    if (BOOKS.meta) {
      document.getElementById('books-intro').textContent = BOOKS.meta.intro || '';
      document.getElementById('books-note').textContent = BOOKS.meta.note || '';
    }
    var grid = document.getElementById('books-grid');
    grid.innerHTML = '';
    (BOOKS.categories || [{ id: null, name: '' }]).forEach(function (cat) {
      var items = BOOKS.books.filter(function (b) { return b.category === cat.id; });
      if (!items.length) return;
      var section = el('div', 'book-cat');
      if (cat.name) section.appendChild(el('h3', 'book-cat-title', esc(cat.name)));
      var row = el('div', 'book-row');
      items.sort(function (a, b) { return (a.year || 0) - (b.year || 0); }).forEach(function (b) {
        var card = el('a', 'book-card');
        card.href = amazonURL(b); card.target = '_blank'; card.rel = 'noopener nofollow sponsored';
        var cover = b.cover
          ? '<div class="book-cover"><img loading="lazy" src="' + esc(localURL(b.cover)) + '" alt="Cover of ' + esc(b.title) + '"></div>'
          : '<div class="book-cover book-cover-ph"><span>' + esc(b.title) + '</span></div>';
        card.innerHTML =
          cover +
          '<div class="book-info">' +
            '<div class="book-title">' + esc(b.title) + '</div>' +
            '<div class="book-authors">' + esc(b.authors) + (b.year ? ' · ' + b.year : '') + '</div>' +
            (b.description || b.note ? '<p class="book-note">' + esc(b.description || b.note) + '</p>' : '') +
            '<span class="book-amazon">View on Amazon →</span>' +
          '</div>';
        row.appendChild(card);
      });
      section.appendChild(row);
      grid.appendChild(section);
    });
  }

  /* ---------------- Vintage ad archive ---------------- */
  function decadeOf(y) { return y ? Math.floor(y / 10) * 10 : null; }

  function adsForModel(m) {
    var s = m.yearStart, e = m.yearEnd || s;
    return ADS.filter(function (a) { return a.year && a.year >= s && a.year <= e; })
      .sort(function (a, b) { return a.year - b.year; });
  }
  function leadAdImage(m) {
    var list = adsForModel(m).filter(function (a) { return a.category === 'ad'; });
    return list.length ? list[0] : (adsForModel(m)[0] || null);
  }

  function catLabel(c) {
    return { ad: 'Ad', brochure: 'Brochure', floorplan: 'Floor plan', argosy: 'Argosy' }[c] || c;
  }

  function buildAdArchive() {
    if (!ADS.length) { document.getElementById('ads').hidden = true; return; }
    var yrs = ADS.filter(function (a) { return a.year; }).map(function (a) { return a.year; });
    var minY = Math.min.apply(null, yrs), maxY = Math.max.apply(null, yrs);
    document.getElementById('ads-intro').textContent =
      ADS.length + ' original Airstream advertisements, brochures and factory floor-plan sheets — ' +
      minY + ' to ' + maxY + ' — digitized from a private collection. Click any scan to view it full size.';

    // decade chips
    var decs = {};
    ADS.forEach(function (a) { if (a.year) decs[decadeOf(a.year)] = true; });
    var decList = Object.keys(decs).map(Number).sort(function (a, b) { return a - b; });
    var df = document.getElementById('ad-decade-filters');
    df.appendChild(adChip('All years', 'all', 'decade'));
    decList.forEach(function (d) { df.appendChild(adChip(d + 's', String(d), 'decade')); });

    // category chips
    var cats = {};
    ADS.forEach(function (a) { cats[a.category] = (cats[a.category] || 0) + 1; });
    var cf = document.getElementById('ad-cat-filters');
    cf.appendChild(adChip('All types', 'all', 'cat', true));
    ['ad', 'brochure', 'floorplan', 'argosy'].forEach(function (c) {
      if (cats[c]) cf.appendChild(adChip(catLabel(c) + 's (' + cats[c] + ')', c, 'cat', true));
    });

    // default to the richest decade for a fast first paint
    var counts = {};
    decList.forEach(function (d) { counts[d] = 0; });
    ADS.forEach(function (a) { if (a.year) counts[decadeOf(a.year)]++; });
    adState.decade = String(decList.reduce(function (best, d) { return counts[d] > counts[best] ? d : best; }, decList[0]));
    syncAdChips();
    renderAdArchive();
  }

  function adChip(label, value, kind, isType) {
    var c = el('button', 'chip' + (isType ? ' type-chip' : ''), esc(label));
    c.type = 'button'; c.dataset.adkind = kind; c.dataset.value = value;
    c.addEventListener('click', function () {
      if (kind === 'decade') adState.decade = value; else adState.cat = value;
      syncAdChips(); renderAdArchive();
    });
    return c;
  }
  function syncAdChips() {
    document.querySelectorAll('[data-adkind]').forEach(function (c) {
      var on = (c.dataset.adkind === 'decade' && c.dataset.value === adState.decade) ||
               (c.dataset.adkind === 'cat' && c.dataset.value === adState.cat);
      c.classList.toggle('active', on);
    });
  }

  function currentAds() {
    return ADS.filter(function (a) {
      if (adState.cat !== 'all' && a.category !== adState.cat) return false;
      if (adState.decade !== 'all') {
        if (!a.year || String(decadeOf(a.year)) !== adState.decade) return false;
      }
      return true;
    });
  }

  function adThumb(a, onClick) {
    var t = el('button', 'ad-thumb cat-' + a.category);
    t.type = 'button';
    t.setAttribute('aria-label', a.label + (a.year ? ' (' + a.year + ')' : ''));
    var img = new Image();
    img.loading = 'lazy';
    img.alt = a.label + (a.year ? ' — ' + a.year : '');
    img.src = localURL(a.file);
    img.onerror = function () { t.style.display = 'none'; };
    t.appendChild(img);
    t.appendChild(el('span', 'ad-cat', esc(catLabel(a.category) + (a.year ? ' · ' + a.year : ''))));
    t.addEventListener('click', onClick || function () {
      var u = localURL(a.file);
      openLightbox({ display: u, original: u, cap: adCaption(a), page: null, credit: null });
    });
    return t;
  }
  function adCaption(a) {
    var lbl = a.label || '';
    var prefix = (a.year && lbl.indexOf(String(a.year)) !== 0) ? a.year + ' — ' : '';
    return prefix + lbl + ' · ' + catLabel(a.category) + ' · Personal collection';
  }

  function renderAdArchive() {
    var wrap = document.getElementById('ad-archive');
    wrap.innerHTML = '';
    var list = currentAds();
    document.getElementById('ad-count').textContent =
      list.length + ' item' + (list.length === 1 ? '' : 's') + ' shown';

    // group by year (undated last)
    var groups = {};
    list.forEach(function (a) {
      var k = a.year || 'Undated';
      (groups[k] = groups[k] || []).push(a);
    });
    var keys = Object.keys(groups).sort(function (x, y) {
      if (x === 'Undated') return 1; if (y === 'Undated') return -1;
      return Number(x) - Number(y);
    });
    // flat set (in display order) so the lightbox can page across the whole archive
    var lbItems = [];
    keys.forEach(function (k) {
      var g = el('div', 'ad-year-group');
      var items = groups[k];
      g.innerHTML = '<h3 class="ad-year-head">' + esc(k) +
        '<span class="yc">' + items.length + ' item' + (items.length === 1 ? '' : 's') + '</span></h3>' +
        '<div class="ad-year-rule"></div>';
      var grid = el('div', 'ad-grid');
      items.forEach(function (a) {
        var idx = lbItems.length;
        lbItems.push({ display: localURL(a.file), original: localURL(a.file), cap: adCaption(a), page: null, credit: null });
        grid.appendChild(adThumb(a, function () { openLightboxSet(lbItems, idx); }));
      });
      g.appendChild(grid);
      wrap.appendChild(g);
    });
  }

  function uniqueTypes() {
    var set = {};
    DATA.models.forEach(function (m) { set[m.type] = true; });
    return Object.keys(set);
  }

  /* ---------------- Timeline ---------------- */
  function buildTimeline() {
    var tl = document.getElementById('timeline-grid');
    DATA.eras.forEach(function (era, i) {
      var count = modelsInEra(era.id).length;
      var num = ('0' + (i + 1)).slice(-2);
      var card = el('button', 'era-card');
      card.type = 'button';
      card.innerHTML =
        '<div class="era-head">' +
          '<span class="era-num" aria-hidden="true">' + num + '</span>' +
          '<div class="era-years">' + esc(era.years) + '</div>' +
          '<div class="era-name">' + esc(era.name) + '</div>' +
        '</div>' +
        '<div class="era-body">' +
          '<p class="era-blurb">' + esc(era.blurb) + '</p>' +
          '<span class="era-count">' + count + ' model' + (count === 1 ? '' : 's') + ' →</span>' +
        '</div>';
      card.addEventListener('click', function () {
        location.href = pageUrl('models') + '?era=' + encodeURIComponent(era.id);
      });
      tl.appendChild(card);
    });
  }

  /* ---------------- Filters ---------------- */
  function buildFilters() {
    var ef = document.getElementById('era-filters');
    ef.appendChild(makeChip('All eras', 'all', 'era'));
    DATA.eras.forEach(function (era) { ef.appendChild(makeChip(era.name, era.id, 'era')); });

    var tf = document.getElementById('type-filters');
    tf.appendChild(makeChip('All types', 'all', 'type', true));
    uniqueTypes().forEach(function (t) { tf.appendChild(makeChip(t, t, 'type', true)); });
  }
  function makeChip(label, value, kind, isType) {
    var c = el('button', 'chip' + (isType ? ' type-chip' : ''), esc(label));
    c.type = 'button';
    c.dataset.kind = kind;
    c.dataset.value = value;
    if ((kind === 'era' && state.era === value) || (kind === 'type' && state.type === value)) c.classList.add('active');
    c.addEventListener('click', function () {
      if (kind === 'era') setEra(value); else setType(value);
    });
    return c;
  }
  function setEra(v) { state.era = v; syncChips(); render(); }
  function setType(v) { state.type = v; syncChips(); render(); }
  function syncChips() {
    document.querySelectorAll('.chip').forEach(function (c) {
      var on = (c.dataset.kind === 'era' && c.dataset.value === state.era) ||
               (c.dataset.kind === 'type' && c.dataset.value === state.type);
      c.classList.toggle('active', on);
    });
  }

  /* ---------------- Render grid ---------------- */
  function currentModels() {
    var q = state.query.trim().toLowerCase();
    return DATA.models.filter(function (m) {
      if (state.era !== 'all' && m.era !== state.era) return false;
      if (state.type !== 'all' && m.type !== state.type) return false;
      if (q) {
        var hay = (m.name + ' ' + m.type + ' ' + m.description + ' ' +
          (m.lengths || []).join(' ') + ' ' + eraById(m.era).name).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    }).sort(function (a, b) { return a.yearStart - b.yearStart; });
  }

  function render() {
    var grid = document.getElementById('model-grid');
    var list = currentModels();
    grid.innerHTML = '';
    document.getElementById('no-results').hidden = list.length > 0;

    var rc = document.getElementById('result-count');
    rc.textContent = list.length + ' of ' + DATA.models.length + ' model lines shown';

    list.forEach(function (m) {
      var card = el('article', 'model-card');
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', m.name + ', ' + yearLabel(m));

      var media = el('div', 'card-media');
      var lead = (m.images && m.images.length) ? m.images[0] : null;
      var leadAd = lead ? null : leadAdImage(m);
      if (lead || leadAd) {
        var img = new Image();
        img.loading = 'lazy';
        img.alt = lead ? (lead.caption || m.name) : (m.name + ' — period advertisement');
        img.src = lead ? imgURL(lead.file, 640) : localURL(leadAd.file);
        img.onerror = function () { media.innerHTML = '<div class="placeholder">Photo unavailable</div>'; };
        media.appendChild(img);
        if (leadAd) media.appendChild(el('span', 'card-adtag', 'Period ad'));
      } else {
        media.appendChild(el('div', 'placeholder', 'Add a photo'));
      }
      media.appendChild(el('span', 'card-badge', esc(eraById(m.era).name)));
      media.appendChild(el('span', 'card-type', esc(shortType(m.type))));

      var body = el('div', 'card-body');
      body.appendChild(el('h3', 'card-title', esc(m.name)));
      body.appendChild(el('div', 'card-years', esc(yearLabel(m))));
      body.appendChild(el('p', 'card-desc', esc(m.description)));

      var specs = el('div', 'card-specs');
      specs.innerHTML =
        '<span class="spec"><b>Length</b> ' + esc((m.lengths || []).join(', ') || '—') + '</span>' +
        '<span class="spec"><b>Sleeps</b> ' + esc(m.sleeps || '—') + '</span>';
      body.appendChild(specs);

      var href = '#/model/' + encodeURIComponent(m.id);
      body.appendChild(el('span', 'card-cta', 'View every year →'));
      card.appendChild(media);
      card.appendChild(body);
      card.addEventListener('click', function () { location.hash = href; });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); location.hash = href; }
      });
      grid.appendChild(card);
    });
  }

  function yearLabel(m) {
    if (!m.yearEnd || m.yearEnd === m.yearStart) return String(m.yearStart);
    var cur = (new Date()).getFullYear();
    if (m.yearEnd >= cur - 1) return m.yearStart + '–present';
    return m.yearStart + '–' + m.yearEnd;
  }
  function shortType(t) {
    return t.replace('Travel Trailer', 'Trailer').replace('Motorhome (Class A)', 'Class A')
      .replace('Motorhome (Class B)', 'Class B').replace('Motorhome (Class B/B+)', 'Class B+');
  }

  /* ---------------- Shared detail builders ---------------- */
  function galleryHTML(images, name) {
    if (!images || !images.length) return '';
    return '<div class="m-gallery' + (images.length === 1 ? ' single' : '') + '">' +
      images.map(function (im) {
        return '<figure>' +
          '<img loading="lazy" src="' + imgURL(im.file, 900) + '" alt="' + esc(im.caption || name) + '" ' +
          'data-full="' + imgURL(im.file, 2000) + '" data-original="' + esc(origURL(im.file)) + '" ' +
          'data-cap="' + esc(im.caption || '') + '" ' +
          'data-src-page="' + esc(srcPage(im.file)) + '" data-credit="' + esc(im.credit || '') + '">' +
          '<figcaption>' + esc(im.caption || '') +
          ' · <a href="' + esc(srcPage(im.file)) + '" target="_blank" rel="noopener">' +
          esc(im.credit || 'source') + '</a></figcaption>' +
        '</figure>';
      }).join('') + '</div>';
  }
  function specGridHTML(cells) {
    return '<div class="m-specs">' + cells.map(function (s) {
      return '<div class="spec-cell"><div class="spec-label">' + esc(s[0]) +
        '</div><div class="spec-value">' + esc(s[1]) + '</div></div>';
    }).join('') + '</div>';
  }
  function listSection(title, items, cls) {
    if (!items || !items.length) return '';
    return '<h4 class="m-subhead">' + title + '</h4><ul class="m-list ' + (cls || '') + '">' +
      items.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>';
  }
  function adThumbsHTML(list) {
    return '<div class="m-ad-thumbs">' + list.map(function (a) {
      var u = localURL(a.file);
      return '<button type="button" class="ad-thumb cat-' + a.category + '" ' +
        'data-adfile="' + esc(u) + '" data-adcap="' + esc(adCaption(a)) + '" aria-label="' + esc(a.label) + '">' +
        '<img loading="lazy" src="' + esc(u) + '" alt="' + esc(a.label) + '">' +
        '<span class="ad-cat">' + esc(catLabel(a.category) + (a.year ? ' · ' + a.year : '')) + '</span></button>';
    }).join('') + '</div>';
  }
  function crumbs(items) {
    return '<nav class="crumbs">' + items.map(function (it, i) {
      var last = i === items.length - 1;
      if (last || !it[0]) return '<span class="crumb-cur">' + esc(it[1]) + '</span>';
      return '<a href="' + esc(it[0]) + '">' + esc(it[1]) + '</a><span class="sep">/</span>';
    }).join('') + '</nav>';
  }
  /* Wire the lightbox for gallery images and ad thumbnails within a container.
     Each group becomes a navigable set (prev/next) in the lightbox. */
  function wireLightbox(container) {
    var galImgs = [].slice.call(container.querySelectorAll('.m-gallery img'));
    var galSet = galImgs.map(function (img) {
      return {
        display: img.getAttribute('data-full'), original: img.getAttribute('data-original'),
        cap: img.getAttribute('data-cap'), page: img.getAttribute('data-src-page'), credit: img.getAttribute('data-credit')
      };
    });
    galImgs.forEach(function (img, i) {
      img.addEventListener('click', function () { openLightboxSet(galSet, i); });
    });

    var adBtns = [].slice.call(container.querySelectorAll('.ad-thumb[data-adfile]'));
    var adSet = adBtns.map(function (btn) {
      var f = btn.getAttribute('data-adfile');
      return { display: f, original: f, cap: btn.getAttribute('data-adcap'), page: null, credit: null };
    });
    adBtns.forEach(function (btn, i) {
      btn.addEventListener('click', function () { openLightboxSet(adSet, i); });
    });
  }

  /* ---------------- Per-year helpers ---------------- */
  function modelById(id) {
    for (var i = 0; i < DATA.models.length; i++) if (DATA.models[i].id === id) return DATA.models[i];
    return null;
  }
  function modelYears(m) {
    var cur = (new Date()).getFullYear();
    var end = Math.min(m.yearEnd || m.yearStart, cur);
    var arr = [];
    for (var y = m.yearStart; y <= end; y++) arr.push(y);
    return arr;
  }
  function adsForYear(year) {
    return ADS.filter(function (a) { return a.year === year; })
      .sort(function (a, b) { return a.category < b.category ? -1 : (a.category > b.category ? 1 : 0); });
  }

  /* Inflation-adjust the first dollar amount found in a price string. */
  function inflatedPrice(priceStr, year) {
    if (!priceStr) return null;
    var m = String(priceStr).replace(/,/g, '').match(/\$\s?(\d{2,6})/);
    if (!m) return null;
    var amount = parseInt(m[1], 10);
    var base = CPI[year];
    if (!base) { // fall back to nearest known year
      var ys = Object.keys(CPI).map(Number);
      base = CPI[ys.reduce(function (p, c) { return Math.abs(c - year) < Math.abs(p - year) ? c : p; }, ys[0])];
    }
    if (!base) return null;
    var today = Math.round(amount * (CPI_REF / base) / 100) * 100;
    return { original: amount, today: today };
  }
  function money(n) { return '$' + n.toLocaleString('en-US'); }

  function funFactFor(m) {
    return (DATA.meta && DATA.meta.funFacts && DATA.meta.funFacts[m.id]) || '';
  }
  function byamQuote(seed) {
    return BYAM_QUOTES[Math.abs(seed) % BYAM_QUOTES.length];
  }


  /* ---------------- Market / community blocks ---------------- */
  function marketFor(m) { return (DATA.meta.market && DATA.meta.market[m.id]) || null; }

  function rarityMeter(level) {
    var dots = '';
    for (var i = 1; i <= 5; i++) dots += '<span class="rd' + (i <= level ? ' on' : '') + '"></span>';
    return '<span class="rarity-meter" role="img" aria-label="Collectibility ' + level + ' of 5">' + dots + '</span>';
  }
  function towingBlock(mkt) {
    if (!mkt) return '';
    if (mkt.motorhome) return '<h4 class="m-subhead">Weights &amp; towing</h4>' +
      '<p class="m-ad-note">Self-propelled motorhome — refer to the chassis GVWR rather than trailer tow weights.</p>';
    var rows = [];
    if (mkt.dry) rows.push(['Dry weight', mkt.dry]);
    if (mkt.gvwr) rows.push(['GVWR', mkt.gvwr]);
    if (mkt.hitch) rows.push(['Hitch weight', mkt.hitch]);
    if (!rows.length) return '';
    return '<h4 class="m-subhead">Weights &amp; towing</h4>' + specGridHTML(rows);
  }
  function collectBlock(mkt) {
    if (!mkt) return '';
    return '<h4 class="m-subhead">Collectibility &amp; value</h4><div class="collect">' +
      '<div class="collect-row"><span class="collect-key">Rarity</span>' + rarityMeter(mkt.level || 1) +
        '<span class="collect-val">' + esc(mkt.rarity || '') + '</span></div>' +
      (mkt.why ? '<p class="collect-why">' + esc(mkt.why) + '</p>' : '') +
      (mkt.production ? '<div class="collect-row"><span class="collect-key">Production</span><span class="collect-val">' + esc(mkt.production) + '</span></div>' : '') +
      (mkt.value ? '<div class="collect-row"><span class="collect-key">Value today</span><span class="collect-val strong">' + esc(mkt.value) + '</span></div>' : '') +
      '<p class="collect-note">' + esc(DATA.meta.marketNote || 'Approximate; varies with condition.') + '</p>' +
      '</div>';
  }
  function serialBlock() {
    var s = DATA.meta.serial; if (!s) return '';
    return '<details class="serial"><summary>Finding &amp; reading the serial number</summary>' +
      (s.where ? '<p><strong>Where:</strong> ' + esc(s.where) + '</p>' : '') +
      (s.reading ? '<p><strong>Reading it:</strong> ' + esc(s.reading) + '</p>' : '') +
      (s.tip ? '<p class="serial-tip">' + esc(s.tip) + '</p>' : '') + '</details>';
  }
  function exploreBlock(m, year) {
    var years = modelYears(m), idx = years.indexOf(year), id = encodeURIComponent(m.id);
    var nav = [];
    if (idx > 0) nav.push('<a class="chip" href="#/model/' + id + '/' + years[idx - 1] + '">← Compare to ' + years[idx - 1] + '</a>');
    if (idx >= 0 && idx < years.length - 1) nav.push('<a class="chip" href="#/model/' + id + '/' + years[idx + 1] + '">Compare to ' + years[idx + 1] + ' →</a>');
    var sibs = DATA.models.filter(function (x) {
      return x.id !== m.id && x.yearStart <= year && (x.yearEnd || x.yearStart) >= year;
    });
    var out = '<h4 class="m-subhead">Explore more</h4>';
    if (nav.length) out += '<div class="filter-row">' + nav.join('') + '</div>';
    if (sibs.length) out += '<p class="m-ad-note">Other Airstreams you could buy new in ' + year + ':</p>' +
      '<div class="filter-row">' + sibs.map(function (x) {
        return '<a class="chip" href="#/model/' + encodeURIComponent(x.id) + '/' + year + '">' + esc(x.name) + '</a>';
      }).join('') + '</div>';
    return out;
  }
  function communityBlock(m, year) {
    var out = '<h4 class="m-subhead">Owner community</h4>';
    var op = DATA.meta.ownerPhotos && DATA.meta.ownerPhotos[m.id + '/' + year];
    if (op && op.length) out += '<p class="m-ad-note">Spotted in the wild — reader submissions:</p>' + galleryHTML(op, m.name);
    if (DATA.meta.community && DATA.meta.community.length) {
      out += '<ul class="link-list">' + DATA.meta.community.map(function (c) {
        return '<li><a href="' + esc(c.url) + '" target="_blank" rel="noopener">' + esc(c.label) + '</a>' +
          (c.note ? ' — ' + esc(c.note) : '') + '</li>';
      }).join('') + '</ul>';
    }
    var email = DATA.meta.submitEmail;
    out += '<p class="share-cta">Own or spotted a ' + year + ' ' + esc(m.name) + '? ' +
      (email ? '<a href="mailto:' + esc(email) + '?subject=' + encodeURIComponent(year + ' ' + m.name + ' photo') + '">Share your photo</a> to feature it here.'
             : 'Great owner photos get featured in this “spotted in the wild” gallery.') + '</p>';
    return out;
  }

  /* ---------------- Model overview page ---------------- */
  function renderModelPage(m) {
    var era = eraById(m.era);
    var years = modelYears(m);
    var id = encodeURIComponent(m.id);

    var yearCards = years.map(function (y) {
      var n = adsForYear(y).length;
      return '<a class="year-card" href="#/model/' + id + '/' + y + '">' +
        '<span class="yc-year">' + y + '</span>' +
        '<span class="yc-ads">' + (n ? n + ' ad' + (n === 1 ? '' : 's') : 'open') + '</span></a>';
    }).join('');

    var periodAds = adsForModel(m);
    var note = (m.ads && m.ads[0] && m.ads[0].note) ? m.ads[0].note : '';

    var detail = document.getElementById('detail-view');
    detail.innerHTML =
      '<div class="detail-wrap wrap">' +
        crumbs([[ROOT, 'Home'], [pageUrl('models'), 'Models'], [null, m.name]]) +
        '<div class="detail-head">' +
          '<p class="m-eyebrow">' + esc(era.name) + ' · ' + esc(era.years) + ' · ' + esc(m.type) + '</p>' +
          '<h1 class="detail-title">' + esc(m.name) + '</h1>' +
          '<div class="m-years">' + esc(yearLabel(m)) + '</div>' +
        '</div>' +
        galleryHTML(m.images, m.name) +
        '<div class="detail-body">' +
          specGridHTML([
            ['Years', yearLabel(m)], ['Type', m.type],
            ['Length(s)', (m.lengths || []).join(', ') || '—'], ['Sleeps', m.sleeps || '—'],
            ['Price when new', m.priceNew || '—'], ['Era', era.name]
          ]) +
          '<p class="m-desc">' + esc(m.description) + '</p>' +
          (funFactFor(m) ? '<div class="funfact"><span class="ff-label">Did you know?</span><p>' + esc(funFactFor(m)) + '</p></div>' : '') +
          listSection('Floor plans &amp; layouts', m.floorplans, 'm-floorplans') +
          listSection('Notable features', m.highlights, 'highlights') +
          towingBlock(marketFor(m)) +
          collectBlock(marketFor(m)) +
          serialBlock() +
          '<h4 class="m-subhead">A page for every model year</h4>' +
          '<p class="m-ad-note">Open any year of the ' + esc(m.name) + ' for its own page — with that year’s ads, brochures and floor-plan sheets from the archive.</p>' +
          '<div class="year-grid">' + yearCards + '</div>' +
          (periodAds.length
            ? '<h4 class="m-subhead">Advertising across the run</h4>' +
              (note ? '<p class="m-ad-lead">' + esc(note) + '</p>' : '') +
              '<p class="m-ad-note">' + periodAds.length + ' item' + (periodAds.length === 1 ? '' : 's') +
                ' spanning ' + esc(yearLabel(m)) + ' — a sample below; open a year for its own ads.</p>' +
              adThumbsHTML(periodAds.slice(0, 8)) +
              '<a class="ad-link" href="' + esc(pageUrl('ads')) + '">See the full advertising archive →</a>'
            : '') +
        '</div>' +
      '</div>';
  }

  /* ---------------- Individual year page ---------------- */
  function renderYearPage(m, year) {
    var era = eraById(m.era);
    var years = modelYears(m);
    var idx = years.indexOf(year);
    var id = encodeURIComponent(m.id);
    var prev = idx > 0 ? years[idx - 1] : null;
    var next = idx >= 0 && idx < years.length - 1 ? years[idx + 1] : null;
    var yearAds = adsForYear(year);

    var nav = '<div class="year-nav">' +
      (prev ? '<a href="#/model/' + id + '/' + prev + '">← ' + prev + '</a>' : '<span class="yn-empty"></span>') +
      '<a class="yn-all" href="#/model/' + id + '">All ' + esc(m.name) + ' years</a>' +
      (next ? '<a href="#/model/' + id + '/' + next + '">' + next + ' →</a>' : '<span class="yn-empty"></span>') +
      '</div>';

    var adsBlock;
    if (yearAds.length) {
      adsBlock = '<h4 class="m-subhead">' + year + ' Airstream advertising &amp; brochures</h4>' +
        '<p class="m-ad-note">' + yearAds.length + ' item' + (yearAds.length === 1 ? '' : 's') +
        ' from ' + year + ' in the archive — click any scan to view full size:</p>' +
        adThumbsHTML(yearAds);
    } else {
      adsBlock = '<h4 class="m-subhead">' + year + ' advertising</h4>' +
        '<p class="m-ad-note">No ' + year + ' scans in the archive yet. ' +
        '<a href="' + esc(pageUrl('ads')) + '">Browse the full advertising archive →</a></p>';
    }

    var ms = (DATA.meta.milestones && DATA.meta.milestones[year]) ? DATA.meta.milestones[year] : '';
    var msBlock = ms
      ? '<div class="milestone"><span class="milestone-label">' + year + ' at Airstream</span>' +
        '<p>' + esc(ms) + '</p></div>'
      : '';

    var inf = inflatedPrice(m.priceNew, year);
    var priceBlock = inf
      ? '<div class="pricenow"><span class="pn-then">' + money(inf.original) + ' new</span>' +
        '<span class="pn-arrow" aria-hidden="true">→</span>' +
        '<span class="pn-now">≈ ' + money(inf.today) + ' today</span>' +
        '<span class="pn-note">inflation-adjusted from ' + year + '</span></div>'
      : '';

    var ctx = CONTEXT.years && CONTEXT.years[year];
    var ctxBlock = ctx
      ? '<div class="context"><h4 class="m-subhead">' + year + ' in America</h4>' +
        '<div class="ctx-stats">' +
          (ctx.gas ? '<div class="ctx-stat"><span class="ctx-val">' + esc(ctx.gas) + '</span><span class="ctx-key">gas</span></div>' : '') +
          (ctx.car ? '<div class="ctx-stat"><span class="ctx-val">' + esc(ctx.car) + '</span><span class="ctx-key">new car</span></div>' : '') +
        '</div>' +
        (ctx.note ? '<p class="ctx-note">' + esc(ctx.note) + '</p>' : '') + '</div>'
      : '';

    var ff = funFactFor(m);
    var ffBlock = ff ? '<div class="funfact"><span class="ff-label">Did you know?</span><p>' + esc(ff) + '</p></div>' : '';

    var quoteBlock = '<figure class="byam-quote"><blockquote>“' + esc(byamQuote(year)) + '”</blockquote>' +
      '<figcaption>— Wally Byam, founder of Airstream</figcaption></figure>';

    var mkt = marketFor(m);

    // Year-specific photos where a verified free image exists; else the model default.
    var yImgs = (DATA.meta.yearImages && DATA.meta.yearImages[m.id + '/' + year]);
    var galleryImgs = (yImgs && yImgs.length) ? yImgs : m.images;
    var galleryBlock = galleryHTML(galleryImgs, m.name) +
      (yImgs && yImgs.length ? '<p class="yearphoto-note">Photographs of an actual ' + year + ' ' + esc(m.name) + '.</p>' : '');

    var detail = document.getElementById('detail-view');
    detail.innerHTML =
      '<div class="detail-wrap wrap">' +
        crumbs([[ROOT, 'Home'], [pageUrl('models'), 'Models'], ['#/model/' + id, m.name], [null, String(year)]]) +
        nav +
        '<div class="detail-head">' +
          '<p class="m-eyebrow">' + esc(era.name) + ' · ' + esc(m.type) + '</p>' +
          '<h1 class="detail-title">' + year + ' Airstream ' + esc(m.name) + '</h1>' +
          '<div class="m-years">Part of the ' + esc(m.name) + ' line · ' + esc(yearLabel(m)) + '</div>' +
        '</div>' +
        galleryBlock +
        '<div class="detail-body">' +
          specGridHTML([
            ['Model year', String(year)], ['Model', m.name], ['Type', m.type],
            ['Length(s)', (m.lengths || []).join(', ') || '—'], ['Sleeps', m.sleeps || '—'],
            ['Price when new', m.priceNew || '—']
          ]) +
          priceBlock +
          msBlock +
          ctxBlock +
          '<p class="m-desc">' + esc(m.description) + '</p>' +
          ffBlock +
          quoteBlock +
          '<p class="m-ad-note yearnote">Specifications describe the ' + esc(m.name) +
            ' line; Airstream often offered several lengths and floor plans within a single model year. ' +
            'The advertisements below are specific to ' + year + '.</p>' +
          listSection('Floor plans &amp; layouts', m.floorplans, 'm-floorplans') +
          towingBlock(mkt) +
          collectBlock(mkt) +
          serialBlock() +
          adsBlock +
          exploreBlock(m, year) +
          communityBlock(m, year) +
        '</div>' +
        nav +
      '</div>';
  }

  /* ---------------- Router ---------------- */
  function parseHash() {
    var h = location.hash || '';
    var y = h.match(/^#\/model\/([^\/]+)\/(\d{4})$/);
    if (y) return { view: 'year', id: decodeURIComponent(y[1]), year: parseInt(y[2], 10) };
    var mo = h.match(/^#\/model\/([^\/]+)$/);
    if (mo) return { view: 'model', id: decodeURIComponent(mo[1]) };
    return { view: 'home', anchor: h.length > 1 ? h.slice(1) : '' };
  }
  /* Router lives on the Models page: toggles the archive vs. a model/year detail. */
  function route() {
    var r = parseHash();
    var archive = document.getElementById('models-archive');
    var detail = document.getElementById('detail-view');
    if (!archive || !detail) return;
    document.body.style.overflow = '';

    if (r.view === 'home') { // no model hash → show the archive
      detail.hidden = true; detail.innerHTML = '';
      archive.hidden = false;
      return;
    }
    var m = modelById(r.id);
    if (!m) { location.hash = ''; return; }
    archive.hidden = true;
    detail.hidden = false;
    if (r.view === 'year' && modelYears(m).indexOf(r.year) !== -1) renderYearPage(m, r.year);
    else renderModelPage(m);
    wireLightbox(detail);
    window.scrollTo(0, 0);
  }

  /* ---------------- Lightbox ---------------- */
  /* Holds the current image set so the viewer can page through prev/next.
     Each item is { display, original, cap, page, credit }. */
  var LB = { items: [], index: 0 };

  /* Convenience: open a single image. */
  function openLightbox(o) { openLightboxSet([o], 0); }

  /* Open a set of images at the given index, with prev/next navigation. */
  function openLightboxSet(items, index) {
    LB.items = items || [];
    LB.index = index || 0;
    if (!LB.items.length) return;
    showLightboxItem();
    document.getElementById('lightbox').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function showLightboxItem() {
    var o = LB.items[LB.index] || {};
    var imgEl = document.getElementById('lightbox-img');
    imgEl.classList.remove('zoomed');
    imgEl.src = o.display || o.original;
    imgEl.alt = o.cap || '';
    var original = o.original || o.display;
    imgEl.onclick = function (e) {
      e.stopPropagation();
      var zoom = imgEl.classList.toggle('zoomed');
      if (zoom && imgEl.src !== original) imgEl.src = original;
    };
    var multi = LB.items.length > 1;
    var parts = [];
    if (multi) parts.push('<span class="lb-count">' + (LB.index + 1) + ' / ' + LB.items.length + '</span>');
    if (o.cap) parts.push(esc(o.cap));
    if (original) parts.push('<a href="' + esc(original) + '" target="_blank" rel="noopener">View full resolution ↗</a>');
    if (o.page && o.page !== original) parts.push('<a href="' + esc(o.page) + '" target="_blank" rel="noopener">' + esc(o.credit || 'source') + '</a>');
    document.getElementById('lightbox-cap').innerHTML = parts.join(' · ');
    document.getElementById('lb-prev').style.display = multi ? '' : 'none';
    document.getElementById('lb-next').style.display = multi ? '' : 'none';
  }

  function lbNav(delta) {
    if (LB.items.length < 2) return;
    LB.index = (LB.index + delta + LB.items.length) % LB.items.length;
    showLightboxItem();
  }

  function closeLightbox() {
    document.getElementById('lightbox').hidden = true;
    LB.items = [];
    document.body.style.overflow = '';
  }

  /* ---------------- Events ---------------- */
  /* Search + filter controls — only on the Models page. */
  function wireModelControls() {
    var search = document.getElementById('search');
    var t;
    if (search) search.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { state.query = search.value; render(); }, 120);
    });
    var clear = document.getElementById('clear-filters');
    if (clear) clear.addEventListener('click', function () {
      state = { era: 'all', type: 'all', query: '' };
      if (search) search.value = '';
      syncChips(); render();
    });
  }

  /* Lightbox + keyboard — present on every page (lightbox is injected). */
  function wireGlobalEvents() {
    var lb = document.getElementById('lightbox');
    if (lb) {
      document.querySelectorAll('[data-lb-close]').forEach(function (b) { b.addEventListener('click', closeLightbox); });
      lb.addEventListener('click', function (e) { if (e.target === this) closeLightbox(); });
      document.getElementById('lb-prev').addEventListener('click', function (e) { e.stopPropagation(); lbNav(-1); });
      document.getElementById('lb-next').addEventListener('click', function (e) { e.stopPropagation(); lbNav(1); });
      document.addEventListener('keydown', function (e) {
        if (lb.hidden) return;
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') lbNav(-1);
        else if (e.key === 'ArrowRight') lbNav(1);
      });
    }
  }

  /* ---------------- Header navigation (hamburger + "More") ---------------- */
  function wireNav() {
    var toggle = document.getElementById('nav-toggle');
    var menu = document.getElementById('nav-menu');
    var more = document.getElementById('nav-more');
    var sub = document.getElementById('nav-sub');
    if (!toggle || !menu) return;

    function closeNav() {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      if (sub) { sub.classList.remove('open'); more.setAttribute('aria-expanded', 'false'); }
    }
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    if (more && sub) {
      more.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = sub.classList.toggle('open');
        more.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    // any nav link closes the (mobile) menu
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeNav); });
    // click outside closes everything
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.top-nav') && !e.target.closest('.nav-toggle')) closeNav();
    });
    // Escape closes the menu (only when the lightbox isn't the target)
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.getElementById('lightbox').hidden) closeNav();
    });
  }
})();
