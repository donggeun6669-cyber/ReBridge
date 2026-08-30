import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
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
