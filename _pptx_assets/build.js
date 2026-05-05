const PptxGenJS = require('pptxgenjs');
const path = require('path');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';        /* 13.333 x 7.5 in */
pptx.title = 'POK POK YI 게임 기획서';
pptx.author = 'Joohyun Lee';

const W = 13.333, H = 7.5;
const C = {
  bg:       '0A0E1A',  /* deep navy */
  bgAlt:    '12182B',
  cyan:     '00F5C4',
  pink:     'FF1493',
  gold:     'FFD700',
  white:    'FFFFFF',
  textDim:  '8B95A8',
  card:     '1A2238',
  line:     '2A3556',
  green:    '4DFF88',
  orange:   'FF8800',
};
const F = { head: 'Impact', body: 'Calibri', mono: 'Consolas' };
const ASSETS = path.dirname(__filename);
const img = (f) => path.join(ASSETS, f);

/* ─────────────  helpers  ───────────── */
function fillBg(slide, color = C.bg) {
  slide.background = { color };
}
function pageNum(slide, n, total) {
  slide.addText(`${n} / ${total}`, {
    x: W - 1.2, y: H - 0.45, w: 1, h: 0.3,
    fontFace: F.mono, fontSize: 9, color: C.textDim, align: 'right',
  });
}
function brandTag(slide) {
  slide.addText('POK POK YI', {
    x: 0.5, y: H - 0.45, w: 3, h: 0.3,
    fontFace: F.head, fontSize: 10, color: C.cyan, bold: true,
  });
}
function corner(slide) {
  /* Subtle accent in top-left for visual continuity */
  slide.addShape('rect', { x: 0, y: 0, w: 0.18, h: H, fill: { color: C.cyan } });
  slide.addShape('rect', { x: 0.18, y: 0, w: 0.04, h: H, fill: { color: C.pink } });
}

/* =============================================================
   Slide 1 — TITLE
============================================================= */
{
  const s = pptx.addSlide();
  fillBg(s, C.bg);
  /* Decorative dots */
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    const sz = 0.04 + Math.random() * 0.05;
    s.addShape('ellipse', {
      x, y, w: sz, h: sz,
      fill: { color: i % 3 === 0 ? C.cyan : (i % 3 === 1 ? C.pink : C.gold) },
      line: { color: 'FFFFFF', transparency: 100 },
    });
  }
  s.addText('POK POK YI', {
    x: 0, y: 2.2, w: W, h: 1.6,
    align: 'center', fontFace: F.head, fontSize: 110, bold: true, color: C.cyan,
    glow: { size: 16, color: C.cyan, opacity: 0.5 },
  });
  s.addText('스트레스 받을 땐, 뽁뽁이 터트리기', {
    x: 0, y: 3.9, w: W, h: 0.6,
    align: 'center', fontFace: F.head, fontSize: 28, color: C.pink,
  });
  s.addText('실시간 멀티플레이어 · 솔로 챌린지 게임 · 게임 기획서', {
    x: 0, y: 4.7, w: W, h: 0.4,
    align: 'center', fontFace: F.body, fontSize: 16, color: C.textDim, italic: true,
  });
  s.addText('2026 · Designed & Built by Joohyun Lee', {
    x: 0, y: 6.6, w: W, h: 0.3,
    align: 'center', fontFace: F.mono, fontSize: 11, color: C.textDim,
  });
}

/* =============================================================
   Slide 2 — 게임 개요
============================================================= */
{
  const s = pptx.addSlide();
  fillBg(s, C.bg);
  corner(s);
  s.addText('GAME OVERVIEW', {
    x: 0.6, y: 0.4, w: 8, h: 0.45,
    fontFace: F.mono, fontSize: 11, color: C.cyan, charSpacing: 4,
  });
  s.addText('한 줄 컨셉', {
    x: 0.6, y: 0.95, w: 8, h: 0.7,
    fontFace: F.head, fontSize: 38, bold: true, color: C.white,
  });
  s.addText('"두들겨 부수는 카타르시스 — 뽁뽁이 터트리기를 멀티플레이어 아케이드 게임으로"', {
    x: 0.6, y: 1.7, w: 7.7, h: 0.7,
    fontFace: F.body, fontSize: 16, italic: true, color: C.gold,
  });

  /* Three pillars */
  const pillars = [
    { icon: '🎯', title: 'CORE LOOP', desc: '화면 가득한 뽁뽁이를 손으로 미친 듯이\n터트리며 점수를 쌓는 단순·중독 게임플레이' },
    { icon: '⚡', title: 'REAL-TIME',  desc: 'Socket.IO 기반 실시간 멀티플레이.\n2~4명이 같은 보드에서 경쟁' },
    { icon: '🏆', title: 'PROGRESSION', desc: '솔로 모드 10레벨 점진적 난이도 +\n영구 보존되는 SOLO TOP 5 랭킹' },
  ];
  pillars.forEach((p, i) => {
    const x = 0.6 + i * 4.1;
    const y = 2.85;
    s.addShape('roundRect', {
      x, y, w: 3.9, h: 1.85, rectRadius: 0.08,
      fill: { color: C.card }, line: { color: C.cyan, width: 1 },
    });
    s.addText(p.icon, {
      x: x + 0.15, y: y + 0.15, w: 0.7, h: 0.6,
      fontSize: 28,
    });
    s.addText(p.title, {
      x: x + 0.95, y: y + 0.2, w: 2.8, h: 0.4,
      fontFace: F.head, fontSize: 16, bold: true, color: C.cyan,
    });
    s.addText(p.desc, {
      x: x + 0.2, y: y + 0.85, w: 3.6, h: 0.95,
      fontFace: F.body, fontSize: 13, color: C.white,
    });
  });

  /* Lobby thumbnail */
  s.addImage({
    path: img('01-lobby.png'),
    x: 9.0, y: 1.1, w: 3.9, h: 5.7,
    sizing: { type: 'contain', w: 3.9, h: 5.7 },
  });
  s.addShape('rect', {
    x: 9.0, y: 1.1, w: 3.9, h: 5.7,
    line: { color: C.cyan, width: 1 }, fill: { color: 'FFFFFF', transparency: 100 },
  });
  s.addText('▲ 로비 화면', {
    x: 9.0, y: 6.85, w: 3.9, h: 0.3,
    fontFace: F.mono, fontSize: 10, color: C.textDim, align: 'center',
  });

  brandTag(s); pageNum(s, 2, 13);
}

