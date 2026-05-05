const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const fs = require('fs');

const rooms = new Map();

/* Single-mode leaderboard: best (level, score) per nickname.
   Storage priority:
     1) Upstash Redis (env vars set) — survives all redeploys
     2) Local disk fallback (data/leaderboard.json) — survives same instance only
*/
const LB_FILE = path.join(__dirname, 'data', 'leaderboard.json');
const LB_KEY  = 'pok-pok-yi:leaderboard';
const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useUpstash = !!(UPSTASH_URL && UPSTASH_TOKEN);
const leaderboard = [];

async function upstashCmd(...args) {
  if (!useUpstash) return null;
  try {
    const r = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    if (!r.ok) {
      console.error('[upstash] HTTP', r.status);
      return null;
    }
    const d = await r.json();
    return d.result;
  } catch (e) {
    console.error('[upstash] cmd error:', e.message);
    return null;
  }
}

function loadFromDisk() {
  try {
    if (fs.existsSync(LB_FILE)) {
      const arr = JSON.parse(fs.readFileSync(LB_FILE, 'utf8'));
      if (Array.isArray(arr)) {
        leaderboard.length = 0;
        leaderboard.push(...arr);
        console.log('[leaderboard] loaded from disk:', leaderboard.length);
      }
    }
  } catch (e) { console.error('[leaderboard] disk load failed:', e.message); }
}

async function loadLeaderboardOnBoot() {
  if (useUpstash) {
    console.log('[leaderboard] Upstash configured, fetching saved board...');
    const raw = await upstashCmd('GET', LB_KEY);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          leaderboard.length = 0;
          leaderboard.push(...arr);
          console.log('[leaderboard] loaded from Upstash:', leaderboard.length, 'entries');
          return;
        }
      } catch (e) {
        console.error('[leaderboard] parse failed:', e.message);
      }
    } else {
      console.log('[leaderboard] Upstash key empty (first run, will populate)');
    }
    loadFromDisk();
  } else {
    console.log('[leaderboard] Upstash NOT configured, using disk fallback only');
    loadFromDisk();
  }
}

let lbSaveTimer = null;
function saveLeaderboard() {
  clearTimeout(lbSaveTimer);
  lbSaveTimer = setTimeout(() => {
    const data = JSON.stringify(leaderboard);
    /* Upstash (preferred) */
    if (useUpstash) {
      upstashCmd('SET', LB_KEY, data).catch(() => {});
    }
    /* Disk fallback (also writes when Upstash configured, as backup) */
    try {
      const dir = path.dirname(LB_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LB_FILE, data);
    } catch (e) { console.error('[leaderboard] disk save failed:', e.message); }
  }, 400);
}

loadLeaderboardOnBoot();

/* ── Reviews (persisted) ── */
const REVIEWS_KEY  = 'pok-pok-yi:reviews';
const REVIEWS_FILE = path.join(__dirname, 'data', 'reviews.json');
const REVIEWS_MAX  = 200;
const reviews = [];

async function loadReviewsOnBoot() {
  if (useUpstash) {
    const raw = await upstashCmd('GET', REVIEWS_KEY);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          reviews.length = 0;
          reviews.push(...arr);
          console.log('[reviews] loaded from Upstash:', reviews.length);
          return;
        }
      } catch (_) {}
    }
  }
  try {
    if (fs.existsSync(REVIEWS_FILE)) {
      const arr = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
      if (Array.isArray(arr)) {
        reviews.length = 0;
        reviews.push(...arr);
        console.log('[reviews] loaded from disk:', reviews.length);
      }
    }
  } catch (_) {}
}

