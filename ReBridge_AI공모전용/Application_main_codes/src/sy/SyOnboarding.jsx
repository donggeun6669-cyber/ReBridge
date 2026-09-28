import { useState } from 'react';
import SyTop from './SyTop.jsx';
import { CenterPicker } from '../components/CenterPicker.jsx';
import {
  savePersona, getNav, loadProfile, GRADE_OPTIONS, HOME_REGIONS,
} from '../lib/persona.js';
import './sy-a.css';

// 온보딩 — 서연 UI 시안 「온보딩」(2026-09-28)
//   첫 화면(시안 그대로): 나의 로드맵 카드 + '대학까지 가는 길, 담임처럼 함께할게요' + 시작할게요
//   카드 오른쪽 큰 원은 시안 그대로(진초록 원). 로고는 스플래시에만 넣는다(2026-09-28 동근님).
//   '시작할게요' 다음은 기존 온보딩(OnboardingScreen)과 같은 질문: 학년 → 사는 지역 → 꿈드림 → 상황.
//   (질문 화면은 시안이 없어 서연 UI 공통 모양으로만 그렸다.)
//   끝나면 기존 온보딩과 같이 savePersona 후 getNav().landing(= 홈)으로 간다.
//   홈·로드맵의 '내 정보 입력하기'는 params.step='grade' 로 질문부터 연다.

const STAGE_OPTS = [
  { key: 'tested', title: '이미 검정고시를 봤어요', desc: '점수가 있어요. 갈 수 있는 대학을 찾아드릴게요.' },
  { key: 'studying', title: '지금 공부하고 있어요', desc: '아직 시험 전이에요. 준비부터 도와줄게요.' },
];

const FLOW = ['hello', 'grade', 'region', 'dream', 'stage'];

export default function SyOnboarding({ goTo = () => {}, goBack = () => {}, params = {}, canGoBack = false }) {
  const prev = loadProfile() || {};
  const startAt = params.step && FLOW.includes(params.step) ? FLOW.indexOf(params.step) : 0;
  const [step, setStep] = useState(startAt);
  const [grade, setGrade] = useState(prev.grade || null);
  const [homeRegion, setHomeRegion] = useState(prev.homeRegion || null);
  const [myCenterId, setMyCenter] = useState(prev.myCenterId || null);
  const [pickingCenter, setPickingCenter] = useState(false);
  const cur = FLOW[step];

  function finish(stage) {
    // 기존 온보딩과 같다 — v1은 대입 트랙 하나라 goal 은 university
    savePersona({ goal: 'university', stage, grade, homeRegion, myCenterId });
    goTo(getNav({ goal: 'university', stage }).landing);
  }

  function back() {
    if (pickingCenter) { setPickingCenter(false); return; }
    if (step > startAt) { setStep(step - 1); return; }
    if (canGoBack) goBack();
    else setStep(0);
  }

  if (cur === 'hello') {
    return (
      <div className="sy-screen sy-a-onb">
        <div className="sy-a-onb-card" aria-hidden="true">
          <span className="sy-a-onb-chip">나의 로드맵</span>
          <span className="sy-a-onb-ring">
            <span className="sy-a-onb-logo" />
          </span>
          <ul className="sy-a-onb-list">
            <li><i className="on" />내 정보 준비</li>
            <li><i />대학 찾아보기</li>
            <li><i />원서 챙기기</li>
          </ul>
        </div>

        <h1 className="sy-a-onb-title">대학까지 가는 길,<br />담임처럼 함께할게요</h1>
        <p className="sy-a-onb-sub">필요한 일만 순서대로 보여드려요.</p>

        <div className="sy-a-onb-foot">
          <button type="button" className="sy-btn sy-a-onb-btn" onClick={() => setStep(1)}>시작할게요</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sy-screen sy-a-q">
      <SyTop title="" onBack={back} />
      <div className="sy-a-q-dots" aria-hidden="true">
        {FLOW.slice(1).map((s, i) => <span key={s} className={step - 1 >= i ? 'on' : ''} />)}
      </div>

      {cur === 'grade' && (
        <>
          <h1 className="sy-a-q-title">학교에 다녔다면<br />지금 몇 학년이에요?</h1>
          <p className="sy-a-q-sub">학년에 맞춰 대입 로드맵을 따로 그려 드려요. 또래 친구들 학년으로 골라주세요.</p>
          <div className="sy-a-q-grid">
            {GRADE_OPTIONS.map((o) => (
              <button key={o.key} type="button" className={`sy-a-q-opt${grade === o.key ? ' on' : ''}`}
                onClick={() => { setGrade(o.key); setStep(step + 1); }}>{o.label}</button>
            ))}
          </div>
          <button type="button" className="sy-a-q-skip" onClick={() => { setGrade(null); setStep(step + 1); }}>
            말하고 싶지 않아요
          </button>
        </>
      )}

      {cur === 'region' && (
        <>
          <h1 className="sy-a-q-title">어느 지역에<br />살고 있어요?</h1>
          <p className="sy-a-q-sub">가까운 꿈드림센터부터 보여드릴게요. 시·도까지만 골라주세요.</p>
          <div className="sy-a-q-grid three">
            {HOME_REGIONS.map((r) => (
              <button key={r} type="button" className={`sy-a-q-opt${homeRegion === r ? ' on' : ''}`}
                onClick={() => { setHomeRegion(r); setStep(step + 1); }}>{r}</button>
            ))}
          </div>
          <button type="button" className="sy-a-q-skip" onClick={() => { setHomeRegion(null); setStep(step + 1); }}>
            말하고 싶지 않아요
          </button>
        </>
      )}

      {cur === 'dream' && !pickingCenter && (
        <>
          <h1 className="sy-a-q-title">꿈드림센터에<br />다니고 있어요?</h1>
          <p className="sy-a-q-sub">다니고 있다면 우리 센터 소식과 선생님 쪽지를 모아 드려요.</p>
          <div className="sy-a-q-cards">
            <button type="button" className="sy-a-q-card" onClick={() => setPickingCenter(true)}>
              <b>네, 다니고 있어요</b><span>어느 센터인지 골라 주세요</span>
            </button>
            <button type="button" className="sy-a-q-card" onClick={() => { setMyCenter(null); setStep(step + 1); }}>
              <b>아직이요</b><span>가까운 센터와 하는 일을 보여 드릴게요</span>
            </button>
          </div>
          <button type="button" className="sy-a-q-skip" onClick={() => { setMyCenter(null); setStep(step + 1); }}>
            꿈드림이 뭔지 잘 몰라요
          </button>
        </>
      )}

      {cur === 'dream' && pickingCenter && (
        <>
          <h1 className="sy-a-q-title">어느 꿈드림에<br />다니고 있어요?</h1>
          <p className="sy-a-q-sub">이 기기에만 저장돼요. 나중에 마이에서 바꿀 수 있어요.</p>
          <div style={{ margin: '0 -20px' }}>
            <CenterPicker region={homeRegion} selectedId={myCenterId}
              onPick={(c) => { setMyCenter(c.id); setPickingCenter(false); setStep(step + 1); }} />
          </div>
        </>
      )}

      {cur === 'stage' && (
        <>
          <h1 className="sy-a-q-title">검정고시,<br />어느 단계예요?</h1>
          <p className="sy-a-q-sub">단계에 따라 앱이 완전히 바뀌어요.</p>
          <div className="sy-a-q-cards">
            {STAGE_OPTS.map((o) => (
              <button key={o.key} type="button" className="sy-a-q-card" onClick={() => finish(o.key)}>
                <b>{o.title}</b><span>{o.desc}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