/* =============================================================
   Slide 3 — 모드: MULTI vs SOLO
============================================================= */
{
  const s = pptx.addSlide();
  fillBg(s, C.bg);
  corner(s);
  s.addText('GAME MODES', {
    x: 0.6, y: 0.4, w: 8, h: 0.45,
    fontFace: F.mono, fontSize: 11, color: C.cyan, charSpacing: 4,
  });
  s.addText('두 가지 모드', {
    x: 0.6, y: 0.95, w: 8, h: 0.7,
    fontFace: F.head, fontSize: 38, bold: true, color: C.white,
  });

  /* MULTI card */
  const xL = 0.6, xR = 6.95;
  const yC = 2.0, hC = 5.0;
  s.addShape('roundRect', {
    x: xL, y: yC, w: 6.05, h: hC, rectRadius: 0.1,
    fill: { color: C.card }, line: { color: C.cyan, width: 2 },
  });
  s.addText('MULTI', {
    x: xL + 0.4, y: yC + 0.3, w: 5, h: 0.7,
    fontFace: F.head, fontSize: 38, bold: true, color: C.cyan,
  });
  s.addText('2 ~ 4 PLAYERS · 90초', {
    x: xL + 0.4, y: yC + 1.1, w: 5, h: 0.4,
    fontFace: F.mono, fontSize: 13, color: C.gold,
  });
  const multiBullets = [
    '• 6자리 방 코드로 친구 초대',
    '• 호스트가 START GAME 누르면 동시 시작',
    '• 점수가 가장 높은 플레이어가 승리',
    '• 멀티 전용 스페셜: 폭탄 / 불꽃 등장',
    '• 매 게임 끝나면 15초 후 자동 재시작',
  ];
  s.addText(multiBullets.join('\n'), {
    x: xL + 0.4, y: yC + 1.7, w: 5.5, h: 3.0,
    fontFace: F.body, fontSize: 14, color: C.white, paraSpaceAfter: 6,
  });

  /* SOLO card */
  s.addShape('roundRect', {
    x: xR, y: yC, w: 6.05, h: hC, rectRadius: 0.1,
    fill: { color: C.card }, line: { color: C.pink, width: 2 },
  });
  s.addText('SOLO', {
    x: xR + 0.4, y: yC + 0.3, w: 5, h: 0.7,
    fontFace: F.head, fontSize: 38, bold: true, color: C.pink,
  });
  s.addText('1 PLAYER · 30초 챌린지 · 10 LEVELS', {
    x: xR + 0.4, y: yC + 1.1, w: 5.5, h: 0.4,
    fontFace: F.mono, fontSize: 13, color: C.gold,
  });
  const soloBullets = [
    '• 30초 안에 목표 점수 도달하면 다음 레벨',
    '• L1: 850 → L10: 3,000 (250점 단위 상승)',
    '• 실패 시 같은 레벨 재도전 (REPLAY)',
    '• 레벨업마다 컬러/스페셜 등장 빈도 ↑',
    '• L5+ 부활 속도 폭증 (진정한 미친 모드)',
    '• 영구 SOLO TOP 5 랭킹에 등재',
  ];
  s.addText(soloBullets.join('\n'), {
    x: xR + 0.4, y: yC + 1.7, w: 5.5, h: 3.0,
    fontFace: F.body, fontSize: 14, color: C.white, paraSpaceAfter: 6,
  });

  brandTag(s); pageNum(s, 3, 13);
}

