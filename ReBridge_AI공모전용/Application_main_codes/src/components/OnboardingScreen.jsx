import { useState } from 'react';
import { GraduationCap, BookOpen, Building2, Briefcase, Compass, ArrowRight, ChevronLeft } from 'lucide-react';
import LogoMark from './LogoMark.jsx';
import { savePersona, getNav } from '../lib/persona.js';
import '../styles.onboarding.css';

const STAGE_OPTS = [
  {
    key: 'tested',
    icon: GraduationCap,
    title: '이미 검정고시를 응시했어요',
    desc: '점수가 있어요. 이제 진짜 목표를 정할 때.',
    color: 'brand',
  },
  {
    key: 'studying',
    icon: BookOpen,
    title: '지금 공부할 단계예요',
    desc: '아직 시험 전이에요. 준비부터 도와줄게요.',
    color: 'green',
  },
];

const GOAL_OPTS = [
  { key: 'university', icon: Building2, title: '대학에 가고 싶어요', desc: '내 점수로 갈 대학을 찾고 싶어요', color: 'brand' },
  { key: 'job', icon: Briefcase, title: '바로 취업하고 싶어요', desc: '직업훈련·자격증으로 일을 시작할래요', color: 'green' },
  { key: 'undecided', icon: Compass, title: '아직 고민 중이에요', desc: '어떤 길이 있는지 둘러보고 싶어요', color: 'gold' },
];

export default function OnboardingScreen({ goTo = () => {} }) {
  const [step, setStep] = useState(0);
  const [stage, setStage] = useState(null);

  function pickStage(key) {
    setStage(key);
    setStep(1);
  }

  function pickGoal(goalKey) {
    savePersona({ stage, goal: goalKey });
    const { landing } = getNav({ stage, goal: goalKey });
    // 이미 응시 + 대학 목표 → 점수가 있어야 합격 가능성 매칭이 되므로 점수 입력부터.
    const hasScores = (() => {
      try {
        const p = JSON.parse(localStorage.getItem('rebridge_profile'));
        return !!(p && p.gedScores && Object.values(p.gedScores).some((v) => v !== '' && v != null));
      } catch { return false; }
    })();
    if (stage === 'tested' && goalKey === 'university' && !hasScores) {
      goTo('profile');
    } else {
      goTo(landing);
    }
  }

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
          <h1 className="onb-q">검정고시,<br /><span className="accent">어느 단계예요?</span></h1>
          <p className="onb-sub">상황에 딱 맞는 화면만 보여드릴게요.</p>
          <div className="onb-opts">
            {STAGE_OPTS.map((o) => {
              const Icon = o.icon;
              return (
                <button key={o.key} className={`onb-card oc-${o.color}`} onClick={() => pickStage(o.key)}>
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
        </>
      ) : (
        <>
          <h1 className="onb-q">목표가<br /><span className="accent">무엇인가요?</span></h1>
          <p className="onb-sub">고른 목표에 맞춰 앱이 바뀌어요. 나중에 바꿀 수 있어요.</p>
          <div className="onb-opts">
            {GOAL_OPTS.map((o) => {
              const Icon = o.icon;
              return (
                <button key={o.key} className={`onb-card oc-${o.color}`} onClick={() => pickGoal(o.key)}>
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
        </>
      )}

      <p className="note onb-note">입력한 정보는 이 기기에만 저장돼요. 로그인 필요 없어요.</p>
    </div>
  );
}
