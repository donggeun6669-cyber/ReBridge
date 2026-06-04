import { useEffect, useState } from 'react';
import LogoMark from './LogoMark.jsx';

export default function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // 1.0s 후 페이드 아웃 시작
    const t1 = setTimeout(() => setFading(true), 1000);
    // 1.4s 후 다음 화면으로
    const t2 = setTimeout(() => onDone(), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div className={`splash${fading ? ' splash-out' : ''}`}>
      <div className="splash-content">
        <LogoMark size={72} />
        <span className="splash-wordmark">Re:Bridge</span>
        <span className="splash-sub">검정고시 맞춤 입시</span>
      </div>
    </div>
  );
}