/* =============================================================
   Slide 4 — 핵심 메커닉
============================================================= */
{
  const s = pptx.addSlide();
  fillBg(s, C.bg);
  corner(s);
  s.addText('CORE MECHANIC', {
    x: 0.6, y: 0.4, w: 8, h: 0.45,
    fontFace: F.mono, fontSize: 11, color: C.cyan, charSpacing: 4,
  });
  s.addText('핵심 메커닉', {
    x: 0.6, y: 0.95, w: 8, h: 0.7,
    fontFace: F.head, fontSize: 38, bold: true, color: C.white,
  });

  /* Game screenshot */
  s.addImage({
    path: img('03-game-solo.png'),
    x: 0.6, y: 2.0, w: 7.0, h: 4.4,
    sizing: { type: 'contain', w: 7.0, h: 4.4 },
  });
  s.addShape('rect', {
    x: 0.6, y: 2.0, w: 7.0, h: 4.4,
    line: { color: C.cyan, width: 1 }, fill: { color: 'FFFFFF', transparency: 100 },
  });
  s.addText('▲ 인게임 화면 — 격자 가득한 뽁뽁이', {
    x: 0.6, y: 6.45, w: 7.0, h: 0.3,
    fontFace: F.mono, fontSize: 10, color: C.textDim, align: 'center',
  });

  /* Right column */
  const rx = 8.1;
  const items = [
    { t: '뽁뽁이 그리드', d: '뷰포트 비율 기반 동적 레이아웃 (반응형). 폰 ~38px / 데스크톱 ~56px 셀 사이즈로 자동 산출' },
    { t: '터트리기', d: '클릭/탭 한 번 → 실시간 사운드 + 시각 효과. Web Audio API로 하이톤 pop 합성' },
    { t: '부활 시스템', d: '터진 뽁뽁이의 일정 비율이 짧은 딜레이 후 다시 등장. 레벨에 따라 부활 속도 가속' },
    { t: '실시간 동기화', d: 'Socket.IO 기반. 모든 플레이어가 동일 보드를 공유하며 점수/상태 실시간 반영' },
  ];
  items.forEach((it, i) => {
    const y = 2.05 + i * 1.1;
    s.addShape('rect', {
      x: rx, y, w: 0.08, h: 0.95, fill: { color: C.cyan }, line: { color: C.cyan },
    });
    s.addText(it.t, {
      x: rx + 0.2, y: y - 0.02, w: 4.7, h: 0.4,
      fontFace: F.head, fontSize: 16, bold: true, color: C.cyan,
    });
    s.addText(it.d, {
      x: rx + 0.2, y: y + 0.36, w: 4.7, h: 0.65,
      fontFace: F.body, fontSize: 12, color: C.white,
    });
  });

  brandTag(s); pageNum(s, 4, 13);
}

/* =============================================================
   Slide 5 — 색깔별 점수
============================================================= */
{
  const s = pptx.addSlide();
  fillBg(s, C.bg);
  corner(s);
  s.addText('SCORING SYSTEM', {
    x: 0.6, y: 0.4, w: 8, h: 0.45,
    fontFace: F.mono, fontSize: 11, color: C.cyan, charSpacing: 4,
  });
  s.addText('색깔별 점수 차등', {
    x: 0.6, y: 0.95, w: 8, h: 0.7,
    fontFace: F.head, fontSize: 38, bold: true, color: C.white,
  });
  s.addText('단순한 5점/10점 구조에서 → 색상 티어로 전략성 추가. 어느 색을 우선 노릴지 의사결정 부여.', {
    x: 0.6, y: 1.7, w: 12, h: 0.4,
    fontFace: F.body, fontSize: 14, italic: true, color: C.textDim,
  });

  /* Score tier cards */
  const tiers = [
    { tier: 'NORMAL', pts: '5', colors: '🔘', col: C.textDim, hex: 'B0B8C8', desc: '기본 회색 뽁뽁이' },
    { tier: 'TIER 1',  pts: '10', colors: '🔴 🟡 🌸', col: C.gold, hex: 'FFD700', desc: '빨강 · 노랑 · 핑크' },
    { tier: 'TIER 2',  pts: '15', colors: '🔵 🟣', col: C.pink, hex: 'B266FF', desc: '파랑 · 보라' },
    { tier: 'CHAIN',   pts: 'Σ',  colors: '✦ 💣 🔥', col: C.cyan, hex: '00F5C4', desc: '연쇄 + 보너스' },
  ];
  tiers.forEach((t, i) => {
    const x = 0.6 + i * 3.15;
    const y = 2.4;
    s.addShape('roundRect', {
      x, y, w: 3.0, h: 4.3, rectRadius: 0.1,
      fill: { color: C.card }, line: { color: t.hex, width: 2 },
    });
    s.addText(t.tier, {
      x, y: y + 0.2, w: 3, h: 0.4,
      fontFace: F.head, fontSize: 16, bold: true, color: t.hex, align: 'center',
    });
    s.addText(t.pts, {
      x, y: y + 0.75, w: 3, h: 1.5,
      fontFace: F.head, fontSize: 78, bold: true, color: t.hex, align: 'center',
    });
    s.addText('PTS', {
      x, y: y + 2.3, w: 3, h: 0.3,
      fontFace: F.mono, fontSize: 10, color: C.textDim, align: 'center', charSpacing: 3,
    });
    s.addText(t.colors, {
      x, y: y + 2.85, w: 3, h: 0.5,
      fontSize: 22, align: 'center',
    });
    s.addText(t.desc, {
      x: x + 0.15, y: y + 3.5, w: 2.7, h: 0.7,
      fontFace: F.body, fontSize: 12, color: C.white, align: 'center',
    });
  });

  brandTag(s); pageNum(s, 5, 13);
}

