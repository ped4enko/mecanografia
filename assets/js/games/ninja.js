/*
 * Ninja del teclado — letters fall from the top, press the matching key
 * before they hit the ground. Spanish layout aware (ñ, tildes, ¿ ¡).
 * Depends on /assets/js/game-core.js
 */
(function () {
  'use strict';

  var G = window.MecanografiaGame;
  if (!G) return;

  var canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  var view = G.setupCanvas(canvas);
  var ctx = view.ctx;
  var W = view.width;
  var H = view.height;

  var particles = G.createParticles();
  var shake = G.createShake();
  var audio = G.createAudio('mecanografia-games-muted');
  var scores = G.createScores('mecanografia-juego-ninja-best');

  var HOME = 'asdfghjklñ'.split('');
  var TOP = 'qwertyuiop'.split('');
  var BOTTOM = 'zxcvbnm'.split('');
  var ACCENTS = 'áéíóú'.split('');
  var SPECIAL = ['¿', '¡', 'ü', 'ç'];

  var GROUND_Y = H - 56;
  var LIVES_START = 3;
  var HITS_PER_LEVEL = 12;

  var state;
  var els = {
    score: document.getElementById('stat-score'),
    combo: document.getElementById('stat-combo'),
    level: document.getElementById('stat-level'),
    best: document.getElementById('stat-best'),
    start: document.getElementById('btn-start'),
    sound: document.getElementById('btn-sound'),
    soundIcon: null
  };
  els.soundIcon = els.sound ? els.sound.querySelector('.material-symbols-outlined') : null;

  function resetState() {
    state = {
      phase: 'idle', // idle | playing | paused | over
      letters: [],
      score: 0,
      combo: 0,
      maxCombo: 0,
      hits: 0,
      lives: LIVES_START,
      level: 1,
      spawnTimer: 0.6,
      flash: 0,
      levelFlash: 0,
      popups: [],
      newBest: false,
      time: 0
    };
  }

  function poolForLevel(level) {
    var pool = HOME.slice();
    if (level >= 2) pool = pool.concat(TOP);
    if (level >= 3) pool = pool.concat(BOTTOM);
    if (level >= 4) pool = pool.concat(ACCENTS, ACCENTS);
    if (level >= 5) pool = pool.concat(SPECIAL);
    if (level >= 6) {
      var upper = [];
      for (var i = 0; i < 6; i++) upper.push(G.pick(HOME.concat(TOP)).toUpperCase());
      pool = pool.concat(upper);
    }
    return pool;
  }

  function spawnInterval(level) {
    return Math.max(0.42, 1.35 - (level - 1) * 0.11);
  }

  function fallSpeed(level) {
    return 62 + (level - 1) * 16;
  }

  function maxLetters(level) {
    return 3 + Math.min(level, 6);
  }

  function categoryColor(ch, p) {
    if (ACCENTS.indexOf(ch) >= 0 || ch === 'ü') return p.accent;
    if (SPECIAL.indexOf(ch) >= 0) return p.special;
    if (ch !== ch.toLowerCase()) return p.success;
    return p.text;
  }

  function spawnLetter() {
    var pool = poolForLevel(state.level);
    var ch = G.pick(pool);
    // Keep clear of the HUD pills (level pill top-left, hearts top-right).
    var x = G.randomBetween(120, W - 120);
    // Avoid stacking directly on top of a fresh letter.
    for (var i = 0; i < state.letters.length; i++) {
      var o = state.letters[i];
      if (o.y < 80 && Math.abs(o.x - x) < 56) {
        x = G.randomBetween(120, W - 120);
        break;
      }
    }
    state.letters.push({
      ch: ch,
      x: x,
      y: -30,
      vy: fallSpeed(state.level) * G.randomBetween(0.85, 1.2),
      wobble: Math.random() * Math.PI * 2,
      rot: G.randomBetween(-0.15, 0.15),
      state: 'fall',
      alpha: 1,
      scale: 1,
      age: 0
    });
  }

  function addPopup(text, x, y, color) {
    state.popups.push({ text: text, x: x, y: y, age: 0, life: 0.7, color: color });
  }

  function setPhase(p) {
    state.phase = p;
    if (els.start) {
      els.start.textContent = p === 'playing' ? 'Pausar' : p === 'paused' ? 'Continuar' : p === 'over' ? 'Jugar otra vez' : 'Empezar';
    }
    canvas.setAttribute('data-phase', p);
  }

  function startGame() {
    resetState();
    setPhase('playing');
    particles.clear();
    updateHud();
    audio.unlock();
  }

  function togglePause() {
    if (state.phase === 'playing') setPhase('paused');
    else if (state.phase === 'paused') setPhase('playing');
  }

  function gameOver() {
    setPhase('over');
    state.newBest = scores.submit(state.score);
    audio.over();
    updateHud();
  }

  function updateHud() {
    if (els.score) els.score.textContent = state.score;
    if (els.combo) els.combo.textContent = state.maxCombo;
    if (els.level) els.level.textContent = state.level;
    if (els.best) els.best.textContent = scores.best();
  }

  function handleChar(ch) {
    if (state.phase !== 'playing') {
      if (state.phase === 'idle' || state.phase === 'over') {
        if (ch === ' ') startGame();
      }
      return;
    }
    if (ch === ' ') return;

    var target = null;
    for (var i = 0; i < state.letters.length; i++) {
      var l = state.letters[i];
      if (l.state === 'fall' && l.ch === ch && (!target || l.y > target.y)) target = l;
    }

    var p = G.palette();
    if (target) {
      target.state = 'hit';
      target.age = 0;
      state.combo++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      var gained = 10 + Math.min(40, (state.combo - 1) * 2);
      state.score += gained;
      state.hits++;
      particles.burst(target.x, target.y, { color: categoryColor(target.ch, p), count: 16, speed: 240 });
      addPopup('+' + gained, target.x, target.y - 24, p.primary);
      audio.hit();

      var newLevel = 1 + Math.floor(state.hits / HITS_PER_LEVEL);
      if (newLevel > state.level) {
        state.level = newLevel;
        state.levelFlash = 1.2;
        audio.level();
      }
    } else {
      state.combo = 0;
      state.flash = 0.25;
      shake.trigger(5, 0.2);
      audio.miss();
    }
    updateHud();
  }

  function loseLife(letter) {
    state.lives--;
    state.combo = 0;
    state.flash = 0.4;
    shake.trigger(9, 0.35);
    particles.burst(letter.x, GROUND_Y, { color: G.palette().danger, count: 20, speed: 200 });
    audio.lose();
    if (state.lives <= 0) gameOver();
  }

  function update(dt) {
    shake.update(dt);
    particles.update(dt);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt);
    if (state.levelFlash > 0) state.levelFlash = Math.max(0, state.levelFlash - dt);

    for (var k = state.popups.length - 1; k >= 0; k--) {
      var pop = state.popups[k];
      pop.age += dt;
      pop.y -= 40 * dt;
      if (pop.age >= pop.life) state.popups.splice(k, 1);
    }

    if (state.phase !== 'playing') return;

    state.time += dt;
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.letters.length < maxLetters(state.level)) {
      spawnLetter();
      state.spawnTimer = spawnInterval(state.level) * G.randomBetween(0.8, 1.2);
    }

    for (var i = state.letters.length - 1; i >= 0; i--) {
      var l = state.letters[i];
      l.age += dt;
      if (l.state === 'fall') {
        l.y += l.vy * dt;
        l.wobble += dt * 2.2;
        if (l.y >= GROUND_Y) {
          state.letters.splice(i, 1);
          loseLife(l);
          if (state.phase !== 'playing') return;
        }
      } else {
        l.scale += 3 * dt;
        l.alpha -= 4 * dt;
        if (l.alpha <= 0) state.letters.splice(i, 1);
      }
    }
  }

  function drawBackground(p) {
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, p.bgTop);
    grad.addColorStop(1, p.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = p.grid;
    ctx.lineWidth = 1;
    for (var x = 0; x <= W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (var y = 0; y <= H; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    ctx.strokeStyle = p.ground;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(24, GROUND_Y); ctx.lineTo(W - 24, GROUND_Y); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawLetters(p) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < state.letters.length; i++) {
      var l = state.letters[i];
      var wob = l.state === 'fall' ? Math.sin(l.wobble) * 4 : 0;
      ctx.save();
      ctx.translate(l.x + wob, l.y);
      ctx.rotate(l.rot);
      ctx.scale(l.scale, l.scale);
      ctx.globalAlpha = Math.max(0, l.alpha);

      var color = categoryColor(l.ch, p);
      ctx.fillStyle = p.dark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.96)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      G.roundRect(ctx, -24, -24, 48, 48, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = '700 28px Lexend, "Atkinson Hyperlegible", sans-serif';
      ctx.fillText(l.ch, 0, 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(p) {
    ctx.textBaseline = 'middle';

    // Level pill (top-left)
    var lvlText = 'Nivel ' + state.level;
    ctx.font = '600 15px Lexend, sans-serif';
    var w = ctx.measureText(lvlText).width + 28;
    ctx.fillStyle = state.levelFlash > 0 ? p.primary : p.primarySoft;
    G.roundRect(ctx, 20, 18, w, 30, 15);
    ctx.fill();
    ctx.fillStyle = state.levelFlash > 0 ? '#ffffff' : p.primary;
    ctx.textAlign = 'left';
    ctx.fillText(lvlText, 34, 33);

    // Combo (top-center)
    if (state.combo >= 3 && state.phase === 'playing') {
      var pulse = 1 + 0.06 * Math.sin(state.time * 10);
      ctx.save();
      ctx.translate(W / 2, 34);
      ctx.scale(pulse, pulse);
      ctx.textAlign = 'center';
      ctx.fillStyle = p.accent;
      ctx.font = '700 18px Lexend, sans-serif';
      ctx.fillText('Racha x' + state.combo, 0, 0);
      ctx.restore();
    }

    // Lives (top-right)
    ctx.textAlign = 'right';
    ctx.font = '22px sans-serif';
    var hearts = '';
    for (var i = 0; i < LIVES_START; i++) hearts += i < state.lives ? '♥' : '♡';
    ctx.fillStyle = p.danger;
    ctx.fillText(hearts, W - 22, 33);

    // Score popups
    for (var k = 0; k < state.popups.length; k++) {
      var pop = state.popups[k];
      ctx.globalAlpha = 1 - pop.age / pop.life;
      ctx.fillStyle = pop.color;
      ctx.textAlign = 'center';
      ctx.font = '700 16px Lexend, sans-serif';
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.globalAlpha = 1;

    // Level up banner
    if (state.levelFlash > 0.4 && state.phase === 'playing') {
      ctx.globalAlpha = Math.min(1, (state.levelFlash - 0.4) * 2);
      ctx.textAlign = 'center';
      ctx.fillStyle = p.primary;
      ctx.font = '700 30px Lexend, sans-serif';
      ctx.fillText('¡Nivel ' + state.level + '!', W / 2, H / 2 - 40);
      ctx.globalAlpha = 1;
    }
  }

  function drawOverlay(p) {
    if (state.phase === 'playing') return;
    ctx.fillStyle = p.overlay;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (state.phase === 'idle') {
      ctx.fillStyle = p.text;
      ctx.font = '700 40px Lexend, sans-serif';
      ctx.fillText('Ninja del teclado', W / 2, H / 2 - 70);
      ctx.fillStyle = p.muted;
      ctx.font = '400 18px "Atkinson Hyperlegible", sans-serif';
      ctx.fillText('Las letras caen. Pulsa la tecla correcta antes de que toquen el suelo.', W / 2, H / 2 - 22);
      ctx.fillText('Empieza con la fila base (a s d f · j k l ñ). Luego llegan tildes, ¿ ¡ y mayúsculas.', W / 2, H / 2 + 8);
      ctx.fillStyle = p.primary;
      ctx.font = '600 20px Lexend, sans-serif';
      ctx.fillText('Pulsa Enter o Espacio para empezar', W / 2, H / 2 + 64);
    } else if (state.phase === 'paused') {
      ctx.fillStyle = p.text;
      ctx.font = '700 36px Lexend, sans-serif';
      ctx.fillText('Pausa', W / 2, H / 2 - 20);
      ctx.fillStyle = p.muted;
      ctx.font = '400 18px "Atkinson Hyperlegible", sans-serif';
      ctx.fillText('Pulsa Esc o Enter para continuar', W / 2, H / 2 + 24);
    } else if (state.phase === 'over') {
      ctx.fillStyle = p.text;
      ctx.font = '700 38px Lexend, sans-serif';
      ctx.fillText('Fin del juego', W / 2, H / 2 - 80);
      ctx.font = '700 30px Lexend, sans-serif';
      ctx.fillStyle = p.primary;
      ctx.fillText(state.score + ' puntos', W / 2, H / 2 - 28);
      ctx.fillStyle = p.muted;
      ctx.font = '400 18px "Atkinson Hyperlegible", sans-serif';
      var line = 'Nivel ' + state.level + ' · Racha máxima ' + state.maxCombo + ' · Mejor ' + scores.best();
      ctx.fillText(line, W / 2, H / 2 + 12);
      if (state.newBest) {
        ctx.fillStyle = p.success;
        ctx.font = '600 18px Lexend, sans-serif';
        ctx.fillText('¡Nuevo récord!', W / 2, H / 2 + 44);
      }
      ctx.fillStyle = p.primary;
      ctx.font = '600 20px Lexend, sans-serif';
      ctx.fillText('Enter o Espacio para jugar otra vez', W / 2, H / 2 + 86);
    }
  }

  function render() {
    var p = G.palette();
    var off = shake.offset();
    ctx.save();
    ctx.translate(off.x, off.y);
    drawBackground(p);
    drawLetters(p);
    particles.draw(ctx);
    drawHud(p);
    ctx.restore();

    if (state.flash > 0) {
      ctx.fillStyle = 'rgba(239, 68, 68, ' + (state.flash * 0.5) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    drawOverlay(p);
  }

  G.createInput({
    onChar: function (ch, e) {
      if (state.phase === 'playing' || ch === ' ') e.preventDefault();
      handleChar(ch);
    },
    onEnter: function (e) {
      if (e.target && e.target.tagName === 'BUTTON' && e.target !== els.start) return;
      e.preventDefault();
      if (state.phase === 'idle' || state.phase === 'over') startGame();
      else if (state.phase === 'paused') setPhase('playing');
    },
    onEscape: function (e) {
      e.preventDefault();
      togglePause();
    }
  });

  canvas.addEventListener('click', function () {
    if (state.phase === 'idle' || state.phase === 'over') startGame();
    else if (state.phase === 'paused') setPhase('playing');
  });

  window.addEventListener('blur', function () {
    if (state.phase === 'playing') setPhase('paused');
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state.phase === 'playing') setPhase('paused');
  });

  if (els.start) {
    els.start.addEventListener('click', function () {
      if (state.phase === 'idle' || state.phase === 'over') startGame();
      else togglePause();
      els.start.blur();
    });
  }

  function syncSoundButton() {
    if (!els.sound) return;
    var muted = audio.isMuted();
    els.sound.setAttribute('aria-pressed', muted ? 'true' : 'false');
    els.sound.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar');
    if (els.soundIcon) els.soundIcon.textContent = muted ? 'volume_off' : 'volume_up';
  }
  if (els.sound) {
    els.sound.addEventListener('click', function () {
      audio.toggle();
      syncSoundButton();
      els.sound.blur();
    });
    syncSoundButton();
  }

  resetState();
  setPhase('idle');
  updateHud();
  G.createLoop({ update: update, render: render }).start();

  if (location.hash === '#debug') {
    window.__ninjaState = function () { return state; };
  }
})();
