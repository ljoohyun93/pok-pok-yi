/* ================================================
   POK POK YI — client
   ================================================ */

const socket = io();

let COLS = 20;
let ROWS = 14;

/* ── State ── */
let mySocketId = null;
let myNum = 0;
let roomCode = '';
let bubbles = [];
let scores = { 1: 0, 2: 0, 3: 0, 4: 0 };
let nicks = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4' };
let restartCdInterval = null;
let audioCtx = null;
let selectedMode = 'multi';
let currentMode = 'multi';

/* ── Audio (with iOS unlock, idempotent, runs every gesture) ── */
function unlockAudio() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
      audioCtx.resume().catch(() => {});
    }
    /* Silent buffer keeps the audio path open on iOS */
    const buf = audioCtx.createBuffer(1, 1, 22050);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start(0);
  } catch (_) {}
}
function getAudioCtx() {
  if (!audioCtx) unlockAudio();
  if (audioCtx && (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted')) {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}
/* Attach unlock listeners — NOT once:true so a missed first tap is recoverable */
['touchstart', 'touchend', 'mousedown', 'click', 'keydown'].forEach(ev => {
  document.addEventListener(ev, unlockAudio, { passive: true, capture: true });
});

/* Realistic bubble-wrap pop using filtered noise burst */
function playPop() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    /* short noise click — the "snap" of the membrane */
    const len = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    /* bandpass shaped much higher for a crisp pop */
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800 + Math.random() * 600;
    bp.Q.value = 1.4;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.55, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    src.connect(bp);
    bp.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    src.start(now);

    /* high-pitched body — quick downward chirp, slight pitch variance */
    const baseHi = 1100 + Math.random() * 400;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseHi, now);
    osc.frequency.exponentialRampToValueAtTime(baseHi * 0.45, now + 0.06);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.45, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(og); og.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.08);

    /* tiny squeaky harmonic on top */
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(baseHi * 2, now);
    osc2.frequency.exponentialRampToValueAtTime(baseHi * 0.9, now + 0.04);
    const og2 = ctx.createGain();
    og2.gain.setValueAtTime(0.18, now);
    og2.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc2.connect(og2); og2.connect(ctx.destination);
    osc2.start(now); osc2.stop(now + 0.06);
  } catch (_) {}
}

/* Coin jingle for special bubbles */
function playCoin() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    /* bright sweep up */
    const sweep = ctx.createOscillator();
    sweep.type = 'triangle';
    sweep.frequency.setValueAtTime(880, now);
    sweep.frequency.exponentialRampToValueAtTime(2600, now + 0.08);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.28, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    sweep.connect(sg); sg.connect(ctx.destination);
    sweep.start(now); sweep.stop(now + 0.25);

    /* metallic shimmer — two slightly detuned tones */
    [1480, 1510, 2200].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, now + i * 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.35 + i * 0.03);
      o.connect(g); g.connect(ctx.destination);
      o.start(now + i * 0.02); o.stop(now + 0.4);
    });

    /* short pop base so it still feels physical */
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(300, now);
    osc2.frequency.exponentialRampToValueAtTime(80, now + 0.05);
    const og2 = ctx.createGain();
    og2.gain.setValueAtTime(0.4, now);
    og2.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc2.connect(og2); og2.connect(ctx.destination);
    osc2.start(now); osc2.stop(now + 0.07);
  } catch (_) {}
}

/* ── Screen helpers ── */
function show(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = '';
  });
  const el = document.getElementById(id);
  el.style.display = 'flex';
  el.classList.add('active');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ── Lobby ── */
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
    document.getElementById('multi-extra').style.display = selectedMode === 'single' ? 'none' : '';
    document.getElementById('single-info').style.display = selectedMode === 'single' ? 'block' : 'none';
    document.getElementById('create-label').textContent =
      selectedMode === 'single' ? 'START SOLO' : 'CREATE ROOM';
  });
});