/* =============================================================
   Slide 6 — 빛나는 뽁뽁이 (Shimmer)
============================================================= */
{
  const s = pptx.addSlide();
  fillBg(s, C.bg);
  corner(s);
  s.addText('SPECIAL #1 — SHIMMER', {
    x: 0.6, y: 0.4, w: 9, h: 0.45,
    fontFace: F.mono, fontSize: 11, color: C.cyan, charSpacing: 4,
  });
  s.addText('빛나는 뽁뽁이 ✦', {
    x: 0.6, y: 0.95, w: 10, h: 0.7,
    fontFace: F.head, fontSize: 38, bold: true, color: C.white,
  });

  /* Visual representation: rainbow circle */
  s.addShape('ellipse', {
    x: 1.2, y: 2.5, w: 3.5, h: 3.5,
    fill: {
      type: 'solid', color: 'FF1493',
    },
    line: { color: 'FFFFFF', width: 3 },
    glow: { size: 20, color: 'FF1493', opacity: 0.6 },
  });
  s.addText('✦', {
    x: 1.2, y: 2.5, w: 3.5, h: 3.5,
    fontSize: 110, color: C.white, align: 'center', valign: 'middle', bold: true,
  });

  /* Description right side */
  const rx = 5.5;
  s.addText('무지개색으로 회전하며 ✦ 별 무늬', {
    x: rx, y: 2.5, w: 7.5, h: 0.5,
    fontFace: F.body, fontSize: 16, italic: true, color: C.gold,
  });
  s.addText('ROW / COLUMN BLAST', {
    x: rx, y: 3.1, w: 7.5, h: 0.5,
    fontFace: F.head, fontSize: 24, bold: true, color: C.cyan,
  });
  const detail = [
    '• 터트리면 가로 또는 세로 한 줄 전체가 연쇄 폭발',
    '• 가로/세로 중 남은 뽁뽁이가 더 많은 쪽 자동 선택',
    '• 줄에 있는 모든 색의 점수를 합산해서 획득',
    '• 매직 차임 사운드 + 흰빛 빔 sweep 효과',
    '• 한 게임당 최대 6개 (L3+ 단계적으로 max 증가)',
    '• L5+ 등장 확률 +10% 추가 보너스',
  ];
  s.addText(detail.join('\n'), {
    x: rx, y: 3.85, w: 7.5, h: 3.0,
    fontFace: F.body, fontSize: 14, color: C.white, paraSpaceAfter: 6,
  });

  brandTag(s); pageNum(s, 6, 13);
}

/* =============================================================
   Slide 7 — 폭탄 / 불꽃 (멀티 전용)
============================================================= */
{
  const s = pptx.addSlide();
  fillBg(s, C.bg);
  corner(s);
  s.addText('SPECIAL #2 — BOMB & FIRE (MULTI ONLY)', {
    x: 0.6, y: 0.4, w: 12, h: 0.45,
    fontFace: F.mono, fontSize: 11, color: C.cyan, charSpacing: 4,
  });
  s.addText('폭탄 💣  ·  불꽃 🔥', {
    x: 0.6, y: 0.95, w: 10, h: 0.7,
    fontFace: F.head, fontSize: 38, bold: true, color: C.white,
  });

  /* Bomb card */
  const xB = 0.6, yT = 1.95, hT = 5.1;
  s.addShape('roundRect', {
    x: xB, y: yT, w: 6.05, h: hT, rectRadius: 0.1,
    fill: { color: C.card }, line: { color: C.orange, width: 2 },
  });
  s.addShape('ellipse', {
    x: xB + 0.4, y: yT + 0.4, w: 1.5, h: 1.5,
    fill: { color: 'FF7F00' },
    line: { color: 'FFD700', width: 2 },
    glow: { size: 14, color: 'FF7F00', opacity: 0.7 },
  });
  s.addText('💣', { x: xB + 0.4, y: yT + 0.4, w: 1.5, h: 1.5, fontSize: 42, align: 'center', valign: 'middle' });

  s.addText('BOMB · 폭탄 뽁뽁이', {
    x: xB + 2.1, y: yT + 0.5, w: 4, h: 0.5,
    fontFace: F.head, fontSize: 22, bold: true, color: C.orange,
  });
  s.addText('부풀어 오르는 펄스 애니메이션', {
    x: xB + 2.1, y: yT + 1.0, w: 4, h: 0.4,
    fontFace: F.mono, fontSize: 11, italic: true, color: C.gold,
  });
  const bombDetail = [
    '터트리면 → 화면의 랜덤 10개 뽁뽁이 폭발',
    'BOOM 사운드 + 화면 흔들림 애니메이션',
    '+20점 보너스 + 폭발한 모든 뽁뽁이 점수 합산',
    '한 게임당 2~5번 등장 (확정 스케줄링)',
  ];
  bombDetail.forEach((d, i) => {
    s.addText(`• ${d}`, {
      x: xB + 0.4, y: yT + 2.3 + i * 0.6, w: 5.4, h: 0.5,
      fontFace: F.body, fontSize: 13, color: C.white,
    });
  });

  /* Fire card */
  const xF = 6.95;
  s.addShape('roundRect', {
    x: xF, y: yT, w: 6.05, h: hT, rectRadius: 0.1,
    fill: { color: C.card }, line: { color: 'FF3030', width: 2 },
  });
  s.addShape('ellipse', {
    x: xF + 0.4, y: yT + 0.4, w: 1.5, h: 1.5,
    fill: { color: 'FF4500' },
    line: { color: 'FFEE00', width: 2 },
    glow: { size: 18, color: 'FF8800', opacity: 0.85 },
  });
  s.addText('🔥', { x: xF + 0.4, y: yT + 0.4, w: 1.5, h: 1.5, fontSize: 42, align: 'center', valign: 'middle' });

  s.addText('FIRE · 불꽃 뽁뽁이', {
    x: xF + 2.1, y: yT + 0.5, w: 4, h: 0.5,
    fontFace: F.head, fontSize: 22, bold: true, color: 'FF6030',
  });
  s.addText('스파크 회전 + 8개 불똥 + 떨림', {
    x: xF + 2.1, y: yT + 1.0, w: 4, h: 0.4,
    fontFace: F.mono, fontSize: 11, italic: true, color: C.gold,
  });
  const fireDetail = [
    '터트리면 → 가장자리 한 바퀴 전체 폭발',
    '바깥 비어있으면 안쪽 ring으로 → 자동 탐색',
    '14개 불똥 파티클 + WHOOSH 사운드',
    '+25점 보너스, 한 게임당 단 1번만 등장',
  ];
  fireDetail.forEach((d, i) => {
    s.addText(`• ${d}`, {
      x: xF + 0.4, y: yT + 2.3 + i * 0.6, w: 5.4, h: 0.5,
      fontFace: F.body, fontSize: 13, color: C.white,
    });
  });

  brandTag(s); pageNum(s, 7, 13);
}