let reviewSaveTimer = null;
function saveReviews() {
  clearTimeout(reviewSaveTimer);
  reviewSaveTimer = setTimeout(() => {
    const data = JSON.stringify(reviews);
    if (useUpstash) upstashCmd('SET', REVIEWS_KEY, data).catch(() => {});
    try {
      const dir = path.dirname(REVIEWS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(REVIEWS_FILE, data);
    } catch (_) {}
  }, 400);
}

function recordReview(nickname, text) {
  const nick = String(nickname || '').trim().slice(0, 12);
  const body = String(text || '').trim().slice(0, 200);
  if (!nick || !body) return false;
  reviews.unshift({ nickname: nick, text: body, ts: Date.now() });
  if (reviews.length > REVIEWS_MAX) reviews.length = REVIEWS_MAX;
  saveReviews();
  return true;
}

loadReviewsOnBoot();

function recordLeaderboard(nickname, level, score) {
  if (!nickname) return;
  const nick = String(nickname).slice(0, 12);
  const idx = leaderboard.findIndex(e => e.nickname === nick);
  if (idx >= 0) {
    const ex = leaderboard[idx];
    if (level > ex.level || (level === ex.level && score > ex.score)) {
      ex.level = level; ex.score = score; ex.ts = Date.now();
    }
  } else {
    leaderboard.push({ nickname: nick, level, score, ts: Date.now() });
  }
  leaderboard.sort((a, b) => b.level - a.level || b.score - a.score);
  if (leaderboard.length > 50) leaderboard.length = 50;
  saveLeaderboard();
}

function getTopLeaderboard(n = 5) {
  return leaderboard.slice(0, n).map(({ nickname, level, score }) => ({ nickname, level, score }));
}

const GAME_DURATION = 90;
const GAME_DURATION_SINGLE = 30;
const SINGLE_TARGETS = [850, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000];
const SINGLE_MAX_LEVEL = 10;
const SINGLE_LEVEL_MULT = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8];
/* Pick layout based on a target bubble size (px).
   This guarantees the grid fills the screen and bubbles look proportional
   on phones, tablets, and desktops. */
function pickLayout(vw, vh) {
  /* HUD + footer + safe-area buffer (notch/home indicator). Errs on the high
     side so client never overflows; client uses 1fr grid + measured bubble. */
  const CHROME = vw < 500 ? 170 : 150;
  const aw = Math.max(vw - 6, 320);
  const ah = Math.max(vh - CHROME, 260);

  let target;
  if (vw < 500)        target = 38;   /* phone */
  else if (vw < 900)   target = 44;   /* tablet */
  else if (vw < 1400)  target = 50;   /* small desktop */
  else                 target = 56;   /* large desktop */

  /* Pick cols from width, derive rows from cell size.
     ceil(rows) so vertical fill is maximized; horizontal trims slightly. */
  let cols = Math.max(5, Math.min(28, Math.round(aw / target)));
  const cellSize = aw / cols;
  let rows = Math.max(5, Math.min(30, Math.ceil(ah / cellSize) + 6));
  return { cols, rows };
}
const SPECIAL_COLORS = ['red', 'blue', 'purple', 'pink', 'yellow'];
const SCORE_NORMAL = 5;
const SCORE_LOW    = 10;  /* red, pink, yellow */
const SCORE_HIGH   = 15;  /* blue, purple */
const SHIMMER_MAX = 6;
const BOMB_BONUS = 20;
const BOMB_BLAST_COUNT = 10;
const FIRE_BONUS = 25;

function pointsFor(color) {
  if (color === 'normal') return SCORE_NORMAL;
  if (color === 'red' || color === 'pink' || color === 'yellow') return SCORE_LOW;
  if (color === 'blue' || color === 'purple') return SCORE_HIGH;
  /* shimmer/bomb/fire: trigger pays a bonus, chain items pay their own colors */
  return 0;
}
const ROOM_TTL = 30 * 60 * 1000;
const MAX_PLAYERS = 4;

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function makeBubbles(total) {
  return Array.from({ length: total }, (_, i) => ({ id: i, popped: false, color: 'normal' }));
}

function clearTimers(room) {
  clearInterval(room.timerInterval);
  clearInterval(room.specialInterval);
  clearTimeout(room.restartTimeout);
  clearTimeout(room.expireTimeout);
  if (room.bombTimeouts) { room.bombTimeouts.forEach(clearTimeout); room.bombTimeouts = []; }
  clearTimeout(room.fireTimeout);
}