document.getElementById('btn-create').addEventListener('click', () => {
  const nick = document.getElementById('inp-nick').value.trim();
  if (!nick) { toast('닉네임을 입력해주세요!'); return; }
  socket.emit('createRoom', {
    nickname: nick,
    mode: selectedMode,
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,
  });
});

document.getElementById('btn-join').addEventListener('click', doJoin);
document.getElementById('inp-code').addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });
document.getElementById('inp-nick').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('btn-create').click(); });

function doJoin() {
  const nick = document.getElementById('inp-nick').value.trim();
  const code = document.getElementById('inp-code').value.trim().toUpperCase();
  if (!nick) { toast('닉네임을 입력해주세요!'); return; }
  if (!code) { toast('방 코드를 입력해주세요!'); return; }
  socket.emit('joinRoom', { code, nickname: nick });
}

/* ── Waiting ── */
document.getElementById('btn-copy').addEventListener('click', () => {
  navigator.clipboard.writeText(roomCode).then(() => {
    const ok = document.getElementById('copy-ok');
    ok.classList.add('show');
    clearTimeout(ok._t);
    ok._t = setTimeout(() => ok.classList.remove('show'), 1600);
  }).catch(() => toast('클립보드 복사 실패'));
});

document.getElementById('btn-wait-back').addEventListener('click', () => {
  socket.emit('leaveRoom');
  show('s-lobby');
});

/* ── Game back ── */
document.getElementById('btn-game-back').addEventListener('click', () => {
  socket.emit('leaveRoom');
  show('s-lobby');
});

/* ── End screen ── */
document.getElementById('btn-end-back').addEventListener('click', () => {
  socket.emit('leaveRoom');
  clearInterval(restartCdInterval);
  show('s-lobby');
});

document.getElementById('btn-replay').addEventListener('click', () => {
  clearInterval(restartCdInterval);
  socket.emit('replay');
});

document.getElementById('btn-chat').addEventListener('click', sendChat);
document.getElementById('chat-inp').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

function sendChat() {
  const msg = document.getElementById('chat-inp').value.trim();
  if (!msg) return;
  socket.emit('chat', { msg });
  document.getElementById('chat-inp').value = '';
}

/* ── Socket events ── */
socket.on('connect', () => { mySocketId = socket.id; });

socket.on('roomCreated', ({ code, num, mode }) => {
  roomCode = code;
  myNum = num;
  currentMode = mode || 'multi';
  if (currentMode === 'single') {
    /* skip waiting screen — game will start immediately via gameStart */
    return;
  }
  document.getElementById('disp-code').textContent = code;
  document.getElementById('wait-players').textContent = `★  ${document.getElementById('inp-nick').value.trim()} (YOU)`;
  document.getElementById('wait-count').textContent = 'PLAYERS 1 / 4';
  document.getElementById('btn-start').style.display = 'none';
  show('s-waiting');
});

document.getElementById('btn-start').addEventListener('click', () => {
  socket.emit('startGame');
});

socket.on('roomJoined', ({ code, num }) => {
  roomCode = code;
  myNum = num;
});

socket.on('joinError', ({ msg }) => toast(msg));

socket.on('playerJoined', ({ players }) => {
  const el = document.getElementById('wait-players');
  if (el) {
    el.textContent = players.map(p =>
      `★  ${p.nickname}${p.num === myNum ? ' (YOU)' : ''}`
    ).join('\n');
  }
  const cnt = document.getElementById('wait-count');
  if (cnt) cnt.textContent = `PLAYERS ${players.length} / 4`;
  const startBtn = document.getElementById('btn-start');
  if (startBtn) startBtn.style.display = players.length >= 2 ? '' : 'none';
});

