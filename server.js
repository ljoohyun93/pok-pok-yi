const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

const GAME_DURATION = 90;
const GAME_DURATION_SINGLE = 30;
const SINGLE_TARGETS = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400];
const SINGLE_MAX_LEVEL = 10;
const SINGLE_LEVEL_MULT = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8];
/* Pick layout based on a target bubble size (px).
   This guarantees the grid fills the screen and bubbles look proportional
   on phones, tablets, and desktops. */
function pickLayout(vw, vh) {
  const HUD_H = 120;
  const FOOTER_H = 38;
  const aw = Math.max(vw - 6, 320);
  const ah = Math.max(vh - HUD_H - FOOTER_H, 260);

  let target;
  if (vw < 500)        target = 38;   /* phone */
  else if (vw < 900)   target = 44;   /* tablet */
  else if (vw < 1400)  target = 50;   /* small desktop */
  else                 target = 56;   /* large desktop */

  let cols = Math.round(aw / target);
  let rows = Math.round(ah / target);
  cols = Math.max(5, Math.min(28, cols));
  rows = Math.max(5, Math.min(24, rows));
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
  const active = room.players.filter(p => p.active);
  const minPlayers = room.mode === 'single' ? 1 : 2;
  if (active.length < minPlayers) return;

  clearInterval(room.timerInterval);
  clearInterval(room.specialInterval);
  clearTimeout(room.restartTimeout);

  room.state = 'playing';
  room.timer = room.mode === 'single' ? GAME_DURATION_SINGLE : GAME_DURATION;
  room.bubbles = makeBubbles(room.total);
  room.shimmerCount = 0;
  room.bombCount = 0;
  room.bombMax = room.mode === 'multi' ? 2 + Math.floor(Math.random() * 4) : 0; /* 2-5 */
  room.fireSpawned = false;
  if (room.bombTimeouts) room.bombTimeouts.forEach(clearTimeout);
  room.bombTimeouts = [];
  clearTimeout(room.fireTimeout);
  room.fireTimeout = null;

  /* ── Multi only: schedule guaranteed bomb/fire spawns ── */
  if (room.mode === 'multi') {
    const dur = GAME_DURATION * 1000;
    /* Fire (exactly 1) — appears between 12s and (dur-15)s */
    const fireDelay = 12000 + Math.floor(Math.random() * Math.max(1, dur - 27000));
    room.fireTimeout = setTimeout(() => {
      if (!rooms.has(code) || room.state !== 'playing' || room.fireSpawned) return;
      const cands = room.bubbles.filter(b => !b.popped && b.color === 'normal');
      if (!cands.length) return;
      cands[Math.floor(Math.random() * cands.length)].color = 'fire';
      room.fireSpawned = true;
      io.to(code).emit('bubblesUpdate', room.bubbles);
    }, fireDelay);

    /* Bombs (2-5) — staggered between 4s and (dur-10)s */
    for (let i = 0; i < room.bombMax; i++) {
      const delay = 4000 + Math.floor(Math.random() * Math.max(1, dur - 14000));
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

    /* Shimmer spawn — scales up from level 3+ in single mode */
    let shimmerChance = 0.22;
    let shimmerMax = SHIMMER_MAX;
    if (room.mode === 'single' && room.level >= 3) {
      const bump = room.level - 2;                   /* 1 at L3, 8 at L10 */
      shimmerChance = Math.min(0.55, 0.22 + bump * 0.04);
      shimmerMax    = Math.min(15,   SHIMMER_MAX + bump);
    }
    if (room.shimmerCount < shimmerMax && Math.random() < shimmerChance && normals.length > 0) {
      const idx = Math.floor(Math.random() * normals.length);
      normals[idx].color = 'shimmer';
      normals.splice(idx, 1);
      room.shimmerCount++;
    }

    /* Multi-only: BOMB (2-5 per game) and FIRE (1 per game) */
    if (room.mode === 'multi') {
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

    /* ── Fire: pop entire perimeter ── */
    if (color === 'fire') {
      bubble.popped = true;
      player.score += FIRE_BONUS;
      const C = room.cols, R = room.rows;
      const chain = [];
      for (let i = 0; i < room.bubbles.length; i++) {
        const b = room.bubbles[i];
        if (b.popped) continue;
        const r = Math.floor(i / C), c = i % C;
        if (r === 0 || r === R - 1 || c === 0 || c === C - 1) {
          b.popped = true;
          const c2 = b.color;
          const p = pointsFor(c2);
          player.score += p;
          chain.push({ id: i, color: c2, pts: p });
        }
      }
      io.to(socket.data.room).emit('firePop', {
        triggerId: id, num: player.num, chain, bonus: FIRE_BONUS,
        scores: room.players.filter(p => p.active).map(({ num, score }) => ({ num, score })),
      });
      return;
    }

    /* ── Shimmer: chain pop the entire row OR column at random ── */
    if (color === 'shimmer') {
      const C = room.cols, R = room.rows;
      const direction = Math.random() < 0.5 ? 'h' : 'v';
      const row = Math.floor(id / C);
      const col = id % C;
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

    /* Respawn — very fast so the board never empties */
    const respawnChance = room.mode === 'multi' ? 0.70 : 0.60;
    const respawnMin    = 350;
    const respawnRange  = room.mode === 'multi' ? 1400 : 1800;
    if (Math.random() < respawnChance && room.timer > 5) {
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