/* =============================================================
   Slide 8 — SOLO 레벨 곡선
============================================================= */
{
  const s = pptx.addSlide();
  fillBg(s, C.bg);
  corner(s);
  s.addText('SOLO PROGRESSION', {
    x: 0.6, y: 0.4, w: 8, h: 0.45,
    fontFace: F.mono, fontSize: 11, color: C.cyan, charSpacing: 4,
  });
  s.addText('10 레벨 — 점진적 난이도 곡선', {
    x: 0.6, y: 0.95, w: 12, h: 0.7,
    fontFace: F.head, fontSize: 36, bold: true, color: C.white,
  });

  /* Bar chart of targets */
  pptx.defineSlideMaster({
    title: 'noop',
  });
  const targets = [850, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000];
  s.addChart(pptx.charts.BAR, [
    {
      name: '목표 점수',
      labels: targets.map((_, i) => `LV ${i + 1}`),
      values: targets,
    },
  ], {
    x: 0.6, y: 1.95, w: 7.5, h: 5.0,
    barDir: 'bar',
    chartColors: [C.cyan],
    showValue: true,
    dataLabelFontSize: 10,
    dataLabelFontFace: F.mono,
    dataLabelColor: C.white,
    catAxisLabelColor: C.white,
    catAxisLabelFontFace: F.mono,
    catAxisLabelFontSize: 11,
    valAxisLabelColor: C.textDim,
    valAxisLabelFontFace: F.mono,
    valAxisLabelFontSize: 9,
    showLegend: false,
    plotArea: { fill: { color: C.bgAlt } },
    chartArea: { fill: { color: C.bg } },
  });

  /* Right col: progression rules */
  const rx = 8.5;
  const rules = [
    { t: 'STEP', d: '레벨업마다 +250점 (L3는 1250)' },
    { t: 'COLOR', d: '컬러 뽁뽁이 등장량 1.0x → 2.8x' },
    { t: 'BOMB / FIRE', d: 'L3+ 등장. L4+ 갯수 보너스' },
    { t: 'RESPAWN', d: 'L4 1.3x → L5+ 6x/level → L10 37x' },
    { t: 'SHIMMER', d: 'L3+ 확률 단계적 ↑, L5+ 추가 +10%' },
    { t: 'FAIL', d: '같은 레벨 자동 재시도 (10초) + REPLAY' },
  ];
  rules.forEach((r, i) => {
    const y = 2.05 + i * 0.78;
    s.addShape('rect', {
      x: rx, y, w: 4.5, h: 0.7,
      fill: { color: C.card }, line: { color: C.line, width: 0 },
    });
    s.addShape('rect', {
      x: rx, y, w: 0.08, h: 0.7, fill: { color: C.pink }, line: { color: C.pink },
    });
    s.addText(r.t, {
      x: rx + 0.2, y: y + 0.04, w: 1.5, h: 0.3,
      fontFace: F.mono, fontSize: 10, bold: true, color: C.pink, charSpacing: 2,
    });
    s.addText(r.d, {
      x: rx + 0.2, y: y + 0.32, w: 4.2, h: 0.36,
      fontFace: F.body, fontSize: 12, color: C.white,
    });
  });

  brandTag(s); pageNum(s, 8, 13);
}

