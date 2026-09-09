/*
 * Mecanografía — shared mini game engine.
 * Vanilla JS + <canvas>. No build step, no dependencies.
 *
 * Exposes window.MecanografiaGame with:
 *   setupCanvas(canvas, w, h)   -> { ctx, width, height, resize }
 *   createLoop({ update, render })
 *   createInput({ onChar, onEnter, onEscape })
 *   createParticles()
 *   createShake()
 *   createAudio(storageKey)
 *   createScores(key)
 *   palette()                   -> colors for current theme
 *   roundRect(ctx, x, y, w, h, r)
 *   randomBetween(min, max), pick(array), clamp(v, min, max)
 */
(function (global) {
  'use strict';

  var LOGICAL_W = 960;
  var LOGICAL_H = 540;

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function isDark() {
    return document.documentElement.classList.contains('dark');
  }

  function palette() {
    if (isDark()) {
      return {
        dark: true,
        bgTop: '#0b1220',
        bgBottom: '#101622',
        grid: 'rgba(148, 163, 184, 0.06)',
        ground: 'rgba(148, 163, 184, 0.35)',
        text: '#e2e8f0',
        muted: '#94a3b8',
        primary: '#135bec',
        primarySoft: 'rgba(19, 91, 236, 0.25)',
        accent: '#f59e0b',
        special: '#a78bfa',
        danger: '#ef4444',
        success: '#22c55e',
        overlay: 'rgba(11, 18, 32, 0.82)'
      };
    }
    return {
      dark: false,
      bgTop: '#ffffff',
      bgBottom: '#eef2f7',
      grid: 'rgba(15, 23, 42, 0.05)',
      ground: 'rgba(15, 23, 42, 0.25)',
      text: '#0f172a',
      muted: '#64748b',
      primary: '#135bec',
      primarySoft: 'rgba(19, 91, 236, 0.15)',
      accent: '#d97706',
      special: '#7c3aed',
      danger: '#dc2626',
      success: '#16a34a',
      overlay: 'rgba(246, 246, 248, 0.88)'
    };
  }

  /* ---------- canvas ---------- */

  function setupCanvas(canvas, w, h) {
    w = w || LOGICAL_W;
    h = h || LOGICAL_H;
    var ctx = canvas.getContext('2d');

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = canvas.getBoundingClientRect();
      var cssW = rect.width || w;
      var cssH = cssW * h / w;
      var pxW = Math.max(1, Math.round(cssW * dpr));
      var pxH = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW;
        canvas.height = pxH;
      }
      var scale = pxW / w;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    }

    resize();
    if (window.ResizeObserver) {
      new ResizeObserver(resize).observe(canvas.parentElement || canvas);
    } else {
      window.addEventListener('resize', resize);
    }

    return { ctx: ctx, width: w, height: h, resize: resize };
  }

  /* ---------- loop ---------- */

  function createLoop(opts) {
    var update = opts.update;
    var render = opts.render;
    var running = false;
    var last = 0;
    var raf = 0;

    function frame(now) {
      if (!running) return;
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      update(dt);
      render();
      raf = requestAnimationFrame(frame);
    }

    return {
      start: function () {
        if (running) return;
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      },
      stop: function () {
        running = false;
        cancelAnimationFrame(raf);
      },
      isRunning: function () {
        return running;
      }
    };
  }

  /* ---------- input ---------- */

  var IGNORED_KEYS = {
    Dead: 1, Shift: 1, Control: 1, Alt: 1, Meta: 1, CapsLock: 1,
    AltGraph: 1, Tab: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1,
    Backspace: 1, Delete: 1, Home: 1, End: 1, PageUp: 1, PageDown: 1, Insert: 1,
    NumLock: 1, ScrollLock: 1, ContextMenu: 1, Unidentified: 1
  };

  function isEditable(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function createInput(handlers) {
    function onKeydown(e) {
      if (e.ctrlKey || e.metaKey) return;
      if (isEditable(e.target)) return;

      if (e.key === 'Escape') {
        if (handlers.onEscape) handlers.onEscape(e);
        return;
      }
      if (e.key === 'Enter') {
        if (handlers.onEnter) handlers.onEnter(e);
        return;
      }
      if (IGNORED_KEYS[e.key]) return;
      if (e.key.length !== 1) return;
      if (handlers.onChar) handlers.onChar(e.key, e);
    }

    document.addEventListener('keydown', onKeydown);
    return {
      destroy: function () {
        document.removeEventListener('keydown', onKeydown);
      }
    };
  }

  /* ---------- particles ---------- */

  function createParticles() {
    var list = [];

    function burst(x, y, opts) {
      opts = opts || {};
      var count = opts.count || 14;
      var color = opts.color || '#135bec';
      var speed = opts.speed || 220;
      var life = opts.life || 0.6;
      var size = opts.size || 4;
      for (var i = 0; i < count; i++) {
        var a = Math.random() * Math.PI * 2;
        var s = speed * (0.4 + Math.random() * 0.8);
        list.push({
          x: x, y: y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - speed * 0.3,
          life: life * (0.6 + Math.random() * 0.6),
          age: 0,
          size: size * (0.6 + Math.random() * 0.8),
          color: color
        });
      }
    }

    function update(dt) {
      for (var i = list.length - 1; i >= 0; i--) {
        var p = list[i];
        p.age += dt;
        if (p.age >= p.life) {
          list.splice(i, 1);
          continue;
        }
        p.vy += 520 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    function draw(ctx) {
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var t = 1 - p.age / p.life;
        ctx.globalAlpha = t;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    return {
      burst: burst,
      update: update,
      draw: draw,
      clear: function () { list.length = 0; },
      count: function () { return list.length; }
    };
  }

  /* ---------- screen shake ---------- */

  function createShake() {
    var time = 0;
    var duration = 0;
    var intensity = 0;

    return {
      trigger: function (i, d) {
        intensity = i || 6;
        duration = d || 0.25;
        time = duration;
      },
      update: function (dt) {
        if (time > 0) time = Math.max(0, time - dt);
      },
      offset: function () {
        if (time <= 0) return { x: 0, y: 0 };
        var k = time / duration;
        return {
          x: (Math.random() * 2 - 1) * intensity * k,
          y: (Math.random() * 2 - 1) * intensity * k
        };
      }
    };
  }

  /* ---------- audio (WebAudio synth, no files) ---------- */

  function createAudio(storageKey) {
    storageKey = storageKey || 'mecanografia-games-muted';
    var ctx = null;
    var muted = false;
    try { muted = localStorage.getItem(storageKey) === '1'; } catch (e) {}

    function ensure() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function tone(freq, dur, type, gain, delay) {
      if (muted) return;
      var c = ensure();
      if (!c) return;
      var t0 = c.currentTime + (delay || 0);
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(gain || 0.12, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    }

    return {
      unlock: ensure,
      hit: function () { tone(880, 0.07, 'square', 0.06); tone(1320, 0.09, 'sine', 0.05); },
      miss: function () { tone(180, 0.18, 'sawtooth', 0.07); },
      lose: function () { tone(240, 0.2, 'triangle', 0.1); tone(150, 0.35, 'triangle', 0.09, 0.08); },
      level: function () { tone(523, 0.12, 'sine', 0.09); tone(659, 0.12, 'sine', 0.09, 0.09); tone(784, 0.16, 'sine', 0.09, 0.18); },
      over: function () { tone(392, 0.2, 'triangle', 0.1); tone(311, 0.2, 'triangle', 0.1, 0.18); tone(233, 0.45, 'triangle', 0.1, 0.36); },
      isMuted: function () { return muted; },
      toggle: function () {
        muted = !muted;
        try { localStorage.setItem(storageKey, muted ? '1' : '0'); } catch (e) {}
        if (!muted) ensure();
        return muted;
      }
    };
  }

  /* ---------- scores ---------- */

  function createScores(key) {
    var best = 0;
    try { best = parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch (e) {}
    return {
      best: function () { return best; },
      submit: function (value) {
        if (value > best) {
          best = value;
          try { localStorage.setItem(key, String(best)); } catch (e) {}
          return true;
        }
        return false;
      }
    };
  }

  global.MecanografiaGame = {
    LOGICAL_W: LOGICAL_W,
    LOGICAL_H: LOGICAL_H,
    setupCanvas: setupCanvas,
    createLoop: createLoop,
    createInput: createInput,
    createParticles: createParticles,
    createShake: createShake,
    createAudio: createAudio,
    createScores: createScores,
    palette: palette,
    roundRect: roundRect,
    randomBetween: randomBetween,
    pick: pick,
    clamp: clamp
  };
})(window);
