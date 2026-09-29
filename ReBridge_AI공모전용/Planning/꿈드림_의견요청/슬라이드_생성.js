const pptxgen = require('pptxgenjs');

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';            // 13.3 x 7.5 inch
pres.author = '검고담임 팀';
pres.title = '검고담임 — 꿈드림센터 의견 요청';

const W = 13.3, H = 7.5;
const M = 0.75;                          // 좌우 여백
const CW = W - M * 2;                    // 본문 폭

// ── 팔레트 ────────────────────────────────────────────────
const NAVY      = '1F3A5F';
const NAVY_DEEP = '14273D';
const YELLOW    = 'F2C14E';
const YELLOW_BG = 'FDF3DA';
const INK       = '1A1D21';
const MUTED     = '6B7280';
const PANEL     = 'F4F6F8';
const LINE      = 'DFE3E8';
const AMBER     = 'B45309';
const WHITE     = 'FFFFFF';

const F = '맑은 고딕';

// ── 공통 조각 ─────────────────────────────────────────────
function pageTitle(s, kicker, title) {
  s.addText(kicker, {
    x: M, y: 0.52, w: CW, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12, bold: true, color: NAVY, charSpacing: 1.5,
  });
  const twoLine = title.includes('\n');
  s.addText(title, {
    x: M, y: 0.85, w: CW, h: twoLine ? 1.2 : 0.72, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 30, bold: true, color: INK,
  });
}

// 이 덱의 반복 모티프 — 노란 '여쭙고 싶은 것' 카드
function askBox(s, y, lines, h) {
  const height = h || 1.5;
  s.addShape(pres.ShapeType.roundRect, {
    x: M, y, w: CW, h: height, rectRadius: 0.1,
    fill: { color: YELLOW_BG }, line: { color: YELLOW, width: 1 },
  });
  s.addShape(pres.ShapeType.ellipse, {
    x: M + 0.32, y: y + 0.26, w: 0.36, h: 0.36, fill: { color: YELLOW }, line: { width: 0 },
  });
  s.addText('?', {
    x: M + 0.32, y: y + 0.26, w: 0.36, h: 0.36, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 16, bold: true, color: NAVY_DEEP, align: 'center', valign: 'middle',
  });
  s.addText('여쭙고 싶은 것', {
    x: M + 0.82, y: y + 0.24, w: 4, h: 0.32, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 13, bold: true, color: AMBER,
  });
  s.addText(
    lines.map((t, i) => ({
      text: t,
      options: { bullet: true, breakLine: i !== lines.length - 1, paraSpaceAfter: 5 },
    })),
    {
      x: M + 0.82, y: y + 0.6, w: CW - 1.5, h: height - 0.75, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 13, color: INK, lineSpacing: 19,
    },
  );
}

// 좌측 큰 숫자 + 설명 행
function statRow(s, x, y, w, num, unit, label) {
  s.addText([
    { text: num, options: { fontSize: 34, bold: true, color: NAVY } },
    { text: ' ' + unit, options: { fontSize: 15, bold: true, color: NAVY } },
  ], { x, y, w, h: 0.66, isTextBox: true, margin: 0, fontFace: F });
  s.addText(label, {
    x, y: y + 0.66, w, h: 0.62, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12, color: MUTED, lineSpacing: 16,
  });
}

function card(s, x, y, w, h, title, body, opts) {
  const o = opts || {};
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: o.fill || PANEL }, line: { color: o.line || LINE, width: 1 },
  });
  s.addText(title, {
    x: x + 0.28, y: y + 0.24, w: w - 0.56, h: 0.36, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 15, bold: true, color: o.titleColor || INK,
  });
  s.addText(body, {
    x: x + 0.28, y: y + 0.62, w: w - 0.56, h: h - 0.8, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12, color: o.bodyColor || MUTED, lineSpacing: 17,
  });
}

function footer(s, n) {
  s.addText('검고담임 · 꿈드림센터 의견 요청', {
    x: M, y: H - 0.5, w: 6, h: 0.28, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 9.5, color: MUTED,
  });
  s.addText(String(n), {
    x: W - M - 0.6, y: H - 0.5, w: 0.6, h: 0.28, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 9.5, color: MUTED, align: 'right',
  });
}