/* =============================================================
   Slide 9 — 사회적 기능 (Leaderboard + Reviews)
============================================================= */
{
  const s = pptx.addSlide();
  fillBg(s, C.bg);
  corner(s);
  s.addText('SOCIAL', {
    x: 0.6, y: 0.4, w: 8, h: 0.45,
    fontFace: F.mono, fontSize: 11, color: C.cyan, charSpacing: 4,
  });
  s.addText('SOLO TOP 5 · 후기', {
    x: 0.6, y: 0.95, w: 12, h: 0.7,
    fontFace: F.head, fontSize: 38, bold: true, color: C.white,
  });
  s.addText('단순 1회성 게임이 아닌 — 누적되는 기록과 커뮤니티', {
    x: 0.6, y: 1.7, w: 12, h: 0.4,
    fontFace: F.body, fontSize: 15, italic: true, color: C.textDim,
  });

  /* Leaderboard card */
  const yC = 2.4, hC = 4.5;
  s.addShape('roundRect', {
    x: 0.6, y: yC, w: 6.05, h: hC, rectRadius: 0.1,
    fill: { color: C.card }, line: { color: C.gold, width: 2 },
  });
  s.addText('🏆 SOLO TOP 5', {
    x: 0.6, y: yC + 0.2, w: 6.05, h: 0.5,
    fontFace: F.head, fontSize: 22, bold: true, color: C.gold, align: 'center',
  });
  const leaderFeatures = [
    { h: '닉네임당 최고 기록만', d: '레벨 우선 → 동률 시 점수' },
    { h: '5명 표시 + 자동 갱신', d: '게임 종료 시 모두에게 broadcast' },
    { h: '영구 저장', d: 'Upstash Redis (무료 티어)' },
    { h: '메달 표시', d: '🥇 🥈 🥉 + LV / 점수 표기' },
  ];
  leaderFeatures.forEach((f, i) => {
    const y = yC + 0.95 + i * 0.85;
    s.addText(`◆ ${f.h}`, {
      x: 0.85, y, w: 5.5, h: 0.35,
      fontFace: F.head, fontSize: 14, bold: true, color: C.gold,
    });
    s.addText(f.d, {
      x: 1.1, y: y + 0.35, w: 5.2, h: 0.35,
      fontFace: F.body, fontSize: 12, color: C.white,
    });
  });

  /* Reviews card */
  s.addShape('roundRect', {
    x: 6.95, y: yC, w: 6.05, h: hC, rectRadius: 0.1,
    fill: { color: C.card }, line: { color: C.pink, width: 2 },
  });
  s.addText('✎ REVIEWS', {
    x: 6.95, y: yC + 0.2, w: 6.05, h: 0.5,
    fontFace: F.head, fontSize: 22, bold: true, color: C.pink, align: 'center',
  });
  const reviewFeatures = [
    { h: '닉네임 + 후기 입력', d: '메인 닉네임 자동 동기화' },
    { h: '실시간 broadcast', d: '제출 즉시 모든 클라이언트 반영' },
    { h: '5개 표시 + 더보기', d: '클릭 시 펼침 + 세로 스크롤' },
    { h: '최대 200개 보관', d: 'Upstash Redis 영구 저장' },
  ];
  reviewFeatures.forEach((f, i) => {
    const y = yC + 0.95 + i * 0.85;
    s.addText(`◆ ${f.h}`, {
      x: 7.2, y, w: 5.5, h: 0.35,
      fontFace: F.head, fontSize: 14, bold: true, color: C.pink,
    });
    s.addText(f.d, {
      x: 7.45, y: y + 0.35, w: 5.2, h: 0.35,
      fontFace: F.body, fontSize: 12, color: C.white,
    });
  });

  brandTag(s); pageNum(s, 9, 13);
}

