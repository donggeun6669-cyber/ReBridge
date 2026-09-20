// 광고 HTML 점검 — 실제 Chrome으로 열어 재생·조작·촬영 모드·QR·글자 넘침을 확인한다.
// 실행: node tools/verify.mjs [--full]   (--full 이면 50초 실시간 재생까지 본다)
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const PW = process.env.PLAYWRIGHT_PATH
  || '/Users/r_o_und_12/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL = pathToFileURL(join(ROOT, 'index.html')).href;
const FULL = process.argv.includes('--full');

const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
const watch = (page) => {
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push('요청 실패 ' + r.url()));
};
const ready = (page) => page.waitForFunction(() => window.AD && document.documentElement.classList.contains('is-ready'), null, { timeout: 30000 });
// 두 캡처를 픽셀로 비교 — 눈에 보이는 차이(한 채널이라도 16단계 넘게 다른 픽셀) 수를 센다.
// 그림자 그라데이션의 1단계 반올림 같은 렌더링 잡음은 세지 않는다.
const visibleDiff = (page, a, b) => page.evaluate(async ([x, y]) => {
  const load = async (s) => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); return im; };
  const [A, B] = await Promise.all([load(x), load(y)]);
  const c = document.createElement('canvas'); c.width = A.width; c.height = A.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(A, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data;
  g.clearRect(0, 0, c.width, c.height); g.drawImage(B, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < da.length; i += 4) {
    if (Math.abs(da[i] - db[i]) > 16 || Math.abs(da[i + 1] - db[i + 1]) > 16 || Math.abs(da[i + 2] - db[i + 2]) > 16) n++;
  }
  return n;
}, [a.toString('base64'), b.toString('base64')]);
const frames = (page, n = 2) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

