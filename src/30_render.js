  /* ==========================================================================
     RENDER — layer order: backdrop → stars → entities → particles → rings
     → composite (bloom / aberration / shake / zoom) → vignette → HUD
     ======================================================================== */
  var FONT = 'ui-monospace, Menlo, Consolas, "DejaVu Sans Mono", monospace';
  var scanPat = null;

  function buildScanPattern() {
    var c = document.createElement('canvas');
    c.width = 1; c.height = 3;
    var g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.34)';
    g.fillRect(0, 2, 1, 1);
    scanPat = ctx.createPattern(c, 'repeat');
  }

  function forEachWrap(o, margin, fn) {
    fn(o.x, o.y);
    var dxs = null, dys = null;
    if (o.x < margin) dxs = [W]; else if (o.x > W - margin) dxs = [-W];
    if (o.y < margin) dys = [H]; else if (o.y > H - margin) dys = [-H];
    var i, j;
    if (dxs && dys) {
      for (i = 0; i < dxs.length; i++) for (j = 0; j < dys.length; j++) fn(o.x + dxs[i], o.y + dys[j]);
    } else if (dxs) { for (i = 0; i < dxs.length; i++) fn(o.x + dxs[i], o.y); }
    else if (dys) { for (j = 0; j < dys.length; j++) fn(o.x, o.y + dys[j]); }
  }

  /* ------------------------------------------------------------------ stars */
  function drawStars(c) {
    var t = STATE.t;
    var px = ship.vx * 0.012, py = ship.vy * 0.012;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var x = s.x + t * 5 * s.z + px * s.z;
      var y = s.y + t * 2.4 * s.z + py * s.z;
      x = ((x % W) + W) % W;
      y = ((y % H) + H) % H;
      var a = 0.30 + 0.45 * s.z + 0.26 * Math.sin(t * s.tws + s.tw);
      c.fillStyle = s.hue + clamp(a, 0, 1).toFixed(3) + ')';
      c.fillRect(x, y, s.r, s.r);
    }
  }

  /* ----------------------------------------------------------------- rocks */
  function drawRockAt(c, rk, x, y) {
    var col = ROCKCOL[rk.type];
    c.save();
    c.translate(x, y);
    c.rotate(rk.rot);
    var n = rk.dist.length, i, px, py;
    c.beginPath();
    for (i = 0; i < n; i++) {
      px = rk.ux[i] * rk.dist[i] * rk.r;
      py = rk.uy[i] * rk.dist[i] * rk.r;
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.closePath();
    c.fillStyle = col.fill;
    c.fill();

    /* glow halo */
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = col.glow;
    c.globalAlpha = 0.14 + 0.05 * Math.sin(rk.surf * 1.7 + rk.seed);
    c.lineWidth = rk.r * 0.30;
    c.stroke();
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';

    /* crisp vector edge */
    c.strokeStyle = col.core;
    c.lineWidth = Math.max(1.1, rk.r * 0.048);
    c.lineJoin = 'round';
    c.stroke();

    /* craters */
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = col.crater;
    c.lineWidth = Math.max(0.8, rk.r * 0.032);
    for (i = 0; i < rk.craters.length; i++) {
      var cr = rk.craters[i];
      c.beginPath();
      c.arc(cr.x * rk.r, cr.y * rk.r, cr.r * rk.r, 0, TAU);
      c.stroke();
    }
    /* interior cracks — molten ones pulse */
    if (rk.type === 2) {
      var pulse = 0.35 + 0.3 * Math.sin(rk.surf * 3.1 + rk.seed);
      c.strokeStyle = 'rgba(255,138,61,' + pulse.toFixed(3) + ')';
      c.lineWidth = Math.max(1.2, rk.r * 0.055);
    } else {
      c.strokeStyle = 'rgba(255,255,255,0.16)';
      c.lineWidth = Math.max(0.8, rk.r * 0.022);
    }
    for (i = 0; i < rk.cracks.length; i++) {
      var ck = rk.cracks[i];
      c.beginPath();
      c.moveTo(ck.x1 * rk.r, ck.y1 * rk.r);
      c.lineTo(ck.x2 * rk.r, ck.y2 * rk.r);
      c.stroke();
    }
    c.restore();
  }

  function drawRocks(c) {
    var it = rocks.items;
    for (var i = 0; i < it.length; i++) {
      var rk = it[i];
      if (!rk.alive) continue;
      (function (r) {
        forEachWrap(r, r.r * 2.2, function (x, y) { drawRockAt(c, r, x, y); });
      })(rk);
    }
  }

  /* ------------------------------------------------------------------ ship */
  function drawShipShape(c, r, thrust, t) {
    /* engine flame */
    if (thrust > 0.05) {
      var fl = (0.62 + Math.random() * 0.55) * r * (0.8 + thrust * 0.7);
      c.globalCompositeOperation = 'lighter';
      c.beginPath();
      c.moveTo(-r * 0.72, r * 0.36);
      c.lineTo(-r * 0.72 - fl, 0);
      c.lineTo(-r * 0.72, -r * 0.36);
      c.closePath();
      var fg = c.createLinearGradient(-r * 0.7, 0, -r * 0.7 - fl, 0);
      fg.addColorStop(0, 'rgba(255,255,255,0.95)');
      fg.addColorStop(0.28, 'rgba(125,249,255,0.75)');
      fg.addColorStop(1, 'rgba(125,80,255,0)');
      c.fillStyle = fg;
      c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    /* hull outline */
    c.beginPath();
    c.moveTo(r * 1.55, 0);
    c.lineTo(-r * 0.92, r * 0.95);
    c.lineTo(-r * 0.42, 0);
    c.lineTo(-r * 0.92, -r * 0.95);
    c.closePath();
    c.fillStyle = 'rgba(6,16,26,0.92)';
    c.fill();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(95,216,255,0.35)';
    c.lineWidth = r * 0.42;
    c.stroke();
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = '#eaffff';
    c.lineWidth = Math.max(1.2, r * 0.115);
    c.lineJoin = 'round';
    c.stroke();
    /* cockpit */
    c.globalCompositeOperation = 'lighter';
    c.beginPath();
    c.moveTo(r * 0.15, 0);
    c.lineTo(-r * 0.42, r * 0.26);
    c.lineTo(-r * 0.42, -r * 0.26);
    c.closePath();
    c.fillStyle = 'rgba(125,249,255,0.85)';
    c.fill();
    c.globalCompositeOperation = 'source-over';
  }

  function drawTrail(c) {
    if (!ship.alive || trail.length < 2) return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (var i = trail.length - 1; i >= 1; i--) {
      var t = trail[i], k = 1 - i / trail.length;
      var a = k * k * 0.16 * (0.35 + t.w);
      if (a < 0.004) continue;
      c.globalAlpha = a;
      c.strokeStyle = '#7df9ff';
      c.lineWidth = Math.max(0.8, ship.r * 0.16);
      c.beginPath();
      c.moveTo(t.x + Math.cos(t.ang) * ship.r * 1.4, t.y + Math.sin(t.ang) * ship.r * 1.4);
      c.lineTo(t.x - Math.cos(t.ang) * ship.r * 0.9 + Math.cos(t.ang + 1.2) * ship.r * 0.9,
        t.y - Math.sin(t.ang) * ship.r * 0.9 + Math.sin(t.ang + 1.2) * ship.r * 0.9);
      c.lineTo(t.x - Math.cos(t.ang) * ship.r * 0.9 + Math.cos(t.ang - 1.2) * ship.r * 0.9,
        t.y - Math.sin(t.ang) * ship.r * 0.9 + Math.sin(t.ang - 1.2) * ship.r * 0.9);
      c.closePath();
      c.stroke();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.restore();
  }

  function drawShip(c) {
    if (!ship.alive) return;
    var blink = ship.invuln > 0 && Math.floor(STATE.t * 12) % 2 === 0;
    var sc = 1 + ship.warp * 0.25;
    forEachWrap(ship, 40 * U, function (x, y) {
      c.save();
      c.translate(x, y);
      c.rotate(ship.ang);
      c.scale(sc, sc);
      if (!blink) drawShipShape(c, ship.r, ship.thrustAmt, STATE.t);
      c.restore();
    });
    if (ship.invuln > 0) {
      var a = clamp(ship.invuln / 2.6, 0, 1);
      c.save();
      c.translate(ship.x, ship.y);
      c.rotate(STATE.t * 1.6);
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(125,249,255,' + (0.30 + 0.35 * a).toFixed(3) + ')';
      c.lineWidth = 2 * U;
      c.beginPath();
      for (var i = 0; i < 6; i++) {
        var ang = (i / 6) * TAU, rr = ship.r * 1.95;
        if (i) c.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        else c.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      c.closePath(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,' + (0.14 * a).toFixed(3) + ')';
      c.lineWidth = 6 * U; c.stroke();
      c.restore();
    }
  }

  /* ------------------------------------------------------------------- ufo */
  function drawUfo(c) {
    var it = ufos.items;
    for (var i = 0; i < it.length; i++) {
      var u = it[i];
      if (!u.alive) continue;
      (function (uu) {
        forEachWrap(uu, uu.r * 2.4, function (x, y) {
          c.save();
          c.translate(x, y);
          var r = uu.r;
          /* under-glow */
          c.globalCompositeOperation = 'lighter';
          c.drawImage(SPR.hot, -r * 1.5, -r * 1.2, r * 3, r * 2.4);
          c.globalCompositeOperation = 'source-over';
          /* saucer body */
          c.beginPath();
          c.ellipse(0, r * 0.12, r, r * 0.52, 0, 0, TAU);
          c.fillStyle = 'rgba(20,6,18,0.92)'; c.fill();
          c.strokeStyle = '#ff8ab5'; c.lineWidth = Math.max(1.1, r * 0.12); c.stroke();
          /* dome */
          c.beginPath();
          c.ellipse(0, -r * 0.26, r * 0.46, r * 0.42, 0, Math.PI, TAU);
          c.strokeStyle = '#ffd3e6'; c.lineWidth = Math.max(0.9, r * 0.1); c.stroke();
          /* running lights */
          c.globalCompositeOperation = 'lighter';
          for (var k = -1; k <= 1; k++) {
            var lit = (Math.floor(uu.t * 8) % 3) === (k + 1);
            c.fillStyle = lit ? 'rgba(255,255,255,0.95)' : 'rgba(255,46,136,0.35)';
            c.beginPath(); c.arc(k * r * 0.55, r * 0.16, r * 0.12, 0, TAU); c.fill();
          }
          /* targeting beam for small saucers */
          if (uu.kind === 1 && ship.alive) {
            var ang = Math.atan2(ship.y - y, ship.x - x);
            c.globalAlpha = 0.10 + 0.06 * Math.sin(uu.t * 14);
            c.strokeStyle = '#ff2e88';
            c.lineWidth = r * 0.1;
            c.beginPath();
            c.moveTo(0, r * 0.2);
            c.lineTo(Math.cos(ang) * r * 3.4, Math.sin(ang) * r * 3.4);
            c.stroke();
            c.globalAlpha = 1;
          }
          c.globalCompositeOperation = 'source-over';
          c.restore();
        });
      })(u);
    }
  }

  /* --------------------------------------------------------------- bullets */
  function drawBullets(c) {
    var it = bullets.items;
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < it.length; i++) {
      var b = it[i];
      if (!b.alive) continue;
      var tx = b.x - b.vx * 0.022, ty = b.y - b.vy * 0.022;
      var col = b.friendly ? 'rgba(190,250,255,' : 'rgba(255,120,180,';
      c.strokeStyle = col + '0.20)';
      c.lineWidth = 7 * U;
      c.lineCap = 'round';
      c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(tx, ty); c.stroke();
      c.strokeStyle = col + '0.95)';
      c.lineWidth = 2.2 * U;
      c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(tx, ty); c.stroke();
      c.drawImage(b.friendly ? SPR.cyan : SPR.hot, b.x - 9 * U, b.y - 9 * U, 18 * U, 18 * U);
    }
    c.globalCompositeOperation = 'source-over';
    c.lineCap = 'butt';
  }

  /* -------------------------------------------------------------- particles */
  function drawParticles(c) {
    var it = parts.items;
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < it.length; i++) {
      var p = it[i];
      if (!p.alive) continue;
      var lr = clamp(p.life / p.max, 0, 1);
      if (p.kind === 0) {
        var sp = Math.hypot(p.vx, p.vy);
        var len = clamp(sp * 0.055, 2.5 * U, 34 * U);
        var nx = sp > 1 ? p.vx / sp : 0, ny = sp > 1 ? p.vy / sp : 0;
        c.globalAlpha = lr * 0.95;
        c.strokeStyle = p.col;
        c.lineWidth = p.size;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x - nx * len, p.y - ny * len);
        c.stroke();
      } else if (p.kind === 1) {
        c.globalAlpha = lr * 0.5;
        var es = p.size * 3.4;
        c.drawImage(p.spr || SPR.amber, p.x - es, p.y - es, es * 2, es * 2);
        c.globalAlpha = lr * 0.9;
        c.fillStyle = p.col;
        c.beginPath(); c.arc(p.x, p.y, p.size * 0.55, 0, TAU); c.fill();
      } else if (p.kind === 2) {
        c.globalAlpha = lr * 0.16;
        c.drawImage(SPR.smoke, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      } else {
        c.globalAlpha = lr * lr * 0.95;
        c.drawImage(p.spr || SPR.white, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.lineCap = 'butt';
  }

  function drawDebris(c) {
    var it = debris.items;
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < it.length; i++) {
      var d = it[i];
      if (!d.alive) continue;
      var lr = clamp(d.life / d.max, 0, 1);
      c.save();
      c.translate(d.x, d.y);
      c.rotate(d.rot);
      c.globalAlpha = lr;
      c.beginPath();
      for (var k = 0; k < d.pts.length; k++) {
        var pt = d.pts[k];
        if (k) c.lineTo(pt[0] * d.r, pt[1] * d.r); else c.moveTo(pt[0] * d.r, pt[1] * d.r);
      }
      c.closePath();
      c.strokeStyle = d.col;
      c.lineWidth = 1.3 * U;
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.10)';
      c.fill();
      c.restore();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  function drawRings(c) {
    var it = rings.items;
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < it.length; i++) {
      var r = it[i];
      if (!r.alive) continue;
      var lr = clamp(r.life / r.max, 0, 1);
      c.globalAlpha = Math.pow(lr, 2.2) * 0.62;
      c.strokeStyle = r.col;
      c.lineWidth = Math.max(0.6, r.w * lr);
      c.beginPath(); c.arc(r.x, r.y, Math.max(0.5, r.r), 0, TAU); c.stroke();
      c.globalAlpha = Math.pow(lr, 2.2) * 0.09;
      c.lineWidth = Math.max(1, r.w * 3 * lr);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  function drawTexts(c) {
    var it = texts.items;
    for (var i = 0; i < it.length; i++) {
      var t = it[i];
      if (!t.alive) continue;
      var lr = clamp(t.life / t.max, 0, 1);
      c.globalAlpha = lr;
      c.font = '700 ' + t.size + 'px ' + FONT;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.fillText(t.txt, t.x + 1.5, t.y + 1.5);
      c.fillStyle = t.col;
      c.fillText(t.txt, t.x, t.y);
    }
    c.globalAlpha = 1;
  }

  function drawSurgeWave(c) {
    if (!surgeWave.active) return;
    var lr = clamp(surgeWave.life / surgeWave.max, 0, 1);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = lr * 0.30;
    c.strokeStyle = '#cdf7ff';
    c.lineWidth = 16 * U * lr;
    c.beginPath(); c.arc(surgeWave.x, surgeWave.y, surgeWave.r, 0, TAU); c.stroke();
    c.globalAlpha = lr;
    c.strokeStyle = '#ffffff';
    c.lineWidth = 4 * U * lr + 1;
    c.beginPath(); c.arc(surgeWave.x, surgeWave.y, surgeWave.r, 0, TAU); c.stroke();
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  /* ------------------------------------------------------------------- HUD */
  function text(c, s, x, y, size, col, align, weight) {
    c.font = (weight || 700) + ' ' + size + 'px ' + FONT;
    c.textAlign = align || 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = col;
    c.fillText(s, x, y);
  }
  function spaced(c, px) { try { c.letterSpacing = px + 'px'; } catch (e) { } }

  function drawHUD(c) {
    var pad = 22 * U;
    var t = STATE.t;
    c.save();
    /* score */
    spaced(c, 2 * U);
    text(c, 'SCORE', pad, pad + 11 * U, Math.round(9.5 * U), 'rgba(140,190,220,0.85)');
    var sc = String(Math.round(STATE.score)).padStart(6, '0');
    c.globalAlpha = 0.9;
    text(c, sc, pad - 1.5, pad + 39 * U, Math.round(27 * U), 'rgba(125,249,255,0.35)');
    c.globalAlpha = 1;
    text(c, sc, pad, pad + 38 * U, Math.round(27 * U), '#eaffff');
    text(c, 'BEST ' + String(STATE.best).padStart(6, '0'), pad, pad + 56 * U, Math.round(9.5 * U), 'rgba(120,160,190,0.8)');

    /* wave */
    text(c, 'WAVE', W - pad, pad + 11 * U, Math.round(9.5 * U), 'rgba(140,190,220,0.85)', 'right');
    text(c, String(STATE.wave).padStart(2, '0'), W - pad, pad + 38 * U, Math.round(27 * U), '#eaffff', 'right');

    /* lives — parked top-left on touch layouts so the stick never covers them */
    var ly = touchOn ? pad + 82 * U : H - pad - 12 * U;
    var lx = touchOn ? pad + 9 * U : pad + 9 * U;
    for (var i = 0; i < Math.min(STATE.lives, 8); i++) {
      c.save();
      c.translate(lx + i * 20 * U, ly);
      c.rotate(-Math.PI / 2);
      c.globalAlpha = 0.9;
      drawShipShape(c, 7 * U, 0, t);
      c.restore();
    }
    if (STATE.lives > 8) text(c, '+' + (STATE.lives - 8), lx + 8 * 20 * U, ly + 4 * U, Math.round(11 * U), '#9fd8ff');

    /* chain multiplier */
    if (STATE.mult > 1) {
      var bob = Math.sin(t * 7) * 2 * U;
      var mcol = STATE.mult >= 6 ? '#ffd166' : '#9ff6ff';
      text(c, 'x' + STATE.mult, W / 2, pad + 30 * U + bob, Math.round(24 * U), mcol, 'center');
      var bw = 96 * U, bx = W / 2 - bw / 2, by = pad + 38 * U;
      c.fillStyle = 'rgba(255,255,255,0.13)';
      c.fillRect(bx, by, bw, 3 * U);
      c.fillStyle = mcol;
      c.fillRect(bx, by, bw * clamp(STATE.chainT / 2.7, 0, 1), 3 * U);
      spaced(c, 1.5 * U);
      text(c, 'CHAIN', W / 2, pad + 54 * U, Math.round(8 * U), 'rgba(150,200,230,0.75)', 'center');
    }

    /* surge meter */
    var mw = Math.min(W * 0.42, 260 * U), mx = W / 2 - mw / 2, my = H - pad - 26 * U, mh = 9 * U;
    c.fillStyle = 'rgba(255,255,255,0.09)';
    c.fillRect(mx - 1, my - 1, mw + 2, mh + 2);
    var full = STATE.surge >= 1;
    if (full) {
      var pulse = 0.55 + 0.45 * Math.sin(t * 6);
      c.globalAlpha = 0.25 + 0.3 * pulse;
      c.fillStyle = '#7df9ff';
      c.fillRect(mx - 6 * U, my - 6 * U, mw + 12 * U, mh + 12 * U);
      c.globalAlpha = 1;
    }
    var g = c.createLinearGradient(mx, 0, mx + mw, 0);
    g.addColorStop(0, full ? '#ffffff' : '#2f7fa8');
    g.addColorStop(1, full ? '#7df9ff' : '#6fd0ff');
    c.fillStyle = g;
    c.fillRect(mx, my, mw * STATE.surge, mh);
    /* segment ticks */
    for (var s = 1; s < 4; s++) {
      c.fillStyle = 'rgba(4,8,16,0.75)';
      c.fillRect(mx + (mw / 4) * s, my, 1.5 * U, mh);
    }
    spaced(c, 2 * U);
    text(c, full ? 'SURGE READY · E' : 'SURGE', W / 2, my - 7 * U, Math.round(8.5 * U),
      full ? 'rgba(180,250,255,0.95)' : 'rgba(120,170,200,0.7)', 'center');

    /* wave banner */
    if (STATE.banner > 0) {
      var a = Math.min(1, STATE.banner * 1.6);
      c.globalAlpha = a;
      spaced(c, 8 * U);
      text(c, STATE.bannerTxt, W / 2, H * 0.30, Math.round(34 * U), 'rgba(180,250,255,0.95)', 'center', 800);
      c.globalAlpha = a * 0.6;
      text(c, 'HOSTILES INBOUND', W / 2, H * 0.30 + 22 * U, Math.round(9.5 * U), 'rgba(255,120,180,0.9)', 'center');
      c.globalAlpha = 1;
    }
    c.restore();
    try { c.letterSpacing = '0px'; } catch (e) { }
  }

  /* --------------------------------------------------------------- composite */
  function drawWorld() {
    sctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    sctx.globalCompositeOperation = 'source-over';
    sctx.globalAlpha = 1;
    sctx.drawImage(bgCv, 0, 0, W, H);
    drawStars(sctx);
    drawSurgeWave(sctx);
    drawBullets(sctx);
    drawRocks(sctx);
    drawUfo(sctx);
    if (STATE.mode !== 'menu') { drawTrail(sctx); drawShip(sctx); }
    drawDebris(sctx);
    drawParticles(sctx);
    drawRings(sctx);
    drawTexts(sctx);
  }

  function render() {
    drawWorld();

    /* --- composite with shake + zoom --- */
    var sx = 0, sy = 0;
    if (FX.shake > 0.002) {
      var m = 26 * U * FX.shake * FX.shake;
      sx = rnd(-m, m); sy = rnd(-m, m);
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#04050c';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.scale(FX.zoom, FX.zoom);
    ctx.drawImage(scene, -W / 2, -H / 2, W, H);

    /* chromatic aberration on impact */
    if (Q.aber && SET.quality !== 'performance' && FX.aber > 0.02) {
      var off = Math.min(5 * U, FX.aber * 4 * U), al = Math.min(0.16, FX.aber * 0.13);
      rctx.setTransform(1, 0, 0, 1, 0, 0);
      rctx.globalCompositeOperation = 'source-over';
      rctx.drawImage(scene, 0, 0);
      rctx.globalCompositeOperation = 'multiply';
      rctx.fillStyle = '#ff0000'; rctx.fillRect(0, 0, redCv.width, redCv.height);
      rctx.globalCompositeOperation = 'source-over';
      cctx.setTransform(1, 0, 0, 1, 0, 0);
      cctx.globalCompositeOperation = 'source-over';
      cctx.drawImage(scene, 0, 0);
      cctx.globalCompositeOperation = 'multiply';
      cctx.fillStyle = '#00ffff'; cctx.fillRect(0, 0, cyanCv.width, cyanCv.height);
      cctx.globalCompositeOperation = 'source-over';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = al;
      ctx.drawImage(redCv, -off, 0, W, H);
      ctx.drawImage(cyanCv, off, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    /* bloom */
    if (SET.bloom && Q.bloom) {
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.globalCompositeOperation = 'source-over';
      bctx.clearRect(0, 0, bloomCv.width, bloomCv.height);
      try { bctx.filter = 'blur(2px)'; } catch (e) { }
      bctx.drawImage(scene, 0, 0, bloomCv.width, bloomCv.height);
      try { bctx.filter = 'none'; } catch (e) { }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(0.24 + FX.bloomBoost * 0.16, 0, 0.42);
      ctx.drawImage(bloomCv, -W / 2, -H / 2, W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();

    /* vignette */
    ctx.drawImage(vigCv, 0, 0, W, H);

    /* proximity danger tint */
    if (STATE.mode === 'play' && ship.alive) {
      var near = 1e9, ri = rocks.items;
      for (var i = 0; i < ri.length; i++) {
        var rk = ri[i];
        if (!rk.alive) continue;
        var d = Math.hypot(rk.x - ship.x, rk.y - ship.y) - rk.r;
        if (d < near) near = d;
      }
      if (near < 150 * U) {
        var da = (1 - clamp(near / (150 * U), 0, 1)) * 0.30 * (0.7 + 0.3 * Math.sin(STATE.t * 9));
        var dg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72);
        dg.addColorStop(0, 'rgba(255,40,90,0)');
        dg.addColorStop(1, 'rgba(255,40,90,' + da.toFixed(3) + ')');
        ctx.fillStyle = dg;
        ctx.fillRect(0, 0, W, H);
      }
    }

    /* CRT scanlines */
    if (SET.crt && scanPat && SET.quality !== 'performance') {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = scanPat;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    /* impact flash */
    if (FX.flash > 0.003) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(' + FX.flashCol + ',' + clamp(FX.flash * 0.5, 0, 0.42).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }

    /* HUD last — stays crisp above every post effect */
    if (STATE.mode !== 'menu') drawHUD(ctx);
  }