socket.on('gameStart', ({ bubbles: serverBubbles, players, timer, mode, target, cols, rows, level }) => {
  bubbles = serverBubbles;
  /* Re-fit grid on every new game (wrap dims may have shifted between games) */
  gridSized = false;
  if (cols) COLS = cols;
  if (rows) ROWS = rows;
  scores = { 1: 0, 2: 0, 3: 0, 4: 0 };
  currentMode = mode || 'multi';

  const levelEl = document.getElementById('hud-level');
  const roomEl = document.getElementById('hud-room-info');
  if (mode === 'single') {
    levelEl.style.display = '';
    roomEl.style.display = 'none';
    document.getElementById('lvl-num').textContent = level || 1;
    document.getElementById('lvl-target').textContent = target || 400;
  } else {
    levelEl.style.display = 'none';
    roomEl.style.display = '';
  }

  /* clear nick map but preserve player labels */
  players.forEach(p => { nicks[p.num] = p.nickname; });

  /* show/hide chips based on player count */
  const presentNums = new Set(players.map(p => p.num));
  for (let n = 1; n <= 4; n++) {
    const chip = document.getElementById(`chip-p${n}`);
    if (!chip) continue;
    if (presentNums.has(n)) {
      chip.style.display = '';
      document.getElementById(`nick-p${n}`).textContent = nicks[n] || `P${n}`;
      document.getElementById(`sc-p${n}`).textContent = '0';
    } else {
      chip.style.display = 'none';
    }
  }

  document.getElementById('hud-room-code').textContent = roomCode;
  setTimer(timer);

  renderGrid();
  show('s-game');
});

socket.on('timerUpdate', t => setTimer(t));

socket.on('bubblesUpdate', serverBubbles => {
  serverBubbles.forEach((sb, i) => {
    if (!bubbles[i].popped && sb.color !== bubbles[i].color) {
      bubbles[i].color = sb.color;
      refreshBubbleClass(i);
    }
  });
});

socket.on('bubblePopped', ({ id, socketId, num, pts, color, scores: newScores }) => {
  const alreadyPopped = bubbles[id].popped;
  bubbles[id].popped = true;
  bubbles[id].poppedBy = num;

  newScores.forEach(s => updateScore(s.num, s.score));

  if (!alreadyPopped) {
    const wasSpecial = color !== 'normal';
    animatePop(id, num, wasSpecial);
  }
});

socket.on('bombPop', ({ triggerId, num, chain, scores }) => {
  scores.forEach(s => updateScore(s.num, s.score));
  document.body.classList.remove('shake');
  void document.body.offsetWidth;
  document.body.classList.add('shake');
  setTimeout(() => document.body.classList.remove('shake'), 500);

  /* trigger pops first */
  bubbles[triggerId].popped = true;
  bubbles[triggerId].poppedBy = num;
  animatePop(triggerId, num, true);
  playBoom();

  /* cascade-pop the 10 random bubbles */
  chain.forEach((item, i) => {
    setTimeout(() => {
      bubbles[item.id].popped = true;
      bubbles[item.id].poppedBy = num;
      animatePop(item.id, num, item.color !== 'normal');
      if (i % 2 === 0) playPop();
    }, 80 + i * 55);
  });
});

socket.on('firePop', ({ triggerId, num, chain, scores, ring }) => {
  scores.forEach(s => updateScore(s.num, s.score));
  showFireFrame(ring || 0);
  playWhoosh();

  bubbles[triggerId].popped = true;
  bubbles[triggerId].poppedBy = num;
  animatePop(triggerId, num, true);

  /* perimeter cascade — order clockwise from top-left for sweep effect */
  const sorted = [...chain].sort((a, b) => {
    const ar = Math.floor(a.id / COLS), ac = a.id % COLS;
    const br = Math.floor(b.id / COLS), bc = b.id % COLS;
    /* clockwise rank */
    const rank = (r, c) => {
      if (r === 0)              return c;                              /* top L→R */
      if (c === COLS - 1)       return COLS + r;                       /* right T→B */
      if (r === ROWS - 1)       return COLS + ROWS + (COLS - 1 - c);   /* bottom R→L */
      return COLS + ROWS + COLS + (ROWS - 1 - r);                       /* left B→T */
    };
    return rank(ar, ac) - rank(br, bc);
  });
  sorted.forEach((item, i) => {
    setTimeout(() => {
      bubbles[item.id].popped = true;
      bubbles[item.id].poppedBy = num;
      animatePop(item.id, num, item.color !== 'normal');
      if (i % 3 === 0) playPop();
    }, 60 + i * 22);
  });
});