// ══ 1. 표지 ═══════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY_DEEP };
  s.addShape(pres.ShapeType.ellipse, {
    x: W - 3.1, y: -1.5, w: 5.2, h: 5.2, fill: { color: NAVY }, line: { width: 0 },
  });
  s.addShape(pres.ShapeType.ellipse, {
    x: W - 1.6, y: 4.5, w: 1.5, h: 1.5, fill: { color: YELLOW }, line: { width: 0 },
  });

  s.addText('학교 밖 청소년 대입 지원 서비스', {
    x: M, y: 1.75, w: 8.6, h: 0.36, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 15, bold: true, color: YELLOW, charSpacing: 1.5,
  });
  s.addText('검고담임', {
    x: M, y: 2.2, w: 8.6, h: 1.1, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 58, bold: true, color: WHITE,
  });
  s.addText('만들어 둔 기능이 현장에서 실제로 쓸모가 있는지\n여쭙기 위해 보내 드립니다.', {
    x: M, y: 3.45, w: 8.6, h: 1.0, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 18, color: 'C9D4E3', lineSpacing: 30,
  });
  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 4.75, w: 5.3, h: 0.52, rectRadius: 0.26,
    fill: { color: NAVY }, line: { color: '3A5B84', width: 1 },
  });
  s.addText('읽으시는 데 10분 · 답변은 편하신 만큼만', {
    x: M, y: 4.75, w: 5.3, h: 0.52, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12.5, color: 'D6E0EC', align: 'center', valign: 'middle',
  });
  s.addText('【팀명 / 소속】  ·  【보내는 날짜】', {
    x: M, y: H - 1.0, w: 8, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 11.5, color: '8FA3BC',
  });
  s.addNotes('표지. 팀명·날짜·연락처는 캔바에서 채워 주세요.');
}

// ══ 2. 왜 연락드렸는지 ════════════════════════════════════
{
  const s = pres.addSlide();
  pageTitle(s, '드리는 말씀', '만든 사람 눈에는 안 보이는 것을\n여쭙고 싶습니다');

  s.addText('저희는 검정고시로 대학에 가려는 청소년이 혼자서도 길을 따라갈 수 있게 돕는 앱을 만들고 있습니다. '
    + '기능은 대부분 만들어 뒀지만, 그게 현장에서 정말 쓸모가 있는지는 저희끼리 판단할 수 없습니다.', {
    x: M, y: 2.18, w: CW, h: 0.8, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 14, color: INK, lineSpacing: 24,
  });

  const cw = (CW - 0.6) / 3;
  card(s, M, 3.1, cw, 1.75, '① 쓸모가 있습니까',
    '넣어 둔 기능이 실제 상담·생활에 도움이 되는지 봐 주세요.');
  card(s, M + cw + 0.3, 3.1, cw, 1.75, '② 빼도 될 것이 있습니까',
    '"이건 없어도 될 것 같다" 싶은 기능을 알려 주세요.\n빼는 것도 답입니다.');
  card(s, M + (cw + 0.3) * 2, 3.1, cw, 1.75, '③ 무엇이 빠졌습니까',
    '아이들이 앱을 쓰게 하려면 무엇이 더 있어야 할지 여쭙습니다.');

  askBox(s, 5.0, [
    '이 자료는 답을 정해 두고 확인받는 자료가 아닙니다. 기능을 덜어내야 한다는 말씀도 그대로 반영하겠습니다.',
    '현장에서 아이들을 만나 오신 선생님의 눈으로만 봐 주시면 됩니다. 아이들에게 따로 물어보실 필요는 없습니다.',
  ], 1.45);
  footer(s, 2);
}

// ══ 3. 문제 정의 ══════════════════════════════════════════
{
  const s = pres.addSlide();
  pageTitle(s, '왜 만들었나', '학교를 나오면 입시 정보를 물어볼\n어른이 사라집니다');

  const bw = (CW - 0.6) / 3;
  card(s, M, 2.35, bw, 2.2, '담임이 없습니다',
    '원서 접수 시기, 필요한 서류, 어떤 전형에 지원할 수 있는지를 알려 줄 사람이 없습니다.',
    { fill: WHITE, line: LINE });
  card(s, M + bw + 0.3, 2.35, bw, 2.2, '검정고시생은 기준이 다릅니다',
    '내신 등급이 없어 대학마다 "비교내신"이라는 다른 계산을 씁니다. 그 방식이 대학마다 제각각입니다.',
    { fill: WHITE, line: LINE });
  card(s, M + (bw + 0.3) * 2, 2.35, bw, 2.2, '정보가 흩어져 있습니다',
    '모집요강 PDF, 대교협 자료, 교육청 공고를 각각 찾아 읽어야 합니다.',
    { fill: WHITE, line: LINE });

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 4.85, w: CW, h: 1.35, rectRadius: 0.1,
    fill: { color: NAVY_DEEP }, line: { width: 0 },
  });
  s.addText('그래서 이 앱의 목표는 "많은 기능"이 아니라 "틀리지 않은 안내"입니다.', {
    x: M + 0.45, y: 5.05, w: CW - 0.9, h: 0.4, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 16, bold: true, color: WHITE,
  });
  s.addText('모르는 것은 아는 척하지 않고 "확인 필요"라고 적습니다. 합격을 보장하는 표현은 쓰지 않습니다.', {
    x: M + 0.45, y: 5.5, w: CW - 0.9, h: 0.45, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 13, color: 'C9D4E3',
  });
  footer(s, 3);
}

