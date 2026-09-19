// 광고에 넣을 실제 앱 화면을 배포본(gumgomentor.vercel.app)에서 찍는다.
// 화면 안의 카드·선 위치(CSS px)도 같이 적어 두어, 광고에서 그 조각을
// 폰 밖으로 꺼낼 때 원래 자리와 정확히 겹치게 한다.
//
// 실행: node tools/capture-screens.mjs
//   - Playwright는 이 맥에 이미 있는 npx 캐시를 쓴다(새로 설치하지 않음).
//     다른 위치면 PLAYWRIGHT_PATH 환경변수로 index.mjs 경로를 넘긴다.
//   - 브라우저는 설치된 Google Chrome(channel: 'chrome')을 쓴다.
//
// 결과: assets/screens/*.png (3배 해상도) + assets/screens/screens.js (조각 위치)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PW = process.env.PLAYWRIGHT_PATH
  || '/Users/r_o_und_12/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets/screens');
const URL = 'https://gumgomentor.vercel.app';
// 폰 화면 = 상태 표시줄(광고에서 그림) 44 + 앱 800
const VIEW = { width: 390, height: 800 };
// 예시 점수 — 실제 학생 점수가 아니다. 광고 화면에 '예시'로 표시한다.
const EXAMPLE_SCORES = [96, 92, 95, 97, 94, 98];

const browser = await chromium.launch({ channel: 'chrome' });
const meta = {};

async function newPage() {
  const ctx = await browser.newContext({
    viewport: VIEW, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });
  const p = await ctx.newPage();
  p.W = (ms) => p.waitForTimeout(ms);
  return p;
}

// 시작 질문: 고3 나이 → 서울 → 이미 검정고시를 봤어요 (개인정보 없음)
async function onboard(p) {
  await p.goto(URL, { waitUntil: 'networkidle' }); await p.W(1500);
  await p.click('text=시작하기'); await p.W(500);
  await p.click('text=고3 나이'); await p.W(500);
  await p.click('text=서울'); await p.W(500);
  await p.click('text=이미 검정고시를 봤어요'); await p.W(900);
}

async function home(p) {
  await p.goto(URL, { waitUntil: 'networkidle' }); await p.W(1500);
}

async function rects(p, map) {
  const out = {};
  for (const [k, sel] of Object.entries(map)) {
    const loc = typeof sel === 'string' ? p.locator(sel).first() : sel;
    const b = await loc.boundingBox();
    if (!b) throw new Error(`위치를 못 찾음: ${k}`);
    out[k] = [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 10) / 10);
  }
  return out;
}

async function shot(p, name, map = {}) {
  await p.W(500);
  await p.screenshot({ path: join(OUT, `${name}.png`) });
  meta[name] = { src: `assets/screens/${name}.png`, rects: await rects(p, map) };
  console.log('찍음', name, JSON.stringify(meta[name].rects));
}