/* =============================================================
   Slide 10 — 비주얼 디자인
============================================================= */
{
  const s = pptx.addSlide();
  fillBg(s, C.bg);
  corner(s);
  s.addText('VISUAL DESIGN', {
    x: 0.6, y: 0.4, w: 8, h: 0.45,
    fontFace: F.mono, fontSize: 11, color: C.cyan, charSpacing: 4,
  });
  s.addText('레트로 네온 + 픽셀 아케이드', {
    x: 0.6, y: 0.95, w: 12, h: 0.7,
    fontFace: F.head, fontSize: 36, bold: true, color: C.white,
  });

  /* Color swatches row */
  const swY = 2.0;
  const swatches = [
    { c: C.cyan, n: 'NEON CYAN', code: '#00F5C4' },
    { c: C.pink, n: 'HOT PINK',  code: '#FF1493' },
    { c: C.gold, n: 'GOLD',      code: '#FFD700' },
    { c: C.green, n: 'NEON LIME', code: '#4DFF88' },
    { c: C.orange,n: 'ORANGE',    code: '#FF8800' },
    { c: 'B266FF', n: 'VIOLET',   code: '#B266FF' },
  ];
  swatches.forEach((sw, i) => {
    const x = 0.6 + i * 2.1;
    s.addShape('rect', {
      x, y: swY, w: 1.85, h: 1.0,
      fill: { color: sw.c }, line: { color: 'FFFFFF', transparency: 100 },
    });
    s.addText(sw.n, {
      x, y: swY + 1.1, w: 1.85, h: 0.3,
      fontFace: F.head, fontSize: 10, bold: true, color: C.white, align: 'center',
    });
    s.addText(sw.code, {
      x, y: swY + 1.4, w: 1.85, h: 0.3,
      fontFace: F.mono, fontSize: 9, color: C.textDim, align: 'center',
    });
  });

  /* Game screenshot */
  s.addImage({
    path: img('04-game-popping.png'),
    x: 0.6, y: 4.0, w: 7.0, h: 3.2,
    sizing: { type: 'contain', w: 7.0, h: 3.2 },
  });
  s.addShape('rect', {
    x: 0.6, y: 4.0, w: 7.0, h: 3.2,
    line: { color: C.cyan, width: 1 }, fill: { color: 'FFFFFF', transparency: 100 },
  });

  /* Right side: design principles */
  const rx = 8.1;
  const principles = [
    { t: '3D 입체 버블', d: '레디얼 그라데이션 + 다층 박스섀도우' },
    { t: '네온 글로우', d: '스페셜 색상마다 외부 글로우 + 펄스 애니메이션' },
    { t: '픽셀 폰트', d: 'Press Start 2P — 타이틀/HUD' },
    { t: '터지는 잔재', d: '터진 자리에 X자 크랙 흔적 잔존' },
    { t: '플레이어 색', d: 'P1 시안 / P2 핫핑크 / P3 그린 / P4 오렌지' },
  ];
  principles.forEach((p, i) => {
    const y = 4.05 + i * 0.62;
    s.addText('▸', {
      x: rx, y, w: 0.3, h: 0.3,
      fontFace: F.head, fontSize: 14, bold: true, color: C.cyan,
    });
    s.addText(p.t, {
      x: rx + 0.3, y, w: 4.5, h: 0.3,
      fontFace: F.head, fontSize: 13, bold: true, color: C.cyan,
    });
    s.addText(p.d, {
      x: rx + 0.3, y: y + 0.28, w: 4.5, h: 0.32,
      fontFace: F.body, fontSize: 11, color: C.white,
    });
  });

  brandTag(s); pageNum(s, 10, 13);
}

/* =============================================================
   Slide 11 — 기술 스택
============================================================= */
{
  const s = pptx.addSlide();
  fillBg(s, C.bg);
  corner(s);
  s.addText('TECH STACK', {
    x: 0.6, y: 0.4, w: 8, h: 0.45,
    fontFace: F.mono, fontSize: 11, color: C.cyan, charSpacing: 4,
  });
  s.addText('기술 스택', {
    x: 0.6, y: 0.95, w: 8, h: 0.7,
    fontFace: F.head, fontSize: 38, bold: true, color: C.white,
  });

  const layers = [
    {
      title: 'FRONTEND',
      color: C.cyan,
      items: [
        ['HTML5 + CSS3', 'CSS Grid / Flexbox / aspect-ratio 동그라미'],
        ['Vanilla JavaScript', 'No framework — 빠른 응답성 우선'],
        ['Web Audio API', '오실레이터 합성 (pop / chime / boom / whoosh)'],
        ['CSS Animations', '@keyframes — 펄스, 플리커, 스파크, 흔들림'],
      ],
    },
    {
      title: 'BACKEND',
      color: C.pink,
      items: [
        ['Node.js + Express', 'HTTP 서버 + 정적 파일 서빙'],
        ['Socket.IO', '실시간 양방향 통신 (방, 게임 상태, 채팅)'],
        ['Upstash Redis', '리더보드/리뷰 영구 저장 (REST API)'],
        ['파일 fallback', 'Upstash 실패 시 디스크 fallback'],
      ],
    },
    {
      title: 'DEPLOY',
      color: C.gold,
      items: [
        ['Render.com', '무료 플랜 자동 배포 (GitHub 연동)'],
        ['GitHub', '버전관리 + Auto Deploy 트리거'],
        ['HTTPS / WSS', 'Render 기본 TLS 종료'],
        ['Mobile-first', 'iOS Safari safe-area / 100dvh 대응'],
      ],
    },
  ];

  layers.forEach((L, i) => {
    const x = 0.6 + i * 4.2;
    const y = 2.0;
    s.addShape('roundRect', {
      x, y, w: 4.0, h: 4.85, rectRadius: 0.1,
      fill: { color: C.card }, line: { color: L.color, width: 2 },
    });
    s.addText(L.title, {
      x, y: y + 0.2, w: 4.0, h: 0.5,
      fontFace: F.head, fontSize: 18, bold: true, color: L.color, align: 'center', charSpacing: 3,
    });
    L.items.forEach((it, j) => {
      const yy = y + 0.95 + j * 0.95;
      s.addText(it[0], {
        x: x + 0.3, y: yy, w: 3.5, h: 0.35,
        fontFace: F.head, fontSize: 13, bold: true, color: C.white,
      });
      s.addText(it[1], {
        x: x + 0.3, y: yy + 0.32, w: 3.5, h: 0.55,
        fontFace: F.body, fontSize: 11, color: C.textDim,
      });
    });
  });

  brandTag(s); pageNum(s, 11, 13);
}

