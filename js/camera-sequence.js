/* ===========================================================================
   CAMERA SEQUENCE
   ---------------------------------------------------------------------------
   Renderiza a câmera do hero em <canvas>, controlada por um progresso 0..1
   vindo da rolagem.

   Dois modos:
     · 'frames'      — desenha uma sequência de imagens (assets/frames/).
                       Use quando o vídeo do Higgsfield estiver pronto.
     · 'procedural'  — desenha a câmera vetorialmente. É o padrão enquanto
                       não houver frames.

   O roteiro é o mesmo nos dois casos:
     0.00 → 0.16   câmera montada, rotação lenta
     0.16 → 0.50   vista explodida (peças se separam em camadas alinhadas)
     0.50 → 0.66   remontagem
     0.62 → 0.86   o diafragma abre
     0.84 → 1.00   travessia: a câmera virtual atravessa a lente

   A abertura do diafragma é literalmente um furo no canvas
   (globalCompositeOperation = 'destination-out'), então a fotografia que
   está atrás em HTML aparece através dela. Nada de truque de opacidade.
   =========================================================================== */

window.CameraSequence = (function () {
  'use strict';

  /* ------------------------------------------------------------- helpers */
  var clamp = function (v, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return v < a ? a : (v > b ? b : v); };
  var remap = function (p, a, b) { return clamp((p - a) / (b - a)); };
  var lerp  = function (a, b, t) { return a + (b - a) * t; };
  var eInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var eOut   = function (t) { return 1 - Math.pow(1 - t, 3); };
  var eIn    = function (t) { return t * t * t; };
  var TAU = Math.PI * 2;

  /* --------------------------------------------------------- perspectiva */
  var PERSP     = 3.4;   // "distância focal" da câmera virtual
  var REST_DIST = 4.4;   // distância de repouso do observador
  var NORM      = PERSP / (PERSP + REST_DIST);
  var SPREAD    = 1.15;  // quanto as peças se afastam na vista explodida

  /* ------------------------------------------------------------- camadas
     z  → profundidade em repouso (0 = plano do diafragma)
     r  → raio relativo
     s  → fator de afastamento na explosão                                 */
  var LAYERS = [
    { id: 'body',    z: -1.42, r: 2.05, s: -2.30, type: 'body' },
    { id: 'back',    z: -1.16, r: 1.28, s: -1.80, type: 'plate' },
    { id: 'sensor',  z: -0.92, r: 0.72, s: -1.35, type: 'sensor',  label: 'sensor',    lside: -1 },
    { id: 'shutter', z: -0.70, r: 0.80, s: -0.95, type: 'shutter', label: 'obturador', lside: -1 },
    { id: 'mount',   z: -0.44, r: 0.88, s: -0.55, type: 'ring', metal: 0.9 },
    { id: 'rear',    z: -0.18, r: 0.60, s: -0.18, type: 'glass', tint: 0.30 },
    { id: 'iris',    z:  0.08, r: 0.76, s:  0.22, type: 'iris',  label: 'diafragma',  lside: 1 },
    { id: 'grp2',    z:  0.40, r: 0.64, s:  0.62, type: 'glass', tint: 0.45 },
    { id: 'zoom',    z:  0.70, r: 0.88, s:  1.02, type: 'knurl' },
    { id: 'focus',   z:  1.00, r: 0.92, s:  1.42, type: 'knurl' },
    { id: 'filter',  z:  1.26, r: 0.84, s:  1.80, type: 'ring', metal: 1 },
    { id: 'front',   z:  1.50, r: 0.78, s:  2.20, type: 'glass', tint: 0.72, label: 'óptica', lside: 1 }
  ];

  /* eixo da vista explodida: as peças se afastam numa diagonal,
     mantendo o tamanho — separação, não explosão. */
  var AXIS = -0.42;                      // rad (sobe para a direita)
  var AXIS_X = Math.cos(AXIS), AXIS_Y = Math.sin(AXIS);

  var BLADES = 9;

  /* --------------------------------------------------------------- state */
  var cv, ctx, W = 0, H = 0, DPR = 1, baseR = 0;
  var dust = [];
  var mode = 'procedural';
  var frames = [], frameCount = 0, framesReady = false;
  var lastP = 0, t0 = performance.now();
  var reduced = false;

  /* ==================================================================== */
  /*  SETUP                                                                */
  /* ==================================================================== */

  function init(canvas) {
    cv = canvas;
    ctx = cv.getContext('2d', { alpha: true });
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resize();
    seedDust();

    var wanted = (window.SITE && window.SITE.heroMode) || 'auto';
    if (wanted === 'frames' || wanted === 'auto') {
      loadFrames().then(function (ok) {
        if (ok) { mode = 'frames'; }
        else if (wanted === 'frames') { console.warn('[hero] frames não encontrados, usando modo procedural'); }
        render(lastP);
      });
    }
    render(0);
    return api;
  }

  function resize() {
    if (!cv) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var rect = cv.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    baseR = Math.min(W, H) * 0.195;
    seedDust();
    render(lastP);
  }

  function seedDust() {
    dust = [];
    var n = W < 700 ? 40 : 90;
    for (var i = 0; i < n; i++) {
      dust.push({
        x: Math.random(), y: Math.random(),
        r: 0.4 + Math.random() * 1.5,
        a: 0.06 + Math.random() * 0.22,
        sp: 0.15 + Math.random() * 0.5,
        ph: Math.random() * TAU
      });
    }
  }

  /* ------------------------------------------- sequência de frames (MCP) */
  function loadFrames() {
    var man = (window.SITE && window.SITE.framesManifest) || 'assets/frames/manifest.json';
    return fetch(man, { cache: 'force-cache' })
      .then(function (r) { if (!r.ok) throw new Error('sem manifest'); return r.json(); })
      .then(function (data) {
        // manifest: { "dir": "assets/frames/", "pattern": "frame_%04d.webp", "count": 180 }
        var dir = data.dir || 'assets/frames/';
        var pat = data.pattern || 'frame_%04d.webp';
        frameCount = data.count | 0;
        if (!frameCount) throw new Error('manifest sem count');
        var loaded = 0;
        return new Promise(function (resolve) {
          for (var i = 0; i < frameCount; i++) {
            var img = new Image();
            img.decoding = 'async';
            img.src = dir + pat.replace(/%0(\d)d/, function (_, w) {
              return String(i + 1).padStart(parseInt(w, 10), '0');
            });
            img.onload = img.onerror = function () {
              if (++loaded === frameCount) { framesReady = true; resolve(true); }
            };
            frames.push(img);
          }
        });
      })
      .catch(function () { return false; });
  }

  /* ==================================================================== */
  /*  ROTEIRO                                                              */
  /* ==================================================================== */

  function script(p) {
    var spinIn   = eInOut(remap(p, 0.00, 0.55));
    var settle   = eInOut(remap(p, 0.62, 0.86));
    var explode  = eInOut(remap(p, 0.16, 0.50)) * (1 - eInOut(remap(p, 0.52, 0.68)));
    var iris     = eInOut(remap(p, 0.62, 0.88));
    var fly      = eIn(remap(p, 0.84, 1.00));

    return {
      // guarda um resto de rotação: de frente total a câmera vira ícone chapado
      yaw:     lerp(-0.40, 0.30, spinIn) * (1 - settle * 0.55) - 0.24 * settle,
      pitch:   lerp(0.16, 0.05, spinIn) * (1 - settle * 0.45) + 0.09 * settle,
      explode: explode,
      iris:    iris,
      fly:     fly,
      dist:    REST_DIST - 0.45 * explode - (REST_DIST + 2.6) * fly,
      phase:   p < 0.16 ? 'montada' : p < 0.52 ? 'vista explodida'
             : p < 0.62 ? 'remontagem' : p < 0.86 ? 'diafragma' : 'travessia'
    };
  }

  /* ==================================================================== */
  /*  RENDER                                                               */
  /* ==================================================================== */

  function render(p) {
    if (!ctx) return;
    lastP = clamp(p);
    ctx.clearRect(0, 0, W, H);
    if (mode === 'frames' && framesReady) { renderFrames(lastP); return; }
    renderProcedural(lastP);
  }

  function renderFrames(p) {
    var i = clamp(Math.round(p * (frameCount - 1)), 0, frameCount - 1);
    var img = frames[i];
    if (!img || !img.naturalWidth) return;
    // cover
    var s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    var w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  }

  /* -------------------------------------------------------- procedural */
  function renderProcedural(p) {
    var st = script(p);
    var cx = W / 2, cy = H * (0.37 + 0.02 * st.explode);
    var time = (performance.now() - t0) / 1000;

    // na vista explodida tudo encolhe para o conjunto caber na tela
    var zoom = 1 - 0.34 * st.explode;
    var spread = st.explode * SPREAD * baseR * (W < 900 ? 0.78 : 1);

    drawStudio(cx, cy, st);
    drawDust(time, st);

    // ordena por profundidade (mais longe primeiro)
    var items = [];
    for (var i = 0; i < LAYERS.length; i++) {
      var L = LAYERS[i];
      var sc = projScale(L.z, st.dist);
      if (sc === null) continue;                     // já passou pelo observador
      items.push({ L: L, z: L.z, sc: sc * zoom });
    }
    items.sort(function (a, b) { return a.z - b.z; });

    var punch = null;
    var labels = [];     // desenhados só no fim, para não ficarem atrás das peças

    for (var k = 0; k < items.length; k++) {
      var it = items[k], L2 = it.L, sc2 = it.sc, z2 = it.z;

      var rx = baseR * L2.r * sc2 * Math.cos(st.yaw * 0.78);
      var ry = baseR * L2.r * sc2 * Math.cos(st.pitch * 0.9);

      // paralaxe da rotação + separação ao longo do eixo diagonal
      var off = L2.s * spread * zoom;
      var x = cx + Math.sin(st.yaw)   * z2 * baseR * 1.05 * sc2 + AXIS_X * off;
      var y = cy - Math.sin(st.pitch) * z2 * baseR * 1.05 * sc2 + AXIS_Y * off;

      // peças distantes perdem contraste (profundidade de campo falsa)
      var depthFade = clamp(1 - Math.abs(z2 - 0.1) * 0.07, 0.72, 1);
      ctx.save();
      ctx.globalAlpha = depthFade;

      switch (L2.type) {
        case 'body':    drawBody(x, y, rx, ry, st);        break;
        case 'plate':   drawPlate(x, y, rx, ry);            break;
        case 'sensor':  drawSensor(x, y, rx, ry);           break;
        case 'shutter': drawShutter(x, y, rx, ry, st);      break;
        case 'ring':    drawRing(x, y, rx, ry, L2.metal);   break;
        case 'knurl':   drawKnurl(x, y, rx, ry, st.yaw);    break;
        case 'glass':   drawGlass(x, y, rx, ry, L2.tint, st); break;
        case 'iris':
          drawIris(x, y, rx, ry, st.iris);
          punch = { x: x, y: y, rx: rx, ry: ry, t: st.iris };
          break;
      }
      ctx.restore();

      if (L2.label && st.explode > 0.05) {
        labels.push([x, y, rx, ry, L2.label, st.explode, L2.lside || 1]);
      }
    }

    if (punch) punchAperture(punch, st);
    drawVignette(cx, cy);
    for (var m = 0; m < labels.length; m++) drawLabel.apply(null, labels[m]);
  }

  function projScale(z, dist) {
    var d = PERSP + dist - z;
    if (d <= 0.30) return null;
    return (PERSP / d) / NORM;
  }

  /* ---------------------------------------------------------- cenário */
  function drawStudio(cx, cy, st) {
    var g = ctx.createRadialGradient(cx, cy * 0.92, 0, cx, cy, Math.max(W, H) * 0.78);
    g.addColorStop(0, '#191920');
    g.addColorStop(0.42, '#101014');
    g.addColorStop(1, '#08080a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // faixa de luz quente atrás da câmera
    var warm = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * (6 + st.fly * 10));
    warm.addColorStop(0, 'rgba(201,138,75,' + (0.10 + st.iris * 0.16) + ')');
    warm.addColorStop(1, 'rgba(201,138,75,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, W, H);
  }

  function drawDust(time, st) {
    ctx.save();
    for (var i = 0; i < dust.length; i++) {
      var d = dust[i];
      var yy = (d.y - (reduced ? 0 : time * d.sp * 0.014)) % 1;
      if (yy < 0) yy += 1;
      var xx = d.x + Math.sin(time * 0.25 * d.sp + d.ph) * 0.012;
      ctx.globalAlpha = d.a * (0.4 + 0.6 * st.iris);
      ctx.fillStyle = '#e2ab6d';
      ctx.beginPath();
      ctx.arc(xx * W, yy * H, d.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawVignette(cx, cy) {
    var g = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.20, cx, cy, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(8,8,10,0)');
    g.addColorStop(1, 'rgba(8,8,10,0.72)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /* ------------------------------------------------------------ peças */

  function ellipse(x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, TAU);
  }

  // anel (rosca de filtro, baioneta)
  function drawRing(x, y, rx, ry, metal) {
    metal = metal === undefined ? 0.8 : metal;
    var inner = 0.80;
    var g = ctx.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
    g.addColorStop(0, '#3a3a44');
    g.addColorStop(0.35, mix('#6e6e7c', '#2a2a31', 1 - metal));
    g.addColorStop(0.55, '#8b8b9a');
    g.addColorStop(0.8, '#33333c');
    g.addColorStop(1, '#1d1d23');

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, TAU);
    ctx.ellipse(x, y, Math.abs(rx * inner), Math.abs(ry * inner), 0, 0, TAU, true);
    ctx.fillStyle = g;
    ctx.fill('evenodd');

    ctx.strokeStyle = 'rgba(226,171,109,0.22)';
    ctx.lineWidth = 1;
    ellipse(x, y, rx, ry); ctx.stroke();
    ctx.restore();
  }

  // anel de foco/zoom com estrias
  function drawKnurl(x, y, rx, ry, yaw) {
    drawRing(x, y, rx, ry, 0.35);
    var inner = 0.80;
    ctx.save();
    ctx.strokeStyle = 'rgba(10,10,12,0.75)';
    ctx.lineWidth = Math.max(1, rx * 0.012);
    var n = 52;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * TAU + yaw * 0.6;
      var c = Math.cos(a), s = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(x + c * rx * inner * 1.02, y + s * ry * inner * 1.02);
      ctx.lineTo(x + c * rx * 0.985, y + s * ry * 0.985);
      ctx.stroke();
    }
    // marcas de distância
    ctx.strokeStyle = 'rgba(226,171,109,0.55)';
    ctx.lineWidth = Math.max(1, rx * 0.016);
    for (var j = 0; j < 5; j++) {
      var aa = -Math.PI * 0.62 + j * 0.16 + yaw * 0.6;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(aa) * rx * 0.88, y + Math.sin(aa) * ry * 0.88);
      ctx.lineTo(x + Math.cos(aa) * rx * 0.96, y + Math.sin(aa) * ry * 0.96);
      ctx.stroke();
    }
    ctx.restore();
  }

  // elemento óptico
  function drawGlass(x, y, rx, ry, tint, st) {
    tint = tint === undefined ? 0.5 : tint;
    ctx.save();

    var g = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.34, rx * 0.05, x, y, Math.abs(rx));
    g.addColorStop(0, 'rgba(38,44,54,0.95)');
    g.addColorStop(0.45, 'rgba(17,19,24,0.96)');
    g.addColorStop(0.86, 'rgba(9,10,13,0.98)');
    g.addColorStop(1, 'rgba(6,6,8,1)');
    ellipse(x, y, rx, ry);
    ctx.fillStyle = g;
    ctx.fill();

    // reflexo âmbar de contorno
    var rim = ctx.createRadialGradient(x, y, Math.abs(rx) * 0.72, x, y, Math.abs(rx));
    rim.addColorStop(0, 'rgba(201,138,75,0)');
    rim.addColorStop(0.86, 'rgba(201,138,75,' + (0.30 * tint) + ')');
    rim.addColorStop(1, 'rgba(226,171,109,' + (0.55 * tint) + ')');
    ellipse(x, y, rx, ry);
    ctx.fillStyle = rim;
    ctx.fill();

    // estria especular
    ctx.save();
    ellipse(x, y, rx, ry); ctx.clip();
    var sp = ctx.createLinearGradient(x - rx, y - ry, x + rx * 0.2, y + ry);
    sp.addColorStop(0, 'rgba(242,236,226,0)');
    sp.addColorStop(0.42, 'rgba(242,236,226,' + (0.13 * tint) + ')');
    sp.addColorStop(0.52, 'rgba(242,236,226,0)');
    ctx.fillStyle = sp;
    ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);

    // flare quente que cresce com a abertura
    var fl = ctx.createRadialGradient(x + rx * 0.28, y - ry * 0.3, 0, x + rx * 0.28, y - ry * 0.3, Math.abs(rx) * 0.55);
    fl.addColorStop(0, 'rgba(226,171,109,' + (0.16 + 0.22 * st.iris) * tint + ')');
    fl.addColorStop(1, 'rgba(226,171,109,0)');
    ctx.fillStyle = fl;
    ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
    ctx.restore();

    ctx.strokeStyle = 'rgba(242,236,226,0.10)';
    ctx.lineWidth = 1;
    ellipse(x, y, rx, ry); ctx.stroke();
    ctx.restore();
  }

  // diafragma: material das lâminas + furo poligonal
  function drawIris(x, y, rx, ry, t) {
    var open = lerp(0.13, 0.985, t);
    ctx.save();

    var g = ctx.createRadialGradient(x, y, Math.abs(rx) * open, x, y, Math.abs(rx));
    g.addColorStop(0, '#2b2b33');
    g.addColorStop(0.5, '#1a1a20');
    g.addColorStop(1, '#101014');

    ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, TAU);
    aperturePath(x, y, rx * open, ry * open, true);
    ctx.fillStyle = g;
    ctx.fill('evenodd');

    // costuras das lâminas
    ctx.strokeStyle = 'rgba(242,236,226,0.13)';
    ctx.lineWidth = 1;
    var rot = -Math.PI / 2 + (1 - t) * 0.5;
    for (var i = 0; i < BLADES; i++) {
      var a = rot + (i / BLADES) * TAU;
      var vx = x + Math.cos(a) * rx * open;
      var vy = y + Math.sin(a) * ry * open;
      var a2 = a + TAU / BLADES * 0.85;
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.quadraticCurveTo(
        x + Math.cos(a + 0.18) * rx * (open + (1 - open) * 0.45),
        y + Math.sin(a + 0.18) * ry * (open + (1 - open) * 0.45),
        x + Math.cos(a2) * rx * 0.995,
        y + Math.sin(a2) * ry * 0.995
      );
      ctx.stroke();
    }

    // borda quente do furo
    ctx.strokeStyle = 'rgba(226,171,109,' + (0.35 + 0.4 * t) + ')';
    ctx.lineWidth = Math.max(1, rx * 0.008);
    aperturePath(x, y, rx * open, ry * open, false);
    ctx.stroke();
    ctx.restore();
  }

  // polígono da abertura (lados levemente curvos, como iris real)
  function aperturePath(x, y, rx, ry, reverse) {
    var rot = -Math.PI / 2;
    var pts = [];
    for (var i = 0; i < BLADES; i++) {
      var a = rot + (i / BLADES) * TAU;
      pts.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]);
    }
    if (reverse) pts.reverse();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var j = 0; j < pts.length; j++) {
      var cur = pts[j], nxt = pts[(j + 1) % pts.length];
      var mx = (cur[0] + nxt[0]) / 2, my = (cur[1] + nxt[1]) / 2;
      // empurra o controle para fora → lado levemente convexo
      ctx.quadraticCurveTo(x + (mx - x) * 1.075, y + (my - y) * 1.075, nxt[0], nxt[1]);
    }
    ctx.closePath();
  }

  function drawShutter(x, y, rx, ry, st) {
    var gap = clamp(remap(st.iris, 0.05, 0.55));   // cortinas abrem antes do diafragma
    ctx.save();
    ellipse(x, y, rx, ry);
    ctx.fillStyle = '#0c0c0f';
    ctx.fill();
    ctx.clip();

    var g = ctx.createLinearGradient(0, y - ry, 0, y + ry);
    g.addColorStop(0, '#26262e');
    g.addColorStop(1, '#131318');
    ctx.fillStyle = g;
    var h = ry * (1 - gap);
    ctx.fillRect(x - rx, y - ry, rx * 2, h);
    ctx.fillRect(x - rx, y + ry - h, rx * 2, h);

    ctx.strokeStyle = 'rgba(226,171,109,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - rx, y - ry + h); ctx.lineTo(x + rx, y - ry + h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - rx, y + ry - h); ctx.lineTo(x + rx, y + ry - h); ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = 'rgba(242,236,226,0.12)';
    ctx.lineWidth = 1;
    ellipse(x, y, rx, ry); ctx.stroke();
  }

  function drawSensor(x, y, rx, ry) {
    var w = rx * 1.42, h = ry * 0.95;
    ctx.save();
    roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.06);
    var g = ctx.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
    g.addColorStop(0, '#1a2029');
    g.addColorStop(0.5, '#0f151c');
    g.addColorStop(1, '#232a34');
    ctx.fillStyle = g; ctx.fill();

    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(226,171,109,0.10)';
    ctx.lineWidth = 1;
    for (var i = 1; i < 9; i++) {
      var xx = x - w / 2 + (w / 9) * i;
      ctx.beginPath(); ctx.moveTo(xx, y - h / 2); ctx.lineTo(xx, y + h / 2); ctx.stroke();
    }
    var sh = ctx.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
    sh.addColorStop(0, 'rgba(120,180,255,0.10)');
    sh.addColorStop(0.5, 'rgba(226,171,109,0.10)');
    sh.addColorStop(1, 'rgba(120,255,200,0.06)');
    ctx.fillStyle = sh; ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.restore();

    ctx.strokeStyle = 'rgba(242,236,226,0.16)'; ctx.lineWidth = 1;
    roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.06); ctx.stroke();
    ctx.restore();
  }

  function drawPlate(x, y, rx, ry) {
    var w = rx * 1.7, h = ry * 1.24;
    roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.10);
    var g = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
    g.addColorStop(0, '#232329');
    g.addColorStop(1, '#131317');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(242,236,226,0.09)'; ctx.lineWidth = 1; ctx.stroke();
  }

  // corpo da câmera: grafite, empunhadura, dial e botão do obturador
  function drawBody(x, y, rx, ry, st) {
    var w = rx * 2.35, h = ry * 1.62, r = Math.min(w, h) * 0.11;
    ctx.save();

    roundRect(x - w / 2, y - h / 2, w, h, r);
    var g = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
    g.addColorStop(0, '#3a3a44');
    g.addColorStop(0.42, '#25252c');
    g.addColorStop(1, '#141419');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(242,236,226,0.20)'; ctx.lineWidth = 1.2; ctx.stroke();

    // prisma / viewfinder
    var pw = w * 0.30, ph = h * 0.24;
    roundRect(x - pw / 2, y - h / 2 - ph * 0.72, pw, ph, r * 0.5);
    ctx.fillStyle = '#22222a'; ctx.fill();
    ctx.strokeStyle = 'rgba(242,236,226,0.08)'; ctx.stroke();

    // empunhadura texturizada
    ctx.save();
    roundRect(x + w * 0.24, y - h * 0.40, w * 0.22, h * 0.80, r * 0.7);
    ctx.clip();
    ctx.fillStyle = '#16161b'; ctx.fillRect(x + w * 0.24, y - h * 0.40, w * 0.22, h * 0.80);
    ctx.fillStyle = 'rgba(242,236,226,0.05)';
    for (var i = 0; i < 22; i++) {
      ctx.fillRect(x + w * 0.24, y - h * 0.40 + i * (h * 0.80 / 22), w * 0.22, 1.2);
    }
    ctx.restore();

    // botão do obturador
    ctx.beginPath();
    ctx.arc(x + w * 0.30, y - h * 0.46, Math.max(2, rx * 0.055), 0, TAU);
    ctx.fillStyle = '#6a6a78'; ctx.fill();

    // dial superior
    ctx.beginPath();
    ctx.arc(x - w * 0.31, y - h * 0.44, Math.max(3, rx * 0.10), 0, TAU);
    ctx.fillStyle = '#2e2e37'; ctx.fill();
    ctx.strokeStyle = 'rgba(226,171,109,' + (0.25 + st.iris * 0.3) + ')';
    ctx.lineWidth = 1; ctx.stroke();

    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ------------------------------------------- anotações da vista explodida */
  function drawLabel(x, y, rx, ry, text, alpha, dir) {
    if (W < 760) return;
    ctx.save();
    ctx.globalAlpha = clamp(alpha) * 0.9;

    // sai da borda da peça, sobe/desce um pouco e segue na horizontal
    var pad = 92;
    var x1 = x + dir * Math.abs(rx) * 0.72;
    var y1 = clamp(y + dir * Math.abs(ry) * 0.62, 28, H - 28);
    var x2 = clamp(x1 + dir * Math.min(W * 0.075, 96), pad, W - pad);

    ctx.strokeStyle = 'rgba(226,171,109,0.60)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y1);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, TAU);
    ctx.fillStyle = '#e2ab6d'; ctx.fill();
    y = y1;

    ctx.font = '500 10px "Inter Tight", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(242,236,226,0.72)';
    ctx.textBaseline = 'middle';
    ctx.textAlign = dir > 0 ? 'left' : 'right';
    ctx.letterSpacing = '0.18em';
    ctx.fillText(text.toUpperCase(), x2 + dir * 8, y);
    ctx.restore();
  }

  /* ------------------------------------- o furo que revela a fotografia */
  function punchAperture(pn, st) {
    var open = lerp(0.13, 0.985, pn.t);
    // durante a travessia o furo cresce bem além da tela
    var boost = 1 + st.fly * 6.5;
    var rx = pn.rx * open * boost;
    var ry = pn.ry * open * boost;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    aperturePath(pn.x, pn.y, rx, ry, false);
    ctx.fill();
    ctx.restore();

    // halo quente na borda do furo
    if (pn.t > 0.02) {
      ctx.save();
      var maxR = Math.max(Math.abs(rx), Math.abs(ry));
      var g = ctx.createRadialGradient(pn.x, pn.y, maxR * 0.86, pn.x, pn.y, maxR * 1.3);
      g.addColorStop(0, 'rgba(226,171,109,' + (0.30 * pn.t) + ')');
      g.addColorStop(1, 'rgba(226,171,109,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------ utils */
  function mix(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
    var g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
    var bl = Math.round(lerp(pa & 255, pb & 255, t));
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  /* ------------------------------------------------------------- api */
  var api = {
    init: init,
    render: render,
    resize: resize,
    phase: function (p) { return script(clamp(p)).phase; },
    get mode() { return mode; }
  };
  return api;
})();
