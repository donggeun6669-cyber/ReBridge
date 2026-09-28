import { useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import SyTop from './SyTop.jsx';
import { requestPosition } from '../lib/centers.js';
import './sy-b.css';

// 위치 동의 (시안: 꿈드림센터 · 위치 동의.png)
//   꿈드림센터 홈의 '다른 센터'에서 들어온다. 허용하면 lib/centers.js 의 위치 수집(기기에만 저장,
//   좌표는 매번 새로 받고 저장하지 않음)을 그대로 쓰고, 홈으로 돌아가면 진짜 거리순 1등이 뜬다.
export default function SyLocationConsent({ goBack = () => {} }) {
  const [busy, setBusy] = useState(false);

  async function allow() {
    setBusy(true);
    await requestPosition();
    goBack();
  }

  return (
    <div className="sy-screen">
      <SyTop title="꿈드림센터" onBack={goBack} />

      <div className="sy-b-consent">
        <div className="sy-b-consent-icon">
          <span className="sy-b-consent-icon-inner"><MapPin size={30} /></span>
          <span className="sy-b-consent-icon-dot" />
        </div>
        <h1 className="sy-b-consent-title">내 위치를 사용할까요?</h1>
        <p className="sy-b-consent-sub">가까운 꿈드림센터부터 보여드려요.</p>
        <div className="sy-b-consent-actions">
          <button type="button" className="sy-btn" onClick={allow} disabled={busy}>
            <Navigation size={16} /> 허용
          </button>
          <button type="button" className="sy-btn ghost" onClick={goBack} disabled={busy}>
            그냥 볼게요
          </button>
        </div>
      </div>
    </div>
  );
}