socket.on('rowPopped', ({ direction, row, col, triggerId, num, chain, scores }) => {
  scores.forEach(s => updateScore(s.num, s.score));
  showRowFlash(direction, row, col);
  playMagicChime();

  /* cascade pop in order from trigger outward */
  const triggerIdx = chain.findIndex(c => c.id === triggerId);
  const ordered = [...chain].sort((a, b) => {
    const da = Math.abs(chain.findIndex(x => x.id === a.id) - triggerIdx);
    const db = Math.abs(chain.findIndex(x => x.id === b.id) - triggerIdx);
    return da - db;
  });

  ordered.forEach((item, i) => {
    setTimeout(() => {
      if (!bubbles[item.id] || bubbles[item.id].popped) {
        bubbles[item.id] = bubbles[item.id] || {};
        bubbles[item.id].popped = true;
        bubbles[item.id].poppedBy = num;
      } else {
        bubbles[item.id].popped = true;
        bubbles[item.id].poppedBy = num;
      }
      animatePop(item.id, num, item.color !== 'normal' && item.color !== 'shimmer');
      if (item.color === 'shimmer') playCoin();
      else if (item.color !== 'normal') playCoin();
      else playPop();
    }, i * 28);
  });
});

/* ── Leaderboard rendering ── */
let lastLeaderboard = [];

function renderLeaderboard(target, board) {
  if (!target) return;
  if (!board || board.length === 0) {
    target.innerHTML = '<li class="lb-empty">아직 기록 없음</li>';
    return;
  }
  target.innerHTML = board.map((e, i) => {
    const rank = ['🥇', '🥈', '🥉', '4', '5'][i] || (i + 1);
    return `<li>` +
      `<span class="lb-rank">${rank}</span>` +
      `<span class="lb-nick">${escHtml(e.nickname)}</span>` +
      `<span class="lb-lvl">L${e.level}</span>` +
      `<span class="lb-sc">${e.score}</span>` +
    `</li>`;
  }).join('');
}

socket.on('leaderboardUpdate', (board) => {
  lastLeaderboard = board || [];
  renderLeaderboard(document.getElementById('lb-list'), lastLeaderboard);
});

socket.on('bubbleRespawned', ({ id }) => {
  if (!bubbles[id]) return;
  bubbles[id].popped = false;
  bubbles[id].color = 'normal';
  delete bubbles[id].poppedBy;

  const grid = document.getElementById('bubble-grid');
  const el = grid && grid.children[id];
  if (!el) return;

  el.className = 'bubble normal respawning';
  /* Re-bind click — old listener was on a popped element, but since we never
     replaced the node, its listener is still attached. Re-attach safely. */
  const fresh = el.cloneNode(false);
  fresh.className = 'bubble normal respawning';
  fresh.dataset.id = id;
  fresh.addEventListener('click', () => onClickBubble(id));
  fresh.addEventListener('touchstart', ev => { ev.preventDefault(); onClickBubble(id); }, { passive: false });
  el.replaceWith(fresh);

  setTimeout(() => fresh.classList.remove('respawning'), 450);
});