// ══ 4. 앱 한눈에 ══════════════════════════════════════════
{
  const s = pres.addSlide();
  pageTitle(s, '앱 한눈에', '다섯 개 영역으로 되어 있습니다');

  // 왼쪽 — 휴대폰 모형
  const px = M, py = 1.9, pw = 2.5, ph = 4.5;
  s.addShape(pres.ShapeType.roundRect, {
    x: px, y: py, w: pw, h: ph, rectRadius: 0.14,
    fill: { color: WHITE }, line: { color: NAVY, width: 1.5 },
  });
  s.addText('고3 · 경기', {
    x: px + 0.22, y: py + 0.3, w: pw - 0.44, h: 0.25, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 9, color: MUTED,
  });
  s.addShape(pres.ShapeType.roundRect, {
    x: px + 0.22, y: py + 0.62, w: pw - 0.44, h: 1.35, rectRadius: 0.09,
    fill: { color: PANEL }, line: { color: LINE, width: 1 },
  });
  s.addText('나의 대입 로드맵', {
    x: px + 0.38, y: py + 0.76, w: 1.0, h: 0.24, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 8, color: MUTED,
  });
  s.addShape(pres.ShapeType.roundRect, {
    x: px + pw - 1.06, y: py + 0.75, w: 0.82, h: 0.26, rectRadius: 0.13,
    fill: { color: YELLOW }, line: { width: 0 },
  });
  s.addText('D-42', {
    x: px + pw - 1.06, y: py + 0.75, w: 0.82, h: 0.26, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 8.5, bold: true, color: NAVY_DEEP, align: 'center', valign: 'middle',
  });
  s.addText('지금은 검정고시를\n준비할 때예요', {
    x: px + 0.38, y: py + 1.08, w: pw - 0.76, h: 0.55, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 11, bold: true, color: INK, lineSpacing: 15,
  });
  for (let i = 0; i < 4; i++) {
    s.addShape(pres.ShapeType.roundRect, {
      x: px + 0.38 + i * 0.45, y: py + 1.72, w: 0.37, h: 0.08, rectRadius: 0.04,
      fill: { color: i === 0 ? YELLOW : LINE }, line: { width: 0 },
    });
  }
  const tiles = [['대학 찾기', 0], ['커뮤니티', 1]];
  tiles.forEach(([t, i]) => {
    s.addShape(pres.ShapeType.roundRect, {
      x: px + 0.22 + i * 1.07, y: py + 2.12, w: 0.97, h: 0.75, rectRadius: 0.08,
      fill: { color: PANEL }, line: { color: LINE, width: 1 },
    });
    s.addText(t, {
      x: px + 0.22 + i * 1.07, y: py + 2.12, w: 0.97, h: 0.75, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 9.5, bold: true, color: INK, align: 'center', valign: 'middle',
    });
  });
  s.addShape(pres.ShapeType.roundRect, {
    x: px + 0.22, y: py + 3.0, w: pw - 0.44, h: 0.62, rectRadius: 0.08,
    fill: { color: NAVY }, line: { width: 0 },
  });
  s.addText('꿈드림센터 찾기', {
    x: px + 0.22, y: py + 3.0, w: pw - 0.44, h: 0.62, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 10.5, bold: true, color: WHITE, align: 'center', valign: 'middle',
  });
  s.addText('※ 화면은 개편 중입니다', {
    x: px, y: py + ph + 0.12, w: pw, h: 0.25, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 9, color: MUTED, align: 'center',
  });

  // 오른쪽 — 영역 5개
  const lx = M + pw + 0.55;
  const lw = W - M - lx;
  const areas = [
    ['홈', '지금 내 상태 요약 · 다른 영역으로 가는 길'],
    ['꿈드림센터', '가까운 센터 찾기 · 받을 수 있는 지원 안내'],
    ['진학지원', '대입의 전부 — 로드맵 · 내 점수 · 대학 찾기 · 서류'],
    ['커뮤니티', '같은 처지의 친구들과 나누는 게시판'],
    ['마이페이지', '내 정보 · 관심 대학 · 약관'],
  ];
  areas.forEach(([name, desc], i) => {
    const y = 1.95 + i * 0.86;
    s.addShape(pres.ShapeType.ellipse, {
      x: lx, y: y + 0.08, w: 0.46, h: 0.46, fill: { color: NAVY }, line: { width: 0 },
    });
    s.addText(String(i + 1), {
      x: lx, y: y + 0.08, w: 0.46, h: 0.46, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 14, bold: true, color: WHITE, align: 'center', valign: 'middle',
    });
    s.addText(name, {
      x: lx + 0.65, y: y + 0.02, w: lw - 0.65, h: 0.32, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 15, bold: true, color: INK,
    });
    s.addText(desc, {
      x: lx + 0.65, y: y + 0.34, w: lw - 0.65, h: 0.32, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12, color: MUTED,
    });
  });
  s.addText('로그인이 없습니다. 회원가입 없이 바로 쓰고, 입력한 내용은 그 기기에만 남습니다.', {
    x: lx, y: 6.4, w: lw, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12, bold: true, color: NAVY,
  });
  footer(s, 4);
}

