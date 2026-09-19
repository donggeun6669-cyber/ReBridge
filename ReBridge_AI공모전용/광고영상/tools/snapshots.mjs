// 광고의 특정 시점을 1920×1080 PNG로 찍는다 (점검·보고용).
// 실행: node tools/snapshots.mjs [출력폴더] [시간1 시간2 ...]
//   예) node tools/snapshots.mjs out/snapshots 3 9 15 20 26
//   시간을 안 주면 장면마다 대표 시점을 찍는다.
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const PW = process.env.PLAYWRIGHT_PATH
  || '/Users/r_o_und_12/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [outArg, ...times] = process.argv.slice(2);
const OUT = resolve(outArg || join(ROOT, 'out/snapshots'));
mkdirSync(OUT, { recursive: true });
const T = times.length ? times.map(Number) : [2.5, 9.5, 13.2, 15.2, 18.5, 22.2, 25.5, 27.2, 30.0, 32.5, 35.5, 38.5, 40.5, 42.2, 47.5];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => errors.push(`[requestfailed] ${r.url()}`));

const url = pathToFileURL(join(ROOT, 'index.html')).href + '?mode=capture&autoplay=0';
await page.goto(url);
await page.waitForFunction(() => window.AD && document.documentElement.classList.contains('is-ready'), null, { timeout: 30000 });
const status = await page.evaluate(() => window.AD.status);
console.log('불러오기:', JSON.stringify(status));
for (const t of T) {
  await page.evaluate((v) => window.AD.seek(v), t);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const f = join(OUT, `t${t.toFixed(2).padStart(5, '0')}.png`);
  await page.screenshot({ path: f });
  console.log('찍음', f);
}
console.log(errors.length ? `콘솔 오류 ${errors.length}건:\n${errors.join('\n')}` : '콘솔 오류 0건');
await browser.close();