socket.on('gameEnd', ({ results, mode, target, success, level, nextLevel, nextTarget, allCleared, leaderboard }) => {
  /* Update lobby leaderboard cache + render to end screen */
  if (leaderboard) {
    lastLeaderboard = leaderboard;
    renderLeaderboard(document.getElementById('lb-list'), leaderboard);
    renderLeaderboard(document.getElementById('end-lb-list'), leaderboard);
    const endLbBox = document.getElementById('end-leaderboard');
    if (endLbBox) endLbBox.style.display = (mode === 'single') ? '' : 'none';
  }
  clearInterval(restartCdInterval);

  const titleEl = document.querySelector('#s-end .end-title');
  titleEl.classList.remove('success', 'fail');
  if (mode === 'single') {
    if (allCleared) titleEl.textContent = '🏆 ALL CLEARED! 🏆';
    else if (success) titleEl.textContent = `LEVEL ${level} CLEARED!`;
    else titleEl.textContent = `LEVEL ${level} FAILED`;
    titleEl.classList.add(success ? 'success' : 'fail');
  } else {
    titleEl.textContent = '✦ GAME OVER ✦';
  }

  const board = document.getElementById('results');
  board.innerHTML = '';

  if (mode === 'single' && results.length === 1) {
    const r = results[0];
    const tgtRow = document.createElement('div');
    tgtRow.className = 'target-line';
    tgtRow.innerHTML = `LEVEL ${level} TARGET ${target} → <span class="${success ? 'hit' : 'miss'}">${r.score}</span>`;
    board.appendChild(tgtRow);
    if (nextLevel) {
      const nextRow = document.createElement('div');
      nextRow.className = 'target-line';
      nextRow.innerHTML = `▶ NEXT: <b style="color:var(--cyan)">LEVEL ${nextLevel}</b> · ★ <b style="color:var(--gold)">${nextTarget}</b>`;
      board.appendChild(nextRow);
    }
    const row = document.createElement('div');
    row.className = 'result-row winner';
    row.innerHTML =
      `<span class="res-rank">${allCleared ? '👑' : success ? '🏆' : '💔'}</span>` +
      `<span class="res-name">${escHtml(r.nickname)}</span>` +
      `<span class="res-score">${r.score} PTS</span>`;
    board.appendChild(row);
  } else {
    results.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'result-row' + (i === 0 ? ' winner' : '');
      row.innerHTML =
        `<span class="res-rank">${i === 0 ? '🏆' : '#' + (i + 1)}</span>` +
        `<span class="res-name">${escHtml(r.nickname)}</span>` +
        `<span class="res-score">${r.score} PTS</span>`;
      board.appendChild(row);
    });
  }

  document.getElementById('chat-log').innerHTML = '';
  const restartRow = document.querySelector('.restart-row');
  const replayBtn = document.getElementById('btn-replay');

  /* Show REPLAY only on single-mode fail (not all-cleared) */
  if (replayBtn) {
    replayBtn.style.display = (mode === 'single' && !success && !allCleared) ? '' : 'none';
  }

  if (mode === 'single' && allCleared) {
    /* terminal win — no auto-restart */
    if (restartRow) restartRow.style.display = 'none';
  } else {
    if (restartRow) restartRow.style.display = '';
    let cd, label;
    if (mode === 'single' && success && nextLevel) { cd = 6;  label = `NEXT LEVEL IN`; }
    else if (mode === 'single' && !success)         { cd = 10; label = `RETRY LEVEL ${level} IN`; }
    else                                            { cd = 15; label = `NEXT GAME IN`; }
    if (restartRow) {
      restartRow.innerHTML = `${label} <span id="restart-cd" class="cd-num">${cd}</span>s`;
    }
    restartCdInterval = setInterval(() => {
      cd--;
      const el = document.getElementById('restart-cd');
      if (el) el.textContent = cd;
      if (cd <= 0) clearInterval(restartCdInterval);
    }, 1000);
  }

  show('s-end');
});

socket.on('chat', ({ nickname, msg, num }) => {
  const log = document.getElementById('chat-log');
  const el = document.createElement('div');
  el.className = 'chat-msg';
  el.innerHTML = `<span class="chat-nick p${num}">${escHtml(nickname)}:</span>${escHtml(msg)}`;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
});

