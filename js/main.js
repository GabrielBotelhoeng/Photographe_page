/* ===========================================================================
   MAIN — Lenis + GSAP ScrollTrigger + interações
   =========================================================================== */

(function () {
  'use strict';

  var SITE = window.SITE || {};
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };

  gsap.registerPlugin(ScrollTrigger);

  /* ==================================================================== */
  /*  WHATSAPP                                                             */
  /* ==================================================================== */
  (function wireWhatsApp() {
    var num = (SITE.whatsapp || '').replace(/\D/g, '');
    var url = num
      ? 'https://wa.me/' + num + '?text=' + encodeURIComponent(SITE.whatsappMsg || '')
      : null;

    $$('[data-wa]').forEach(function (a) {
      if (url) {
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
      } else {
        a.href = '#contato';
      }
    });

    if (/^0+$/.test(num.slice(2))) {
      console.warn('[site] Número de WhatsApp ainda é placeholder. Edite js/config.js → SITE.whatsapp');
    }
  })();

  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ==================================================================== */
  /*  LOADER — diafragma abrindo                                           */
  /* ==================================================================== */
  function irisPath(rOuter, rInner, blades) {
    var d = 'M ' + (100 - rOuter) + ' 100 ' +
            'a ' + rOuter + ' ' + rOuter + ' 0 1 0 ' + (rOuter * 2) + ' 0 ' +
            'a ' + rOuter + ' ' + rOuter + ' 0 1 0 ' + (-rOuter * 2) + ' 0 Z ';
    if (rInner > 0.5) {
      for (var i = 0; i < blades; i++) {
        var a = -Math.PI / 2 + (i / blades) * Math.PI * 2;
        var x = 100 + Math.cos(a) * rInner;
        var y = 100 + Math.sin(a) * rInner;
        d += (i === 0 ? 'M ' : 'L ') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
      }
      d += 'Z';
    }
    return d;
  }

  function runLoader(done) {
    var loader = $('#loader');
    var group = $('.loader__blades');
    var count = $('#loaderCount');
    if (!loader || !group) { done(); return; }

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill-rule', 'evenodd');
    group.appendChild(path);

    var state = { r: 2, n: 0 };
    var apply = function () {
      path.setAttribute('d', irisPath(92, state.r, 9));
      if (count) count.textContent = String(Math.round(state.n)).padStart(3, '0');
    };
    apply();

    if (REDUCED) { done(); loader.classList.add('is-done'); return; }

    var tl = gsap.timeline({ onUpdate: apply, onComplete: function () {
      loader.classList.add('is-done');
      done();
    }});
    tl.to(state, { n: 100, duration: 1.15, ease: 'power2.inOut' }, 0)
      .to(state, { r: 88, duration: 1.05, ease: 'expo.inOut' }, 0.35)
      .to('.loader__meta', { opacity: 0, duration: .4, ease: 'power2.in' }, 1.05)
      .to('.loader__iris', { scale: 1.35, opacity: 0, duration: .7, ease: 'expo.in' }, 1.15);
  }

  /* ==================================================================== */
  /*  SMOOTH SCROLL                                                        */
  /* ==================================================================== */
  var lenis = null;
  if (!REDUCED && typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.05,
      lerp: 0.085,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      smoothWheel: true
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  window.__lenis = lenis;   // útil para depurar no console

  function scrollTo(target) {
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.3 });
    else { var el = $(target); if (el) el.scrollIntoView({ behavior: 'smooth' }); }
  }

  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id === '#' || !$(id)) return;
      e.preventDefault();
      document.body.classList.remove('menu-open');
      if (lenis) lenis.start();
      scrollTo(id);
    });
  });

  /* ==================================================================== */
  /*  SPLIT DE TEXTO (palavra a palavra, preservando <br> e <em>)          */
  /* ==================================================================== */
  function splitWords(root) {
    var out = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var words = child.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          words.forEach(function (w) {
            if (!w.trim()) { frag.appendChild(document.createTextNode(w)); return; }
            var outer = document.createElement('span');
            outer.className = 'w';
            var inner = document.createElement('span');
            inner.textContent = w;
            outer.appendChild(inner);
            frag.appendChild(outer);
            out.push(inner);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    })(root);
    return out;
  }

  /* ==================================================================== */
  /*  BOOT                                                                 */
  /* ==================================================================== */
  function boot() {
    document.body.classList.remove('is-loading');
    if (lenis) lenis.start();

    /* ---------------------------------------------------- splits */
    $$('[data-split]').forEach(function (el) {
      var words = splitWords(el);
      if (REDUCED) return;
      gsap.set(words, { yPercent: 108, opacity: 0 });
      gsap.to(words, {
        yPercent: 0, opacity: 1,
        duration: 1.05, ease: 'expo.out', stagger: 0.035,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    /* --------------------------------------------------- reveals */
    $$('[data-reveal]').forEach(function (el) {
      if (REDUCED) { gsap.set(el, { opacity: 1, y: 0 }); return; }
      gsap.to(el, {
        opacity: 1, y: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    /* -------------------------------------------------- parallax */
    if (!REDUCED) {
      $$('[data-parallax]').forEach(function (el) {
        var speed = parseFloat(el.dataset.parallax) || 0.1;
        var dist = (window.innerWidth < 900 ? 60 : 180) * speed;
        gsap.fromTo(el, { y: dist }, {
          y: -dist, ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
        });
      });
    }

    initHero();
    initStories();
    initServices();
    initNav();

    ScrollTrigger.refresh();
  }

  /* ==================================================================== */
  /*  HERO — canvas controlado pela rolagem                                */
  /* ==================================================================== */
  function initHero() {
    var canvas = $('#cameraCanvas');
    var track = $('.hero__track');
    if (!canvas || !track || !window.CameraSequence) return;

    var progress = 0;
    var seq = window.CameraSequence.init(canvas, function () {
      // o HUD nasce com o vocabulário do procedural; nos frames ele é outro
      if (hud) hud.textContent = window.CameraSequence.phase(progress);
    });

    var reveal = $('#heroReveal');
    var revealImg = reveal ? reveal.querySelector('img') : null;
    var hud = $('#hudPhase');
    var hudBar = $('#hudBar');
    var c1 = $('[data-hero-copy="1"]');
    var c2 = $('.hero__copy--tech');
    var c3 = $('.hero__copy--iris');
    var hint = $('.hero__scrollhint');

    var fade = function (el, v) { if (el) el.style.opacity = v; };
    var band = function (p, a, b, c, d) {
      // sobe entre a→b, cheio até c, desce até d
      if (p < a || p > d) return 0;
      if (p < b) return (p - a) / (b - a);
      if (p > c) return 1 - (p - c) / (d - c);
      return 1;
    };

    if (REDUCED) {
      seq.render(0.9);
      fade(c1, 1); fade(c3, 1);
      if (reveal) reveal.style.opacity = 1;
      return;
    }

    ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.55,
      onUpdate: function (self) {
        var p = progress = self.progress;
        seq.render(p);

        fade(c1, band(p, 0, 0.001, 0.09, 0.15));
        fade(hint, band(p, 0, 0.001, 0.05, 0.10));
        fade(c2, band(p, 0.20, 0.27, 0.42, 0.49));
        fade(c3, band(p, 0.62, 0.69, 0.82, 0.90));

        if (reveal) {
          reveal.style.opacity = clamp((p - 0.50) / 0.30, 0, 1);
          if (revealImg) {
            var s = 1.18 - 0.18 * clamp((p - 0.70) / 0.30, 0, 1);
            revealImg.style.transform = 'scale(' + s.toFixed(3) + ')';
          }
        }
        if (hud) hud.textContent = window.CameraSequence.phase(p);
        if (hudBar) hudBar.style.width = (p * 100).toFixed(1) + '%';
      }
    });

    var ro = 0;
    window.addEventListener('resize', function () {
      clearTimeout(ro);
      ro = setTimeout(function () {
        window.CameraSequence.resize();
        ScrollTrigger.refresh();
      }, 180);
    });
  }

  /* ==================================================================== */
  /*  HISTÓRIAS — máscara circular tipo diafragma                          */
  /* ==================================================================== */
  function initStories() {
    var track = $('.stories__track');
    if (!track) return;
    var layers = $$('.stories__layer');
    var slides = $$('.stories__slide');
    var dots = $$('.stories__dots i');
    var n = slides.length;
    if (!n) return;

    if (REDUCED) {
      layers.forEach(function (l) { l.classList.add('is-active'); });
      slides.forEach(function (s) { s.classList.add('is-active'); });
      return;
    }

    var current = -1;
    var setIndex = function (i) {
      if (i === current) return;
      current = i;
      layers.forEach(function (l, k) { l.classList.toggle('is-active', k <= i); });
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('is-on', k === i); });
    };
    setIndex(0);

    ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: function (self) {
        var i = clamp(Math.floor(self.progress * n * 0.999), 0, n - 1);
        setIndex(i);
      }
    });
  }

  /* ==================================================================== */
  /*  SERVIÇOS — preview seguindo o cursor                                 */
  /* ==================================================================== */
  function initServices() {
    var list = $('#servicesList');
    var prev = $('#servicesPreview');
    if (!list || !prev || window.matchMedia('(hover: none)').matches) return;

    var img = prev.querySelector('img');
    var qx = gsap.quickTo(prev, 'x', { duration: 0.55, ease: 'power3' });
    var qy = gsap.quickTo(prev, 'y', { duration: 0.55, ease: 'power3' });

    // pré-carrega
    $$('.services__row', list).forEach(function (row) {
      var i = new Image(); i.src = row.dataset.img;
    });

    list.addEventListener('pointermove', function (e) { qx(e.clientX); qy(e.clientY); });
    list.addEventListener('pointerenter', function (e) { qx(e.clientX); qy(e.clientY); });

    $$('.services__row', list).forEach(function (row) {
      row.addEventListener('pointerenter', function () {
        if (img.getAttribute('src') !== row.dataset.img) img.src = row.dataset.img;
        prev.classList.add('is-on');
      });
    });
    list.addEventListener('pointerleave', function () { prev.classList.remove('is-on'); });
  }

  /* ==================================================================== */
  /*  NAV, MENU, PROGRESSO                                                 */
  /* ==================================================================== */
  function initNav() {
    var nav = $('#nav');
    var burger = $('#burger');
    var menu = $('#menu');
    var bar = $('#progressBar');
    var last = 0;

    if (burger && menu) {
      burger.addEventListener('click', function () {
        var open = document.body.classList.toggle('menu-open');
        burger.setAttribute('aria-expanded', String(open));
        menu.setAttribute('aria-hidden', String(!open));
        if (lenis) { open ? lenis.stop() : lenis.start(); }
      });
    }

    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: function (self) {
        var y = self.scroll();
        if (bar) bar.style.width = (self.progress * 100).toFixed(2) + '%';
        if (nav && !document.body.classList.contains('menu-open')) {
          nav.classList.toggle('is-hidden', y > last && y > 240);
        }
        last = y;
      }
    });
  }

  /* ==================================================================== */
  var started = false, booted = false;
  function start() {
    if (started) return;
    started = true;
    runLoader(function () { if (!booted) { booted = true; boot(); } });
  }
  window.addEventListener('load', start);
  // fallback caso alguma fonte/imagem externa demore demais
  setTimeout(start, 3800);
})();