// 앱은 .screen 안에서 스크롤한다 → 스크롤 가능한 조상을 찾아 옮긴다
async function scrollTo(p, sel, top = 0) {
  await p.locator(sel).first().evaluate((el, top) => {
    let s = el.parentElement;
    while (s && !(s.scrollHeight > s.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
    const target = s || document.scrollingElement;
    const r = el.getBoundingClientRect();
    target.scrollTop += r.top - top;
  }, top);
  await p.W(400);
}

// ── A: 점수 넣기 전 상태 (합격 판정 문구가 뜨지 않는 상태) ──
{
  const p = await newPage();
  await onboard(p);
  await home(p);
  await shot(p, 'home', {
    road: '.hm-road', steps: '.hm-steps', cta: '.hm-cta', title: '.hm-title', tiles: '.hm-tiles',
    dot0: '.hm-step >> nth=0 >> .hm-step-dot', dot1: '.hm-step >> nth=1 >> .hm-step-dot',
    dot2: '.hm-step >> nth=2 >> .hm-step-dot', dot3: '.hm-step >> nth=3 >> .hm-step-dot',
  });

  await p.click('.hm-road'); await p.W(1000);
  await shot(p, 'roadmap', {
    card: '.rj-card', steps: '.rj-steps',
    s0: '.rj-step >> nth=0', s1: '.rj-step >> nth=1', s2: '.rj-step >> nth=2', s3: '.rj-step >> nth=3',
    dates: '.rj-dates',
  });

  // 챙길 서류 — 로드맵 화면 안의 구역
  await scrollTo(p, '.rm-docs', 16);
  await shot(p, 'docs', { docs: '.rm-docs', item0: '.cl-item >> nth=0', item1: '.cl-item >> nth=1', item2: '.cl-item >> nth=2', progress: '.cl-progress-wrap', c0: '.cl-item >> nth=0 >> .cl-check', c1: '.cl-item >> nth=1 >> .cl-check' });
  // 체크 표시 — 앱의 실제 동작(이 기기에만 저장). 스크롤 위치가 바뀌지 않았는지 위치도 같이 적는다
  await p.click('.cl-item >> nth=0 >> .cl-check'); await p.W(500);
  await shot(p, 'docs1', { item0: '.cl-item >> nth=0', progress: '.cl-progress-wrap' });
  await p.click('.cl-item >> nth=1 >> .cl-check'); await p.W(500);
  await shot(p, 'docs2', { item1: '.cl-item >> nth=1', progress: '.cl-progress-wrap' });

  // 일정 순서
  await home(p); await p.click('.hm-road'); await p.W(900);
  await p.click('text=일정 순서'); await p.W(900);
  await shot(p, 'plan', {});

  // 대학 찾기 → 가나다순 목록
  await home(p); await p.click('.hm-road'); await p.W(900);
  await p.click('text=지역·전형으로 찾기'); await p.W(1500);
  await shot(p, 'explore', { count: 'text=/개 대학 · 가나다순/', filter: 'button:has-text("필터")' });
  await scrollTo(p, 'text=가톨릭꽃동네대학교', 250);
  await shot(p, 'explore2', { row: p.locator('.uni-card').filter({ hasText: '감리교신학대학교' }).first() });

  // 필터 펼침
  await p.goto(URL, { waitUntil: 'networkidle' }); await p.W(1200);
  await p.click('.hm-road'); await p.W(900);
  await p.click('text=지역·전형으로 찾기'); await p.W(1500);
  await p.click('button:has-text("필터")'); await p.W(800);
  await shot(p, 'filter', {});

  // 대학 상세
  await home(p); await p.click('.hm-road'); await p.W(900);
  await p.click('text=지역·전형으로 찾기'); await p.W(1500);
  await p.click('text=감리교신학대학교'); await p.W(1500);
  await shot(p, 'detail', { matrix: '.adm-matrix-card', adm0: '.adm-card >> nth=0' });
  // 전형 카드 펼침
  const card = p.locator('text=학생부교과(검정고시출신자전형)').first();
  await card.click(); await p.W(900);
  await scrollTo(p, 'text=학생부교과(검정고시출신자전형)', 24);
  await shot(p, 'card', { card: '.adm-card.open', ged: '.ged2027-block', fit: '.fit-block', conv: 'text=비교내신 환산표 있음' });

  // 꿈드림센터 — 위치 권한은 '그냥 볼게요'
  await home(p); await p.click('text=꿈드림센터'); await p.W(1200);
  await p.click('text=그냥 볼게요').catch(() => {}); await p.W(700);
  await shot(p, 'dream', { tiles: '.rd-tiles', t0: '.rd-tiles > * >> nth=0', t3: '.rd-tiles > * >> nth=3' });

  // 담임에게 물어보기 (용어·자주 묻는 질문)
  await home(p); await p.click('text=담임에게'); await p.W(1200);
  await shot(p, 'help', { search: '.search-bar', f0: '.help-faq-card >> nth=0', f1: '.help-faq-card >> nth=1', f2: '.help-faq-card >> nth=2', f3: '.help-faq-card >> nth=3' });
  await p.context().close();
}

// ── 대학 탐색 목록을 길게 — 광고에서 폰 안 목록을 실제처럼 스크롤한다 ──
{
  const p = await newPage();
  await p.setViewportSize({ width: 390, height: 1400 });
  await onboard(p); await home(p);
  await p.click('.hm-road'); await p.W(900);
  await p.click('text=지역·전형으로 찾기'); await p.W(1500);
  await shot(p, 'exploreTall', {
    head: 'text=/개 대학 · 가나다순/', filter: 'button:has-text("필터")',
    row: p.locator('.uni-card').filter({ hasText: '감리교신학대학교' }).first(),
  });
  await p.click('text=감리교신학대학교'); await p.W(1500);
  await shot(p, 'detailTall', { matrix: '.adm-matrix-card', adm0: '.adm-card >> nth=0' });
  await p.context().close();
}

// ── B: 점수 입력 화면 (예시 점수) ──
{
  const p = await newPage();
  await onboard(p); // 점수가 없으면 여기서 '내 정보' 화면으로 온다
  const IN = { in0: 'input >> nth=0', in1: 'input >> nth=1', in2: 'input >> nth=2', in3: 'input >> nth=3', in4: 'input >> nth=4', in5: 'input >> nth=5' };
  await shot(p, 'score0', { avg: 'text=/점수를 넣으면 평균과/', ...IN });
  const ins = await p.$$('input');
  for (let i = 0; i < 6; i++) await ins[i].fill(String(EXAMPLE_SCORES[i]));
  await p.W(500);
  await p.evaluate(() => document.activeElement?.blur());
  await shot(p, 'score', { avg: 'text=/입력 6과목/', label: 'text=검정고시 과목 점수', ...IN });
  await p.context().close();
}

await browser.close();
writeFileSync(join(OUT, 'screens.js'),
  `// tools/capture-screens.mjs 가 만든 파일. 직접 고치지 말고 다시 찍는다.\n`
  + `// 찍은 날: ${new Date().toISOString().slice(0, 10)} · 원본: ${URL}\n`
  + `// rects = [x, y, 너비, 높이] (앱 화면 CSS px, 화면 크기 ${VIEW.width}×${VIEW.height})\n`
  + `window.AD_SCREENS = ${JSON.stringify(meta, null, 2)};\n`);
console.log('끝');