function startGame(code) {
  const room = rooms.get(code);
  if (!room) return;
  /* Defensive: prevent overlapping starts (race fix for timer jumps) */
  if (room.state === 'playing') return;
  const active = room.players.filter(p => p.active);
  const minPlayers = room.mode === 'single' ? 1 : 2;
  if (active.length < minPlayers) return;

  clearInterval(room.timerInterval);
  clearInterval(room.specialInterval);
  clearTimeout(room.restartTimeout);
  room.timerInterval = null;
  room.specialInterval = null;

  room.state = 'playing';
  room.timer = room.mode === 'single' ? GAME_DURATION_SINGLE : GAME_DURATION;
  room.bubbles = makeBubbles(room.total);
  room.shimmerCount = 0;
  room.bombCount = 0;
  /* Bombs/fire: multi always; single from L3+, with L4+ getting more bombs */
  const lvl = room.level || 1;
  const bombsEnabled = room.mode === 'multi' || (room.mode === 'single' && lvl >= 3);
  const fireEnabled  = room.mode === 'multi' || (room.mode === 'single' && lvl >= 3);
  if (bombsEnabled) {
    const baseBombs = 2 + Math.floor(Math.random() * 4); /* 2-5 */
    const bonusFromLevel = (room.mode === 'single' && lvl >= 4) ? Math.round((lvl - 3) * 1.0) : 0;
    room.bombMax = Math.min(12, baseBombs + bonusFromLevel);
  } else {
    room.bombMax = 0;
  }
  room.fireEnabled = fireEnabled;
  room.fireSpawned = false;
  if (room.bombTimeouts) room.bombTimeouts.forEach(clearTimeout);
  room.bombTimeouts = [];
  clearTimeout(room.fireTimeout);
  room.fireTimeout = null;

  /* ── Schedule guaranteed bomb/fire spawns ── */
  if (bombsEnabled || fireEnabled) {
    const dur = room.timer * 1000;
    /* Higher level (single) = earlier and more frequent */
    const lvlBoost = (room.mode === 'single' && lvl >= 4) ? Math.min(2, 1 + (lvl - 3) * 0.3) : 1;
    const earlyOffset = Math.round(2000 / lvlBoost);  /* L4: 1538ms, L10: 1000ms */

    if (fireEnabled) {
      const fireDelay = earlyOffset + Math.floor(Math.random() * Math.max(1, dur - earlyOffset - 5000));
      room.fireTimeout = setTimeout(() => {
        if (!rooms.has(code) || room.state !== 'playing' || room.fireSpawned) return;
        const cands = room.bubbles.filter(b => !b.popped && b.color === 'normal');
        if (!cands.length) return;
        cands[Math.floor(Math.random() * cands.length)].color = 'fire';
        room.fireSpawned = true;
        io.to(code).emit('bubblesUpdate', room.bubbles);
      }, fireDelay);
    }

    /* Bombs — stagger across the game; lvlBoost shrinks the time window */
    if (bombsEnabled) {
      const window = Math.max(1, dur - earlyOffset - 4000);
      for (let i = 0; i < room.bombMax; i++) {
        const delay = earlyOffset + Math.floor(Math.random() * window);
        const t = setTimeout(() => {
          if (!rooms.has(code) || room.state !== 'playing') return;
          const cands = room.bubbles.filter(b => !b.popped && b.color === 'normal');
          if (!cands.length) return;
          cands[Math.floor(Math.random() * cands.length)].color = 'bomb';
          room.bombCount++;
          io.to(code).emit('bubblesUpdate', room.bubbles);
        }, delay);
        room.bombTimeouts.push(t);
      }
    }
  }
  active.forEach(p => { p.score = 0; });

  io.to(code).emit('gameStart', {
    bubbles: room.bubbles,
    players: active.map(({ nickname, score, num }) => ({ nickname, score, num })),
    timer: room.timer,
    mode: room.mode,
    cols: room.cols,
    rows: room.rows,
    target: room.mode === 'single' ? SINGLE_TARGETS[(room.level || 1) - 1] : null,
    level: room.mode === 'single' ? (room.level || 1) : null,
  });

  room.timerInterval = setInterval(() => {
    if (room.state !== 'playing') return;  /* defensive: stale callback guard */
    room.timer--;
    io.to(code).emit('timerUpdate', room.timer);
    if (room.timer <= 0) endGame(code);
  }, 1000);

  room.specialInterval = setInterval(() => {
    if (room.state !== 'playing') return;
    const unpopped = room.bubbles.filter(b => !b.popped);

    unpopped.forEach(b => {
      if (b.color !== 'normal' && b.color !== 'shimmer' && b.color !== 'bomb' && b.color !== 'fire'
          && Math.random() < 0.45) b.color = 'normal';
    });

    const normals = unpopped.filter(b => b.color === 'normal');
    const lvlMult = (room.mode === 'single')
      ? SINGLE_LEVEL_MULT[(room.level || 1) - 1] || 1
      : 1;
    const baseN = Math.floor(Math.random() * 6) + 5;
    const n = Math.min(Math.round(baseN * lvlMult), normals.length);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * normals.length);
      if (normals[idx]) {
        normals.splice(idx, 1)[0].color = SPECIAL_COLORS[Math.floor(Math.random() * SPECIAL_COLORS.length)];
      }
    }

    /* Shimmer spawn — scales up from level 3+ in single mode.
       L5+ gets an extra +10% absolute chance bump. */
    let shimmerChance = 0.22;
    let shimmerMax = SHIMMER_MAX;
    if (room.mode === 'single' && room.level >= 3) {
      const bump = room.level - 2;                   /* 1 at L3, 8 at L10 */
      shimmerChance = Math.min(0.55, 0.22 + bump * 0.04);
      shimmerMax    = Math.min(15,   SHIMMER_MAX + bump);
      if (room.level >= 5) {
        shimmerChance = Math.min(0.70, shimmerChance + 0.10);
        shimmerMax    = Math.min(18,  shimmerMax + 2);
      }
    }
    if (room.shimmerCount < shimmerMax && Math.random() < shimmerChance && normals.length > 0) {
      const idx = Math.floor(Math.random() * normals.length);
      normals[idx].color = 'shimmer';
      normals.splice(idx, 1);
      room.shimmerCount++;
    }

    /* Bomb/Fire random spawn fallback (also handles past-deadline jitter) */
    const lvl2 = room.level || 1;
    const allowExtras = (room.mode === 'multi') || (room.mode === 'single' && lvl2 >= 3);
    if (allowExtras) {
      if (room.bombCount < room.bombMax && Math.random() < 0.10 && normals.length > 0) {
        const idx = Math.floor(Math.random() * normals.length);
        normals[idx].color = 'bomb';
        normals.splice(idx, 1);
        room.bombCount++;
      }
      if (!room.fireSpawned && Math.random() < 0.05 && normals.length > 0) {
        const idx = Math.floor(Math.random() * normals.length);
        normals[idx].color = 'fire';
        normals.splice(idx, 1);
        room.fireSpawned = true;
      }
    }

    io.to(code).emit('bubblesUpdate', room.bubbles);
  }, 3000);
}

