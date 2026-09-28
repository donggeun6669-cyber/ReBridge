import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
// 폰트는 CDN이 아니라 번들에 넣는다 (2026-09).
// jsdelivr가 막히거나 느린 환경에서 폰트가 통째로 안 뜨는 사고를 막으려는 것.
// unicode-range로 쪼개져 있어 브라우저가 실제 쓰는 글자 조각만 받는다.
// 2026-09-28 서연님 선택으로 Wanted Sans → IBM Plex Sans KR.
// 이 서체는 700이 최대라 800을 쓰면 브라우저가 가짜 굵기를 그린다 — CSS에 800을 두지 말 것.
import '@fontsource/ibm-plex-sans-kr/400.css';
import '@fontsource/ibm-plex-sans-kr/500.css';
import '@fontsource/ibm-plex-sans-kr/600.css';
import '@fontsource/ibm-plex-sans-kr/700.css';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// 서비스워커 — 프로덕션 빌드에서만 등록한다.
// dev 에 캐시가 끼면 코드를 고쳐도 옛 화면이 남아 디버깅이 어려워진다.
// (등록 실패는 조용히 넘긴다 — 앱 동작에 필수가 아니다)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* 무시 */ });
  });
}
