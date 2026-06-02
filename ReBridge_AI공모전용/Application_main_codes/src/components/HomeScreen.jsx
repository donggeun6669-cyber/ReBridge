import {
  User, ArrowRight, HelpCircle, Sparkles, Scale, Target,
  ChevronRight, ArrowLeftRight, Layers, CalendarDays,
  MessageCircle, BarChart3, FileText,
} from 'lucide-react';
import LogoMark from './LogoMark.jsx';

const HELP = [
  { icon: HelpCircle,    color: 'brand', title: '전형이 뭐예요?',             desc: '학종·교과·논술을 한 번에 정리했어요',   topic: 'types'       },
  { icon: Sparkles,      color: 'green', title: '검정고시도 수시 돼요?',       desc: '어떤 전형이 가능한지 알려드려요',       topic: 'susi'        },
  { icon: Scale,         color: 'coral', title: '비교내신이 뭐예요?',          desc: '검정고시 점수가 내신처럼 바뀌는 법',   topic: 'compare'     },
  { icon: Target,        color: 'brand', title: '수능 최저가 뭐예요?',         desc: '수시에 붙어도 필요한 수능 조건이에요', topic: 'csat'        },
  { icon: ArrowLeftRight,color: 'gold',  title: '수시랑 정시, 뭐가 달라요?',   desc: '두 가지 길의 차이를 쉽게 정리했어요', topic: 'susiJeongsi' },
  { icon: Layers,        color: 'brand', title: '수시는 몇 개까지 쓸 수 있어요?', desc: '지원 가능한 횟수를 알려드려요',      topic: 'count'       },
  { icon: CalendarDays,  color: 'coral', title: '원서는 언제, 어떻게 넣어요?', desc: '접수 시기와 방법을 알려드려요',        topic: 'apply'       },
  { icon: MessageCircle, color: 'green', title: '면접에서는 뭘 물어봐요?',     desc: '면접이 어떻게 진행되는지 미리 봐요',  topic: 'interview'   },
  { icon: BarChart3,     color: 'brand', title: '수능 등급은 어떻게 매겨요?',  desc: '등급·백분위가 뭔지 쉽게 설명해요',   topic: 'grade'       },
  { icon: FileText,      color: 'green', title: '모집요강은 어떻게 봐요?',     desc: '어디부터 볼지 알려드려요',            topic: 'guideline'   },
];

export default function HomeScreen({ goTo = () => {} }) {
  function goToMatch() {
    try {
      const p = JSON.parse(localStorage.getItem('rebridge_profile'));
      goTo(p && Object.keys(p).length > 0 ? 'results' : 'profile');
    } catch {
      goTo('profile');
    }
  }

  return (
    <div className="screen">
      <header className="topbar">
        <span className="brand-lockup">
          <span className="wordmark">Re:Bridge</span>
          <LogoMark size={24} />
        </span>
        <button className="avatar-btn" aria-label="내 프로필" onClick={() => goTo('mypage')}>
          <User size={20} />
        </button>
      </header>

      <section className="hero">
        <h1>
          내 점수로 갈 수 있는
          <br />
          대학, <span className="accent">같이 찾아봐요.</span>
        </h1>
        <p>
          검정고시 점수만 알면 돼요.
          <br />
          어디가 유리한지, 뭐부터 할지 알려드릴게요.
        </p>
      </section>

      <div className="cta-stack">
        <button className="cta" onClick={goToMatch}>
          내 점수로 대학 찾기
          <ArrowRight size={20} />
        </button>
        <button className="cta-ghost" onClick={() => goTo('explore')}>
          그냥 둘러보기
        </button>
      </div>

      <button className="discover-card" onClick={() => goTo('roadmap')}>
        <span className="discover-ico"><CalendarDays size={22} /></span>
        <span className="discover-body">
          <span className="discover-kicker">담임처럼 챙겨드려요</span>
          <span className="discover-title">지금 내가 뭘 해야 할 때일까요?</span>
        </span>
        <ChevronRight size={20} className="discover-arrow" />
      </button>

      <div className="section-head section-head-stack">
        <h2>궁금한 거, 하나씩 풀어봐요</h2>
        <p className="section-sub">학교에서 안 알려준 입시 이야기예요.</p>
      </div>

      <div className="help-list">
        {HELP.map(({ icon: Icon, color, title, desc, topic }) => (
          <button key={topic} className={`help-card tint-${color}`} onClick={() => goTo('guide', { topic })}>
            <span className={`help-ico ico-${color}`}>
              <Icon size={22} />
            </span>
            <span className="help-body">
              <span className="help-title">{title}</span>
              <span className="help-desc">{desc}</span>
            </span>
            <ChevronRight size={18} className="help-arrow" />
          </button>
        ))}
      </div>

      <p className="note">
        ReBridge는 검정고시로 대학을 준비하는
        <br />
        학교 밖 청소년을 위해 만들어졌어요.
      </p>
    </div>
  );
}