// ══ 5. 기능 ① 꿈드림센터 ═════════════════════════════════
{
  const s = pres.addSlide();
  pageTitle(s, '핵심 기능 ①', '꿈드림센터 찾기 · 받을 수 있는 지원');

  statRow(s, M, 1.95, 2.6, '222', '곳', '전국 꿈드림센터 정보를\n앱 안에 담았습니다');
  s.addShape(pres.ShapeType.line, {
    x: M + 2.95, y: 1.95, w: 0, h: 1.15, line: { color: LINE, width: 1 },
  });

  const bx = M + 3.3, bw = W - M - bx;
  s.addText([
    { text: '센터 카드에서 바로 되는 것', options: { fontSize: 14, bold: true, color: INK, breakLine: true, paraSpaceAfter: 7 } },
    { text: '전화 걸기 · 지도 보기 · 홈페이지 열기', options: { fontSize: 13, color: MUTED, bullet: true, breakLine: true, paraSpaceAfter: 5 } },
    { text: '내 위치 기준으로 가까운 순서대로 정렬', options: { fontSize: 13, color: MUTED, bullet: true, breakLine: true, paraSpaceAfter: 5 } },
    { text: '"누구나 받을 수 있는 지원" 목록을 따로 정리', options: { fontSize: 13, color: MUTED, bullet: true } },
  ], { x: bx, y: 1.95, w: bw, h: 1.5, isTextBox: true, margin: 0, fontFace: F, lineSpacing: 19 });

  card(s, M, 3.45, (CW - 0.3) / 2, 1.45, '앱에서 가장 크게 다루는 기능입니다',
    '홈에서 제일 눈에 띄는 자리에 두었습니다. 온라인으로 다 해결하기보다, 실제 센터로 연결하는 것이 낫다고 보았습니다.',
    { fill: WHITE, line: NAVY });
  card(s, M + (CW - 0.3) / 2 + 0.3, 3.45, (CW - 0.3) / 2, 1.45, '지도는 지금 꺼 두었습니다',
    '지도 서비스 도메인 등록을 확인하기 전까지 기능을 막아 두었습니다. 자리만 잡아 둔 상태입니다.',
    { fill: WHITE, line: LINE });

  askBox(s, 5.05, [
    '222곳 센터 정보 중 틀리거나 빠진 곳이 있을까요? 특히 전화번호와 주소를 봐 주시면 감사하겠습니다.',
    '"누구나 받을 수 있는 지원" 목록에서 실제로 아이들이 가장 많이 쓰는 것은 무엇인가요?',
  ], 1.45);
  footer(s, 5);
}

