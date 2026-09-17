/*
 * Ninja del teclado — fruit-slice edition with sprite sheets + bomb hazards.
 * Spanish layout aware (ñ, tildes, ¿ ¡). Letter-only copy: /juegos/letras/
 * Depends on /assets/js/game-core.js
 */
(function () {
  'use strict';

  var G = window.MecanografiaGame;
  if (!G) return;

  var ASSET_BASE = '/assets/games/ninja';
  var ASSET_URLS = {
    apple: ASSET_BASE + '/fruits/apple.png',
    banana: ASSET_BASE + '/fruits/banana.png',
    coconut: ASSET_BASE + '/fruits/coconut.png',
    lime: ASSET_BASE + '/fruits/lime.png',
    orange: ASSET_BASE + '/fruits/orange.png',
    strawberry: ASSET_BASE + '/fruits/strawberry.png',
    bg: ASSET_BASE + '/sprites/bg.jpg',
    stage: ASSET_BASE + '/sprites/stage.png',
    effects: ASSET_BASE + '/sprites/effects.png',
    slashes: ASSET_BASE + '/sprites/slashes.png',
    splatter: ASSET_BASE + '/sprites/splatter.png',
    monkey: ASSET_BASE + '/sprites/monkey.png',
    sfxPop: ASSET_BASE + '/sounds/pop.mp3',
    sfxError: ASSET_BASE + '/sounds/error.mp3',
    sfxIntro: ASSET_BASE + '/sounds/intro.mp3',
    sfxGame: ASSET_BASE + '/sounds/game.mp3',
    sfxBank: ASSET_BASE + '/sounds/sounds.mp3'
  };
  var media = null;
  var fruitAtlases = null; // built after images load
  var FRUIT_KEYS = ['apple', 'banana', 'coconut', 'lime', 'orange', 'strawberry'];
  var FRUIT_JUICE = {
    apple: '#ef4444',
    banana: '#facc15',
    coconut: '#e7e5e4',
    lime: '#84cc16',
    orange: '#fb923c',
    strawberry: '#e11d48'
  };

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

  function isSpritePixel(r, g, b, a) {
    return a > 20 && (r + g + b) > 45;
  }

  function extractSpriteBoxes(img) {
    var c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    var cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);
    var imageData = cx.getImageData(0, 0, c.width, c.height);
    var data = imageData.data;
    var w = c.width;
    var h = c.height;
    var visited = new Uint8Array(w * h);
    var boxes = [];

    function idx(x, y) { return y * w + x; }

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = idx(x, y);
        if (visited[i]) continue;
        var p = i * 4;
        if (!isSpritePixel(data[p], data[p + 1], data[p + 2], data[p + 3])) {
          visited[i] = 1;
          continue;
        }
        var stack = [x, y];
        visited[i] = 1;
        var minX = x, maxX = x, minY = y, maxY = y, count = 0;
        while (stack.length) {
          var cy = stack.pop();
          var cx0 = stack.pop();
          count++;
          if (cx0 < minX) minX = cx0;
          if (cx0 > maxX) maxX = cx0;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
          var nbs = [cx0 - 1, cy, cx0 + 1, cy, cx0, cy - 1, cx0, cy + 1];
          for (var n = 0; n < nbs.length; n += 2) {
            var nx = nbs[n], ny = nbs[n + 1];
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            var ni = idx(nx, ny);
            if (visited[ni]) continue;
            var np = ni * 4;
            if (!isSpritePixel(data[np], data[np + 1], data[np + 2], data[np + 3])) {
              visited[ni] = 1;
              continue;
            }
            visited[ni] = 1;
            stack.push(nx, ny);
          }
        }
        var bw = maxX - minX + 1;
        var bh = maxY - minY + 1;
        if (count > 800 && bw > 24 && bh > 24) {
          boxes.push({ x: minX, y: minY, w: bw, h: bh, count: count });
        }
      }
    }
    boxes.sort(function (a, b) { return b.count - a.count; });
    return { canvas: c, data: data, boxes: boxes };
  }

  function cropTransparentFrame(srcCanvas, srcData, box) {
    var out = document.createElement('canvas');
    out.width = box.w;
    out.height = box.h;
    var ox = out.getContext('2d');
    var img = ox.createImageData(box.w, box.h);
    var sw = srcCanvas.width;
    for (var y = 0; y < box.h; y++) {
      for (var x = 0; x < box.w; x++) {
        var si = ((box.y + y) * sw + (box.x + x)) * 4;
        var di = (y * box.w + x) * 4;
        var r = srcData[si], g = srcData[si + 1], b = srcData[si + 2], a = srcData[si + 3];
        if (!isSpritePixel(r, g, b, a)) {
          img.data[di + 3] = 0;
        } else {
          img.data[di] = r;
          img.data[di + 1] = g;
          img.data[di + 2] = b;
          img.data[di + 3] = 255;
        }
      }
    }
    ox.putImageData(img, 0, 0);
    return out;
  }

  // Matches Typing.com Keyboard Ninja (app.min) fruit animation.
  var FRUIT_FRAME_ORDER = [5, 6, 7, 8, 9, 8, 7, 6, 5, 4, 3, 2, 1, 2, 3, 4];
  var FRUIT_FRAME_FLIP_START = 4;
  var FRUIT_FRAME_FLIP_END = 12;
  var FRUIT_QUARTER_HALVES = { orange: 1, lime: 1, coconut: 1 };

  function mirrorFrame(frame) {
    var out = document.createElement('canvas');
    out.width = frame.width;
    out.height = frame.height;
    var ox = out.getContext('2d');
    ox.translate(frame.width, 0);
    ox.scale(-1, 1);
    ox.drawImage(frame, 0, 0);
    return out;
  }

  function flipFrame(frame) {
    var out = document.createElement('canvas');
    out.width = frame.width;
    out.height = frame.height;
    var ox = out.getContext('2d');
    ox.translate(0, frame.height);
    ox.scale(1, -1);
    ox.drawImage(frame, 0, 0);
    return out;
  }

  function frameHasFleshCut(frame) {
    var c = frame.getContext('2d');
    var w = frame.width;
    var h = frame.height;
    var data = c.getImageData(0, 0, w, h).data;
    var band = Math.max(4, Math.floor(w / 6));
    var pale = 0;
    var n = 0;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < band; x++) {
        var i = (y * w + x) * 4;
        if (data[i + 3] < 20) continue;
        n++;
        if (data[i] > 185 && data[i + 1] > 165 && data[i + 2] > 90) pale++;
      }
      for (x = w - band; x < w; x++) {
        i = (y * w + x) * 4;
        if (data[i + 3] < 20) continue;
        n++;
        if (data[i] > 185 && data[i + 1] > 165 && data[i + 2] > 90) pale++;
      }
    }
    return pale / Math.max(1, n) > 0.12;
  }

  function compositeVerticalMirrorWhole(half) {
    // orange / lime / coconut: horizontal half + flipped copy = whole fruit.
    var top = flipFrame(half);
    var overlap = Math.max(6, Math.floor(half.height * 0.08));
    var out = document.createElement('canvas');
    out.width = half.width;
    out.height = half.height * 2 - overlap;
    var ox = out.getContext('2d');
    ox.drawImage(top, 0, 0);
    ox.drawImage(half, 0, half.height - overlap);
    return out;
  }

  function coverBananaCut(cut, peel) {
    // Keep cut on the back layer so the white flesh face stays hidden in flight.
    var w = Math.max(cut.width, peel.width);
    var h = Math.max(cut.height, peel.height);
    var out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    var ox = out.getContext('2d');
    ox.drawImage(cut, Math.floor((w - cut.width) / 2), Math.floor((h - cut.height) / 2) + 1);
    ox.drawImage(peel, Math.floor((w - peel.width) / 2), Math.floor((h - peel.height) / 2));
    return out;
  }

  function buildFrameSequence(sheetFrames, key) {
    var peelRef = null;
    if (key === 'banana') {
      for (var p = 0; p < sheetFrames.length; p++) {
        if (!frameHasFleshCut(sheetFrames[p])) {
          peelRef = sheetFrames[p];
          break;
        }
      }
      peelRef = peelRef || sheetFrames[0];
    }

    var isQuarter = !!FRUIT_QUARTER_HALVES[key];
    var seq = [];
    for (var i = 0; i < FRUIT_FRAME_ORDER.length; i++) {
      var sheetIdx = FRUIT_FRAME_ORDER[i] - 1;
      var src = sheetFrames[Math.max(0, Math.min(sheetFrames.length - 1, sheetIdx))];
      var frame = src;
      if (isQuarter) {
        frame = compositeVerticalMirrorWhole(src);
      } else if (key === 'banana' && frameHasFleshCut(src)) {
        frame = coverBananaCut(src, peelRef);
      }
      seq.push(frame);
    }
    return seq;
  }

  function buildFruitAtlases(loaded) {
    var atlases = {};
    for (var i = 0; i < FRUIT_KEYS.length; i++) {
      var key = FRUIT_KEYS[i];
      var img = loaded[key];
      if (!img) continue;
      var extracted = extractSpriteBoxes(img);
      if (!extracted.boxes.length) continue;

      var items = [];
      for (var b = 0; b < extracted.boxes.length; b++) {
        var box = extracted.boxes[b];
        items.push({
          box: box,
          frame: cropTransparentFrame(extracted.canvas, extracted.data, box)
        });
      }

      // Stable sheet order: top→bottom, left→right (= frame_1 … frame_n).
      items.sort(function (a, b) {
        if (Math.abs(a.box.y - b.box.y) > 20) return a.box.y - b.box.y;
        return a.box.x - b.box.x;
      });

      var sheetFrames = items.map(function (it) { return it.frame; });
      var sequence = buildFrameSequence(sheetFrames, key);
      var midpoint = sequence.length >> 1;

      atlases[key] = {
        sequence: sequence,
        midpoint: midpoint,
        quarter: !!FRUIT_QUARTER_HALVES[key],
        whole: sequence[0],
        tumble: sequence,
        halves: sheetFrames,
        juice: FRUIT_JUICE[key] || '#f97316'
      };
    }
    return atlases;
  }

  // Preload fruit / SFX / sprite sheets, then build transparent fruit frames.
  G.loadAssets(ASSET_URLS).then(function (loaded) {
    media = loaded;
    try {
      fruitAtlases = buildFruitAtlases(loaded);
    } catch (err) {
      console.warn('[ninja] fruit atlas failed', err);
      fruitAtlases = null;
    }
    if (location.hash === '#debug') {
      window.__ninjaMedia = media;
      window.__ninjaFruits = fruitAtlases;
      console.info('[ninja] assets ready', Object.keys(media), fruitAtlases && Object.keys(fruitAtlases));
    }
  }).catch(function (err) {
    console.warn('[ninja] asset preload failed', err);
  });

  var HOME = 'asdfghjklñ'.split('');
  var TOP = 'qwertyuiop'.split('');
  var BOTTOM = 'zxcvbnm'.split('');
  var ACCENTS = 'áéíóú'.split('');
  var SPECIAL = ['¿', '¡', 'ü', 'ç'];

  var GROUND_Y = H - 56;
  var LIVES_START = 3;
  var HITS_PER_LEVEL = 12;
  var BOMB_CHANCE_BASE = 0.12;
  var BOMB_CHANCE_PER_LEVEL = 0.025;
  var BOMB_SCORE_PENALTY = 50;

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
      blasts: [],
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

  function fallingChars(kind) {
    var map = {};
    for (var i = 0; i < state.letters.length; i++) {
      var o = state.letters[i];
      if (o.state !== 'fall') continue;
      if (kind === 'bomb' && o.kind !== 'bomb') continue;
      if (kind === 'letter' && o.kind === 'bomb') continue;
      if (kind && kind !== 'letter' && kind !== 'bomb' && o.kind !== kind) continue;
      map[o.ch] = true;
    }
    return map;
  }

  function pickChar(pool, banned) {
    var options = [];
    for (var i = 0; i < pool.length; i++) {
      if (!banned[pool[i]]) options.push(pool[i]);
    }
    if (!options.length) return null;
    return G.pick(options);
  }

  function pickSpawnX() {
    var x = G.randomBetween(120, W - 120);
    for (var i = 0; i < state.letters.length; i++) {
      var o = state.letters[i];
      if (o.y < 80 && Math.abs(o.x - x) < 70) {
        x = G.randomBetween(120, W - 120);
        break;
      }
    }
    return x;
  }

  function countBombs() {
    var n = 0;
    for (var i = 0; i < state.letters.length; i++) {
      if (state.letters[i].kind === 'bomb' && state.letters[i].state === 'fall') n++;
    }
    return n;
  }

  function shouldSpawnBomb() {
    if (state.level < 2) return false;
    if (countBombs() >= 1) return false;
    var chance = Math.min(0.32, BOMB_CHANCE_BASE + (state.level - 2) * BOMB_CHANCE_PER_LEVEL);
    return Math.random() < chance;
  }

  function playClip(key) {
    if (audio.isMuted() || !media || !media[key]) return;
    try {
      var clip = media[key].cloneNode ? media[key].cloneNode() : media[key];
      clip.currentTime = 0;
      var p = clip.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  function playBombBoom() {
    audio.explode();
    playClip('sfxError');
  }

  function spawnLetter() {
    var pool = poolForLevel(state.level);
    var fruitChars = fallingChars('letter');
    var bombChars = fallingChars('bomb');
    var isBomb = shouldSpawnBomb();
    var ch;

    if (isBomb) {
      // Never share a letter with a fruit already falling — impossible choice.
      ch = pickChar(pool, fruitChars);
      if (!ch) isBomb = false;
    }
    if (!isBomb) {
      // Also avoid matching an on-screen bomb letter.
      ch = pickChar(pool, bombChars);
      if (!ch) ch = G.pick(pool);
    }

    var x = pickSpawnX();
    var fruitKey = null;
    if (!isBomb && fruitAtlases) {
      var available = [];
      for (var fi = 0; fi < FRUIT_KEYS.length; fi++) {
        if (fruitAtlases[FRUIT_KEYS[fi]]) available.push(FRUIT_KEYS[fi]);
      }
      if (available.length) fruitKey = G.pick(available);
    }
    state.letters.push({
      kind: isBomb ? 'bomb' : 'fruit',
      fruit: fruitKey,
      ch: ch,
      x: x,
      y: -40,
      vy: fallSpeed(state.level) * G.randomBetween(0.85, 1.15) * (isBomb ? 0.9 : 1),
      wobble: Math.random() * Math.PI * 2,
      rot: isBomb ? G.randomBetween(-0.12, 0.12) : 0,
      spin: isBomb ? 0 : 0,
      // Dual-half tumble: left frame index; right = left + midpoint.
      animT: Math.random() * FRUIT_FRAME_ORDER.length,
      tumbleSpeed: G.randomBetween(8, 14),
      animReverse: Math.random() < 0.5,
      zSwap: false,
      fuse: Math.random() * Math.PI * 2,
      state: 'fall',
      halves: null,
      alpha: 1,
      scale: 1,
      age: 0
    });
  }

  function addPopup(text, x, y, color) {
    state.popups.push({ text: text, x: x, y: y, age: 0, life: 0.85, color: color });
  }

  function addBlast(x, y) {
    state.blasts.push({ x: x, y: y, age: 0, life: 0.55 });
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

  function fruitAnimIndex(fruit, atlas) {
    var seq = atlas && atlas.sequence;
    if (!seq || !seq.length) return 0;
    var idx = Math.floor(fruit.animT || 0) % seq.length;
    if (idx < 0) idx += seq.length;
    if (fruit.animReverse) idx = (seq.length - 1 - idx + seq.length) % seq.length;
    return idx;
  }

  function makeHalfPiece(frame, seq, x, y, vx, vy, rot, spin, frameSpeed) {
    return {
      frame: frame,
      frames: seq && seq.length ? seq : (frame ? [frame] : null),
      frameT: 0,
      frameSpeed: frameSpeed == null ? -G.randomBetween(10, 16) : frameSpeed,
      mirrorX: false,
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      rot: rot,
      spin: spin
    };
  }

  function sliceFruit(fruit) {
    fruit.state = 'sliced';
    fruit.age = 0;
    fruit.alpha = 1;
    var atlas = fruit.fruit && fruitAtlases ? fruitAtlases[fruit.fruit] : null;
    var seq = atlas && atlas.sequence ? atlas.sequence : null;
    var mid = atlas && atlas.midpoint != null ? atlas.midpoint : (seq ? seq.length >> 1 : 0);
    var leftIdx = fruitAnimIndex(fruit, atlas);
    var rightIdx = seq ? (leftIdx + mid) % seq.length : 0;
    var leftFrame = seq ? seq[leftIdx] : null;
    var rightFrame = seq ? seq[rightIdx] : null;
    var outward = G.randomBetween(160, 240);
    var liftL = G.randomBetween(100, 170);
    var liftR = G.randomBetween(80, 150);
    var spinMag = G.randomBetween(4, 8);
    // Same as original: one half keeps forward anim, the other reverses.
    var forwardSpeed = G.randomBetween(10, 16);
    var slashDir = Math.random() < 0.5 ? 1 : -1;

    fruit.halves = [
      makeHalfPiece(
        leftFrame,
        seq,
        fruit.x - 10,
        fruit.y,
        -outward * slashDir,
        -liftL,
        -0.25 * slashDir,
        -spinMag * slashDir,
        forwardSpeed
      ),
      makeHalfPiece(
        rightFrame,
        seq,
        fruit.x + 10,
        fruit.y,
        outward * slashDir,
        -liftR,
        0.25 * slashDir,
        spinMag * slashDir,
        -forwardSpeed
      )
    ];
    fruit.halves[0].frameT = leftIdx;
    fruit.halves[1].frameT = rightIdx;
    fruit.halves[0].mirrorX = leftIdx > FRUIT_FRAME_FLIP_START && leftIdx < FRUIT_FRAME_FLIP_END;
    fruit.halves[1].mirrorX = rightIdx > FRUIT_FRAME_FLIP_START && rightIdx < FRUIT_FRAME_FLIP_END;
  }

  function explodeBomb(bomb) {
    bomb.state = 'explode';
    bomb.age = 0;
    bomb.alpha = 1;
    bomb.scale = 1;
    state.combo = 0;
    var penalty = BOMB_SCORE_PENALTY;
    state.score = Math.max(0, state.score - penalty);
    state.flash = 0.6;
    shake.trigger(16, 0.5);
    addBlast(bomb.x, bomb.y);
    particles.burst(bomb.x, bomb.y, { color: '#fb923c', count: 28, speed: 320, life: 0.7, size: 5 });
    particles.burst(bomb.x, bomb.y, { color: '#fef08a', count: 16, speed: 240, life: 0.45, size: 3 });
    particles.burst(bomb.x, bomb.y, { color: '#111827', count: 14, speed: 180, life: 0.55, size: 4 });
    addPopup('-' + penalty, bomb.x, bomb.y - 34, G.palette().danger);
    playBombBoom();
    state.lives--;
    if (state.lives <= 0) gameOver();
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
      if (target.kind === 'bomb') {
        explodeBomb(target);
      } else {
        sliceFruit(target);
        state.combo++;
        state.maxCombo = Math.max(state.maxCombo, state.combo);
        var gained = 10 + Math.min(40, (state.combo - 1) * 2);
        state.score += gained;
        state.hits++;
        var juice = (target.fruit && FRUIT_JUICE[target.fruit]) || categoryColor(target.ch, p);
        particles.burst(target.x, target.y, { color: juice, count: 22, speed: 280, size: 0.65, size: 5 });
        addPopup('+' + gained, target.x, target.y - 28, p.primary);
        audio.hit();
        playClip('sfxPop');

        var newLevel = 1 + Math.floor(state.hits / HITS_PER_LEVEL);
        if (newLevel > state.level) {
          state.level = newLevel;
          state.levelFlash = 1.2;
          audio.level();
        }
      }
    } else {
      state.combo = 0;
      state.flash = 0.25;
      shake.trigger(5, 0.2);
      audio.miss();
      playClip('sfxError');
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

    for (var b = state.blasts.length - 1; b >= 0; b--) {
      state.blasts[b].age += dt;
      if (state.blasts[b].age >= state.blasts[b].life) state.blasts.splice(b, 1);
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
      if (l.kind === 'bomb' && l.state === 'fall') l.fuse += dt * 10;
      if (l.state === 'fall') {
        l.y += l.vy * dt;
        l.wobble += dt * 2.2;
        if (l.kind === 'fruit') {
          l.animT = (l.animT || 0) + dt * (l.tumbleSpeed || 10);
          var atlasFall = l.fruit && fruitAtlases ? fruitAtlases[l.fruit] : null;
          if (atlasFall && atlasFall.sequence) {
            var fiFall = fruitAnimIndex(l, atlasFall);
            var midFall = atlasFall.midpoint != null ? atlasFall.midpoint : (atlasFall.sequence.length >> 1);
            if (fiFall === 0) l.zSwap = false;
            else if (fiFall === midFall) l.zSwap = true;
          }
        }
        if (l.kind === 'bomb') {
          // Ignoring a bomb is correct — leave the playfield with no penalty.
          if (l.y > H + 40) state.letters.splice(i, 1);
        } else if (l.y >= GROUND_Y) {
          state.letters.splice(i, 1);
          loseLife(l);
          if (state.phase !== 'playing') return;
        }
      } else if (l.state === 'explode') {
        l.scale = 1 + l.age * 2.8;
        l.alpha = 1 - l.age / 0.45;
        if (l.age >= 0.45) state.letters.splice(i, 1);
      } else if (l.state === 'sliced') {
        var gravity = 780;
        for (var hi = 0; hi < l.halves.length; hi++) {
          var half = l.halves[hi];
          half.vy += gravity * dt;
          half.x += half.vx * dt;
          half.y += half.vy * dt;
          half.rot += half.spin * dt;
          if (half.frames && half.frames.length) {
            half.frameT = (half.frameT || 0) + dt * (half.frameSpeed || -12);
            var fi = Math.floor(half.frameT) % half.frames.length;
            if (fi < 0) fi += half.frames.length;
            half.frame = half.frames[fi];
            half.mirrorX = fi > FRUIT_FRAME_FLIP_START && fi < FRUIT_FRAME_FLIP_END;
          }
        }
        var sliceLife = 1.0;
        l.alpha = 1 - l.age / sliceLife;
        if (l.age >= sliceLife) state.letters.splice(i, 1);
      } else {
        l.scale += 3 * dt;
        l.alpha -= 4 * dt;
        if (l.alpha <= 0) state.letters.splice(i, 1);
      }
    }
  }

  function drawBackground(p) {
    if (media && media.bg) {
      ctx.drawImage(media.bg, 0, 0, W, H);
      ctx.fillStyle = p.dark ? 'rgba(11, 18, 32, 0.28)' : 'rgba(246, 246, 248, 0.18)';
      ctx.fillRect(0, 0, W, H);
    } else {
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
    }

    ctx.strokeStyle = p.ground;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(24, GROUND_Y); ctx.lineTo(W - 24, GROUND_Y); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawBomb(l) {
    var r = 28;
    // Outer danger halo — keeps bombs distinct from dark fruit tiles.
    ctx.fillStyle = 'rgba(250, 204, 21, 0.22)';
    ctx.beginPath();
    ctx.arc(0, 2, r + 10, 0, Math.PI * 2);
    ctx.fill();

    // Body: glossy black sphere with hard yellow outline
    var body = ctx.createRadialGradient(-9, -11, 3, 0, 2, r);
    body.addColorStop(0, '#6b7280');
    body.addColorStop(0.35, '#1f2937');
    body.addColorStop(1, '#020617');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Yellow/black hazard band
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 2, r - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-r, -4, r * 2, 12);
    ctx.fillStyle = '#0f172a';
    for (var s = -r; s < r; s += 10) {
      ctx.beginPath();
      ctx.moveTo(s, -4);
      ctx.lineTo(s + 5, -4);
      ctx.lineTo(s + 11, 8);
      ctx.lineTo(s + 6, 8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Spikes / studs around the rim
    ctx.fillStyle = '#cbd5e1';
    for (var a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      var sx = Math.cos(a) * (r + 2);
      var sy = 2 + Math.sin(a) * (r + 2);
      ctx.beginPath();
      ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Metal fuse base
    ctx.fillStyle = '#94a3b8';
    G.roundRect(ctx, -8, -r - 4, 16, 12, 3);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Visible fuse
    ctx.strokeStyle = '#e7c27d';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -r + 2);
    var fx = Math.sin(l.fuse) * 6;
    var fy = -r - 20 + Math.cos(l.fuse * 0.7) * 2;
    ctx.quadraticCurveTo(fx + 8, -r - 12, fx, fy);
    ctx.stroke();

    // Spark
    var sparkPulse = 0.7 + 0.3 * Math.sin(l.fuse * 3);
    ctx.fillStyle = 'rgba(248, 113, 113, 0.35)';
    ctx.beginPath();
    ctx.arc(fx, fy - 2, 8 * sparkPulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(251, 146, 60, ' + sparkPulse + ')';
    ctx.beginPath();
    ctx.arc(fx, fy, 5 * sparkPulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(fx, fy, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Skull mark — unmistakably a bomb, not a fruit
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(0, -2, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-2.5, -3, 1.6, 0, Math.PI * 2);
    ctx.arc(2.5, -3, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-1.2, 0, 2.4, 3);

    // Letter badge (high contrast)
    ctx.fillStyle = '#ef4444';
    G.roundRect(ctx, -15, 8, 30, 22, 7);
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 18px Lexend, "Atkinson Hyperlegible", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(l.ch, 0, 20);
  }

  function drawExplosion(l) {
    var t = Math.min(1, l.age / 0.45);
    var radius = 18 + t * 70;
    var alpha = 1 - t;
    ctx.globalAlpha = alpha;
    var fire = ctx.createRadialGradient(0, 0, 2, 0, 0, radius);
    fire.addColorStop(0, '#fff7ed');
    fire.addColorStop(0.25, '#fbbf24');
    fire.addColorStop(0.55, '#f97316');
    fire.addColorStop(1, 'rgba(127, 29, 29, 0)');
    ctx.fillStyle = fire;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(254, 240, 138, ' + alpha + ')';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawBlasts() {
    for (var i = 0; i < state.blasts.length; i++) {
      var b = state.blasts[i];
      var t = b.age / b.life;
      var r = 30 + t * 90;
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.55;
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 6 * (1 - t);
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFruitSprite(frame, size, mirrorX) {
    if (!frame) return;
    var s = size || 72;
    var scale = Math.min(s / frame.width, s / frame.height);
    var dw = frame.width * scale;
    var dh = frame.height * scale;
    if (mirrorX) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(frame, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(frame, -dw / 2, -dh / 2, dw, dh);
    }
  }

  function drawLetterBadge(ch, yOff) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    G.roundRect(ctx, -16, yOff - 12, 32, 26, 8);
    ctx.fill();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 18px Lexend, "Atkinson Hyperlegible", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 0, yOff + 2);
  }

  function drawFruitFalling(l, p) {
    var atlas = l.fruit && fruitAtlases ? fruitAtlases[l.fruit] : null;
    if (atlas && atlas.sequence && atlas.sequence.length) {
      var seq = atlas.sequence;
      var mid = atlas.midpoint != null ? atlas.midpoint : (seq.length >> 1);
      var leftIdx = fruitAnimIndex(l, atlas);
      var rightIdx = (leftIdx + mid) % seq.length;
      var leftMirror = leftIdx > FRUIT_FRAME_FLIP_START && leftIdx < FRUIT_FRAME_FLIP_END;
      var rightMirror = rightIdx > FRUIT_FRAME_FLIP_START && rightIdx < FRUIT_FRAME_FLIP_END;
      // Z-order swap at frame 0 / midpoint — same as original fruit actor.
      if (l.zSwap) {
        drawFruitSprite(seq[rightIdx], 78, rightMirror);
        drawFruitSprite(seq[leftIdx], 78, leftMirror);
      } else {
        drawFruitSprite(seq[leftIdx], 78, leftMirror);
        drawFruitSprite(seq[rightIdx], 78, rightMirror);
      }
      drawLetterBadge(l.ch, 34);
      return;
    }
    // Fallback tile if sprites are still loading — keep letter upright too.
    var color = categoryColor(l.ch, p);
    ctx.fillStyle = p.dark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.96)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    G.roundRect(ctx, -24, -24, 48, 48, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = '700 28px Lexend, "Atkinson Hyperlegible", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(l.ch, 0, 2);
  }

  function drawFruitSliced(l) {
    if (!l.halves) return;
    for (var i = 0; i < l.halves.length; i++) {
      var half = l.halves[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, l.alpha);
      ctx.translate(half.x, half.y);
      ctx.rotate(half.rot);
      if (half.frame) {
        drawFruitSprite(half.frame, 64, half.mirrorX);
      } else {
        ctx.fillStyle = (l.fruit && FRUIT_JUICE[l.fruit]) || '#f97316';
        ctx.beginPath();
        ctx.arc(0, 0, 18, Math.PI * 0.15, Math.PI * 1.15);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawLetters(p) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < state.letters.length; i++) {
      var l = state.letters[i];

      if (l.state === 'sliced') {
        drawFruitSliced(l);
        continue;
      }

      var wob = l.state === 'fall' ? Math.sin(l.wobble) * 4 : 0;
      ctx.save();
      ctx.translate(l.x + wob, l.y);
      // Fruits tumble via sprite frames (2-axis). Only bombs/explosions use canvas rotate.
      if (l.kind !== 'fruit' && l.state !== 'explode') ctx.rotate(l.rot || 0);
      ctx.scale(l.scale, l.scale);
      ctx.globalAlpha = Math.max(0, l.alpha);

      if (l.state === 'explode') {
        drawExplosion(l);
      } else if (l.kind === 'bomb') {
        drawBomb(l);
      } else {
        drawFruitFalling(l, p);
      }
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
      ctx.fillText('Corta frutas pulsando su letra antes de que toquen el suelo.', W / 2, H / 2 - 28);
      ctx.fillText('Si aparece una bomba (mecha + calavera), NO pulses su letra: -50 pts y una vida.', W / 2, H / 2 + 2);
      ctx.fillStyle = p.primary;
      ctx.font = '600 20px Lexend, sans-serif';
      ctx.fillText('Pulsa Enter o Espacio para empezar', W / 2, H / 2 + 58);
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
    drawBlasts();
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