function endGame(code) {
  const room = rooms.get(code);
  if (!room || room.state === 'ended') return;

  clearInterval(room.timerInterval);
  clearInterval(room.specialInterval);
  room.state = 'ended';

  const results = room.players
    .filter(p => p.active)
    .map(({ nickname, score, num }) => ({ nickname, score, num }))
    .sort((a, b) => b.score - a.score);

  const payload = { results, mode: room.mode };
  if (room.mode === 'single') {
    const lvl = room.level || 1;
    const target = SINGLE_TARGETS[lvl - 1];
    const success = results.length > 0 && results[0].score >= target;
    payload.target = target;
    payload.level = lvl;
    payload.success = success;
    payload.nextLevel = success && lvl < SINGLE_MAX_LEVEL ? lvl + 1 : null;
    payload.nextTarget = payload.nextLevel ? SINGLE_TARGETS[payload.nextLevel - 1] : null;
    payload.allCleared = success && lvl === SINGLE_MAX_LEVEL;

    /* Record best result; if user just cleared L=lvl, store as L=lvl */
    if (results.length > 0) {
      const r = results[0];
      const recordedLevel = success ? lvl : Math.max(1, lvl - 1); /* fail keeps prior cleared level */
      /* Always record current (level, score) — best stays via upsert */
      recordLeaderboard(r.nickname, success ? lvl : Math.max(1, lvl), r.score);
    }
    payload.leaderboard = getTopLeaderboard(5);
    /* broadcast updated board to everyone */
    io.emit('leaderboardUpdate', payload.leaderboard);

    io.to(code).emit('gameEnd', payload);

    if (success && lvl < SINGLE_MAX_LEVEL) {
      /* advance to next level after short pause */
      room.level = lvl + 1;
      room.restartTimeout = setTimeout(() => {
        if (!rooms.has(code)) return;
        startGame(code);
      }, 6000);
    } else if (!success) {
      /* failed — keep same level, auto-retry after 10s */
      room.restartTimeout = setTimeout(() => {
        if (!rooms.has(code)) return;
        const r = rooms.get(code);
        if (r.state === 'ended') startGame(code);
      }, 10000);
    } else {
      /* all cleared — keep level at MAX, no auto-restart */
    }
    return;
  }

  io.to(code).emit('gameEnd', payload);

  room.restartTimeout = setTimeout(() => {
    if (!rooms.has(code)) return;
    const r = rooms.get(code);
    if (r.players.filter(p => p.active).length >= 2) startGame(code);
  }, 15000);
}