// ══ 6. 기능 ② 대학 찾기 ══════════════════════════════════
{
  const s = pres.addSlide();
  pageTitle(s, '핵심 기능 ②', '대학 찾기 · 내 점수로 보는 지원 가능성');

  const sw = (CW - 0.9) / 4;
  statRow(s, M, 1.95, sw, '351', '개 대학', '4년제 213 · 전문대 138');
  statRow(s, M + (sw + 0.3), 1.95, sw, '2,496', '개 전형', '2027학년도 대교협 자료\n(195개 대학)');
  statRow(s, M + (sw + 0.3) * 2, 1.95, sw, '187', '개 전형', '검정고시가 지원할 수 없는\n전형을 따로 표시합니다');
  statRow(s, M + (sw + 0.3) * 3, 1.95, sw, '185', '개', '합격선 자료\n(2026학년도 70%컷)');

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 3.5, w: CW, h: 1.5, rectRadius: 0.1,
    fill: { color: PANEL }, line: { color: LINE, width: 1 },
  });
  s.addText('검정고시 점수를 넣으면 대학별로 이렇게 보여 줍니다', {
    x: M + 0.35, y: 3.7, w: CW - 0.7, h: 0.32, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 14, bold: true, color: INK,
  });
  const chips = [
    ['안정', '93C47D'], ['적정', 'A8C66C'], ['소신', YELLOW],
    ['도전', 'E8A33D'], ['어려움', 'D97757'], ['확인 필요', 'B0B7C0'],
  ];
  chips.forEach(([label, color], i) => {
    const x = M + 0.35 + i * 1.62;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 4.16, w: 1.42, h: 0.42, rectRadius: 0.21,
      fill: { color }, line: { width: 0 },
    });
    s.addText(label, {
      x, y: 4.16, w: 1.42, h: 0.42, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12, bold: true, color: NAVY_DEEP, align: 'center', valign: 'middle',
    });
  });
  s.addText('※ 규칙으로 계산한 참고값입니다. 합격을 보장하지 않습니다. 근거가 부족하면 "확인 필요"로 둡니다.', {
    x: M + 0.35, y: 4.66, w: CW - 0.7, h: 0.28, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 11, color: MUTED,
  });

  askBox(s, 5.2, [
    '"확인 필요"가 자주 뜨는 화면을 아이들이 어떻게 받아들일까요? 솔직하다고 볼까요, 못 믿겠다고 볼까요?',
    '지원 가능성을 다섯 단계로 나눈 것이 도움이 될까요, 오히려 부담이 될까요?',
  ], 1.45);
  footer(s, 6);
}

// ══ 7. 기능 ③ 로드맵 ═════════════════════════════════════
{
  const s = pres.addSlide();
  pageTitle(s, '핵심 기능 ③', '대입 로드맵 · 챙길 서류');

  const steps = ['검정고시', '내 점수', '대학 찾기', '원서·서류'];
  const tw = (CW - 0.9) / 4;
  steps.forEach((t, i) => {
    const x = M + i * (tw + 0.3);
    const on = i === 0;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 2.0, w: tw, h: 1.3, rectRadius: 0.09,
      fill: { color: on ? NAVY : WHITE }, line: { color: on ? NAVY : LINE, width: 1 },
    });
    s.addText(String(i + 1), {
      x: x + 0.25, y: 2.2, w: 0.6, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12, bold: true, color: on ? YELLOW : MUTED,
    });
    s.addText(t, {
      x: x + 0.25, y: 2.55, w: tw - 0.5, h: 0.45, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 15, bold: true, color: on ? WHITE : INK,
    });
  });
  s.addText('지금 어느 단계인지 앱이 표시하고, 가장 가까운 일정의 D-day를 함께 보여 줍니다.', {
    x: M, y: 3.45, w: CW, h: 0.32, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 13, color: INK,
  });

  card(s, M, 3.9, (CW - 0.3) / 2, 1.35, '일정은 공고된 해에만 날짜를 보여 줍니다',
    '아직 공고 전이면 D-day를 감추고 "예년엔 4월 초"처럼만 안내합니다.',
    { fill: WHITE, line: LINE });
  card(s, M + (CW - 0.3) / 2 + 0.3, 3.9, (CW - 0.3) / 2, 1.35, '서류 체크리스트가 같은 화면에 있습니다',
    '합격증명서·성적증명서 등 시기별로 챙길 것을 눌러서 지울 수 있습니다.',
    { fill: WHITE, line: LINE });

  askBox(s, 5.35, [
    '센터에서 아이들이 가장 자주 놓치는 시기나 서류는 무엇인가요? 로드맵에 더 넣어야 할 단계가 있을까요?',
    '학년을 묻지 않고도 쓸 수 있게 해 두었는데, 학년을 먼저 받는 편이 나을까요?',
  ], 1.45);
  footer(s, 7);
}