/* =============================================================
   Slide 12 — 모바일 대응
============================================================= */
{
  const s = pptx.addSlide();
  fillBg(s, C.bg);
  corner(s);
  s.addText('MOBILE OPTIMIZATION', {
    x: 0.6, y: 0.4, w: 8, h: 0.45,
    fontFace: F.mono, fontSize: 11, color: C.cyan, charSpacing: 4,
  });
  s.addText('iOS / Android 디테일', {
    x: 0.6, y: 0.95, w: 12, h: 0.7,
    fontFace: F.head, fontSize: 38, bold: true, color: C.white,
  });

  const challenges = [
    {
      title: 'iOS Safari 100vh 이슈',
      problem: '주소창 상태에 따라 vh가 변동 → 화면 잘림',
      fix: '100dvh + viewport-fit=cover + safe-area-inset 패딩',
    },
    {
      title: '노치/홈 인디케이터',
      problem: '컨텐츠가 노치 영역과 홈바 아래로 밀려 가려짐',
      fix: 'env(safe-area-inset-top/bottom) 적용',
    },
    {
      title: '오디오 잠금',
      problem: 'iOS는 첫 사용자 제스처 전엔 Web Audio 음소거',
      fix: '첫 터치/클릭에 silent buffer 재생으로 unlock',
    },
    {
      title: '동그란 버블 유지',
      problem: '화면 비율 차이로 셀이 비대칭 → 타원 발생',
      fix: '뷰포트별 cols/rows 동적 산출 + aspect-ratio:1',
    },
  ];
  challenges.forEach((ch, i) => {
    const r = i % 2, c = Math.floor(i / 2);
    const x = 0.6 + c * 6.4;
    const y = 2.0 + r * 2.55;
    s.addShape('roundRect', {
      x, y, w: 6.0, h: 2.35, rectRadius: 0.08,
      fill: { color: C.card }, line: { color: C.cyan, width: 1 },
    });
    s.addText(ch.title, {
      x: x + 0.3, y: y + 0.2, w: 5.5, h: 0.5,
      fontFace: F.head, fontSize: 17, bold: true, color: C.cyan,
    });
    s.addText('PROBLEM', {
      x: x + 0.3, y: y + 0.75, w: 5, h: 0.3,
      fontFace: F.mono, fontSize: 9, color: 'FF6080', charSpacing: 2,
    });
    s.addText(ch.problem, {
      x: x + 0.3, y: y + 1.0, w: 5.5, h: 0.45,
      fontFace: F.body, fontSize: 12, color: C.white,
    });
    s.addText('FIX', {
      x: x + 0.3, y: y + 1.45, w: 5, h: 0.3,
      fontFace: F.mono, fontSize: 9, color: C.cyan, charSpacing: 2,
    });
    s.addText(ch.fix, {
      x: x + 0.3, y: y + 1.7, w: 5.5, h: 0.5,
      fontFace: F.body, fontSize: 12, color: C.green,
    });
  });

  brandTag(s); pageNum(s, 12, 13);
}

/* =============================================================
   Slide 13 — End / Closing
============================================================= */
{
  const s = pptx.addSlide();
  fillBg(s, C.bg);
  /* deco */
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    const sz = 0.04 + Math.random() * 0.05;
    s.addShape('ellipse', {
      x, y, w: sz, h: sz,
      fill: { color: i % 2 === 0 ? C.cyan : C.pink },
      line: { color: 'FFFFFF', transparency: 100 },
    });
  }
  s.addText('THANK YOU', {
    x: 0, y: 2.4, w: W, h: 1.2,
    align: 'center', fontFace: F.head, fontSize: 88, bold: true, color: C.cyan,
    glow: { size: 14, color: C.cyan, opacity: 0.5 },
  });
  s.addText('Live Demo · https://pok-pok-yi.onrender.com', {
    x: 0, y: 4.0, w: W, h: 0.5,
    align: 'center', fontFace: F.mono, fontSize: 18, color: C.pink,
  });
  s.addText('GitHub · https://github.com/ljoohyun93/pok-pok-yi', {
    x: 0, y: 4.5, w: W, h: 0.5,
    align: 'center', fontFace: F.mono, fontSize: 14, color: C.textDim,
  });
  s.addText('— Joohyun Lee —', {
    x: 0, y: 6.4, w: W, h: 0.4,
    align: 'center', fontFace: F.head, fontSize: 18, color: C.gold, italic: true,
  });
}

/* =============================================================
   Save
============================================================= */
pptx.writeFile({ fileName: path.join(ASSETS, '..', 'POK_POK_YI_GameDesign.pptx') })
  .then(fn => console.log('Wrote:', fn));
