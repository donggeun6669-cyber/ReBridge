// 광고 HTML → MP4 (1920×1080, 무음).
// 실시간 녹화가 아니라 한 프레임씩 시간을 옮겨 가며 찍기 때문에, 컴퓨터가 느려도 끊기거나 밀리지 않는다.
//
// 실행: node tools/render-mp4.mjs [출력파일] [--fps 30] [--from 0] [--to 50]
//   기본 출력: out/검고담임_광고_50초_1080p.mp4
//   필요한 것: 이 맥의 ffmpeg(libx264), Google Chrome, Playwright(npx 캐시)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const PW = process.env.PLAYWRIGHT_PATH
  || '/Users/r_o_und_12/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? Number(args[i + 1]) : d; };
const outArg = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const OUT = resolve(outArg || join(ROOT, 'out/검고담임_광고_50초_1080p.mp4'));
mkdirSync(dirname(OUT), { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const PAGE_URL = pathToFileURL(join(ROOT, 'index.html')).href + '?mode=capture&autoplay=0';
const open = async () => {
  await page.goto(PAGE_URL);
  await page.waitForFunction(() => window.AD && document.documentElement.classList.contains('is-ready'), null, { timeout: 30000 });
};
await open();
const { duration, fpsCfg } = await page.evaluate(() => ({ duration: window.AD.duration, fpsCfg: window.AD_CONFIG.fps }));
const FPS = opt('--fps', fpsCfg || 30);
const from = opt('--from', 0), to = Math.min(opt('--to', duration), duration);
const N = Math.round((to - from) * FPS);

const ff = spawn('ffmpeg', [
  '-y', '-v', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
  '-r', String(FPS), '-movflags', '+faststart',
  OUT,
], { stdio: ['pipe', 'inherit', 'inherit'] });
const ffDone = new Promise((res) => ff.on('close', res));

const t0 = Date.now();
// 안전장치: 5초 분량마다 페이지를 새로 연다. 화면은 시간 t로만 정해지므로 결과는 같다.
// (2026-09-20: 폰 속 화면이 흐려지던 원인은 '반투명으로 들어온 화면이 흐린 화질로 굳는 것'이었고
//  scenes.js 의 화면 넘김 방식을 바꿔 고쳤다. 새로 열기는 긴 세션의 캐시가 쌓이는 것을 막는 용도다.)
const RELOAD_EVERY = 5 * FPS;
for (let i = 0; i < N; i++) {
  if (i > 0 && i % RELOAD_EVERY === 0) await open();
  const t = from + i / FPS;
  await page.evaluate((v) => new Promise((r) => { window.AD.seek(v); requestAnimationFrame(() => requestAnimationFrame(r)); }), t);
  const buf = await page.screenshot({ type: 'png' });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % FPS === 0) process.stdout.write(`\r${(i / FPS).toFixed(0).padStart(3)}초 / ${(N / FPS).toFixed(0)}초  (${((Date.now() - t0) / 1000).toFixed(0)}초 걸림)`);
}
ff.stdin.end();
const code = await ffDone;
await browser.close();
console.log(`\n프레임 ${N}개 · ${FPS}fps · ${code === 0 ? '완료' : 'ffmpeg 실패 ' + code} → ${OUT}`);
if (errors.length) console.log('콘솔 오류:', errors.join(' / '));
process.exit(code === 0 && !errors.length ? 0 : 1);
