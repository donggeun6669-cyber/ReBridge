import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import LogoMark from './LogoMark.jsx';
import { savePersona, getNav, V1_UNIV_ONLY, AGE_OPTIONS } from '../lib/persona.js';
import '../styles.onboarding.css';

// 2026-09 서연님 UI 개선안으로 다시 씀.
//   0) 인사 — 로고 + 큰 글씨로 "어서 와요", 기기 저장 안내를 여기서 먼저 못박는다
//   1) 나이 — 나이대만. 생년월일·이름 같은 개인정보는 묻지 않는다
//   2) 상황 — 검정고시 어느 단계인지
// 한 화면에 다 몰아넣지 않고 한 번에 하나씩만 묻는다(같은 개선안의 "한 페이지에 모든 정보 X").
//
// v1(V1_UNIV_ONLY)에서는 '취업' 길이 없으므로 트랙 질문 자체를 하지 않는다.

const STAGE_OPTS = [
  {
    key: 'tested',
    emoji: '📄',
    title: '이미 검정고시를 봤어요',
    desc: '점수가 있어요. 갈 수 있는 대학을 찾아드릴게요.',
    color: 'brand',
  },
  {
    key: 'studying',
    emoji: '📚',
    title: '지금 공부하고 있어요',
    desc: '아직 시험 전이에요. 준비부터 도와줄게요.',
    color: 'green',
  },
];

const TRACK_OPTS = [
  {
    key: 'university',
    emoji: '🎓',
    title: '검정고시로 대학 가기',
    desc: '검정고시 보고 대학에 진학할래요',
    color: 'brand',
    next: 'stage',
  },
  {
    key: 'job',
    emoji: '🧰',
    title: '바로 취업·자격증',
    desc: '직업훈련·자격증으로 일을 시작할래요',
    color: 'green',
  },
];

function hasScores() {
  try {
    const p = JSON.parse(localStorage.getItem('rebridge_profile'));
    return !!(p && p.gedScores && Object.values(p.gedScores).some((v) => v !== '' && v != null));
  } catch { return false; }
}

export default function OnboardingScreen({ goTo = () => {}, presetTrack = null }) {
  // 0 인사 → 1 나이 → 2 상황. v1이 아니고 트랙이 안 정해졌으면 나이 다음에 트랙을 묻는다.
  const [step, setStep] = useState(0);
  const [age, setAge] = useState(null);
  const [track, setTrack] = useState(V1_UNIV_ONLY ? 'university' : presetTrack);

  const needTrack = !V1_UNIV_ONLY && !presetTrack;
  // 화면 순서를 배열로 들고 다닌다 — 조건이 늘어도 인덱스 계산이 안 꼬이게.
  const FLOW = needTrack ? ['hello', 'age', 'track', 'stage'] : ['hello', 'age', 'stage'];
  const cur = FLOW[step];

  function finish(goal, stage) {
    savePersona({ goal, stage, age });
    if (goal === 'university' && stage === 'tested' && !hasScores()) {
      goTo('profile'); // 점수 입력부터
    } else if (goal === 'job') {
      goTo('job-questions');
    } else {
      goTo(getNav({ goal, stage }).landing);
    }
  }

  function pickAge(key) {
    setAge(key);
    setStep(step + 1);
  }

  function pickTrack(o) {
    setTrack(o.key);
    if (o.next === 'stage') setStep(step + 1);
    else finish(o.key, 'tested'); // 취업은 검정고시 단계가 의미 없다
  }

  function pickStage(o) {
    finish(track || 'university', o.key);
  }

  return (
    <div className="screen onb-screen">
      <header className="onb-top">
        {step > 0 ? (
          <button className="icon-btn" aria-label="뒤로" onClick={() => setStep(step - 1)}>
            <ChevronLeft size={22} />
          </button>
        ) : (
          <span className="brand-lockup">
            <LogoMark size={22} />
            <span className="wordmark">검고담임</span>
          </span>
        )}
      </header>

      {/* 인사 화면엔 진행 점을 띄우지 않는다 — 아직 아무것도 안 물었으니까 */}
      {cur !== 'hello' && (
        <div className="onb-progress" aria-hidden="true">
          {FLOW.slice(1).map((s, i) => (
            <span key={s} className={`onb-dot ${step - 1 >= i ? 'on' : ''}`} />
          ))}
        </div>
      )}

      {cur === 'hello' && (
        <div className="onb-hello">
          <span className="onb-hello-logo"><LogoMark size={64} /></span>
          <h1 className="onb-hello-title">
            어서 와요.<br />
            <span className="accent">검고담임</span>이에요
          </h1>
          <p className="onb-hello-sub">
            검정고시로 대학 가는 길,<br />
            처음부터 끝까지 같이 볼게요.
          </p>

          <div className="onb-privacy">
            <span className="onb-privacy-emoji">🔒</span>
            <span className="onb-privacy-text">
              <b>로그인 없어요.</b><br />
              앞으로 물어볼 건 나이와 지금 상황 두 가지뿐이고,
              그것도 <b>이 기기에만</b> 저장돼요. 서버로 보내지 않아요.
            </span>
          </div>

          <button className="onb-primary" onClick={() => setStep(1)}>시작하기</button>
        </div>
      )}

      {cur === 'age' && (
        <>
          <h1 className="onb-q">몇 살이에요?</h1>
          <p className="onb-sub">나이에 따라 받을 수 있는 지원이 달라서 물어봐요.</p>
          <div className="onb-age-grid">
            {AGE_OPTIONS.map((o) => (
              <button
                key={o.key}
                className={`onb-age-chip${age === o.key ? ' on' : ''}`}
                onClick={() => pickAge(o.key)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button className="onb-skip" onClick={() => pickAge(null)}>
            말하고 싶지 않아요
          </button>
        </>
      )}

      {cur === 'track' && (
        <>
          <h1 className="onb-q">지금 어떤 준비를<br /><span className="accent">하고 있어요?</span></h1>
          <p className="onb-sub">고른 상황에 딱 맞는 화면만 보여드릴게요.</p>
          <div className="onb-opts">
            {TRACK_OPTS.map((o) => (
              <button key={o.key} className={`onb-card oc-${o.color}`} onClick={() => pickTrack(o)}>
                <span className="onb-card-emoji" aria-hidden="true">{o.emoji}</span>
                <span className="onb-card-body">
                  <span className="onb-card-title">{o.title}</span>
                  <span className="onb-card-desc">{o.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {cur === 'stage' && (
        <>
          <h1 className="onb-q">검정고시,<br /><span className="accent">어느 단계예요?</span></h1>
          <p className="onb-sub">단계에 따라 앱이 완전히 바뀌어요.</p>
          <div className="onb-opts">
            {STAGE_OPTS.map((o) => (
              <button key={o.key} className={`onb-card oc-${o.color}`} onClick={() => pickStage(o)}>
                <span className="onb-card-emoji" aria-hidden="true">{o.emoji}</span>
                <span className="onb-card-body">
                  <span className="onb-card-title">{o.title}</span>
                  <span className="onb-card-desc">{o.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
