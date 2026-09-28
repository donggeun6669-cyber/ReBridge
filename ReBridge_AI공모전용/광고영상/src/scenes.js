// ───────────────────────────────────────────────────────────────
// 검고담임 광고 — 장면 6개 (2026-09-28 서연 UI 판)
//   1 문제 제시 → 2 검고담임 등장 → 3 대입 네 걸음(폰 밖 공간) → 4 대학·전형 찾기
//   → 5 서류와 도움(제출서류 → 꿈드림: 지원 받기 · 센터와 쪽지 · 커뮤니티) → 6 브랜드 마무리
//
// 규칙
//   · 폰 안에 보이는 화면은 전부 실제 앱을 찍은 것(assets/screens). 지어낸 화면은 없다.
//   · 폰 밖으로 꺼내는 조각도 같은 사진에서 잘라낸 것이라 내용이 앱과 같다.
//   · 네 걸음 공간(장면 3)만 광고용 연출이다. 단계 이름·설명은 앱 홈의 네 걸음과 같다.
//   · 커뮤니티 글은 앱의 시연용 예시 글이라 '시연용 예시 글' 표시를 단다.
//   · 쪽지는 시연 기능(실제 센터로 가지 않음)이고 문장은 예시라 '쪽지는 시연 기능 · 예시 문장' 표시를 단다. 보내는 장면은 없다.
//   · 장면 안의 시간은 '원래 길이(NOM)' 기준으로 적었다. config의 start/end를 바꾸면 비례해서 늘고 준다.
//   · 큰 움직임의 시각은 예전 판(2026-09-20)과 같게 두어 소리(audio-cues.json)와 맞는다.
// ───────────────────────────────────────────────────────────────
(function () {
  'use strict';
  const { clamp, lerp, E, prog, K, el, sv, show, tf } = window.ADK;
  const C = window.AD_CONFIG;
  const SC = window.AD_SCREENS;

  const NOM = { problem: 6, intro: 6, roadmap: 11, score: 11, prepare: 9, brand: 7 };
  const SCN = {};
  C.scenes.forEach((s) => { SCN[s.id] = s; });
  const T = (id, l) => SCN[id].start + (l * (SCN[id].end - SCN[id].start)) / NOM[id];
  const DURATION = C.scenes[C.scenes.length - 1].end;

  // ── 앱 화면 ──
  const TALL = { listTall: 1400, detailTall: 1400 };
  const scrH = (n) => TALL[n] || 800;
  const R = (n, k) => SC[n].rects[k];
  const SRC = (n) => SC[n].src;
  const center = (r) => [r[0] + r[2] / 2, r[1] + r[3] / 2];

  // ── 선 아이콘 (앱과 같은 lucide-react 0.468 모양, ISC) ──
  const ICONS = {
    clipboard: [['rect', { width: 8, height: 4, x: 8, y: 2, rx: 1, ry: 1 }], ['path', { d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' }], ['path', { d: 'm9 14 2 2 4-4' }]],
    search: [['circle', { cx: 11, cy: 11, r: 8 }], ['path', { d: 'm21 21-4.3-4.3' }]],
    file: [['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }], ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }], ['path', { d: 'M10 9H8' }], ['path', { d: 'M16 13H8' }], ['path', { d: 'M16 17H8' }]],
    flag: [['path', { d: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' }], ['line', { x1: 4, x2: 4, y1: 22, y2: 15 }]],
    mapPin: [['path', { d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0' }], ['circle', { cx: 12, cy: 10, r: 3 }]],
    message: [['path', { d: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z' }]],
    users: [['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }], ['circle', { cx: 9, cy: 7, r: 4 }], ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }], ['path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }]],
  };
  function icon(parent, name, size, sw = 1.9) {
    const s = sv('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
    ICONS[name].forEach(([tag, a]) => sv(tag, a, s));
    return s;
  }
  // 색 섞기 (#rrggbb)
  const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mixC = (a, b, u) => { const A = hx(a), B = hx(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], u))).join(',')})`; };

  // ── 네 걸음 공간의 길 — 폰 중심이 원점, 폰 배율 PS ──
  const PS = 0.9;
  const bxy = (x, y) => [(x - 195) * PS, (y - 378) * PS];          // 앱 좌표 → 공간 좌표
  const DOTS = [0, 1, 2, 3].map((k) => center(R('home', 'seg' + k))); // 홈 화면 네 걸음 막대의 가운데
  const SEG_W = R('home', 'seg0')[2], SEG_H = R('home', 'seg0')[3];
  const DOTB = DOTS.map(([x, y]) => bxy(x, y));
  const LAB_DY = R('home', 'lab0')[1] - DOTS[0][1];                   // 막대 가운데 → 이름 윗변
  const LABEL_Y = R('home', 'lab0')[1] + R('home', 'lab0')[3] / 2;    // 이름 글자 가운데
  const P0 = DOTB[0];
  const XT = 480, RAD = 320;                                          // 폰 밖으로 나가 꺾이는 곳
  const L1 = XT - P0[0];
  const ARC = (RAD * Math.PI) / 2;
  const LEG = L1 + ARC;
  function P(s) { // 길 위 거리 s → 좌표
    if (s <= L1) return [P0[0] + s, P0[1]];
    if (s <= LEG) { const a = Math.PI / 2 - (s - L1) / RAD; return [XT + RAD * Math.cos(a), P0[1] - RAD + RAD * Math.sin(a)]; }
    return [XT + RAD, P0[1] - RAD - (s - LEG)];
  }
  const GAP = 640;
  const SS = [0, 1, 2, 3].map((k) => LEG + 140 + k * GAP);            // 정거장 위치
  const S0 = DOTB.map((d) => d[0] - P0[0]);                            // 폰 안 위치
  const LTOT = SS[3] + 1100;
  const FOOT = SS.map((s) => { const p = P(s); return [p[0], p[1] - 44]; }); // 카드가 서는 자리(점 조금 뒤)
  const BILL_W = 360, BILL_H = 262;
  // 점의 색: [막대일 때, 점일 때] — 막대 색은 앱 .sy-a-bar 와 같다
  const DOT_C = {
    done: ['#F8BCA2', '#315E59'],
    current: ['#F8BCA2', '#F7B89C'],
    next: ['#E6E1DD', '#FFFFFF'],
  };

  // 카메라 [목표 x, 목표 y, 확대, 기울기(도)] — 장면 2~3
  const HAND_Z = 1.7;
  const TRAVEL = T('roadmap', 4.6);
  const SINE = E.inOutSine;
  const CAM_IN = {
    x: [[T('intro', 4.5), -300], [T('roadmap', 1.5), 0], [TRAVEL, FOOT[0][0] - 250, SINE]],
    y: [[T('intro', 4.5), 0], [T('roadmap', 1.5), P0[1]], [TRAVEL, FOOT[0][1] + 150, SINE]],
    z: [[T('intro', 4.5), 1], [T('roadmap', 1.5), 2.4], [T('roadmap', 4.5), 1.05, SINE]],
    tilt: [[T('roadmap', 1.6), 0], [T('roadmap', 4.4), 56, SINE]],
  };
  const CAMK = [
    [TRAVEL, [FOOT[0][0] - 250, FOOT[0][1] + 150, 1.05, 56]],
    [T('roadmap', 8.2), [FOOT[3][0] - 250, FOOT[3][1] + 150, 1.05, 56], E.inOutSine],
    [T('roadmap', 9.5), [FOOT[1][0] - 470, (FOOT[0][1] + FOOT[3][1]) / 2 + 330, 0.6, 40]],
    [T('roadmap', 11), [FOOT[1][0], FOOT[1][1], HAND_Z, 50]],
  ];
  const cam3 = (t) => (t < TRAVEL
    ? [K(t, CAM_IN.x), K(t, CAM_IN.y), K(t, CAM_IN.z), K(t, CAM_IN.tilt)]
    : K(t, CAMK));
  const b2s = (bx, by, c) => [960 + (bx - c[0]) * c[2], 540 + (by - c[1]) * c[2]];
  const riseA = (t) => K(t, [[T('intro', 0), 1150], [T('intro', 1.5), 0, E.outQuint]]);
  const phoneAStage = (x, y, t) => { const c = cam3(t); const [bx, by] = bxy(x, y); return b2s(bx, by + riseA(t), c); };

  // ── 장면 4~6 의 폰 (평면) ──
  const P2 = (t) => K(t, [[T('brand', 0), [620, 540, 0.9]], [T('brand', 1.1), [430, 560, 0.72]]]);
  const IDC = [960, 540, 960, 540, 1];
  // 조건 필터를 크게 — '지역 전체 → 서울'과 '조건에 맞는 대학 N곳'이 같이 보이게
  const GRID_C = [620, 540 + (330 - 378) * 0.9];
  const CAMF = [
    [T('score', 0.9), IDC],
    [T('score', 1.55), [GRID_C[0], GRID_C[1], 760, 560, 1.5]],
    [T('score', 2.3), [GRID_C[0], GRID_C[1], 760, 560, 1.5]],
    [T('score', 2.95), IDC],
  ];
  const camF = (t) => K(t, CAMF);
  const f2s = (x, y, c) => [(x - c[0]) * c[4] + c[2], (y - c[1]) * c[4] + c[3]];
  const a2f = (x, y, p) => [p[0] + (x - 195) * p[2], p[1] + (y - 378) * p[2]];
  const appToStage = (x, y, t) => { const [fx, fy] = a2f(x, y, P2(t)); return f2s(fx, fy, camF(t)); };

  // 폰 안 화면 넘김 (push = 오른쪽에서 들어옴, back = 왼쪽에서, fade = 제자리 바뀜 · 탭 바꿈)
  const NAV = [
    { t: T('score', 0), n: 'explore0', type: 'cut' },
    { t: T('score', 1.9), n: 'explore1', type: 'fade', d: 0.25 },
    { t: T('score', 3.1), n: 'listTall', type: 'push' },
    { t: T('score', 6.3), n: 'detailTall', type: 'push' },
    { t: T('score', 10.75), n: 'docs0', type: 'push' },
    { t: T('prepare', 1.2), n: 'docs1', type: 'fade', d: 0.2 },
    { t: T('prepare', 1.9), n: 'docs2', type: 'fade', d: 0.2 },
    { t: T('prepare', 3.3), n: 'centers', type: 'fade', d: 0.3 },
    { t: T('prepare', 5.35), n: 'thread0', type: 'push' },
    { t: T('prepare', 5.8), n: 'thread1', type: 'fade', d: 0.3 },
    { t: T('prepare', 7.45), n: 'community', type: 'fade', d: 0.35 },
    { t: T('brand', 0.05), n: 'home', type: 'fade', d: 0.35 },
  ];
  const SCROLL = {
    detailTall: (t) => -250 * prog(t, T('score', 7.2), T('score', 7.7)),
  };
  const scrollOf = (n, t) => (SCROLL[n] ? SCROLL[n](t) : 0);

  const $ = {};
  const HOME_PARTS = [[0, 0, 390, 60], [0, 60, 390, 90], [12, 150, 366, 244], [0, 394, 390, 406]];
  const QUICK = 1; // 홈 조각 중 '대학찾기'가 있는 줄

  // ═════════════════════════ 만들기 ═════════════════════════
  function phone(parent) {
    const root = el('div', 'phone', parent);
    el('div', 'ph-body', root);
    const screen = el('div', 'ph-screen', root);
    const app = el('div', 'ph-app', screen);
    statusBar(screen);
    return { root, screen, app };
  }
  function statusBar(parent) {
    const s = el('div', 'ph-status', parent);
    el('span', 'ph-time', s, '10:00');
    el('span', 'ph-island', s);
    const ic = el('span', 'ph-icons', s);
    const g = sv('svg', { width: 18, height: 12, viewBox: '0 0 18 12' }, ic);
    [[0, 8, 4], [5, 5.5, 6.5], [10, 3, 9], [15, 0, 12]].forEach(([x, y, h]) =>
      sv('rect', { x, y, width: 3, height: h, rx: 1, fill: '#252330' }, g));
    const b = sv('svg', { width: 27, height: 13, viewBox: '0 0 27 13' }, ic);
    sv('rect', { x: 0.5, y: 0.5, width: 23, height: 12, rx: 3.6, fill: 'none', stroke: '#252330', 'stroke-opacity': 0.4 }, b);
    sv('rect', { x: 2, y: 2, width: 18, height: 9, rx: 2.2, fill: '#252330' }, b);
    sv('path', { d: 'M25 4.6v3.8c.8-.3 1.3-1 1.3-1.9s-.5-1.6-1.3-1.9z', fill: '#252330', 'fill-opacity': 0.45 }, b);
    return s;
  }
  function layer(parent, n) {
    const d = el('div', 'scr', parent);
    d.style.backgroundImage = `url("${SRC(n)}")`;
    d.style.height = scrH(n) + 'px';
    // 긴 화면: 스크롤해도 위 제목줄은 제자리(앱의 sticky 와 같게)
    if (SCROLL[n]) {
      d.fix = crop(d, n, R(n, 'top'));
      d.fix.classList.add('fix');
    }
    return d;
  }
  // 앱 화면 사진에서 r=[x,y,w,h] 부분만 잘라 쓴다 (pad 만큼 둘레를 더)
  function crop(parent, n, r, pad = 0) {
    const [x, y, w, h] = r;
    const X = x - pad, Y = Math.max(0, y - pad), W = w + 2 * pad, H = h + (y - Y) + pad;
    const d = el('div', 'crop', parent);
    d.style.width = W + 'px';
    d.style.height = H + 'px';
    d.style.backgroundImage = `url("${SRC(n)}")`;
    d.style.backgroundSize = `390px ${scrH(n)}px`;
    d.style.backgroundPosition = `${-X}px ${-Y}px`;
    d.r = [X, Y, W, H];
    d.n = n;
    return d;
  }
  const CHECK = (parent, size) => {
    const s = sv('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' }, parent);
    sv('path', { d: 'M20 6 9 17l-5-5', stroke: '#fff', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s);
    return s;
  };
  function billboard(parent, k) {
    const st = C.stations[k];
    const b = el('div', `bill is-${st.state}`, parent);
    const ic = el('div', 'bill-ico', b);
    icon(ic, st.icon, 44, 1.9);
    const title = el('div', 'bill-title', b);
    el('span', 'bill-no', title, String(k + 1));
    title.appendChild(document.createTextNode(st.title));
    el('div', 'bill-sub', b, st.sub);
    if (st.state === 'done') el('div', 'bill-chip', b, C.labels.done);
    if (st.state === 'current') el('div', 'bill-chip', b, C.labels.current);
    return b;
  }

  function build(stage) {
    const L = (cls) => el('div', 'layer ' + cls, stage);
    $.s1floor = L('s1-floor');
    $.floor3d = L('floor3d');
    $.glow = L('glow');
    $.view3d = L('view3d');
    $.cam = el('div', 'cam', $.view3d);
    buildBoard();
    $.fog = L('fog');
    $.flat = L('flat');
    $.flatcam = el('div', 'abs flatcam', $.flat);
    buildPhone2();
    $.morphL = L('morph-layer');
    buildMorph();
    $.lift = L('lift');
    buildPanels();
    $.cards = L('cards');
    buildCards();
    $.end = L('end');
    buildEnd();
    $.copyL = L('copy-layer');
    buildCopies();
    $.ui = L('ui');
    buildUi();
    $.fade = L('fadeout');
  }

  // 장면 2~3: 공간 속 폰 + 길 + 정거장
  function buildBoard() {
    const cam = $.cam;
    $.phA = phone(cam);
    $.homeParts = HOME_PARTS.map((r) => {
      const c = crop($.phA.app, 'home', r);
      c.style.left = r[0] + 'px'; c.style.top = r[1] + 'px';
      c.style.transformOrigin = '50% 50%';
      return c;
    });
    // 앱의 네 걸음 막대를 덮는 흰 조각 — 같은 모양의 복제본으로 바꿔 끼운다
    const br = R('home', 'bar');
    $.patch = el('div', 'patch', $.phA.app);
    Object.assign($.patch.style, { left: br[0] - 8 + 'px', top: br[1] - 6 + 'px', width: br[2] + 16 + 'px', height: br[3] + 10 + 'px' });

    // 길
    const svg = sv('svg', { width: 1700, height: 5200, viewBox: '-300 -5000 1700 5200', overflow: 'visible' }, cam);
    svg.style.left = '-300px'; svg.style.top = '-5000px';
    const defs = sv('defs', {}, svg);
    const lg = sv('linearGradient', { id: 'railGrad', gradientUnits: 'userSpaceOnUse', x1: 205, y1: 0, x2: 450, y2: 0 }, defs);
    sv('stop', { offset: 0, 'stop-color': '#000' }, lg);
    sv('stop', { offset: 1, 'stop-color': '#fff' }, lg);
    const mk = sv('mask', { id: 'railMask', maskUnits: 'userSpaceOnUse', x: -300, y: -5000, width: 1700, height: 5200 }, defs);
    sv('rect', { x: -300, y: -5000, width: 1700, height: 5200, fill: 'url(#railGrad)' }, mk);
    const d = `M ${P0[0]} ${P0[1]} L ${XT} ${P0[1]} A ${RAD} ${RAD} 0 0 0 ${XT + RAD} ${P0[1] - RAD} L ${XT + RAD} ${P0[1] - RAD - (LTOT - LEG)}`;
    const path = (attrs) => sv('path', Object.assign({ d, fill: 'none' }, attrs), svg);
    // 앱 막대 사이에는 선이 없으므로 길은 폰 밖에서부터 보이게(마스크) 한다
    $.railBand = path({ stroke: '#ECE7E0', 'stroke-width': 44, 'stroke-linecap': 'round', mask: 'url(#railMask)' });
    $.railCore = path({ stroke: '#E6E1DD', 'stroke-width': 2 * PS, mask: 'url(#railMask)' });
    $.railCore2 = path({ stroke: '#D6CEC5', 'stroke-width': 5, 'stroke-linecap': 'round', mask: 'url(#railMask)' });
    $.railProg = path({ stroke: '#315E59', 'stroke-width': 6 });
    $.railSvg = svg;

    $.bshadows = [0, 1, 2, 3].map(() => el('div', 'bshadow', cam));
    $.bdots = C.stations.map((s) => {
      const d0 = el('div', `bdot is-${s.state}`, cam);
      if (s.state === 'done') d0.chk = CHECK(d0, 13);
      return d0;
    });
    const STEP_LABELS = ['정보 준비', '대학 찾기', '원서 준비', '결과 확인']; // 앱 홈 .sy-a-bar 이름과 같다
    $.blabels = STEP_LABELS.map((txt, k) => el('div', `blabel is-${C.stations[k].state}`, cam, txt));
    $.bills = [0, 1, 2, 3].map((k) => billboard(cam, k));
  }

  // 장면 4~6: 평면 폰
  const P2_SCREENS = ['explore0', 'explore1', 'listTall', 'detailTall', 'docs0', 'docs1', 'docs2', 'centers', 'thread0', 'thread1', 'community', 'home'];
  function buildPhone2() {
    $.ph2 = phone($.flatcam);
    $.scr = {};
    P2_SCREENS.forEach((n) => { $.scr[n] = layer($.ph2.app, n); });
    // 긴 화면은 하단 탭을 숨기고 찍었다 → 앱처럼 폰 바닥에 하단 탭을 붙인다(대학 찾기는 홈에서 들어가서 '홈' 탭이 켜져 있다)
    $.tabfix = crop($.ph2.app, 'home', R('home', 'tabbar'));
    $.tabfix.classList.add('tabfix');
    $.dim = el('div', 'dim', $.ph2.app);
  }
  function buildMorph() {
    $.morph = el('div', 'morph', $.morphL);
    $.mBill = billboard($.morph, 1);
    $.mScreen = el('div', 'mscreen', $.morph);
    const app = el('div', 'ph-app', $.mScreen);
    layer(app, 'explore0');
    statusBar($.mScreen);
  }
  function panel(cropDefs) {
    const p = el('div', 'panel', $.lift);
    p.crops = cropDefs.map(([n, r, pad]) => crop(p, n, r, pad));
    return p;
  }
  function sticker(name) {
    const s = el('div', 'sticker', $.lift);
    icon(s, name, 56, 2);
    return s;
  }
  // 두 사각형을 합친 사각형
  const union = (a, b) => { const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]); return [x, y, Math.max(a[0] + a[2], b[0] + b[2]) - x, Math.max(a[1] + a[3], b[1] + b[3]) - y]; };
  function buildPanels() {
    // 대학 목록 머리 — '조건에 맞는 대학 N곳 · 가나다순' + 첫 줄
    $.pHead = panel([['listTall', union(R('listTall', 'note'), R('listTall', 'row')), 8]]);
    // 전형 목록 → (누르면) 그 전형의 제출서류 → 체크 두 개
    const admR = union(R('detailTall', 'adm0'), R('detailTall', 'adm2'));
    const docsR = union(R('docs0', 'hero'), R('docs0', 'list'));
    $.hero = panel([
      ['detailTall', [20, admR[1] - 2, 350, admR[3] + 4], 10], // 서류 조각과 너비를 같게(둘레 10)
      ['docs0', docsR, 10], ['docs1', docsR, 10], ['docs2', docsR, 10],
    ]);
    $.ring1 = el('div', 'ring', $.hero);
    $.ring2 = el('div', 'ring', $.hero);
    $.pDream = panel([['centers', R('centers', 'hero'), 10]]);
    $.pMsg = panel([['thread1', union(R('thread1', 'body'), R('thread1', 'note')), 10]]);
    $.pComm = panel([['community', R('community', 'card0'), 10]]);
    // 꿈드림으로 할 수 있는 세 가지 — 지원 받기 · 센터와 쪽지 · 커뮤니티
    $.stDream = sticker('mapPin'); $.fDream = el('div', 'feat', $.lift, '지원 받기');
    $.stMsg = sticker('message'); $.fMsg = el('div', 'feat', $.lift, '센터와 쪽지');
    $.stComm = sticker('users'); $.fComm = el('div', 'feat', $.lift, '커뮤니티');
  }

  // 장면 1: 흩어진 종이 카드
  const CARD_POS = [
    { x: 380, y: 262, r: -5, s: 1.0 },
    { x: 1545, y: 238, r: 4, s: 0.95 },
    { x: 452, y: 826, r: 3, s: 0.92 },
    { x: 1470, y: 842, r: -4, s: 1.0 },
  ];
  const SHEETS = [
    { x: 168, y: 560, r: -8, s: 0.82 },
    { x: 1770, y: 580, r: 7, s: 0.78 },
    { x: 960, y: 952, r: 2, s: 0.62 },
  ];
  function buildCards() {
    $.cshadows = [...CARD_POS, ...SHEETS].map(() => el('div', 'cshadow', $.cards));
    $.pcards = C.words.map((w) => el('div', 'pcard', $.cards, w.text));
    $.psheets = SHEETS.map(() => {
      const s = el('div', 'psheet', $.cards);
      for (let i = 0; i < 5; i++) el('i', null, s);
      return s;
    });
    // 같은 걸음으로 들어가는 카드가 둘이면 좌우로 나눠 앉힌다(원서·서류)
    const cnt = {};
    $.cardDx = C.words.map((w) => { cnt[w.step] = (cnt[w.step] || 0) + 1; return cnt[w.step]; })
      .map((n, i) => (C.words.filter((w) => w.step === C.words[i].step).length > 1 ? (n === 1 ? -15 : 15) : 0));
  }

  // 장면 6: 길 → 캠퍼스, 로고, QR
  const CAMPUS = [
    ['M-128 0H128', 0, 0.22],
    ['M-112 0V-12H112V0', 0.08, 0.3],
    ['M-98 -12V-24H98V-12', 0.14, 0.36],
    ['M-72 -24V-112M-24 -24V-112M24 -24V-112M72 -24V-112', 0.22, 0.55],
    ['M-104 -112H104V-128H-104Z', 0.4, 0.62],
    ['M-116 -128L0 -186L116 -128Z', 0.5, 0.78],
    ['M0 -186V-232', 0.7, 0.86],
  ];
  function buildEnd() {
    const svg = sv('svg', { width: 1920, height: 1080, viewBox: '0 0 1920 1080' }, $.end);
    svg.setAttribute('class', 'abs');
    const defs = sv('defs', {}, svg);
    $.eGrad = sv('linearGradient', { id: 'endGrad', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 1640, y2: 0 }, defs);
    sv('stop', { offset: 0, 'stop-color': '#F8BCA2' }, $.eGrad);
    sv('stop', { offset: 1, 'stop-color': '#315E59' }, $.eGrad);
    $.eMaskGrad = sv('linearGradient', { id: 'endMaskGrad', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 200, y2: 0 }, defs);
    sv('stop', { offset: 0, 'stop-color': '#000' }, $.eMaskGrad);
    sv('stop', { offset: 1, 'stop-color': '#fff' }, $.eMaskGrad);
    const mk = sv('mask', { id: 'endMask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1920, height: 1080 }, defs);
    sv('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: 'url(#endMaskGrad)' }, mk);
    $.eShadow = sv('ellipse', { cx: 0, cy: 0, rx: 150, ry: 14, fill: 'rgba(50,42,36,0.10)' }, svg);
    $.eThin = sv('path', { d: '', fill: 'none', stroke: '#E6E1DD' }, svg);
    $.eRail = sv('path', { d: '', fill: 'none', stroke: 'url(#endGrad)', 'stroke-width': 6, 'stroke-linecap': 'round', mask: 'url(#endMask)' }, svg);
    $.campus = sv('g', { fill: 'none', stroke: '#315E59', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    $.campusParts = CAMPUS.map(([d, a, b]) => {
      const p = sv('path', { d, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, $.campus);
      p.win = [a, b];
      return p;
    });
    $.flag = sv('path', { d: 'M0 -232L38 -219L0 -206Z', fill: '#F7B89C', stroke: '#315E59', 'stroke-width': 4 }, $.campus);

    $.eLine1 = el('div', 'end-line1', $.end, C.scenes[5].copy[0]);
    $.eBrand = el('div', 'end-brand', $.end);
    const logo = el('img', null, $.eBrand); logo.src = 'assets/sy-logo.png'; logo.alt = '검고담임 로고';
    el('b', null, $.eBrand, C.scenes[5].copy[1]);
    $.eQr = el('div', 'qr-card', $.end);
    const qr = el('img', 'qr', $.eQr); qr.src = 'assets/qr-gumgomentor.svg'; qr.alt = `${C.demoUrl} QR 코드`;
    const tx = el('div', null, $.eQr);
    el('div', 'qr-cta', tx, C.labels.cta);
    el('div', 'qr-url', tx, C.demoUrlLabel);
    el('div', 'qr-hint', tx, C.labels.qrHint);
  }

  function copyBlock(lines, cls) {
    const box = el('div', 'copy ' + cls, $.copyL);
    const ls = lines.map((txt) => { const m = el('div', 'cl-mask', box); return el('div', 'cl-line', m, txt); });
    return { box, ls };
  }
  function buildCopies() {
    const c = (i) => C.scenes[i].copy;
    $.c1 = copyBlock(c(0), 'c-center');
    $.c2 = copyBlock(c(1), 'c-left');
    $.c3 = copyBlock(c(2), 'c-top');
    $.c4 = copyBlock(c(3), 'c-right');
    $.c5 = copyBlock(c(4), 'c-right');
    tf($.c1.box, 'translate(0px, 412px)');
    tf($.c2.box, 'translate(150px, 482px)');
    tf($.c3.box, 'translate(140px, 108px)');
    tf($.c4.box, 'translate(1110px, 104px)');
    tf($.c5.box, 'translate(1110px, 104px)');
  }
  function buildUi() {
    $.pillA = el('div', 'pill', $.ui, C.labels.realScreen);
    $.pill2 = el('div', 'pill', $.ui, C.labels.realScreen);
    $.pillEx = el('div', 'pill is-example', $.ui, C.labels.example);
    $.pillMsg = el('div', 'pill is-example', $.ui, C.labels.msgDemo);
    $.taps = TAPS.map(() => {
      const d = el('div', 'tap', $.ui);
      el('div', 'tap-dot', d); el('div', 'tap-ring', d);
      return d;
    });
  }

  // ═════════════════════════ 그리기 ═════════════════════════
  function renderCopy(c, t, tins, tout) {
    let any = false;
    c.ls.forEach((ln, i) => {
      const a = tins[i];
      const u = prog(t, a, a + 0.75, E.outQuint);
      const v = prog(t, tout, tout + 0.45, E.in);
      if (show(ln, u * (1 - v))) any = true;
      tf(ln, `translate3d(0, ${((1 - u) * 100 - v * 14).toFixed(2)}%, 0)`);
    });
    show(c.box, any ? 1 : 0);
  }

  // 장면 1~2: 카드
  function renderCards(t) {
    const on = t < T('intro', 2.4);
    if (!show($.cards, on ? 1 : 0)) return;
    const sg = 1 + 0.03 * prog(t, 0, T('problem', 6), E.linear); // 천천히 다가가는 카메라
    const c = cam3(t), rise = riseA(t);
    const all = [...CARD_POS, ...SHEETS];
    all.forEach((pos, i) => {
      const isWord = i < CARD_POS.length;
      const node = isWord ? $.pcards[i] : $.psheets[i - CARD_POS.length];
      const a = prog(t, 0.12 + 0.11 * i, 1.2 + 0.11 * i, E.outQuint);
      const fy = Math.sin((t * 0.42 + i * 0.23) * Math.PI * 2) * 7;
      const f0 = T('intro', 0.15 + 0.07 * i), f1 = T('intro', 1.85 + 0.05 * i);
      const u = prog(t, f0, f1, E.inOut);
      let tx, ty, ts;
      if (isWord) {
        const w = C.words[i];
        const [bx, by] = bxy(DOTS[w.step][0] + $.cardDx[i], LABEL_Y);
        [tx, ty] = b2s(bx, by + rise, c);
        ts = (11 * PS * c[2]) / 56;
      } else {
        [tx, ty] = b2s(...bxy(195, 560 + (i - 4) * 30), c).map((v, j) => (j === 1 ? v + rise * c[2] : v));
        ts = 0.14;
      }
      const gather = 1 - 0.07 * prog(t, T('problem', 3.2), T('intro', 0.3), E.inOutSine);
      const x0 = 960 + (pos.x - 960) * sg * gather, y0 = 540 + (pos.y - 540) * sg * gather + fy + (1 - a) * 46;
      const x = lerp(x0, tx, u);
      const y = lerp(y0, ty, u) - 80 * Math.sin(Math.PI * u);
      const s = lerp(pos.s * sg * (0.94 + 0.06 * a), ts, u);
      const r = lerp(pos.r, 0, u);
      const o = a * (1 - prog(t, T('intro', 1.7 + 0.05 * i), T('intro', 2.05 + 0.05 * i), E.linear));
      if (show(node, o)) tf(node, `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${r}deg) scale(${s})`);
      const sh = $.cshadows[i];
      if (show(sh, a * (1 - prog(t, f0, f0 + 0.35, E.linear)) * (0.85 - fy * 0.02))) {
        tf(sh, `translate3d(${x0}px, ${540 + (pos.y - 540) * sg + 128 * pos.s}px, 0) translate(-50%, -50%) scale(${pos.s * (1 - fy * 0.012)})`);
      }
    });
  }

  // 장면 2~3: 공간
  function render3D(t) {
    const on = t >= T('intro', 0) && t < T('score', 0.5);
    const o = 1 - prog(t, T('score', 0.05), T('score', 0.45), E.linear);
    if (!show($.view3d, on ? o : 0)) { show($.fog, 0); show($.floor3d, 0); show($.glow, 0); return; }
    const c = cam3(t);
    const tilt = c[3];
    const tk = tilt / 56;
    const dive = prog(t, T('roadmap', 9.8), T('roadmap', 10.8)); // 카드로 다가갈 때는 안개를 걷는다
    show($.floor3d, tk * o); show($.fog, tk * o * (1 - dive)); show($.glow, tk * o * 0.9 * (1 - dive));
    tf($.cam, `rotateX(${tilt}deg) scale3d(${c[2]}, ${c[2]}, ${c[2]}) translate3d(${-c[0]}px, ${-c[1]}px, 0)`);

    // 폰
    show($.phA.root, prog(t, T('intro', 0), T('intro', 0.25), E.linear));
    tf($.phA.root, `translate3d(0px, ${riseA(t)}px, 0) scale(${PS})`);
    $.homeParts.forEach((part, i) => {
      const a = T('intro', 0.95 + 0.14 * i);
      const u = prog(t, a, a + 0.6, E.outQuint);
      const press = i === QUICK ? prog(t, T('intro', 3.62), T('intro', 3.8)) - prog(t, T('intro', 3.85), T('intro', 4.15)) : 0;
      if (show(part, u)) tf(part, `translate3d(0, ${(1 - u) * 18}px, 0) scale(${1 - 0.012 * press})`);
    });

    // 네 걸음 막대: 앱 화면 → 같은 모양 복제본으로 바꿔 끼운 뒤 폰 밖 길 위의 점으로 펼친다
    const swap = t >= T('roadmap', 0.6);
    show($.patch, swap ? 1 : 0);
    show($.railSvg, swap ? 1 : 0);
    const grow = prog(t, T('roadmap', 1.45), T('roadmap', 3.7));
    let lead = S0[3];
    $.bdots.forEach((d, k) => {
      const st = C.stations[k].state;
      const u = prog(t, T('roadmap', 1.35 + 0.05 * (3 - k)), T('roadmap', 3.9));
      const m = prog(t, T('roadmap', 1.35 + 0.05 * (3 - k)), T('roadmap', 2.4 + 0.05 * (3 - k)), E.inOut); // 막대 → 점
      const s = lerp(S0[k], SS[k], u);
      if (k === 3) lead = s;
      const [x, y] = P(s);
      const sc = PS * lerp(1, 2.3, grow);
      if (show(d, swap ? 1 : 0)) {
        const w = lerp(SEG_W, 22, m), h = lerp(SEG_H, 22, m);
        const key = `${w.toFixed(2)}|${h.toFixed(2)}|${m.toFixed(3)}`;
        if (d._k !== key) {
          d._k = key;
          d.style.width = w + 'px'; d.style.height = h + 'px'; d.style.borderRadius = h / 2 + 'px';
          d.style.background = mixC(DOT_C[st][0], DOT_C[st][1], m);
          if (st === 'next') d.style.boxShadow = `inset 0 0 0 2px rgba(214,206,197,${m.toFixed(3)})`;
          if (st === 'current') d.style.boxShadow = `0 0 0 ${(5 * m).toFixed(2)}px #FDE7DC`;
          if (d.chk) d.chk.style.opacity = prog(m, 0.6, 1, E.linear).toFixed(3);
        }
        tf(d, `translate3d(${x}px, ${y}px, 1.2px) scale(${sc}) translate(-50%, -50%)`);
      }
      const lb = $.blabels[k];
      const lsc = PS * lerp(1, 2.7, grow);
      if (show(lb, swap ? 1 - prog(t, T('roadmap', 3.2), T('roadmap', 3.8)) : 0)) {
        // 막대일 때는 앱처럼 바로 아래, 점이 커지면 점 아래로 비켜선다
        tf(lb, `translate3d(${x}px, ${y + lerp(LAB_DY, 21, m) * sc}px, 1.2px) scale(${lsc}) translate(-50%, 0)`);
      }
    });
    const rev = lerp(Math.max(S0[3], lead + 60 * grow) + 700 * grow, LTOT, prog(t, T('roadmap', 3.4), T('roadmap', 5.4)));
    const da = `${rev} ${LTOT + 200}`;
    [$.railBand, $.railCore, $.railCore2].forEach((p) => p.setAttribute('stroke-dasharray', da));
    const pl = (SS[1] - SS[0]) * prog(t, T('roadmap', 4.5), T('roadmap', 5.6));
    $.railProg.setAttribute('stroke-dasharray', `0 ${SS[0]} ${pl} ${LTOT * 2}`);
    tf($.railSvg, 'translate3d(0, 0, 0.4px)');

    // 정거장 카드가 바닥에서 일어선다
    $.bills.forEach((b, k) => {
      const a0 = T('roadmap', 3.25 + 0.16 * k);
      const r = prog(t, a0, T('roadmap', 4.2 + 0.16 * k), E.inOut);
      const [fx, fy] = FOOT[k];
      const near = k < 1 ? 1 - prog(t, T('roadmap', 9.9), T('roadmap', 10.6), E.linear) : 1; // 카메라 앞을 가리는 카드는 걷는다
      if (show(b, prog(t, a0, a0 + 0.3, E.linear) * near)) {
        tf(b, `translate3d(${fx - BILL_W / 2}px, ${fy - BILL_H}px, 2px) rotateX(${-tilt * r}deg)`);
      }
      const sh = $.bshadows[k];
      if (show(sh, r * 0.95 * near)) tf(sh, `translate3d(${fx}px, ${fy - 26}px, 0.8px) scale(${lerp(0.55, 1, r)}) translate(-50%, -50%)`);
    });
  }

  // 장면 4 시작: '대학 찾기' 정거장 카드가 그대로 폰 화면(대학 찾기)이 된다
  function renderMorph(t) {
    const a = T('score', 0), b = T('score', 0.9);
    if (!show($.morph, t >= a && t < b ? 1 : 0)) return;
    const u = prog(t, a, b, E.inOutQuint);
    const A = { x: 960 - (BILL_W * HAND_Z) / 2, y: 540 - BILL_H * HAND_Z, w: BILL_W * HAND_Z, h: BILL_H * HAND_Z, r: 30 * HAND_Z };
    const p = P2(t);
    const B = { x: p[0] - 195 * p[2], y: p[1] - 422 * p[2], w: 390 * p[2], h: 844 * p[2], r: 50 * p[2] };
    const g = { x: lerp(A.x, B.x, u), y: lerp(A.y, B.y, u), w: lerp(A.w, B.w, u), h: lerp(A.h, B.h, u), r: lerp(A.r, B.r, u) };
    const m = $.morph.style;
    m.width = g.w + 'px'; m.height = g.h + 'px'; m.borderRadius = g.r + 'px';
    tf($.morph, `translate3d(${g.x}px, ${g.y}px, 0)`);
    m.background = u < 0.5 ? '#fff' : 'var(--bg)';
    const kb = g.w / BILL_W;
    show($.mBill, 1 - prog(u, 0, 0.35, E.linear));
    tf($.mBill, `translate3d(${(g.w - BILL_W * kb) / 2}px, ${(g.h - BILL_H * kb) / 2}px, 0) scale(${kb})`);
    const ks = g.w / 390;
    show($.mScreen, prog(u, 0.12, 0.5, E.linear));
    tf($.mScreen, `translate3d(0, ${Math.min(0, (g.h - 844 * ks) / 2) * (1 - u)}px, 0) scale(${ks})`);
  }

  // 장면 4~6: 평면 폰과 화면 넘김
  function renderFlat(t) {
    const on = t >= T('score', 0.4);
    if (!show($.flat, on ? 1 : 0)) return;
    const c = camF(t), p = P2(t);
    tf($.flatcam, `translate(${c[2]}px, ${c[3]}px) scale(${c[4]}) translate(${-c[0]}px, ${-c[1]}px)`);
    show($.ph2.root, prog(t, T('score', 0.45), T('score', 0.85), E.linear));
    tf($.ph2.root, `translate3d(${p[0]}px, ${p[1]}px, 0) scale(${p[2]})`);

    let i = 0;
    for (let j = 0; j < NAV.length; j++) if (t >= NAV[j].t) i = j;
    const cur = NAV[i], prev = i > 0 ? NAV[i - 1] : null;
    const u = cur.type === 'cut' ? 1 : prog(t, cur.t, cur.t + (cur.d || 0.5), E.inOutQuint);
    for (const n in $.scr) show($.scr[n], 0);
    show($.dim, 0);
    const place = (n, x, z) => {
      const d = $.scr[n];
      show(d, 1);
      d.style.zIndex = z;
      const y = scrollOf(n, t);
      // 2D로 둔다 — 3D(translate3d)면 따로 떼어진 층이 되어, 흐려지는 중에 그려진 흐린 화질로 굳는 일이 있다
      tf(d, `translate(${x}px, ${y}px)`);
      if (d.fix) tf(d.fix, `translate(0px, ${-y}px)`);
    };
    if (u >= 1 || !prev) place(cur.n, 0, 3);
    // 제자리 바뀜: 새 화면은 처음부터 선명하게 밑에 깔고, 옛 화면을 위에서 걷어 낸다.
    else if (cur.type === 'fade') { place(cur.n, 0, 1); place(prev.n, 0, 3); show($.scr[prev.n], 1 - u); }
    else if (cur.type === 'push') {
      place(prev.n, -117 * u, 1); place(cur.n, 390 * (1 - u), 3);
      $.dim.style.zIndex = 2; show($.dim, 0.1 * u);
    } else if (cur.type === 'back') {
      place(cur.n, -117 * (1 - u), 1); place(prev.n, 390 * u, 3);
      $.dim.style.zIndex = 2; show($.dim, 0.1 * (1 - u));
    }
    // 긴 화면이 보이는 동안은 하단 탭을 폰 바닥에 붙인다(앱의 하단 탭은 늘 그 자리에 있다)
    const tallOn = TALL[cur.n] || (prev && TALL[prev.n] && u < 1);
    show($.tabfix, tallOn ? 1 : 0);
  }

  // 들어 올린 앱 조각
  function inPhone(cr, t) { // 폰 안에 있을 때의 화면 위치
    const [X, Y, W, H] = cr.r;
    const [sx, sy] = appToStage(X, Y + scrollOf(cr.n, t), t);
    const k = P2(t)[2] * camF(t)[4];
    return { x: sx, y: sy, w: W * k, h: H * k, r: 0, sh: 0 };
  }
  function lifted(cr, cx, cy, S) {
    const [, , W, H] = cr.r;
    return { x: cx - (W * S) / 2, y: cy - (H * S) / 2, w: W * S, h: H * S, r: 30, sh: 1 };
  }
  const mix = (g1, g2, u) => ({ x: lerp(g1.x, g2.x, u), y: lerp(g1.y, g2.y, u), w: lerp(g1.w, g2.w, u), h: lerp(g1.h, g2.h, u), r: lerp(g1.r, g2.r, u), sh: lerp(g1.sh, g2.sh, u) });
  function drawPanel(p, g, o) {
    if (!show(p, o)) return false;
    const s = p.style;
    s.width = g.w + 'px'; s.height = g.h + 'px'; s.borderRadius = g.r + 'px';
    tf(p, `translate3d(${g.x}px, ${g.y}px, 0)`);
    const h = g.sh;
    const bs = h > 0.01
      ? `0 ${44 * h}px ${90 * h}px -${24 * h}px rgba(50,42,36,${(0.28 * h).toFixed(3)}), 0 ${10 * h}px ${22 * h}px -${8 * h}px rgba(50,42,36,${(0.11 * h).toFixed(3)}), 0 0 0 1px rgba(230,225,221,${h.toFixed(3)})`
      : 'none';
    if (p._bs !== bs) { s.boxShadow = bs; p._bs = bs; }
    const k = g.w / p.crops[0].r[2];
    p.crops.forEach((c) => tf(c, `scale(${k})`));
    p.k = k; p.g = g;
    return true;
  }
  function renderPanels(t) {
    if (!show($.lift, t >= T('score', 3.9) && t < T('brand', 0.5) ? 1 : 0)) return;
    // 대학 목록 머리 (조건에 맞는 대학 N곳 · 가나다순 + 첫 대학)
    {
      const cr = $.pHead.crops[0];
      const u = prog(t, T('score', 4.15), T('score', 4.8), E.inOutQuint);
      const v = prog(t, T('score', 5.55), T('score', 5.95), E.inOut);
      const g = mix(inPhone(cr, t), lifted(cr, 1420, 580, 2.0), u);
      g.y -= 30 * v;
      drawPanel($.pHead, g, (u > 0 ? 1 : 0) * (1 - v));
    }
    // 전형 목록 → 제출서류 → 체크 두 개 → 폰으로 돌아감
    {
      const [cAdm, cDocs, cDocs1, cDocs2] = $.hero.crops;
      const G1 = lifted(cAdm, 1420, 650, 1.55);
      const G2 = lifted(cDocs, 1420, 660, 1.4);
      let g, o = 1;
      if (t < T('score', 8.0)) o = 0;
      if (t < T('score', 8.8)) g = mix(inPhone(cAdm, t), G1, prog(t, T('score', 8.0), T('score', 8.8), E.inOutQuint));
      else if (t < T('prepare', 0.8)) g = mix(G1, G2, prog(t, T('prepare', 0), T('prepare', 0.8), E.inOutQuint));
      else if (t < T('prepare', 2.3)) g = G2;
      else {
        g = mix(G2, inPhone(cDocs2, t), prog(t, T('prepare', 2.3), T('prepare', 2.9), E.inOutQuint));
        o = 1 - prog(t, T('prepare', 2.7), T('prepare', 2.9), E.linear);
      }
      if (drawPanel($.hero, g, o)) {
        // 내용 바뀜: 전형 목록 → 서류 → (체크 1) → (체크 2)
        const fAdm = prog(t, T('prepare', 0.05), T('prepare', 0.3), E.linear);
        const fDocs = prog(t, T('prepare', 0.28), T('prepare', 0.6), E.linear);
        const fD1 = prog(t, T('prepare', 1.2), T('prepare', 1.4), E.linear);
        const fD2 = prog(t, T('prepare', 1.9), T('prepare', 2.1), E.linear);
        show(cAdm, 1 - fAdm);
        show(cDocs, fDocs);
        show(cDocs1, fD1);
        show(cDocs2, fD2);
        // 전형 목록 위 강조 테두리 — 검정고시출신자전형 줄, 그 줄의 '가능'
        const ring = (node, r, a, b) => {
          const on = prog(t, a, a + 0.3) * (1 - prog(t, b, b + 0.3));
          if (!show(node, on * (1 - fAdm))) return;
          const k = $.hero.k, [X, Y] = cAdm.r;
          const s = node.style;
          s.width = r[2] * k + 12 + 'px'; s.height = r[3] * k + 12 + 'px';
          tf(node, `translate3d(${(r[0] - X) * k - 6}px, ${(r[1] - Y) * k - 6}px, 0)`);
        };
        ring($.ring1, R('detailTall', 'adm0'), T('score', 8.95), T('score', 9.75));
        ring($.ring2, R('detailTall', 'pill0'), T('score', 9.8), T('score', 10.6));
      }
    }
    // 꿈드림으로 할 수 있는 것 ① 지원 받기 ② 센터와 쪽지 ③ 커뮤니티 — 차례로 폰 밖으로 꺼낸다
    const feature = (pn, st, ft, a, b, c, d, S, end) => {
      const cr = pn.crops[0];
      const u = prog(t, a, b, E.inOutQuint);
      const v = prog(t, c, d, E.inOut);
      const g = mix(inPhone(cr, t), lifted(cr, 1420, 650, S), u);
      g.x -= 40 * v;
      drawPanel(pn, g, (u > 0 ? 1 : 0) * (1 - v));
      const k = prog(t, a + 0.35, b + 0.05) * (1 - v);
      if (show(st, k)) tf(st, `translate3d(${g.x - 50}px, ${g.y - 62}px, 0)`);
      if (show(ft, k)) tf(ft, `translate3d(${g.x + 82}px, ${g.y - 60 + (1 - k) * 10}px, 0)`);
    };
    feature($.pDream, $.stDream, $.fDream, T('prepare', 3.6), T('prepare', 4.2), T('prepare', 4.9), T('prepare', 5.2), 1.5);
    feature($.pMsg, $.stMsg, $.fMsg, T('prepare', 6.1), T('prepare', 6.7), T('prepare', 7.1), T('prepare', 7.4), 1.55);
    feature($.pComm, $.stComm, $.fComm, T('prepare', 7.6), T('prepare', 8.2), T('brand', 0), T('brand', 0.4), 1.55);
  }

  // 들어 올린 조각 위의 한 점 (패널 p 의 i번째 조각에서 앱 좌표 [x,y])
  function panelPoint(p, i, [x, y]) {
    const g = p.g || { x: 0, y: 0 };
    const k = p.k || 1;
    const [X, Y] = p.crops[i].r;
    return [g.x + (x - X) * k, g.y + (y - Y) * k];
  }
  const tabC = (n) => center(R('home', 'tab' + n));
  const TAPS = [
    { t: T('intro', 3.8), at: (t) => phoneAStage(...center(R('home', 'quickUniv')), t) },       // 홈 '대학찾기'
    { t: T('score', 2.95), at: (t) => appToStage(...center(R('explore1', 'cta')), t) },        // 조건에 맞는 대학 N곳 보기
    { t: T('score', 6.1), at: (t) => appToStage(...center(R('listTall', 'row')), t) },         // 감리교신학대학교
    { t: T('score', 10.55), at: () => panelPoint($.hero, 0, center(R('detailTall', 'adm0'))) }, // 검정고시출신자전형
    { t: T('prepare', 1.1), at: () => panelPoint($.hero, 1, center(R('docs0', 'c0'))) },
    { t: T('prepare', 1.8), at: () => panelPoint($.hero, 1, center(R('docs0', 'c1'))) },
    { t: T('prepare', 3.2), at: (t) => appToStage(...tabC(1), t) },                             // 하단 탭 '꿈드림'
    { t: T('prepare', 5.2), at: (t) => appToStage(...center(R('centers', 'msgBtn')), t) },      // 센터에 쪽지 보내기
  ];
  function renderTaps(t) {
    TAPS.forEach((tp, i) => {
      const d = $.taps[i], t0 = tp.t;
      const a = prog(t, t0 - 0.35, t0 - 0.1, E.out);
      const press = prog(t, t0 - 0.1, t0 + 0.05);
      const r = prog(t, t0, t0 + 0.55, E.out);
      const f = prog(t, t0 + 0.2, t0 + 0.55, E.linear);
      if (!show(d, a * (1 - f))) return;
      const [x, y] = tp.at(t);
      tf(d, `translate3d(${x}px, ${y}px, 0)`);
      tf(d.children[0], `scale(${lerp(1.3, 1, a) - 0.15 * press})`);
      show(d.children[1], (1 - r) * press);
      tf(d.children[1], `scale(${lerp(0.7, 2.1, r)})`);
    });
  }

  function renderUi(t) {
    // 장면 2 — 폰 아래 '실제 앱 화면'
    {
      const o = prog(t, T('intro', 1.7), T('intro', 2.1)) * (1 - prog(t, T('intro', 4.3), T('intro', 4.7)));
      if (show($.pillA, o)) {
        const [x, y] = phoneAStage(195, 800 + 16, t);
        tf($.pillA, `translate3d(${x}px, ${y + 30}px, 0) translate(-50%, 0)`);
      }
    }
    // 장면 4~5 — 폰 아래 '실제 앱 화면' (확대 중에는 숨긴다)
    {
      const zoomed = camF(t)[4] > 1.01;
      const o = prog(t, T('score', 0.7), T('score', 1.0)) * (1 - prog(t, T('brand', 0), T('brand', 0.3)));
      if (show($.pill2, zoomed ? 0 : o)) {
        const p = P2(t);
        tf($.pill2, `translate3d(${p[0]}px, ${p[1] + 438 * p[2] + 26}px, 0) translate(-50%, 0)`);
      }
    }
    // '쪽지는 시연 기능' — 들어 올린 쪽지 아래 (실제 센터로 가지 않는다)
    {
      const o = prog(t, T('prepare', 6.5), T('prepare', 6.85)) * (1 - prog(t, T('prepare', 7.1), T('prepare', 7.3)));
      const g = $.pMsg.g;
      if (show($.pillMsg, g ? o : 0)) tf($.pillMsg, `translate3d(${g.x + g.w}px, ${g.y + g.h + 22}px, 0) translate(-100%, 0)`);
    }
    // '시연용 예시 글' — 들어 올린 커뮤니티 글 아래
    {
      const o = prog(t, T('prepare', 8.0), T('prepare', 8.35)) * (1 - prog(t, T('brand', 0), T('brand', 0.3)));
      const g = $.pComm.g;
      if (show($.pillEx, g ? o : 0)) tf($.pillEx, `translate3d(${g.x + g.w}px, ${g.y + g.h + 22}px, 0) translate(-100%, 0)`);
    }
    renderTaps(t);
  }

  function renderEnd(t) {
    const on = t >= T('brand', 0.4);
    if (!show($.end, on ? 1 : 0)) return;
    const p = P2(t);
    const s3 = R('home', 'seg3');
    const [x0, y0] = appToStage(s3[0] + s3[2], s3[1] + s3[3] / 2, t);
    const X1 = 1640;
    const len = X1 - x0;
    const u = prog(t, T('brand', 0.6), T('brand', 1.6), E.inOut);
    const d = `M ${x0} ${y0} H ${X1}`;
    $.eThin.setAttribute('d', d);
    $.eThin.setAttribute('stroke-width', 2 * p[2]);
    $.eThin.setAttribute('stroke-dasharray', `${len * u} ${len + 10}`);
    $.eRail.setAttribute('d', d);
    $.eRail.setAttribute('stroke-dasharray', `${len * u} ${len + 10}`);
    $.eGrad.setAttribute('x1', x0); $.eGrad.setAttribute('x2', X1);
    $.eMaskGrad.setAttribute('x1', x0 + 50); $.eMaskGrad.setAttribute('x2', x0 + 230);
    $.campus.setAttribute('transform', `translate(${X1} ${y0})`);
    const cu = prog(t, T('brand', 1.2), T('brand', 2.1), E.linear);
    $.campusParts.forEach((part) => {
      const [a, b] = part.win;
      part.setAttribute('stroke-dashoffset', 1 - E.inOut(clamp((cu - a) / (b - a), 0, 1)));
    });
    $.flag.setAttribute('opacity', prog(cu, 0.8, 1, E.linear));
    $.eShadow.setAttribute('cx', X1); $.eShadow.setAttribute('cy', y0 + 6);
    $.eShadow.setAttribute('opacity', prog(cu, 0, 0.4, E.linear));

    const rise = (node, a, x, y) => {
      const v = prog(t, a, a + 0.8, E.outQuint);
      if (show(node, v)) tf(node, `translate3d(${x}px, ${y + (1 - v) * 26}px, 0)`);
    };
    rise($.eLine1, T('brand', 0.9), 700, 196);
    rise($.eBrand, T('brand', 1.2), 700, 286);
    rise($.eQr, T('brand', 1.45), 700, 604);
  }

  function render(t) {
    // 장면 1 배경
    show($.s1floor, 1 - prog(t, T('intro', 0.3), T('intro', 1.4), E.linear));
    renderCards(t);
    render3D(t);
    renderMorph(t);
    renderFlat(t);
    renderPanels(t);
    renderEnd(t);
    renderCopy($.c1, t, [0.45, 0.68], T('problem', 5.25));
    renderCopy($.c2, t, [T('intro', 2.3)], T('intro', 4.8));
    renderCopy($.c3, t, [T('roadmap', 4.3), T('roadmap', 4.55)], T('roadmap', 9.75));
    renderCopy($.c4, t, [T('score', 3.3), T('score', 8.1)], T('prepare', 0));
    renderCopy($.c5, t, [T('prepare', 0.35), T('prepare', 4.75)], T('brand', 0));
    renderUi(t);
    // 끝: 배경으로 천천히 사라져 첫 장면과 이어진다
    show($.fade, prog(t, T('brand', 6.4), T('brand', 7), E.inOut));
  }

  // ── 시작 ──
  const assets = [...new Set([
    ...Object.values(SC).map((s) => s.src),
    'assets/sy-logo.png', 'assets/qr-gumgomentor.svg',
  ])];
  window.__AD_DEBUG = { T, P, SS, FOOT, cam3, camF, P2, appToStage, NAV };
  window.AdPlayer({ duration: DURATION, scenes: C.scenes, build, render, assets });
})();