// ── 1. 미리보기 모드: 조작부 ──
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  watch(page);
  await page.goto(URL);
  await ready(page);
  const st = await page.evaluate(() => window.AD.status);
  ok('글꼴·이미지 불러오기', st.fontOk && st.failed.length === 0, `이미지 ${st.images}개, 실패 ${st.failed.length}개, 글꼴 ${st.fontOk ? '정상' : '실패'}`);
  const fontName = await page.evaluate(() => getComputedStyle(document.querySelector('.cl-line')).fontFamily);
  ok('광고 글꼴이 Wanted Sans', /Wanted Sans/.test(fontName), fontName.split(',')[0]);

  await page.waitForTimeout(1500);
  const t1 = await page.evaluate(() => window.AD.time);
  ok('자동 재생', t1 > 0.8 && t1 < 3, `1.5초 뒤 ${t1.toFixed(2)}초`);

  await page.click('[data-a=play]');
  const p0 = await page.evaluate(() => window.AD.time);
  await page.waitForTimeout(800);
  const p1 = await page.evaluate(() => window.AD.time);
  ok('일시정지', !(await page.evaluate(() => window.AD.playing)) && Math.abs(p1 - p0) < 0.001, `멈춘 뒤 0.8초 동안 ${Math.abs(p1 - p0).toFixed(3)}초 변화`);

  await page.fill('[data-a=range]', '25');
  await page.dispatchEvent('[data-a=range]', 'input');
  const s1 = await page.evaluate(() => window.AD.time);
  ok('구간 이동(재생 막대)', Math.abs(s1 - 25) < 0.01, `${s1.toFixed(2)}초`);

  const btns = await page.$$('.scene-btn');
  const want = [0, 6, 12, 23, 34, 43];
  let sceneOk = btns.length === 6;
  for (let i = 0; i < btns.length; i++) {
    await btns[i].click();
    const v = await page.evaluate(() => window.AD.time);
    if (Math.abs(v - want[i]) > 0.01) sceneOk = false;
  }
  ok('장면 버튼 6개로 이동', sceneOk, want.join('·') + '초');

  await page.click('[data-a=restart]');
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => ({ t: window.AD.time, p: window.AD.playing }));
  ok('처음부터', r.p && r.t < 0.8, `${r.t.toFixed(2)}초, 재생 중 ${r.p}`);

  await page.evaluate(() => { window.AD.pause(); window.AD.seek(49.7); window.AD.play(); });
  await page.waitForTimeout(900);
  const lp = await page.evaluate(() => ({ t: window.AD.time, p: window.AD.playing }));
  ok('반복 재생(끝 → 처음)', lp.p && lp.t < 1.2, `49.7초에서 0.9초 뒤 ${lp.t.toFixed(2)}초`);

  await page.evaluate(() => window.AD.setLoop(false));
  await page.evaluate(() => { window.AD.seek(49.6); window.AD.play(); });
  await page.waitForTimeout(900);
  const nl = await page.evaluate(() => ({ t: window.AD.time, p: window.AD.playing }));
  ok('반복 끄면 끝에서 멈춤', !nl.p && nl.t === 50, `${nl.t.toFixed(2)}초`);
  await page.evaluate(() => window.AD.setLoop(true));

  // ── 소리 (미리보기) ──
  {
    const inStage = await page.evaluate(() => {
      const st = document.getElementById('stage');
      return [...document.querySelectorAll('[data-a=sound], [data-a=vol]')].some((e) => st.contains(e));
    });
    ok('소리 버튼·음량이 광고 화면 밖에 있음', !inStage);

    await page.evaluate(() => { window.AD.pause(); window.AD.seek(0); });
    await page.click('[data-a=sound]');                       // 사용자 클릭으로만 소리를 켠다
    await page.waitForTimeout(500);
    ok('클릭하면 소리가 켜짐', await page.evaluate(() => window.AD.sound));

    await page.evaluate(() => { window.AD.seek(20); });
    const atSeek = await page.evaluate(() => document.querySelector('audio').currentTime);
    ok('구간 이동에 소리도 따라감', Math.abs(atSeek - 20) < 0.06, `오디오 ${atSeek.toFixed(2)}초`);

    await page.evaluate(() => window.AD.play());
    await page.waitForTimeout(1200);
    const sync = await page.evaluate(() => ({ t: window.AD.time, a: document.querySelector('audio').currentTime }));
    ok('재생 중 화면과 소리가 같은 시계로 감', Math.abs(sync.t - sync.a) < 0.06 && sync.t > 20.3,
      `화면 ${sync.t.toFixed(2)}초 · 소리 ${sync.a.toFixed(2)}초`);

    await page.evaluate(() => { window.AD.pause(); });
    ok('일시정지에 소리도 멈춤', await page.evaluate(() => document.querySelector('audio').paused));

    await page.evaluate(() => { window.AD.seek(49.3); window.AD.play(); });
    await page.waitForTimeout(1600);
    const looped = await page.evaluate(() => ({ t: window.AD.time, n: document.querySelectorAll('audio').length, p: document.querySelector('audio').paused }));
    ok('반복해도 소리가 겹치지 않음', looped.n === 1 && looped.t < 2.5 && !looped.p, `오디오 요소 ${looped.n}개, ${looped.t.toFixed(2)}초`);
    await page.evaluate(() => { window.AD.pause(); window.AD.disableSound(); window.AD.seek(0); });
  }

  // 화면 비율: 여러 창 크기에서 16:9 유지
  const ratios = [];
  for (const [w, h] of [[1600, 1000], [1280, 900], [900, 1200], [2560, 1300]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    const b = await page.locator('#stage').boundingBox();
    const bar = await page.locator('#controls').boundingBox();
    ratios.push({ w, h, r: b.width / b.height, fits: b.x >= -0.5 && b.y >= -0.5 && b.x + b.width <= w + 0.5 && b.y + b.height <= bar.y + 0.5 });
  }
  ok('창 크기가 달라도 16:9·잘림 없음', ratios.every((x) => Math.abs(x.r - 16 / 9) < 0.002 && x.fits),
    ratios.map((x) => `${x.w}×${x.h}:${x.r.toFixed(4)}${x.fits ? '' : '(넘침)'}`).join(' '));
  await page.close();
}