socket.on('playerLeft', ({ nickname }) => {
  toast(`${nickname} 님이 나갔습니다`);
});

socket.on('playerDisconnected', ({ nickname }) => {
  toast(`${nickname} 님 연결이 끊겼습니다`);
});

/* ── Timer display ── */
function setTimer(t) {
  const el = document.getElementById('game-timer');
  el.textContent = t;
  el.classList.toggle('urgent', t <= 10);
}

/* ── Score display ── */
function updateScore(num, val) {
  scores[num] = val;
  const el = document.getElementById(`sc-p${num}`);
  if (!el) return;
  el.textContent = val;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 200);
}

/* ── Floating-score color helper for 4 players ── */
function playerColor(num) {
  return num === 1 ? 'var(--p1)'
       : num === 2 ? 'var(--p2)'
       : num === 3 ? 'var(--p3)'
       : 'var(--p4)';
}

/* ── Bubble grid ── */
let gridSized = false;  /* fitGrid runs ONCE per game; resize/orientation only */

function renderGrid() {
  const grid = document.getElementById('bubble-grid');
  grid.innerHTML = '';

  bubbles.forEach((b, i) => {
    const el = document.createElement('div');
    el.className = 'bubble ' + bubbleClass(b);
    el.dataset.id = i;
    if (!b.popped) {
      el.addEventListener('click', () => onClickBubble(i));
      el.addEventListener('touchstart', ev => { ev.preventDefault(); onClickBubble(i); }, { passive: false });
    }
    grid.appendChild(el);
  });

  /* Only size the grid the very first time it's rendered for this game.
     Subsequent bubblesUpdate calls keep the same grid template, so bubbles
     don't resize/shift visually mid-game. */
  if (!gridSized) {
    gridSized = true;
    requestAnimationFrame(fitGrid);
    setTimeout(fitGrid, 80);  /* second pass after fonts settle */
  }
}

function fitGrid() {
  const grid = document.getElementById('bubble-grid');
  const wrap = document.querySelector('.grid-wrap');
  if (!grid || !wrap) return;
  /* Fixed pixel-sized cells = perfect circles via aspect-ratio:1.
     Grid centered in wrap; minor edge space is acceptable per user. */
  const gap = 1;
  const aw = wrap.clientWidth;
  const ah = wrap.clientHeight;
  if (aw < 20 || ah < 20) return;
  const colSize = (aw - (COLS - 1) * gap) / COLS;
  const rowSize = (ah - (ROWS - 1) * gap) / ROWS;
  const size = Math.max(14, Math.floor(Math.min(colSize, rowSize)));
  grid.style.gridTemplateColumns = `repeat(${COLS}, ${size}px)`;
  grid.style.gridTemplateRows    = `repeat(${ROWS}, ${size}px)`;
}

window.addEventListener('resize', () => requestAnimationFrame(fitGrid));
window.addEventListener('orientationchange', () => setTimeout(fitGrid, 100));
window.addEventListener('resize', fitGrid);

function bubbleClass(b) {
  if (b.popped) return 'popped' + (b.poppedBy ? ` by-p${b.poppedBy}` : '');
  const map = {
    normal: 'normal',
    red: 's-red', blue: 's-blue', purple: 's-purple',
    pink: 's-pink', yellow: 's-yellow',
    shimmer: 's-shimmer',
    bomb: 's-bomb', fire: 's-fire',
  };
  return map[b.color] || 'normal';
}

function refreshBubbleClass(i) {
  const grid = document.getElementById('bubble-grid');
  const el = grid && grid.children[i];
  if (!el || bubbles[i].popped) return;
  el.className = 'bubble ' + bubbleClass(bubbles[i]);
}

