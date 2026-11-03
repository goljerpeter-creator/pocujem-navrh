/* Kniha „Počujem – hovorím – komunikujem“ – správanie popisu produktu na shopis.sk.
   Pracuje len vnútri #hb-book; ak na stránke nie je, neurobí nič. Bez knižníc, bez globálnych premenných.
   Text, obrázky aj nákup fungujú aj bez tohto súboru (odkazy vedú na obrázky a na produkt). */
(function () {
  "use strict";

  // 40 týždňov: vlna, ktorej amplitúda rastie od prvých zvukov k reči.
  // Kreslí sa v skutočnej šírke pásu, aby bodky mali rovnakú veľkosť na mobile aj počítači.
  function setupWeeks(root) {
    var journey = root.querySelector(".hb-journey");
    if (!journey) return;
    var NS = "http://www.w3.org/2000/svg";
    var band = document.createElement("div");
    band.className = "hb-weeks";
    band.setAttribute("aria-hidden", "true");
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("focusable", "false");
    var labels = document.createElement("div");
    labels.className = "hb-weeks-labels";
    band.appendChild(svg);
    band.appendChild(labels);
    journey.appendChild(band);
    journey.classList.add("has-weeks");

    function draw() {
      var N = 40, PAD = 8, MID = 50;
      var W = Math.max(280, Math.round(band.getBoundingClientRect().width));
      svg.setAttribute("viewBox", "0 0 " + W + " 96");
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      labels.textContent = "";
      var x = function (w) { return PAD + (W - 2 * PAD - 30) * (w - 1) / (N - 1); };
      var y = function (w) {
        var t = (w - 1) / (N - 1);
        return MID - (3 + 36 * Math.pow(t, 1.35)) * Math.sin(t * Math.PI * 2 * 5.25);
      };
      var d = "";
      for (var s = 1; s <= N; s += 0.1) d += (d ? " L" : "M") + x(s).toFixed(1) + " " + y(s).toFixed(1);
      var path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#D9C6EF");
      path.setAttribute("stroke-width", "3");
      path.setAttribute("stroke-linecap", "round");
      svg.appendChild(path);
      var from = [180, 143, 219], to = [78, 47, 122];
      for (var w = 1; w <= N; w++) {
        var t = (w - 1) / (N - 1), c = document.createElementNS(NS, "circle");
        var rgb = from.map(function (f, i) { return Math.round(f + (to[i] - f) * t); });
        c.setAttribute("cx", x(w).toFixed(1));
        c.setAttribute("cy", y(w).toFixed(1));
        c.setAttribute("r", (w % 10 === 0 || w === 1) ? "5.5" : "3.8");
        c.setAttribute("fill", "rgb(" + rgb.join(",") + ")");
        svg.appendChild(c);
      }
      var bubble = document.createElementNS(NS, "g");
      bubble.setAttribute("transform", "translate(" + (x(N) + 4) + " " + (y(N) - 20) + ")");
      bubble.innerHTML = '<path d="M13 1.5c6.6 0 11.5 4.4 11.5 9.8S19.6 21 13 21c-1.3 0-2.6-.2-3.8-.5L3.5 23l1.6-4.8C2.9 16.4 1.5 14 1.5 11.3 1.5 5.9 6.4 1.5 13 1.5z" fill="#FFFFFF" stroke="#4E2F7A" stroke-width="1.8"/><g fill="#4E2F7A"><circle cx="9.6" cy="7.6" r="1.3"/><circle cx="13" cy="7.6" r="1.3"/><circle cx="16.4" cy="7.6" r="1.3"/><circle cx="10.8" cy="11.2" r="1.3"/><circle cx="14.2" cy="11.2" r="1.3"/><circle cx="17.6" cy="11.2" r="1.3"/><circle cx="9.6" cy="14.8" r="1.3"/><circle cx="13" cy="14.8" r="1.3"/><circle cx="16.4" cy="14.8" r="1.3"/></g>';
      svg.appendChild(bubble);
      [1, 10, 20, 30, 40].forEach(function (w) {
        var span = document.createElement("span");
        span.style.left = (x(w) / W * 100) + "%";
        span.textContent = w === 1 ? "1. týždeň" : w === 40 && W >= 520 ? "40. týždeň" : w + ".";
        labels.appendChild(span);
      });
    }
    draw();
    if (window.ResizeObserver) {
      var lastW = 0;
      new ResizeObserver(function (entries) {
        var bw = Math.round(entries[0].contentRect.width);
        if (bw !== lastW) { lastW = bw; draw(); }
      }).observe(band);
    }
  }

  // Listovanie ukážok ako v knihe (vlastná implementácia, bez knižnice).
  // Strana je polovica obrázka dvojstrany; na úzkom displeji sa listuje po jednej strane.
  // Otáčanie riadi requestAnimationFrame, aby animácia aj ťahanie prstom zdieľali to isté svetlo a tieň.
  function setupViewer(root) {
    var gallery = root.querySelector(".hb-gallery");
    var COVER = gallery ? gallery.getAttribute("data-hb-cover") : "";
    var shots = Array.prototype.slice.call(root.querySelectorAll("[data-hb-zoom]")).map(function (a) {
      var cap = a.parentNode.querySelector("figcaption");
      return { href: a.getAttribute("href"), cap: cap ? cap.textContent : "", link: a };
    });
    var dialog, fb, book, leaf, cast, pgL, pgR, fFront, fBack, capEl, cntEl;
    var ZMAX = 3, PADX = 12, PADY = 9; // PADX/PADY = vnútorný okraj .hb-fb-view
    var view, zIn, zOut, zVal, zs = 1, zx = 0, zy = 0, pinch = null, pointers = {}, tapTimer = null, lastTap = null;
    var spread = 0, page = 0, busy = false, state = null, drag = null, pendingClose = false;
    var narrowMq = window.matchMedia ? window.matchMedia("(max-width: 640px)") : null;
    var calmMq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    function isSingle() { return !!(narrowMq && narrowMq.matches); }
    function isCalm() { return !!(calmMq && calmMq.matches); }
    function canOpen() { return typeof HTMLDialogElement !== "undefined" && shots.length > 0; }
    function setFace(el, s, side) {
      el.classList.remove("is-cover", "is-inner");
      if (side < 0 || !shots[s]) { el.style.backgroundImage = "none"; return; }
      el.style.backgroundImage = 'url("' + shots[s].href + '")';
      el.style.backgroundPosition = side ? "100% 0" : "0 0";
    }
    function render() {
      var single = isSingle(), s = single ? Math.floor(page / 2) : spread;
      fb.classList.toggle("is-single", single);
      fb.classList.toggle("can-prev", single ? page > 0 : spread > 0);
      fb.classList.toggle("can-next", single ? page < shots.length * 2 - 1 : spread < shots.length - 1);
      if (single) setFace(pgR, s, page % 2); else { setFace(pgL, s, 0); setFace(pgR, s, 1); }
      capEl.textContent = shots[s].cap;
      cntEl.textContent = (s + 1) + " / " + shots.length;
      book.setAttribute("aria-label", "Dvojstrana knihy: " + shots[s].cap);
      [s - 1, s + 1].forEach(function (k) { if (shots[k]) { var im = new Image(); im.src = shots[k].href; } });
    }
    function setProgress(p) {
      state.p = p;
      var angle = state.single ? (state.dir > 0 ? -180 * p : -180 * (1 - p)) : (state.dir > 0 ? -180 * p : 180 * p);
      leaf.style.transform = "rotateY(" + angle.toFixed(2) + "deg)";
      var r = state.single && state.dir < 0 ? 1 - p : p;
      book.style.setProperty("--hb-fs", (Math.min(r / 0.5, 1) * 0.85).toFixed(3));
      book.style.setProperty("--hb-bs", (Math.min((1 - r) / 0.5, 1) * 0.85).toFixed(3));
      book.style.setProperty("--hb-cast", (state.single && state.dir < 0 ? 0.5 * p : 0.6 * (1 - p)).toFixed(3));
      if (state.kind) { // otváranie alebo zatváranie obálkou
        book.style.setProperty("--hb-open", p.toFixed(3));
        book.style.setProperty("--hb-left", Math.max(0, Math.min(1, (p - 0.5) * 2)).toFixed(3));
        book.style.setProperty("--hb-lpage", Math.max(0, Math.min(1, (p - 0.86) / 0.14)).toFixed(3)); // ľavá strana až pred dopadom obálky
      }
    }
    function coverOn(single) {
      leaf.className = "hb-fb-leaf is-on" + (single ? "" : " is-fwd");
      fFront.classList.remove("is-inner"); fFront.classList.add("is-cover");
      fFront.style.backgroundImage = 'url("' + COVER + '")';
      if (single) { fBack.classList.add("is-inner"); fBack.style.backgroundImage = "none"; } else setFace(fBack, spread, 0);
      cast.className = "hb-fb-cast is-fwd";
      fb.classList.add("is-opening"); book.classList.add("is-turning");
    }
    function beginTurn(dir) {
      if (busy || !fb) return false;
      var single = isSingle(), total = single ? shots.length * 2 : shots.length;
      var cur = single ? page : spread, nxt = cur + dir;
      if (nxt < 0 || nxt >= total) return false;
      busy = true;
      state = { dir: dir, single: single, nxt: nxt, p: 0 };
      if (single) {
        leaf.className = "hb-fb-leaf is-on";
        setFace(fBack, 0, -1);
        if (dir > 0) { setFace(fFront, Math.floor(cur / 2), cur % 2); setFace(pgR, Math.floor(nxt / 2), nxt % 2); }
        else setFace(fFront, Math.floor(nxt / 2), nxt % 2);
      } else if (dir > 0) {
        setFace(fFront, cur, 1); setFace(fBack, nxt, 0); setFace(pgR, nxt, 1);
        leaf.className = "hb-fb-leaf is-on is-fwd";
      } else {
        setFace(fFront, cur, 0); setFace(fBack, nxt, 1); setFace(pgL, nxt, 0);
        leaf.className = "hb-fb-leaf is-on is-back";
      }
      cast.className = "hb-fb-cast " + (dir > 0 ? "is-fwd" : "is-back");
      book.classList.add("is-turning");
      setProgress(0);
      return true;
    }
    function endTurn(completed) {
      if (!state) return;
      if (completed && !state.kind) {
        if (state.single) { page = state.nxt; spread = Math.floor(page / 2); } else { spread = state.nxt; page = spread * 2; }
      }
      render(); // vráti strany pod listom do platného stavu, aj keď sa otáčanie zrušilo
      leaf.className = "hb-fb-leaf"; leaf.style.transform = ""; cast.className = "hb-fb-cast";
      book.classList.remove("is-turning", "is-dragging");
      ["--hb-fs", "--hb-bs", "--hb-cast", "--hb-open", "--hb-left", "--hb-lpage"].forEach(function (v) { book.style.removeProperty(v); });
      fb.classList.remove("is-opening");
      fFront.classList.remove("is-cover"); fBack.classList.remove("is-inner");
      state = null; busy = false;
      if (pendingClose) { pendingClose = false; closeBook(); }
    }
    function animateTo(target, done, full) {
      var from = state.p, dur = (full || 820) * Math.max(0.35, Math.abs(target - from)), t0 = null, finished = false;
      var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
      var finish = function () { if (finished) return; finished = true; setProgress(target); done(); };
      var step = function (ts) {
        if (finished) return;
        if (t0 === null) t0 = ts;
        var t = Math.min(1, (ts - t0) / dur);
        setProgress(from + (target - from) * ease(t));
        if (t < 1) requestAnimationFrame(step); else finish();
      };
      requestAnimationFrame(step);
      setTimeout(finish, dur + 400); // poistka, ak prehliadač nekreslí (napr. karta na pozadí)
    }
    function applyZoom(anim) {
      book.classList.toggle("is-zoom-anim", !!anim && !isCalm());
      book.style.setProperty("--hb-zs", zs.toFixed(4));
      book.style.setProperty("--hb-zx", zx.toFixed(1) + "px");
      book.style.setProperty("--hb-zy", zy.toFixed(1) + "px");
      fb.classList.toggle("is-zoomed", zs > 1.001);
      zVal.textContent = Math.round(zs * 100) + " %";
      zIn.disabled = zs >= ZMAX - 0.001; zOut.disabled = zs <= 1.001;
    }
    function clampPan() {
      var w = book.offsetWidth, h = book.offsetHeight;
      zx = Math.min(0, Math.max(w - zs * w, zx));
      zy = Math.min(0, Math.max(h - zs * h, zy));
    }
    function zoomAt(ns, px, py, anim) { // px, py = bod v nezväčšenej knihe, ktorý ostane na mieste
      ns = Math.max(1, Math.min(ZMAX, ns));
      var lx = (px - zx) / zs, ly = (py - zy) / zs;
      zs = ns; zx = px - zs * lx; zy = py - zs * ly;
      clampPan(); applyZoom(anim);
    }
    function resetZoom(anim) { zs = 1; zx = 0; zy = 0; if (book) applyZoom(anim); }
    function zoomStep(f) { zoomAt(zs * f, book.offsetWidth / 2, book.offsetHeight / 2, true); }
    function pt(e) {
      var r = view.getBoundingClientRect();
      return { x: e.clientX - r.left - PADX, y: e.clientY - r.top - PADY };
    }
    function turn(dir) {
      if (zs > 1.001) resetZoom(false);
      if (!beginTurn(dir)) return;
      if (isCalm()) { endTurn(true); return; }
      animateTo(1, function () { endTurn(true); });
    }
    // otvorenie: zatvorená kniha s obálkou sa otvorí na vybranej dvojstrane
    function openCover() {
      resetZoom(false);
      if (isCalm() || !COVER) return;
      var single = isSingle();
      busy = true;
      state = { kind: "open", dir: 1, single: single, p: 0 };
      coverOn(single);
      setProgress(0);
      setTimeout(function () { if (state && state.kind === "open") animateTo(1, function () { endTurn(true); }, 1150); }, 260);
    }
    // zatvorenie: obálka sa zaklapne a kniha zmizne
    function closeBook() {
      if (!dialog || !dialog.open) return;
      if (busy) { pendingClose = true; return; }
      resetZoom(false);
      if (isCalm() || !COVER) { dialog.close(); return; }
      var single = isSingle();
      busy = true;
      state = { kind: "close", dir: 1, single: single, p: 1 };
      coverOn(single);
      setProgress(1);
      animateTo(0, function () {
        fb.classList.add("is-leaving");
        setTimeout(function () { dialog.close(); fb.classList.remove("is-leaving"); endTurn(false); }, 220);
      }, 950);
    }
    function build() {
      dialog = document.createElement("dialog");
      dialog.className = "hb-lightbox";
      dialog.setAttribute("aria-label", "Ukážky z knihy");
      dialog.innerHTML = '<div class="hb-fb"><div class="hb-fb-view"><div class="hb-fb-book" role="img">'
        + '<div class="hb-fb-page hb-fb-left"></div><div class="hb-fb-page hb-fb-right"></div><div class="hb-fb-cast"></div>'
        + '<div class="hb-fb-leaf"><div class="hb-fb-face hb-fb-front"></div><div class="hb-fb-face hb-fb-back"></div></div>'
        + '</div></div><p class="hb-fb-cap" aria-live="polite"></p>'
        + '<div class="hb-fb-tools"><button type="button" class="hb-z-out" aria-label="Oddialiť">−</button>'
        + '<span class="hb-fb-zoomval">100 %</span><button type="button" class="hb-z-in" aria-label="Priblížiť">+</button>'
        + '<span class="hb-fb-count"></span></div>'
        + '<p class="hb-fb-hint">Listujte potiahnutím strany, kliknutím alebo šípkami. Priblížite dvojklikom, kolieskom myši alebo roztiahnutím prstov.</p></div>'
        + '<button type="button" class="hb-lb-prev" aria-label="Predchádzajúca strana">‹</button>'
        + '<button type="button" class="hb-lb-next" aria-label="Ďalšia strana">›</button>'
        + '<button type="button" class="hb-lb-close">Zavrieť</button>';
      fb = dialog.querySelector(".hb-fb"); book = dialog.querySelector(".hb-fb-book"); leaf = dialog.querySelector(".hb-fb-leaf");
      cast = dialog.querySelector(".hb-fb-cast");
      pgL = dialog.querySelector(".hb-fb-left"); pgR = dialog.querySelector(".hb-fb-right");
      fFront = dialog.querySelector(".hb-fb-front"); fBack = dialog.querySelector(".hb-fb-back");
      capEl = dialog.querySelector(".hb-fb-cap"); cntEl = dialog.querySelector(".hb-fb-count");
      view = dialog.querySelector(".hb-fb-view"); zIn = dialog.querySelector(".hb-z-in"); zOut = dialog.querySelector(".hb-z-out");
      zVal = dialog.querySelector(".hb-fb-zoomval");
      dialog.addEventListener("click", function (e) {
        if (e.target === dialog || e.target.classList.contains("hb-lb-close")) { closeBook(); return; }
        if (e.target.classList.contains("hb-lb-prev")) turn(-1);
        if (e.target.classList.contains("hb-lb-next")) turn(1);
        if (e.target === zIn && !busy) zoomStep(1.5);
        if (e.target === zOut && !busy) zoomStep(1 / 1.5);
      });
      dialog.addEventListener("cancel", function (e) { e.preventDefault(); closeBook(); });
      dialog.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") { e.preventDefault(); turn(-1); }
        if (e.key === "ArrowRight") { e.preventDefault(); turn(1); }
        if (busy) return;
        if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomStep(1.5); }
        if (e.key === "-") { e.preventDefault(); zoomStep(1 / 1.5); }
        if (e.key === "0") { e.preventDefault(); resetZoom(true); }
      });
      // koliesko myši alebo touchpad: plynulé priblíženie okolo kurzora
      book.addEventListener("wheel", function (e) {
        e.preventDefault();
        if (busy) return;
        var q = pt(e);
        zoomAt(zs * Math.exp(-e.deltaY * 0.0015), q.x, q.y, false);
      }, { passive: false });
      // ťahanie strany (list ide za prstom), posun pri priblížení, priblíženie dvoma prstami a dvojklik
      var dist = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
      book.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        var ids = Object.keys(pointers);
        if (ids.length === 2 && !busy) {
          if (drag && drag.active && !drag.pan) return; // práve sa otáča strana
          drag = null; clearTimeout(tapTimer); tapTimer = null;
          var a = pointers[ids[0]], b = pointers[ids[1]];
          var m = pt({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
          pinch = { d0: dist(a, b), s0: zs, lx: (m.x - zx) / zs, ly: (m.y - zy) / zs };
          book.classList.remove("is-zoom-anim");
          return;
        }
        if (ids.length > 1 || busy) return;
        var r = book.getBoundingClientRect();
        drag = {
          x: e.clientX, y: e.clientY, t: performance.now(), right: e.clientX - r.left > r.width / 2, w: r.width,
          id: e.pointerId, active: false, pan: zs > 1.001, zx0: zx, zy0: zy
        };
      });
      book.addEventListener("pointermove", function (e) {
        if (pointers[e.pointerId]) pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        if (pinch) {
          var ids = Object.keys(pointers);
          if (ids.length < 2) return;
          var a = pointers[ids[0]], b = pointers[ids[1]];
          var m = pt({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
          zs = Math.max(1, Math.min(ZMAX, pinch.s0 * dist(a, b) / pinch.d0));
          zx = m.x - zs * pinch.lx; zy = m.y - zs * pinch.ly;
          clampPan(); applyZoom(false);
          return;
        }
        if (!drag) return;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (drag.pan) {
          if (!drag.active) {
            if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
            drag.active = true; book.classList.add("is-panning");
            try { book.setPointerCapture(drag.id); } catch (err) { /* staršie prehliadače */ }
          }
          zx = drag.zx0 + dx; zy = drag.zy0 + dy;
          clampPan(); applyZoom(false);
          return;
        }
        if (!drag.active) {
          if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
          var dir = dx < 0 ? 1 : -1;
          if (!isSingle() && (dir > 0) !== drag.right) { drag = null; return; }
          if (!beginTurn(dir)) { drag = null; return; }
          drag.active = true; book.classList.add("is-dragging");
          try { book.setPointerCapture(drag.id); } catch (err) { /* staršie prehliadače */ }
        }
        setProgress(Math.max(0, Math.min(1, Math.abs(dx) / (isSingle() ? drag.w : drag.w * 0.85))));
      });
      var handleTap = function (e, d) {
        var now = performance.now();
        if (lastTap && now - lastTap.t < 300 && Math.abs(e.clientX - lastTap.x) < 30 && Math.abs(e.clientY - lastTap.y) < 30) {
          clearTimeout(tapTimer); tapTimer = null; lastTap = null;
          if (zs > 1.001) resetZoom(true); else { var q = pt(e); zoomAt(2.2, q.x, q.y, true); }
          return;
        }
        lastTap = { t: now, x: e.clientX, y: e.clientY };
        if (d.pan) return; // pri priblížení ťuknutie nelistuje
        var dir = d.right ? 1 : -1;
        clearTimeout(tapTimer);
        tapTimer = setTimeout(function () { tapTimer = null; turn(dir); }, 280); // počká, či nepríde dvojklik
      };
      var release = function (e, cancelled) {
        if (pinch) {
          if (Object.keys(pointers).length < 2) { pinch = null; if (zs < 1.05) resetZoom(true); }
          return;
        }
        if (!drag) return;
        var d = drag; drag = null;
        if (d.pan) {
          book.classList.remove("is-panning");
          if (!d.active && !cancelled && e) handleTap(e, d);
          return;
        }
        if (!d.active) { if (!cancelled && e) handleTap(e, d); return; }
        var speed = e ? Math.abs(e.clientX - d.x) / Math.max(1, performance.now() - d.t) : 0;
        var complete = !cancelled && (state.p > 0.35 || speed > 0.6);
        book.classList.remove("is-dragging");
        if (isCalm()) { endTurn(complete); return; }
        animateTo(complete ? 1 : 0, function () { endTurn(complete); });
      };
      book.addEventListener("pointerup", function (e) { delete pointers[e.pointerId]; release(e, false); });
      book.addEventListener("pointercancel", function (e) { delete pointers[e.pointerId]; release(null, true); });
      if (narrowMq && narrowMq.addEventListener) {
        narrowMq.addEventListener("change", function () { if (dialog.open && !busy) { resetZoom(false); render(); } });
      }
      root.appendChild(dialog);
    }
    // link = odkaz ukážky, null = od prvej dvojstrany
    function open(link) {
      if (!canOpen()) return false;
      if (!dialog) build();
      var idx = 0;
      for (var k = 0; k < shots.length; k++) if (shots[k].link === link) idx = k;
      spread = idx; page = idx * 2; pendingClose = false;
      pointers = {}; pinch = null; drag = null;
      render();
      resetZoom(false);
      dialog.showModal();
      openCover();
      return true;
    }
    return { open: open, canOpen: canOpen };
  }

  // Tlačidlá pri ukážkach vznikajú až tu: bez JS by nemali čo robiť.
  function setupGalleryTools(root, viewer) {
    var side = root.querySelector(".hb-gallery-side"), strip = root.querySelector(".hb-shots");
    if (!side || !strip) return;
    var tools = document.createElement("div");
    tools.className = "hb-gallery-tools";
    if (viewer.canOpen()) tools.innerHTML = '<button type="button" class="hb-btn-ghost" data-hb-open-book>Prelistovať knihu</button>';
    var nav = document.createElement("div");
    nav.className = "hb-shots-nav";
    nav.innerHTML = '<button type="button" data-hb-dir="-1" aria-label="Predchádzajúce ukážky">‹</button>'
      + '<button type="button" data-hb-dir="1" aria-label="Ďalšie ukážky">›</button>';
    nav.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-hb-dir]");
      if (!b) return;
      var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      strip.scrollBy({ left: Number(b.getAttribute("data-hb-dir")) * strip.clientWidth * 0.9, behavior: calm ? "auto" : "smooth" });
    });
    tools.appendChild(nav);
    side.appendChild(tools);
  }

  // Nákup cez oficiálnu funkciu Shoptetu. Ak nie je k dispozícii alebo chýba kód produktu,
  // klik pokračuje ako obyčajný odkaz na produkt (záloha).
  function makeBuy() {
    var pending = false;
    return function (btn) {
      var code = btn.getAttribute("data-hb-code");
      var cart = window.shoptet && window.shoptet.cartShared;
      if (!code || code === "PRODUCT_CODE" || !cart || typeof cart.addToCart !== "function") return false;
      if (pending) return true; // druhý klik počas vkladania sa nespracuje
      pending = true;
      btn.setAttribute("aria-disabled", "true");
      var done = function () { pending = false; btn.removeAttribute("aria-disabled"); };
      try {
        cart.addToCart({ productCode: code, amount: 1 });
      } catch (err) {
        done();
        return false;
      }
      setTimeout(done, 2000);
      return true;
    };
  }

  function init() {
    var root = document.getElementById("hb-book");
    if (!root || root.getAttribute("data-hb-ready")) return;
    root.setAttribute("data-hb-ready", "1");
    setupWeeks(root);
    var viewer = setupViewer(root);
    setupGalleryTools(root, viewer);
    var buy = makeBuy();
    // AIDEV-NOTE: capture fáza – OPAL by inak na odkazy na obrázky v popise mohol naviazať vlastný lightbox
    root.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var buyBtn = t.closest("[data-hb-buy]");
      if (buyBtn) {
        if (buy(buyBtn)) e.preventDefault();
        return;
      }
      var opener = t.closest("[data-hb-open-book]");
      var shot = opener ? null : t.closest("[data-hb-zoom]");
      if ((opener || shot) && viewer.open(shot)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  // Shoptet po AJAX zmene obsahu: nový #hb-book sa inicializuje, už spustený nie druhýkrát
  document.addEventListener("ShoptetDOMContentLoaded", init);
})();
