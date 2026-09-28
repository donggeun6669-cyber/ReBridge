import { useEffect } from 'react';

// 서연 UI 「스플래시」 — 가운데 '검고담임' + 한 줄 소개
export default function SySplash({ onDone }) {
  useEffect(() => {
    const t = setTimeout(() => onDone(), 1400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="sy-splash" role="status" aria-label="검고담임">
      <div className="sy-splash-title">검고담임</div>
      <div className="sy-splash-sub">대학까지, 혼자여도 차근차근</div>
    </div>
  );
}