/* Per-color points (mirrors server) */
function pointsFor(color) {
  if (color === 'normal') return 5;
  if (color === 'red' || color === 'pink' || color === 'yellow') return 10;
  if (color === 'blue' || color === 'purple') return 15;
  return 0;
}

/* ── Pop a bubble ── */
function onClickBubble(i) {
  const b = bubbles[i];
  if (b.popped) return;

  /* Shimmer/Bomb/Fire — let server orchestrate; we just send & wait */
  if (b.color === 'shimmer' || b.color === 'bomb' || b.color === 'fire') {
    socket.emit('popBubble', { id: i });
    return;
  }

  const wasSpecial = b.color !== 'normal';
  const color = b.color;
  const pts = pointsFor(color);
  b.popped = true;

  const grid = document.getElementById('bubble-grid');
  const el = grid && grid.children[i];
  if (el) {
    el.classList.add('popping');
    spawnRing(el, wasSpecial ? color : null);
    spawnScore(el, pts, myNum);
    setTimeout(() => {
      el.className = `bubble popped by-p${myNum}`;
    }, 150);
  }

  if (wasSpecial) playCoin();
  else playPop();

  socket.emit('popBubble', { id: i });
}

/* ── Shimmer row/col flash beam ── */
function showRowFlash(direction, row, col) {
  const grid = document.getElementById('bubble-grid');
  if (!grid) return;
  const flash = document.createElement('div');
  flash.className = 'row-flash' + (direction === 'v' ? ' vertical' : '');

  if (direction === 'h') {
    const first = grid.children[row * COLS];
    const last  = grid.children[row * COLS + COLS - 1];
    if (!first || !last) return;
    const r1 = first.getBoundingClientRect();
    const r2 = last.getBoundingClientRect();
    flash.style.cssText = `
      left:${r1.left - 14}px;
      top:${r1.top + r1.height / 2 - 9}px;
      width:${r2.right - r1.left + 28}px;
      height:18px;
    `;
  } else {
    const first = grid.children[col];
    const last  = grid.children[(ROWS - 1) * COLS + col];
    if (!first || !last) return;
    const r1 = first.getBoundingClientRect();
    const r2 = last.getBoundingClientRect();
    flash.style.cssText = `
      left:${r1.left + r1.width / 2 - 9}px;
      top:${r1.top - 14}px;
      width:18px;
      height:${r2.bottom - r1.top + 28}px;
    `;
  }

  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 620);
}

/* ── Fire frame burst around the chosen ring ── */
function showFireFrame(ring) {
  const grid = document.getElementById('bubble-grid');
  if (!grid) return;
  ring = ring || 0;
  const tl = grid.children[ring * COLS + ring];
  const br = grid.children[(ROWS - 1 - ring) * COLS + (COLS - 1 - ring)];
  if (!tl || !br) return;
  const r1 = tl.getBoundingClientRect();
  const r2 = br.getBoundingClientRect();
  const frame = document.createElement('div');
  frame.className = 'fire-frame';
  frame.style.cssText = `
    left:${r1.left - 12}px;
    top:${r1.top - 12}px;
    width:${r2.right - r1.left + 24}px;
    height:${r2.bottom - r1.top + 24}px;
  `;
  document.body.appendChild(frame);
  setTimeout(() => frame.remove(), 1400);

  /* Emit roving sparks around the perimeter for extra impact */
  const cx = (r1.left + r2.right) / 2;
  const cy = (r1.top + r2.bottom) / 2;
  const halfW = (r2.right - r1.left) / 2 + 12;
  const halfH = (r2.bottom - r1.top) / 2 + 12;
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 0.85 + Math.random() * 0.25;
    const px = cx + Math.cos(ang) * halfW * dist;
    const py = cy + Math.sin(ang) * halfH * dist;
    const s = document.createElement('div');
    s.className = 'fire-spark';
    const dx = (Math.random() - 0.5) * 80;
    const dy = -30 - Math.random() * 60;
    s.style.cssText = `left:${px}px;top:${py}px;--dx:${dx}px;--dy:${dy}px;`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}

