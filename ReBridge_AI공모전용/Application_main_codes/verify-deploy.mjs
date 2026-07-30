// 라이브 사이트가 "지금 실제로" 어떤 빌드를 서빙하는지 확인하는 스크립트.
// 사용법:  npm run verify
// 배포 후 이걸 돌려서 build 시각이 방금 빌드와 같으면 끝. 다르면 캐시/배포 문제.

const SITE = 'https://gumgomentor.vercel.app'; // 항상 이 고정 도메인만 본다 (해시 URL 금지)
const cb = () => `?cb=${Date.now()}`; // 엣지/브라우저 캐시 우회 — 진짜 최신 상태를 본다

const html = await (await fetch(SITE + '/' + cb(), { cache: 'no-store' })).text();
const jsPath = html.match(/\/assets\/[^"]+\.js/)?.[0];
if (!jsPath) {
  console.error('❌ index.html에서 JS 경로를 못 찾음. 사이트 응답 확인 필요.');
  process.exit(1);
}
const js = await (await fetch(SITE + jsPath + cb(), { cache: 'no-store' })).text();
const stamp = js.match(/\d{2}-\d{2} \d{2}:\d{2}/)?.[0] ?? '(스탬프 없음)';
const hasFilter = js.includes('지방거점');

console.log('────────────────────────────────');
console.log(' 라이브 사이트:', SITE);
console.log(' 서빙 중 JS   :', jsPath);
console.log(' 빌드 시각    :', stamp, '(KST)');
console.log(' 지역필터 포함:', hasFilter ? '✅' : '❌');
console.log('────────────────────────────────');
console.log(' 휴대폰에서 옛 화면이 보이면 → 캐시 문제.');
console.log(' 시크릿창으로 위 주소를 열거나, 주소 뒤에 ?v=' + Date.now() + ' 붙여서 확인.');
