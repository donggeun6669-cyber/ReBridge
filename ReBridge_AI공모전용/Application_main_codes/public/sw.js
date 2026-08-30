// 검고담임 서비스워커 — 목적은 '오프라인 완전 동작'이 아니라
// (1) PWA 설치 요건 충족 (2) 재방문 로딩 체감 개선 (3) 네트워크가 끊겼을 때 빈 화면 대신 안내.
//
// ⚠️ 캐시 전략 주의
//   · HTML(내비게이션)은 항상 네트워크 우선. 캐시 우선으로 하면 배포해도 옛 UI가 남는다.
//     (이 프로젝트는 과거에 캐시 때문에 옛 화면이 보이는 문제를 겪었다 — CLAUDE.md 참고)
//   · /assets/* 는 파일명에 해시가 붙고 immutable 이라 캐시 우선이 안전하다.
//   · Supabase·커리어넷 등 API 응답은 절대 캐시하지 않는다(로그인 상태·개인 데이터).

const VERSION = 'v1';
const SHELL = `gumgo-shell-${VERSION}`;
const ASSETS = `gumgo-assets-${VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll([OFFLINE_URL, '/icon-192.png'])).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // 다른 출처(Supabase·커리어넷·폰트 CDN)는 손대지 않는다.
  if (url.origin !== self.location.origin) return;
  // API 응답은 캐시 금지.
  if (url.pathname.startsWith('/api/')) return;

  // 페이지 이동 — 네트워크 우선, 실패하면 오프라인 안내.
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // 해시 붙은 정적 자산 — 캐시 우선.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(ASSETS).then((c) => c.put(request, copy));
        }
        return res;
      })),
    );
  }
});