/* ── Boom sound for bomb ── */
function playBoom() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    /* low frequency thump */
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, now);
    o.frequency.exponentialRampToValueAtTime(28, now + 0.45);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.7, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    o.connect(og); og.connect(ctx.destination);
    o.start(now); o.stop(now + 0.55);
    /* noise burst */
    const len = Math.floor(ctx.sampleRate * 0.32);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random()*2-1) * Math.pow(1 - i/len, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1200;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.55, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    src.connect(lp); lp.connect(ng); ng.connect(ctx.destination);
    src.start(now);
  } catch (_) {}
}

/* ── Whoosh sound for fire ── */
function playWhoosh() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.7);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random()*2-1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(450, now);
    bp.frequency.exponentialRampToValueAtTime(2600, now + 0.55);
    bp.Q.value = 4;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, now);
    ng.gain.linearRampToValueAtTime(0.45, now + 0.05);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    src.connect(bp); bp.connect(ng); ng.connect(ctx.destination);
    src.start(now);
    /* low crackle */
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(140, now);
    o.frequency.exponentialRampToValueAtTime(70, now + 0.5);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.18, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    o.connect(og); og.connect(ctx.destination);
    o.start(now); o.stop(now + 0.6);
  } catch (_) {}
}

/* ── Magic chime for shimmer chain ── */
function playMagicChime() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    /* ascending arpeggio */
    [659, 880, 1175, 1568, 2093].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, now + i * 0.05);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + i * 0.05);
      g.gain.linearRampToValueAtTime(0.22, now + i * 0.05 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.55);
      o.connect(g); g.connect(ctx.destination);
      o.start(now + i * 0.05); o.stop(now + i * 0.05 + 0.6);
    });
    /* shimmer noise sweep */
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2500, now);
    bp.frequency.exponentialRampToValueAtTime(800, now + 0.5);
    bp.Q.value = 4;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.18, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    src.connect(bp); bp.connect(ng); ng.connect(ctx.destination);
    src.start(now);
  } catch (_) {}
}

function animatePop(id, num, wasSpecial) {
  const grid = document.getElementById('bubble-grid');
  const el = grid && grid.children[id];
  if (!el) return;

  el.classList.add('popping');
  spawnRing(el, wasSpecial ? bubbles[id].color : null);
  spawnScore(el, wasSpecial ? 10 : 5, num);
  setTimeout(() => {
    el.className = `bubble popped by-p${num}`;
  }, 150);

  if (wasSpecial) playCoin();
  else playPop();
}

/* Ring effect */
function spawnRing(el, color) {
  const rect = el.getBoundingClientRect();
  const ring = document.createElement('div');
  ring.className = 'pop-ring';
  const size = rect.width;
  ring.style.cssText = `
    left:${rect.left}px; top:${rect.top}px;
    width:${size}px; height:${size}px;
    border-color:${ringColor(color)};
  `;
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 380);
}

function ringColor(color) {
  if (color === 'red')    return 'rgba(255,80,80,0.8)';
  if (color === 'blue')   return 'rgba(80,140,255,0.8)';
  if (color === 'purple') return 'rgba(200,80,255,0.8)';
  return 'rgba(255,255,255,0.7)';
}

/* Floating +pts */
function spawnScore(el, pts, num) {
  const rect = el.getBoundingClientRect();
  const fl = document.createElement('div');
  fl.className = 'float-score';
  fl.textContent = `+${pts}`;
  fl.style.cssText = `
    left:${rect.left + rect.width / 2}px;
    top:${rect.top + rect.height / 2}px;
    transform: translateX(-50%);
    color:${playerColor(num)};
  `;
  document.body.appendChild(fl);
  setTimeout(() => fl.remove(), 750);
}

/* ── Util ── */
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
