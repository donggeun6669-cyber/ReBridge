import { useState } from 'react';
import { GraduationCap, BookOpen, Briefcase, Compass, ArrowRight, ChevronLeft } from 'lucide-react';
import LogoMark from './LogoMark.jsx';
import { savePersona, getNav } from '../lib/persona.js';
import '../styles.onboarding.css';

// 1단계: 최상위 길 — 검정고시(대학) vs 취업 vs 고민중
const TRACK_OPTS = [
  {
    key: 'university',
    icon: GraduationCap,
    title: '검정고시로 대학 가기',
    desc: '검정고시 보고 대학에 진학할래요',
    color: 'brand',
    next: 'stage', // 2단계로
  },
  {
    key: 'job',
    icon: Briefcase,
    title: '바로 취업·자격증',
    desc: '직업훈련·자격증으로 일을 시작할래요',
    color: 'green',
  },
  {
    key: 'undecided',
    icon: Compass,
    title: '아직 고민 중이에요',
    desc: '어떤 길이 있는지 둘러보고 싶어요',
    color: 'gold',
  },
];

// 2단계(검정고시 선택 시): 검정고시 단계
const STAGE_OPTS = [
  {
    key: 'tested',
    icon: GraduationCap,
    title: '이미 검정고시를 응시했어요',
    desc: '점수가 있어요. 갈 수 있는 대학을 찾아드릴게요.',
    color: 'brand',
  },
  {
    key: 'studying',
    icon: BookOpen,
    title: '지금 공부하고 있어요',
    desc: '아직 시험 전이에요. 준비부터 도와줄게요.',
    color: 'green',
  },
];

function hasScores() {
  try {
    const p = JSON.parse(localStorage.getItem('rebridge_profile'));
    return !!(p && p.gedScores && Object.values(p.gedScores).some((v) => v !== '' && v != null));
  } catch { return false; }
}

export default function OnboardingScreen({ goTo = () => {} }) {
  const [step, setStep] = useState(0);

  function finish(goal, stage) {
    savePersona({ goal, stage });
    if (goal === 'university' && stage === 'tested' && !hasScores()) {
      goTo('profile'); // 점수 입력부터
    } else {
      goTo(getNav({ goal, stage }).landing);
    }
  }

  function pickTrack(o) {
    if (o.next === 'stage') {
      setStep(1);
    } else {
      // 취업/고민중 — stage는 의미 없으니 tested로 고정(스터디 분기 회피)
      finish(o.key, 'tested');
    }
  }

  function pickStage(o) {
    finish('university', o.key);
  }

  const OPTS = step === 0 ? TRACK_OPTS : STAGE_OPTS;
  const onPick = step === 0 ? pickTrack : pickStage;

  return (
    <div className="screen onb-screen">
      <header className="onb-top">
        {step > 0 ? (
          <button className="icon-btn" aria-label="뒤로" onClick={() => setStep(0)}>
            <ChevronLeft size={22} />
          </button>
        ) : (
          <span className="brand-lockup">
            <LogoMark size={22} />
            <span className="wordmark">검고담임</span>
          </span>
        )}
      </header>

      <div className="onb-progress">
        <span className={`onb-dot ${step >= 0 ? 'on' : ''}`} />
        <span className={`onb-dot ${step >= 1 ? 'on' : ''}`} />
      </div>

      {step === 0 ? (
        <>
          <h1 className="onb-q">지금 어떤 준비를<br /><span className="accent">하고 있어요?</span></h1>
          <p className="onb-sub">고른 상황에 딱 맞는 화면만 보여드릴게요.</p>
        </>
      ) : (
        <>
          <h1 className="onb-q">검정고시,<br /><span className="accent">어느 단계예요?</span></h1>
          <p className="onb-sub">단계에 따라 앱이 완전히 바뀌어요.</p>
        </>
      )}

      <div className="onb-opts">
        {OPTS.map((o) => {
          const Icon = o.icon;
          return (
            <button key={o.key} className={`onb-card oc-${o.color}`} onClick={() => onPick(o)}>
              <span className={`onb-card-ico ico-${o.color}`}><Icon size={22} /></span>
              <span className="onb-card-body">
                <span className="onb-card-title">{o.title}</span>
                <span className="onb-card-desc">{o.desc}</span>
              </span>
              <ArrowRight size={18} className="onb-card-arrow" />
            </button>
          );
        })}
      </div>

      <p className="note onb-note">입력한 정보는 이 기기에만 저장돼요. 로그인 필요 없어요.</p>
    </div>
  );
}
