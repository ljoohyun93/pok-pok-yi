/* ================================================
   POK POK YI — client
   ================================================ */

const socket = io();

const COLS = 20;
const ROWS = 14;

/* ── State ── */
let mySocketId = null;
let myNum = 0;
let roomCode = '';
let bubbles = [];
let scores = { 1: 0, 2: 0 };
let nicks = { 1: 'P1', 2: 'P2' };
let restartCdInterval = null;
let audioCtx = null;

/* ── Audio ── */
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

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
document.getElementById('btn-create').addEventListener('click', () => {
  const nick = document.getElementById('inp-nick').value.trim();
  if (!nick) { toast('닉네임을 입력해주세요!'); return; }
  socket.emit('createRoom', { nickname: nick });
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

socket.on('roomCreated', ({ code, num }) => {
  roomCode = code;
  myNum = num;
  document.getElementById('disp-code').textContent = code;
  document.getElementById('wait-players').textContent = `★  ${document.getElementById('inp-nick').value.trim()} (YOU)`;
  show('s-waiting');
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
});

socket.on('gameStart', ({ bubbles: serverBubbles, players, timer }) => {
  bubbles = serverBubbles;
  scores = { 1: 0, 2: 0 };

  players.forEach(p => { nicks[p.num] = p.nickname; });

  document.getElementById('nick-p1').textContent = nicks[1] || 'P1';
  document.getElementById('nick-p2').textContent = nicks[2] || 'P2';
  document.getElementById('sc-p1').textContent = '0';
  document.getElementById('sc-p2').textContent = '0';
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

socket.on('gameEnd', ({ results }) => {
  clearInterval(restartCdInterval);

  const board = document.getElementById('results');
  board.innerHTML = '';
  results.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'result-row' + (i === 0 ? ' winner' : '');
    row.innerHTML =
      `<span class="res-rank">${i === 0 ? '🏆' : '#' + (i + 1)}</span>` +
      `<span class="res-name">${escHtml(r.nickname)}</span>` +
      `<span class="res-score">${r.score} PTS</span>`;
    board.appendChild(row);
  });

  document.getElementById('chat-log').innerHTML = '';
  let cd = 15;
  document.getElementById('restart-cd').textContent = cd;
  restartCdInterval = setInterval(() => {
    cd--;
    document.getElementById('restart-cd').textContent = cd;
    if (cd <= 0) clearInterval(restartCdInterval);
  }, 1000);

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

/* ── Bubble grid ── */
function renderGrid() {
  const grid = document.getElementById('bubble-grid');
  grid.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
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

  /* Responsive size: fit grid into available container */
  requestAnimationFrame(fitGrid);
}

function fitGrid() {
  const wrap = document.querySelector('.grid-wrap');
  if (!wrap) return;
  const aw = wrap.clientWidth - 20;
  const ah = wrap.clientHeight - 16;
  const gap = 3;
  const colSize = Math.floor((aw - (COLS - 1) * gap) / COLS);
  const rowSize = Math.floor((ah - (ROWS - 1) * gap) / ROWS);
  const size = Math.max(20, Math.min(colSize, rowSize, 80));
  const grid = document.getElementById('bubble-grid');
  grid.style.gridTemplateColumns = `repeat(${COLS}, ${size}px)`;
}
window.addEventListener('resize', fitGrid);

function bubbleClass(b) {
  if (b.popped) return 'popped' + (b.poppedBy ? ` by-p${b.poppedBy}` : '');
  const map = { normal: 'normal', red: 's-red', blue: 's-blue', purple: 's-purple' };
  return map[b.color] || 'normal';
}

function refreshBubbleClass(i) {
  const grid = document.getElementById('bubble-grid');
  const el = grid && grid.children[i];
  if (!el || bubbles[i].popped) return;
  el.className = 'bubble ' + bubbleClass(bubbles[i]);
}

/* ── Pop a bubble ── */
function onClickBubble(i) {
  const b = bubbles[i];
  if (b.popped) return;

  const wasSpecial = b.color !== 'normal';
  const color = b.color;
  b.popped = true;

  const grid = document.getElementById('bubble-grid');
  const el = grid && grid.children[i];
  if (el) {
    el.classList.add('popping');
    spawnRing(el, wasSpecial ? color : null);
    spawnScore(el, wasSpecial ? 10 : 5, myNum);
    setTimeout(() => {
      el.className = `bubble popped by-p${myNum}`;
    }, 150);
  }

  if (wasSpecial) playCoin();
  else playPop();

  socket.emit('popBubble', { id: i });
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
    color:${num === 1 ? 'var(--p1)' : 'var(--p2)'};
  `;
  document.body.appendChild(fl);
  setTimeout(() => fl.remove(), 750);
}

/* ── Util ── */
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