// ── 2. 촬영 모드 ──
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  watch(page);
  await page.goto(URL + '?mode=capture&autoplay=0');
  await ready(page);
  const ui = await page.evaluate(() => {
    const c = document.getElementById('controls');
    const cs = getComputedStyle(c);
    const txt = document.getElementById('stage').innerText;
    return { display: cs.display, hidden: c.hidden, h: c.getBoundingClientRect().height, time: /\d+\.\d\d\s*\/\s*\d/.test(txt), cursor: getComputedStyle(document.body).cursor };
  });
  ok('촬영 모드: 조작부·시간 표시 없음', ui.display === 'none' && ui.h === 0 && !ui.time, `controls display=${ui.display}, 커서 ${ui.cursor}`);
  const noAudio = await page.evaluate(() => ({ els: document.querySelectorAll('audio').length, on: window.AD.sound }));
  ok('촬영 모드에서는 오디오를 만들지 않음', noAudio.els === 0 && noAudio.on === false, `<audio> ${noAudio.els}개`);
  const b = await page.locator('#stage').boundingBox();
  ok('촬영 모드: 1920×1080 꽉 채움', Math.round(b.width) === 1920 && Math.round(b.height) === 1080 && Math.round(b.x) === 0 && Math.round(b.y) === 0, `${b.width}×${b.height} @${b.x},${b.y}`);

  // 같은 시점은 늘 같은 화면 (다른 곳을 거쳐 와도)
  const shot = async (seq) => {
    for (const v of seq) { await page.evaluate((x) => window.AD.seek(x), v); await frames(page); }
    return page.screenshot();
  };
  const pts = [3.3, 13.9, 17.2, 23.0, 25.4, 33.2, 38.1, 47.0];
  let same = 0;
  for (const p of pts) {
    const a = await shot([p]);
    const c = await shot([49, 2, 30, p]);
    const n = Buffer.compare(a, c) === 0 ? 0 : await visibleDiff(page, a, c);
    if (n === 0) same++;
    else console.log('   다름:', p, `${n}픽셀`);
  }
  ok('시점 재현(다른 시점을 거쳐 와도 같은 화면)', same === pts.length, `${same}/${pts.length}`);

  // 재생으로 도착한 화면 = 바로 이동한 화면
  await page.evaluate(() => { window.AD.seek(16.5); window.AD.play(); });
  await page.waitForTimeout(700);
  const tp = await page.evaluate(() => { window.AD.pause(); return window.AD.time; });
  await page.waitForTimeout(1200); // 움직임이 멈춘 뒤 브라우저가 선명하게 다시 그릴 시간
  const viaPlay = await page.screenshot();
  await shot([0, tp]);
  await page.waitForTimeout(1200);
  const direct = await page.screenshot();
  const dPlay = Buffer.compare(viaPlay, direct) === 0 ? 0 : await visibleDiff(page, viaPlay, direct);
  ok('재생 후 멈춘 화면 = 같은 시점으로 이동한 화면', dPlay === 0, `${tp.toFixed(3)}초, 눈에 보이는 차이 ${dPlay}픽셀`);

  // 글자가 화면 밖으로 넘치지 않는지 (장면별 카피가 다 보이는 시점)
  const copyTimes = [3.2, 9.8, 18.0, 32.8, 41.5, 47.0];
  const over = [];
  for (const v of copyTimes) {
    await page.evaluate((x) => window.AD.seek(x), v); await frames(page);
    const bad = await page.evaluate(() => {
      const out = [];
      // 3D 공간의 정거장 카드는 카메라가 움직이며 화면 가장자리를 드나드는 것이 정상이라 뺀다
        document.querySelectorAll('.cl-line, .end-line1, .end-brand b, .qr-card, .pill').forEach((e) => {
        const cs = getComputedStyle(e);
        let vis = true; let n = e;
        while (n && n !== document.body) { if (getComputedStyle(n).visibility === 'hidden' || getComputedStyle(n).opacity === '0') { vis = false; break; } n = n.parentElement; }
        if (!vis || cs.display === 'none') return;
        const r = e.getBoundingClientRect();
        if (r.width === 0) return;
        if (r.left < -1 || r.right > 1921 || r.top < -1 || r.bottom > 1081) out.push(`${e.className}:${e.textContent.trim().slice(0, 12)} [${Math.round(r.left)},${Math.round(r.top)}~${Math.round(r.right)},${Math.round(r.bottom)}]`);
        if (e.classList.contains('cl-line') && e.scrollWidth > e.clientWidth + 1) out.push('줄 넘침 ' + e.textContent);
      });
      return out;
    });
    if (bad.length) over.push(`${v}s: ${bad.join(', ')}`);
  }
  ok('카피·표시 글자가 화면 안에 들어옴', over.length === 0, over.join(' / '));

  // 카피가 한 줄씩 끊기지 않고 그대로 나오는지
  const lines = await page.evaluate(() => [...document.querySelectorAll('.cl-line')].map((e) => e.textContent));
  ok('카피 문구', lines.length === 9, lines.join(' | '));

  // QR: 브라우저의 바코드 인식으로 실제 주소를 읽어 본다
  await page.evaluate(() => window.AD.seek(47)); await frames(page);
  // 마지막 화면에 실제로 그려진 QR을 캡처해서 판독한다(보는 사람이 찍는 것과 같은 조건)
  const box = await page.locator('.qr-card .qr').boundingBox();
  const png = await page.screenshot({ clip: { x: box.x - 20, y: box.y - 20, width: box.width + 40, height: box.height + 40 } });
  const qr = await page.evaluate(async (b64) => {
    if (!('BarcodeDetector' in window)) return { err: 'BarcodeDetector 없음' };
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const r = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(img);
    return { v: r.map((x) => x.rawValue) };
  }, png.toString('base64'));
  if (qr.err) {
    // 대신 화면 캡처를 파일로 남겨 사람이 폰으로 찍어 보게 한다
    ok('QR 목적지(자동 판독)', false, qr.err + ' — 수동 확인 필요');
  } else ok('QR 목적지', qr.v[0] === 'https://gumgomentor.vercel.app', JSON.stringify(qr.v));

  // ── 3. 실시간 50초 재생 ──
  if (FULL) {
    await page.evaluate(() => { window.__fr = 0; const f = () => { window.__fr++; requestAnimationFrame(f); }; requestAnimationFrame(f); window.AD.seek(0); window.AD.play(); });
    const t0 = Date.now();
    const samples = [];
    while (Date.now() - t0 < 51000) {
      await page.waitForTimeout(5000);
      samples.push(await page.evaluate(() => ({ t: window.AD.time, fr: window.__fr })));
    }
    const fps = samples[samples.length - 1].fr / ((Date.now() - t0) / 1000);
    const wrapped = samples.findIndex((x, i) => i > 0 && x.t < samples[i - 1].t);
    ok('50초 실시간 재생 후 처음으로 돌아옴', wrapped > 0 && samples[wrapped].t < 3 && samples[wrapped - 1].t > 44, samples.map((s) => s.t.toFixed(1)).join(' → ') + ` · 평균 ${fps.toFixed(0)}fps`);
  }
  await page.close();
}

ok('콘솔 오류·경고 없음', errors.length === 0, errors.slice(0, 5).join(' / '));
await browser.close();
const fail = results.filter((r) => !r.pass).length;
console.log(`\n결과: ${results.length - fail}/${results.length} 통과`);
process.exit(fail ? 1 : 0);
