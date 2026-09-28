// 광고에 넣을 실제 앱 화면을 배포본(gumgomentor.vercel.app)에서 찍는다.
// 화면 안의 카드·막대 위치(CSS px)도 같이 적어 두어, 광고에서 그 조각을
// 폰 밖으로 꺼낼 때 원래 자리와 정확히 겹치게 한다.
//
// 2026-09-28: 서연 UI(초록·종이색, 하단 탭 5개)로 바뀐 앱을 다시 찍도록 새로 썼다.
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
const TALL = 1400;

const browser = await chromium.launch({ channel: 'chrome' });
const meta = {};

async function newPage(height = VIEW.height) {
  const ctx = await browser.newContext({
    viewport: { width: VIEW.width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    locale: 'ko-KR', timezoneId: 'Asia/Seoul',
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(15000);
  p.W = (ms) => p.waitForTimeout(ms);
  return p;
}

// 시작 질문: 고3 나이 → 서울 → 꿈드림은 아직 → 이미 검정고시를 봤어요 (개인정보 없음)
async function onboard(p) {
  await p.goto(URL, { waitUntil: 'networkidle' }); await p.W(2400); // 스플래시 1.4초
  await p.click('text=시작할게요'); await p.W(600);
  await p.click('text=고3 나이'); await p.W(600);
  await p.click('text=서울'); await p.W(600);
  await p.click('text=아직이요'); await p.W(600);
  await p.click('text=이미 검정고시를 봤어요'); await p.W(1500);
}
async function home(p) {
  await p.goto(URL, { waitUntil: 'networkidle' }); await p.W(2600);
}
const tab = async (p, name) => { await p.locator('.sy-tab').filter({ hasText: name }).first().click(); await p.W(1400); };

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
  await p.W(700);
  await p.screenshot({ path: join(OUT, `${name}.png`) });
  meta[name] = { src: `assets/screens/${name}.png`, rects: await rects(p, map) };
  console.log('찍음', name, JSON.stringify(meta[name].rects));
}
// 긴 화면은 광고에서 폰 안을 스크롤한다. 하단 탭은 광고가 폰 바닥에 따로 붙이므로 찍을 때만 숨긴다.
const hideTabbar = (p) => p.addStyleTag({ content: '.sy-tabbar{visibility:hidden!important}' });

const TABS = {
  tab0: '.sy-tab >> nth=0', tab1: '.sy-tab >> nth=1', tab2: '.sy-tab >> nth=2',
  tab3: '.sy-tab >> nth=3', tab4: '.sy-tab >> nth=4', tabbar: '.sy-tabbar',
};
async function toExplore(p) {
  await p.locator('.sy-a-quick-item').nth(1).click(); await p.W(1600);
  await p.locator('.sy-c-filter').nth(0).locator('select').selectOption({ label: '서울' }); await p.W(900);
}

// ── A: 홈 → 대학 찾기(조건) · 꿈드림 · 커뮤니티 ──
{
  const p = await newPage();
  await onboard(p);
  await home(p);
  await shot(p, 'home', {
    header: '.sy-a-home-top', quick: '.sy-a-quick', rcard: '.sy-a-rcard', bar: '.sy-a-bar',
    seg0: '.sy-a-bar li >> nth=0 >> i', seg1: '.sy-a-bar li >> nth=1 >> i',
    seg2: '.sy-a-bar li >> nth=2 >> i', seg3: '.sy-a-bar li >> nth=3 >> i',
    lab0: '.sy-a-bar li >> nth=0 >> span', lab1: '.sy-a-bar li >> nth=1 >> span',
    lab2: '.sy-a-bar li >> nth=2 >> span', lab3: '.sy-a-bar li >> nth=3 >> span',
    quickUniv: '.sy-a-quick-item >> nth=1', ...TABS,
  });

  // 홈 위 '대학찾기' → 조건 필터
  await p.locator('.sy-a-quick-item').nth(1).click(); await p.W(1600);
  await shot(p, 'explore0', {
    filters: '.sy-c-filters', cta: '.sy-c-cta', f0: '.sy-c-filter >> nth=0',
    f0val: '.sy-c-filter >> nth=0 >> .sy-c-filter-val', search: '.sy-c-search', ...TABS,
  });
  await p.locator('.sy-c-filter').nth(0).locator('select').selectOption({ label: '서울' }); await p.W(900);
  await shot(p, 'explore1', { filters: '.sy-c-filters', cta: '.sy-c-cta', f0val: '.sy-c-filter >> nth=0 >> .sy-c-filter-val' });

  // 꿈드림 탭
  await tab(p, '꿈드림');
  await shot(p, 'centers', {
    hero: '.sy-b-hero', heroRow: '.sy-b-hero-row', center: '.sy-b-center-card',
    msgBtn: 'button:has-text("센터에 쪽지 보내기")', ...TABS,
  });
  // 센터에 쪽지 보내기 — 빈 화면 → 예시 문장을 적은 화면. 보내지는 않는다(시연 기능: 실제 센터로 가지 않는다)
  await p.click('button:has-text("센터에 쪽지 보내기")'); await p.W(1400);
  const MSG = { top: '.sy-top', body: '.sy-b-field >> nth=2', note: '.sy-b-note', wrap: '.sy-b-write-wrap' };
  await shot(p, 'thread0', MSG);
  await p.fill('#sy-b-body', '검정고시 학습 지원을 받고 싶어요. 언제 방문하면 될까요?'); await p.W(400);
  await p.evaluate(() => document.activeElement?.blur());
  await shot(p, 'thread1', MSG);
  await home(p);
  // 커뮤니티 탭 (시연 모드 — 예시 글)
  await tab(p, '커뮤니티');
  await shot(p, 'community', { boards: '.sy-e-boards', card0: '.sy-e-card >> nth=0', card1: '.sy-e-card >> nth=1', ...TABS });
  await p.context().close();
}

// ── B: 대학 목록 · 대학 정보 (긴 화면) ──
{
  const p = await newPage(TALL);
  await onboard(p); await home(p);
  await toExplore(p);
  await p.click('.sy-c-cta'); await p.W(1600);
  await hideTabbar(p);
  await shot(p, 'listTall', {
    top: '.sy-top', note: '.sy-c-note', list: '.sy-c-list',
    row: p.locator('.sy-c-row').filter({ hasText: '감리교신학대학교' }).first(),
  });
  await p.locator('.sy-c-row').filter({ hasText: '감리교신학대학교' }).first().click(); await p.W(1800);
  await hideTabbar(p);
  await shot(p, 'detailTall', {
    top: '.sy-top', coach: '.sy-d-coach', list: '.sy-d-list', adm0: '.sy-d-adm >> nth=0',
    adm2: '.sy-d-adm >> nth=2', pill0: '.sy-d-adm >> nth=0 >> .sy-d-pill',
  });
  await p.context().close();
}

// ── C: 전형 → 그 전형의 제출서류 (체크 두 개) ──
{
  const p = await newPage();
  await onboard(p); await home(p);
  await toExplore(p);
  await p.click('.sy-c-cta'); await p.W(1600);
  await p.locator('.sy-c-row').filter({ hasText: '감리교신학대학교' }).first().click(); await p.W(1800);
  await p.locator('.sy-d-adm').first().click(); await p.W(1800);
  const DOC = {
    top: '.sy-top', hero: '.sy-d-dochero', list: '.sy-d-doclist',
    c0: '.sy-d-doc >> nth=0 >> .sy-d-box', c1: '.sy-d-doc >> nth=1 >> .sy-d-box', ...TABS,
  };
  await shot(p, 'docs0', DOC);
  await p.locator('.sy-d-doc').nth(0).click(); await p.W(700);
  await shot(p, 'docs1', DOC);
  await p.locator('.sy-d-doc').nth(1).click(); await p.W(700);
  await shot(p, 'docs2', DOC);
  await p.context().close();
}

await browser.close();
writeFileSync(join(OUT, 'screens.js'),
  `// tools/capture-screens.mjs 가 만든 파일. 직접 고치지 말고 다시 찍는다.\n`
  + `// 찍은 날: ${new Date().toISOString().slice(0, 10)} · 원본: ${URL}\n`
  + `// rects = [x, y, 너비, 높이] (앱 화면 CSS px, 화면 너비 ${VIEW.width} · 높이 ${VIEW.height}, 긴 화면 ${TALL})\n`
  + `window.AD_SCREENS = ${JSON.stringify(meta, null, 2)};\n`);
console.log('끝');