// ══ 8. 기능 ④ 검정고시 안내 + ⑤ 커뮤니티 ═════════════════
{
  const s = pres.addSlide();
  pageTitle(s, '핵심 기능 ④ ⑤', '검정고시 안내 · 커뮤니티');

  const hw = (CW - 0.4) / 2;
  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 1.95, w: hw, h: 2.95, rectRadius: 0.1,
    fill: { color: WHITE }, line: { color: LINE, width: 1 },
  });
  s.addText('④ 검정고시 안내', {
    x: M + 0.3, y: 2.15, w: hw - 0.6, h: 0.36, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 17, bold: true, color: NAVY,
  });
  s.addText([
    { text: '응시 자격을 "볼 수 있어요 / 볼 수 없어요" 두 칸으로 나눠 보여 줍니다', options: { bullet: true, breakLine: true, paraSpaceAfter: 6 } },
    { text: '필수 6과목과 선택 1과목, 합격 기준(평균 60점)을 정리했습니다', options: { bullet: true, breakLine: true, paraSpaceAfter: 6 } },
    { text: '과목합격제와 결시 처리처럼 잘못 알기 쉬운 것을 짚었습니다', options: { bullet: true, breakLine: true, paraSpaceAfter: 6 } },
    { text: '모든 내용에 확인한 공식 출처를 적어 두었습니다', options: { bullet: true } },
  ], {
    x: M + 0.3, y: 2.62, w: hw - 0.6, h: 2.1, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12.5, color: INK, lineSpacing: 19,
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: M + hw + 0.4, y: 1.95, w: hw, h: 2.95, rectRadius: 0.1,
    fill: { color: WHITE }, line: { color: LINE, width: 1 },
  });
  s.addText('⑤ 커뮤니티', {
    x: M + hw + 0.7, y: 2.15, w: hw - 0.6, h: 0.36, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 17, bold: true, color: NAVY,
  });
  s.addText([
    { text: '게시판 7개 — 자유 · 고민(익명) · 질문 · 정보 · 합격 후기 · 꿈드림 후기 · HOT', options: { bullet: true, breakLine: true, paraSpaceAfter: 6 } },
    { text: '인증 배지 3종 — 학교밖 인증 · 꿈드림 선생님 · 합격 멘토', options: { bullet: true, breakLine: true, paraSpaceAfter: 6 } },
    { text: '"질문" 게시판은 선생님·멘토가 답하는 구조로 두었습니다', options: { bullet: true, breakLine: true, paraSpaceAfter: 6 } },
    { text: '장터·홍보 게시판은 두지 않았습니다', options: { bullet: true } },
  ], {
    x: M + hw + 0.7, y: 2.62, w: hw - 0.6, h: 2.1, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12.5, color: INK, lineSpacing: 19,
  });

  askBox(s, 5.1, [
    '검정고시 안내에서 아이들이 가장 많이 오해하는 부분은 무엇인가요? 빠진 내용이 있을까요?',
    '커뮤니티 운영에 선생님이 답변자로 참여하시는 구조가 현실적으로 가능할까요? 부담이 되지는 않을까요?',
  ], 1.45);
  footer(s, 8);
}

// ══ 9. 검토 중 — 쪽지 기능 ═══════════════════════════════
{
  const s = pres.addSlide();
  pageTitle(s, '아직 만들지 않았습니다', '센터에 쪽지 보내기 — 넣을지 말지\n정하지 못했습니다');

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 2.35, w: CW, h: 1.1, rectRadius: 0.1,
    fill: { color: PANEL }, line: { color: LINE, width: 1 },
  });
  s.addText('아이가 센터에 전화하기 부담스러울 때, 앱에서 짧은 쪽지를 보내 미리 물어볼 수 있게 하자는 아이디어입니다.', {
    x: M + 0.35, y: 2.6, w: CW - 0.7, h: 0.6, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 14, color: INK, lineSpacing: 21,
  });

  const cw2 = (CW - 0.3) / 2;
  card(s, M, 3.62, cw2, 1.5, '넣는다면 걸리는 점',
    '이 앱은 로그인이 없습니다. 보낸 사람이 누구인지 표시할 방법이 없고, 센터에서는 답장을 보낼 곳이 없습니다.',
    { fill: WHITE, line: AMBER, titleColor: AMBER });
  card(s, M + cw2 + 0.3, 3.62, cw2, 1.5, '빼는 것도 답입니다',
    '전화·방문이 이미 되고 있다면 굳이 채널을 늘릴 이유가 없습니다. "필요 없다"는 답을 주셔도 괜찮습니다.',
    { fill: WHITE, line: LINE });

  askBox(s, 5.25, [
    '쪽지 기능이 센터 업무에 도움이 될까요, 아니면 처리할 일만 늘어날까요?',
    '필요하다면 답장은 어떤 방식이 좋을까요? (앱 안 / 문자 / 전화 회신)',
  ], 1.45);
  footer(s, 9);
}

