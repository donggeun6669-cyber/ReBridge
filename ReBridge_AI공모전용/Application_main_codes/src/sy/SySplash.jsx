import { useEffect } from 'react';

// 서연 UI 「스플래시」 — 가운데 '검고담임' + 한 줄 소개
// 처음 켤 때 한 번 보이는 이 화면에만 검고담임 로고(캐릭터)를 넣는다(2026-09-28 동근님).
export default function SySplash({ onDone }) {
  useEffect(() => {
    const t = setTimeout(() => onDone(), 1400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="sy-splash" role="status" aria-label="검고담임">
      <img className="sy-splash-logo" src="/sy-logo.png" alt="" />
      <div className="sy-splash-title">검고담임</div>
      <div className="sy-splash-sub">대학까지, 혼자여도 차근차근</div>
    </div>
  );
}
