// 라이브 사이트가 "지금 실제로" 어떤 빌드를 서빙하는지 확인하는 스크립트.
// 사용법:  npm run verify
// 배포 후 이걸 돌려서 build 시각이 방금 빌드와 같으면 끝. 다르면 캐시/배포 문제.
//
// ⚠️ 2026-09 수정: 예전엔 index.html에서 JS를 '하나만' 받아 거기서 스탬프를 찾았다.
//    코드 스플리팅이 들어간 뒤 빌드 스탬프는 MyPageScreen 청크로, 화면 문자열은
//    ExploreScreen/GuideScreen 청크로 흩어져서, 배포가 멀쩡해도 항상 실패로 나왔다.
//    지금은 index.html이 참조하는 청크를 따라가며 전부 훑는다.

// 기본은 운영 주소. PR 프리뷰를 검사하려면 주소를 인자로 준다:
//   node verify-deploy.mjs https://rebridge-xxxx.vercel.app
const SITE = (process.argv[2] || 'https://gumgomentor.vercel.app').replace(/\/$/, '');
const cb = () => `?cb=${Date.now()}`; // 엣지/브라우저 캐시 우회 — 진짜 최신 상태를 본다

// 배포본에 있어야 하는 것들. 화면을 크게 바꾸면 여기도 같이 손본다.
const MARKERS = [
  { label: '지역 필터',      test: (js) => js.includes('지방거점') },
  { label: '시작 화면',      test: (js) => js.includes('어서 와요') },
  { label: '목록 안내 분리', test: (js) => js.includes('이 목록 읽는 법') },
];

const get = async (url) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
};

const html = await get(SITE + '/' + cb());

// index.html이 직접 참조하는 자바스크립트(진입점 + modulepreload)
const entries = [...new Set([...html.matchAll(/\/assets\/[^"']+\.js/g)].map((m) => m[0]))];
if (entries.length === 0) {
  console.error('❌ index.html에서 JS 경로를 못 찾음. 사이트 응답 확인 필요.');
  process.exit(1);
}

// 진입점이 lazy import하는 청크까지 한 겹 따라간다(화면들이 전부 여기 있다).
const seen = new Set(entries);
const sources = [];
for (const path of entries) {
  const js = await get(SITE + path + cb());
  sources.push({ path, js });
  // 청크 참조는 빌드에서 "assets/X.js" 또는 "./X.js" 형태로 나온다 — 둘 다 잡는다.
  for (const m of js.matchAll(/["'`](?:\.?\/)?(?:assets\/)?([A-Za-z0-9_.-]+\.js)["'`]/g)) {
    const p2 = `/assets/${m[1]}`;
    if (!seen.has(p2)) seen.add(p2);
  }
}
for (const path of [...seen].filter((p) => !entries.includes(p))) {
  try {
    sources.push({ path, js: await get(SITE + path + cb()) });
  } catch {
    /* 청크 하나 못 받아도 검증은 계속한다 */
  }
}

const all = sources.map((s) => s.js).join('\n');
const stampHit = sources.find((s) => /\d{2}-\d{2} \d{2}:\d{2}/.test(s.js));
const stamp = stampHit ? stampHit.js.match(/\d{2}-\d{2} \d{2}:\d{2}/)[0] : null;

console.log('────────────────────────────────');
console.log(' 라이브 사이트:', SITE);
console.log(' 진입 JS     :', entries.join(', '));
console.log(' 받은 청크   :', sources.length, '개');
console.log(' 빌드 시각   :', stamp ? `${stamp} (KST)` : '❌ 스탬프 없음');
for (const m of MARKERS) {
  console.log(` ${m.label.padEnd(12)}:`, m.test(all) ? '✅' : '❌');
}
console.log('────────────────────────────────');

const missing = MARKERS.filter((m) => !m.test(all));
if (!stamp || missing.length) {
  console.log(' 옛 빌드가 서빙되고 있을 수 있어요.');
  console.log(' gumgomentor.vercel.app 은 수동 별칭이라 자동배포를 따라가지 않습니다.');
  console.log(' 레포 루트에서:  npx vercel --prod');
  console.log('                npx vercel alias set <배포URL> gumgomentor.vercel.app');
  process.exit(1);
}

console.log(' 휴대폰에서 옛 화면이 보이면 → 캐시 문제.');
console.log(' 시크릿창으로 위 주소를 열거나, 주소 뒤에 ?v=' + Date.now() + ' 붙여서 확인.');