// ══ 10. 데이터 출처 ══════════════════════════════════════
{
  const s = pres.addSlide();
  pageTitle(s, '무엇을 근거로 안내하나', '쓰고 있는 자료와 출처');

  const rows = [
    ['대학 · 학과 기본 정보', '351개 대학', '대학알리미 · 대교협'],
    ['2027학년도 전형', '2,496개 (195개 대학)', '대교협 대입정보포털'],
    ['2028학년도 시행계획', '1,007개 (351개 대학)', '각 대학 시행계획'],
    ['전문대 전형', '282개 (119개 대학)', '전문대교협 포털'],
    ['합격선', '185개 · 2026학년도', '대교협 어디가 70%컷'],
    ['비교내신 환산', '182개 대학 정리', '각 대학 모집요강'],
    ['꿈드림센터', '222곳', '여성가족부 · 각 센터'],
  ];
  const y0 = 2.0, rh = 0.52;
  const c1 = M + 0.3, c2 = M + 4.6, c3 = M + 8.2;
  s.addShape(pres.ShapeType.rect, {
    x: M, y: y0, w: CW, h: 0.46, fill: { color: NAVY }, line: { width: 0 },
  });
  [['항목', c1], ['담긴 양', c2], ['출처', c3]].forEach(([t, x]) => {
    s.addText(t, {
      x, y: y0, w: 3.6, h: 0.46, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12, bold: true, color: WHITE, valign: 'middle',
    });
  });
  rows.forEach(([a, b, c], i) => {
    const y = y0 + 0.46 + i * rh;
    if (i % 2 === 0) {
      s.addShape(pres.ShapeType.rect, {
        x: M, y, w: CW, h: rh, fill: { color: PANEL }, line: { width: 0 },
      });
    }
    s.addText(a, { x: c1, y, w: 4.2, h: rh, isTextBox: true, margin: 0, fontFace: F, fontSize: 12, bold: true, color: INK, valign: 'middle' });
    s.addText(b, { x: c2, y, w: 3.5, h: rh, isTextBox: true, margin: 0, fontFace: F, fontSize: 12, color: NAVY, valign: 'middle' });
    s.addText(c, { x: c3, y, w: 3.6, h: rh, isTextBox: true, margin: 0, fontFace: F, fontSize: 12, color: MUTED, valign: 'middle' });
  });

  s.addText('블로그나 학원 자료는 근거로 쓰지 않았습니다. 검정고시 관련 내용은 시·도교육청과 국가평생교육진흥원 자료로만 확인했습니다.', {
    x: M, y: 6.15, w: CW, h: 0.35, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12, bold: true, color: NAVY,
  });
  footer(s, 10);
}

// ══ 11. 한계 ═════════════════════════════════════════════
{
  const s = pres.addSlide();
  pageTitle(s, '솔직하게 말씀드립니다', '저희가 아직 못 하는 것');

  const items = [
    ['검정고시생만의 합격선은 어디에도 없습니다',
      '앱이 보여 주는 합격선은 전체 학생 기준 70%컷입니다. 검정고시 출신만 따로 집계한 자료는 공공데이터에도 없었습니다.'],
    ['비교내신 환산표를 182곳 중 27곳만 원문으로 확인했습니다',
      '나머지는 대학이 공개하지 않았거나 표현이 모호해 "확인 필요"로 두었습니다. 지어내지 않았습니다.'],
    ['2028학년도부터 내신이 5등급제로 바뀝니다',
      '이전 9등급 결과와 직접 비교할 수 없어, 2028학년도 지원은 가능성 계산을 하지 않습니다.'],
    ['서류·비교과에서 잃는 점수는 반영하지 못합니다',
      '학생부종합에서 검정고시생이 불리해지는 정도를 수치로 알 방법이 없습니다. 그래서 종합전형은 결과를 보수적으로 낮춰 보여 줍니다.'],
  ];
  items.forEach(([t, d], i) => {
    const y = 1.95 + i * 1.02;
    s.addShape(pres.ShapeType.ellipse, {
      x: M, y: y + 0.06, w: 0.34, h: 0.34, fill: { color: AMBER }, line: { width: 0 },
    });
    s.addText(String(i + 1), {
      x: M, y: y + 0.06, w: 0.34, h: 0.34, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12, bold: true, color: WHITE, align: 'center', valign: 'middle',
    });
    s.addText(t, {
      x: M + 0.52, y, w: CW - 0.52, h: 0.34, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 14, bold: true, color: INK,
    });
    s.addText(d, {
      x: M + 0.52, y: y + 0.36, w: CW - 0.52, h: 0.58, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12, color: MUTED, lineSpacing: 17,
    });
  });

  s.addText('이 한계를 숨기고 그럴듯하게 보이는 것보다, 모른다고 적는 쪽을 택했습니다. 이 판단이 맞는지도 여쭙고 싶습니다.', {
    x: M, y: 6.2, w: CW, h: 0.35, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 13, bold: true, color: NAVY,
  });
  footer(s, 11);
}