io.on('connection', socket => {
  /* Send latest leaderboard + reviews immediately so lobby can show them */
  socket.emit('leaderboardUpdate', getTopLeaderboard(5));
  socket.emit('reviewsUpdate', reviews.slice(0, 50));

  socket.on('getLeaderboard', () => {
    socket.emit('leaderboardUpdate', getTopLeaderboard(5));
  });

  socket.on('getReviews', () => {
    socket.emit('reviewsUpdate', reviews.slice(0, 50));
  });

  socket.on('submitReview', ({ nickname, text }) => {
    if (recordReview(nickname, text)) {
      io.emit('reviewsUpdate', reviews.slice(0, 50));
    }
  });

  socket.on('createRoom', ({ nickname, mode, viewportW, viewportH }) => {
    const safeMode = mode === 'single' ? 'single' : 'multi';
    const code = genCode();
    const layout = pickLayout(viewportW || 1280, viewportH || 720);
    const room = {
      code,
      mode: safeMode,
      cols: layout.cols,
      rows: layout.rows,
      total: layout.cols * layout.rows,
      level: 1,
      state: 'waiting',
      players: [{ id: socket.id, nickname, score: 0, num: 1, active: true }],
      bubbles: makeBubbles(layout.cols * layout.rows),
      timer: safeMode === 'single' ? GAME_DURATION_SINGLE : GAME_DURATION,
      timerInterval: null,
      specialInterval: null,
      restartTimeout: null,
      expireTimeout: setTimeout(() => {
        const r = rooms.get(code);
        if (r) { clearTimers(r); rooms.delete(code); }
      }, ROOM_TTL),
    };
    rooms.set(code, room);
    socket.join(code);
    socket.data.room = code;
    socket.emit('roomCreated', { code, num: 1, mode: safeMode, cols: layout.cols, rows: layout.rows });

    /* Single mode: start immediately */
    if (safeMode === 'single') {
      setTimeout(() => startGame(code), 800);
    }
  });

  socket.on('joinRoom', ({ code, nickname }) => {
    const key = code.toUpperCase().trim();
    const room = rooms.get(key);
    if (!room) { socket.emit('joinError', { msg: '방을 찾을 수 없어요!' }); return; }
    if (room.mode === 'single') { socket.emit('joinError', { msg: '솔로 방이라 입장 불가!' }); return; }

    const active = room.players.filter(p => p.active);
    if (active.length >= MAX_PLAYERS) { socket.emit('joinError', { msg: '방이 꽉 찼어요!' }); return; }
    if (room.state === 'playing') { socket.emit('joinError', { msg: '이미 게임 진행 중!' }); return; }

    const usedNums = new Set(active.map(p => p.num));
    let num = 1;
    while (usedNums.has(num)) num++;

    room.players.push({ id: socket.id, nickname, score: 0, num, active: true });
    socket.join(key);
    socket.data.room = key;
    socket.emit('roomJoined', { code: key, num });

    io.to(key).emit('playerJoined', {
      players: room.players.filter(p => p.active).map(({ nickname, num }) => ({ nickname, num })),
    });
  });

  socket.on('startGame', () => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    if (room.state === 'playing') return;
    const active = room.players.filter(p => p.active);
    if (active.length < 2) return;
    startGame(room.code);
  });

  socket.on('replay', () => {
    const room = rooms.get(socket.data.room);
    if (!room || room.mode !== 'single') return;
    if (room.state === 'playing') return;
    clearTimeout(room.restartTimeout);
    startGame(room.code);
  });

  socket.on('popBubble', ({ id }) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.state !== 'playing') return;
    const bubble = room.bubbles[id];
    if (!bubble || bubble.popped) return;

    const player = room.players.find(p => p.id === socket.id && p.active);
    if (!player) return;

    const color = bubble.color;

    /* ── Bomb: explode 10 random unpopped bubbles ── */
    if (color === 'bomb') {
      bubble.popped = true;
      player.score += BOMB_BONUS;
      const candidates = room.bubbles.filter(b => !b.popped);
      const chain = [];
      const n = Math.min(BOMB_BLAST_COUNT, candidates.length);
      for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random() * candidates.length);
        const b = candidates.splice(idx, 1)[0];
        b.popped = true;
        const c2 = b.color;
        const p = pointsFor(c2);
        player.score += p;
        chain.push({ id: b.id, color: c2, pts: p });
      }
      io.to(socket.data.room).emit('bombPop', {
        triggerId: id, num: player.num, chain, bonus: BOMB_BONUS,
        scores: room.players.filter(p => p.active).map(({ num, score }) => ({ num, score })),
      });
      return;
    }

    /* ── Fire: pop the OUTERMOST RING that still has unpopped bubbles.
       If outer perimeter is empty, step inward ring by ring. ── */
    if (color === 'fire') {
      bubble.popped = true;
      player.score += FIRE_BONUS;
      const C = room.cols, R = room.rows;
      const maxRing = Math.floor(Math.min(C, R) / 2);
      const isOnRing = (idx, ring) => {
        const rr = Math.floor(idx / C), cc = idx % C;
        return rr === ring || rr === R - 1 - ring || cc === ring || cc === C - 1 - ring;
      };
      const ringHasUnpopped = (ring) => {
        for (let i = 0; i < room.bubbles.length; i++) {
          if (!isOnRing(i, ring)) continue;
          if (!room.bubbles[i].popped) return true;
        }
        return false;
      };
      let chosenRing = 0;
      while (chosenRing < maxRing && !ringHasUnpopped(chosenRing)) chosenRing++;

      const chain = [];
      for (let i = 0; i < room.bubbles.length; i++) {
        if (!isOnRing(i, chosenRing)) continue;
        const b = room.bubbles[i];
        if (b.popped) continue;
        b.popped = true;
        const c2 = b.color;
        const p = pointsFor(c2);
        player.score += p;
        chain.push({ id: i, color: c2, pts: p });
      }
      io.to(socket.data.room).emit('firePop', {
        triggerId: id, num: player.num, chain, bonus: FIRE_BONUS,
        ring: chosenRing, cols: C, rows: R,
        scores: room.players.filter(p => p.active).map(({ num, score }) => ({ num, score })),
      });
      return;
    }

    /* ── Shimmer: chain pop the row OR column with more unpopped bubbles.
       (Random tie-break) Avoids the "shimmer ate itself only" bug when one
       axis is mostly empty. ── */
    if (color === 'shimmer') {
      const C = room.cols, R = room.rows;
      const row = Math.floor(id / C);
      const col = id % C;
      let rowUnpopped = 0, colUnpopped = 0;
      for (let c = 0; c < C; c++) if (!room.bubbles[row * C + c].popped) rowUnpopped++;
      for (let r = 0; r < R; r++) if (!room.bubbles[r * C + col].popped) colUnpopped++;
      const direction =
        rowUnpopped > colUnpopped ? 'h' :
        colUnpopped > rowUnpopped ? 'v' :
        (Math.random() < 0.5 ? 'h' : 'v');
      const chain = [];

      const indices = [];
      if (direction === 'h') {
        for (let c = 0; c < C; c++) indices.push(row * C + c);
      } else {
        for (let r = 0; r < R; r++) indices.push(r * C + col);
      }

      indices.forEach(bid => {
        const b = room.bubbles[bid];
        if (b.popped) return;
        b.popped = true;
        const c2 = b.color;
        const p = pointsFor(c2);
        player.score += p;
        chain.push({ id: bid, color: c2, pts: p });
      });

      io.to(socket.data.room).emit('rowPopped', {
        direction, row, col, triggerId: id, num: player.num, chain,
        scores: room.players.filter(p => p.active).map(({ num, score }) => ({ num, score })),
      });
      return;
    }

    /* ── Normal pop ── */
    bubble.popped = true;
    const pts = pointsFor(color);
    player.score += pts;

    io.to(socket.data.room).emit('bubblePopped', {
      id,
      socketId: socket.id,
      num: player.num,
      pts,
      color,
      scores: room.players.filter(p => p.active).map(({ num, score }) => ({ num, score })),
    });

    /* Respawn — base rate; single mode scales aggressively from L5+
       L4: 1.3x, L5+: +6x per level → L5:7, L6:13, L7:19, L8:25, L9:31, L10:37
       Combined with very low min/range floors for near-instant respawn at L5+. */
    let respawnChance = room.mode === 'multi' ? 0.85 : 0.80;
    let respawnMin    = 180;
    let respawnRange  = room.mode === 'multi' ? 700 : 900;
    const lvlR = room.level || 1;
    if (room.mode === 'single' && lvlR >= 4) {
      let boost;
      if (lvlR >= 5) boost = 1 + (lvlR - 4) * 6;
      else           boost = 1.3;
      respawnChance = boost >= 2 ? 1.0 : Math.min(0.97, respawnChance * boost);
      respawnMin    = Math.max(15, Math.round(respawnMin / boost));
      respawnRange  = Math.max(30, Math.round(respawnRange / boost));
    }
    if (Math.random() < respawnChance && room.timer > 4) {
      const delay = respawnMin + Math.floor(Math.random() * respawnRange);
      setTimeout(() => {
        if (!rooms.has(room.code)) return;
        if (room.state !== 'playing') return;
        if (room.timer <= 3) return;
        if (!bubble.popped) return;
        bubble.popped = false;
        bubble.color = 'normal';
        io.to(room.code).emit('bubbleRespawned', { id });
      }, delay);
    }
  });

  socket.on('chat', ({ msg }) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.state !== 'ended') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    io.to(socket.data.room).emit('chat', {
      nickname: player.nickname,
      msg: msg.substring(0, 80),
      num: player.num,
    });
  });

  socket.on('leaveRoom', () => doLeave(socket));
  socket.on('disconnect', () => doLeave(socket));

  function doLeave(s) {
    const code = s.data.room;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.find(p => p.id === s.id);
    if (player) {
      player.active = false;
      io.to(code).emit('playerLeft', { nickname: player.nickname, num: player.num });
    }

    if (room.state === 'playing') endGame(code);
    s.leave(code);
    s.data.room = null;
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`POK POK YI running on http://localhost:${PORT}`));
