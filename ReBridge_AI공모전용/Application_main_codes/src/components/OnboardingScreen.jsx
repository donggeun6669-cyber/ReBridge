import LogoMark from './LogoMark.jsx';
import { savePersona } from '../lib/persona.js';
import '../styles.onboarding.css';

// 2026-09 리디자인: 학년·지역·상황을 미리 묻지 않는다.
// 인사 한 화면만 보여주고 바로 홈(탭)으로 들어간다 — 점수 입력도 여기서 강제하지 않는다.
// 개인화가 필요한 정보는 각 탭(꿈드림센터의 지역, 진학지원의 학년·점수 등)에서 필요할 때 물어본다.
export default function OnboardingScreen({ onDone, goBack = () => {} }) {
  function start() {
    savePersona({ stage: 'unspecified', goal: 'university' });
    (onDone || goBack)();
  }

  return (
    <div className="screen onb-screen">
      <header className="onb-top">
        <span className="brand-lockup">
          <LogoMark size={22} />
          <span className="wordmark">검고담임</span>
        </span>
      </header>

      <div className="onb-hello">
        <span className="onb-hello-logo"><LogoMark size={64} /></span>
        <h1 className="onb-hello-title">
          어서 와요.<br />
          <span className="accent">검고담임</span>이에요
        </h1>
        <p className="onb-hello-sub">
          꿈드림센터 찾기부터 검정고시 진학지원, 커뮤니티까지<br />
          한 곳에서 볼게요.
        </p>

        <div className="onb-privacy">
          <span className="onb-privacy-emoji">🔒</span>
          <span className="onb-privacy-text">
            <b>로그인 없어요.</b><br />
            필요한 정보는 그때그때 물어보고, <b>이 기기에만</b> 저장돼요. 서버로 보내지 않아요.
          </span>
        </div>

        <button className="onb-primary" onClick={start}>시작하기</button>
      </div>
    </div>
  );
}