// ══ 12. 질문 모음 ════════════════════════════════════════
{
  const s = pres.addSlide();
  pageTitle(s, '정리하면', '이것들을 여쭙고 싶습니다');

  const hw = (CW - 0.4) / 2;

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 1.95, w: hw, h: 3.9, rectRadius: 0.1,
    fill: { color: WHITE }, line: { color: NAVY, width: 1.5 },
  });
  s.addText('기능이 쓸모가 있는지', {
    x: M + 0.3, y: 2.15, w: hw - 0.6, h: 0.36, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 16, bold: true, color: NAVY,
  });
  s.addText([
    { text: '넣어 둔 기능 중 현장에서 실제로 쓰일 것 같은 것은 무엇인가요?', options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: '반대로 "이건 없어도 되겠다" 싶은 기능이 있나요?', options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: '아이들이 앱을 계속 쓰게 하려면 무엇이 더 있어야 할까요?', options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: '센터에서 아이들이 가장 자주 묻는 입시 질문은 무엇인가요?', options: { bullet: true } },
  ], {
    x: M + 0.3, y: 2.62, w: hw - 0.6, h: 3.0, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12.5, color: INK, lineSpacing: 19,
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: M + hw + 0.4, y: 1.95, w: hw, h: 3.9, rectRadius: 0.1,
    fill: { color: WHITE }, line: { color: YELLOW, width: 1.5 },
  });
  s.addText('현장에서 쓰인다면', {
    x: M + hw + 0.7, y: 2.15, w: hw - 0.6, h: 0.36, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 16, bold: true, color: AMBER,
  });
  s.addText([
    { text: '센터에서 쓰신다면 어떤 방식일까요? 아이 혼자 보게 할지, 상담하며 같이 볼지.', options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: '쪽지 기능은 도움이 될까요, 처리할 일만 늘어날까요?', options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: '"확인 필요"가 자주 뜨는 것이 신뢰를 얻을까요, 잃을까요?', options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: '센터 정보 222곳 중 틀리거나 빠진 곳이 있을까요?', options: { bullet: true } },
  ], {
    x: M + hw + 0.7, y: 2.62, w: hw - 0.6, h: 3.0, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12.5, color: INK, lineSpacing: 19,
  });

  s.addText('모든 항목에 답하지 않으셔도 됩니다. 눈에 걸리는 것 한두 개만 짚어 주셔도 큰 도움이 됩니다.', {
    x: M, y: 6.1, w: CW, h: 0.35, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 13, color: MUTED,
  });
  footer(s, 12);
}

// ══ 13. 회신 ═════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY_DEEP };
  s.addShape(pres.ShapeType.ellipse, {
    x: -1.4, y: 4.3, w: 4.0, h: 4.0, fill: { color: NAVY }, line: { width: 0 },
  });

  s.addText('읽어 주셔서 감사합니다', {
    x: M, y: 1.55, w: CW, h: 0.8, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 38, bold: true, color: WHITE,
  });
  s.addText('이 앱이 실제로 아이들에게 쓸모가 있으려면, 현장에서 보시는 눈이 필요합니다.', {
    x: M, y: 2.45, w: CW, h: 0.45, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 16, color: 'C9D4E3',
  });

  const bw2 = (CW - 0.6) / 3;
  const ways = [
    ['앱 직접 보기', 'gumgomentor.vercel.app\n설치 없이 휴대폰으로 열립니다'],
    ['의견 보내실 곳', '【이메일 주소】\n【연락처】'],
    ['회신 희망일', '【날짜】\n편하신 때에 주셔도 괜찮습니다'],
  ];
  ways.forEach(([t, d], i) => {
    const x = M + i * (bw2 + 0.3);
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 3.35, w: bw2, h: 1.75, rectRadius: 0.1,
      fill: { color: NAVY }, line: { color: '3A5B84', width: 1 },
    });
    s.addText(t, {
      x: x + 0.3, y: 3.6, w: bw2 - 0.6, h: 0.35, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 14, bold: true, color: YELLOW,
    });
    s.addText(d, {
      x: x + 0.3, y: 4.0, w: bw2 - 0.6, h: 0.95, isTextBox: true, margin: 0,
      fontFace: F, fontSize: 12.5, color: 'D6E0EC', lineSpacing: 19,
    });
  });

  s.addText('검고담임 · 【팀명 / 소속】', {
    x: M, y: H - 1.05, w: 8, h: 0.32, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 12, color: '8FA3BC',
  });
  s.addNotes('이메일·연락처·회신 희망일은 캔바에서 채워 주세요.');
}

const out = process.argv[2] || 'kkumdrim-feedback.pptx';
pres.writeFile({ fileName: out }).then(() => console.log('완료:', out));
