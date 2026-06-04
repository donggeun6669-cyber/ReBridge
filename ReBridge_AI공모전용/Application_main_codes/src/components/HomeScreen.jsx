import {
  ArrowRight, HelpCircle, Sparkles, Scale, Target,
  ChevronRight, ArrowLeftRight, Layers, CalendarDays,
  MessageCircle, BarChart3, FileText, ClipboardCheck, BookOpen, Heart,
} from 'lucide-react';
import LogoMark from './LogoMark.jsx';

const HELP = [
  { icon: HelpCircle,    color: 'brand', title: '전형이 뭐예요?',                topic: 'types'       },
  { icon: Sparkles,      color: 'green', title: '검정고시도 수시 돼요?',          topic: 'susi'        },
  { icon: Scale,         color: 'coral', title: '비교내신이 뭐예요?',             topic: 'compare'     },
  { icon: Target,        color: 'brand', title: '100점이면 교과 전형 돼요?',      topic: 'gedLimit'    },
  { icon: FileText,      color: 'coral', title: '합격증명서 vs 성적증명서?',      topic: 'docs'        },
  { icon: ArrowLeftRight,color: 'gold',  title: '수시 vs 정시, 차이는?',          topic: 'susiJeongsi' },
  { icon: Layers,        color: 'brand', title: '수시 몇 개까지 써요?',           topic: 'count'       },
  { icon: CalendarDays,  color: 'coral', title: '원서 언제, 어떻게 내요?',        topic: 'apply'       },
  { icon: BarChart3,     color: 'brand', title: '나이스 온라인 신청이 뭐예요?',   topic: 'naice'       },
  { icon: MessageCircle, color: 'green', title: '논술 전형이 왜 유리해요?',       topic: 'essay'       },
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
      {/* 상단바 */}
      <header className="topbar">
        <span className="brand-lockup">
          <LogoMark size={24} />
          <span className="wordmark">Re:Bridge</span>
        </span>
      </header>

      {/* 히어로 — 간결하게 */}
      <section className="home-hero">
        <p className="home-kicker">검정고시 맞춤 입시</p>
        <h1 className="home-title">
          우리도 갈 수 있는<br />
          <span className="accent">대학, 찾아드려요</span>
        </h1>
      </section>

      {/* 메인 CTA — 카드형 */}
      <button className="home-cta-card" onClick={goToMatch}>
        <div className="home-cta-inner">
          <span className="home-cta-label">내 검정고시 점수로</span>
          <span className="home-cta-title">맞는 대학 찾기</span>
        </div>
        <span className="home-cta-arrow"><ArrowRight size={24} /></span>
      </button>

      {/* 빠른 접근 */}
      <div className="home-section">
        <p className="home-section-label">바로가기</p>
        <div className="home-quick-list">
          <button className="home-quick-row" onClick={() => goTo('roadmap')}>
            <span className="home-quick-ico ico-brand">
              <CalendarDays size={18} />
            </span>
            <span className="home-quick-text">
              <span className="home-quick-title">지금 내가 뭘 해야 할 때일까요?</span>
              <span className="home-quick-sub">시기에 맞는 할 일 확인</span>
            </span>
            <ChevronRight size={16} className="home-quick-arrow" />
          </button>
          <div className="home-divider" />
          <button className="home-quick-row" onClick={() => goTo('checklist')}>
            <span className="home-quick-ico ico-coral">
              <ClipboardCheck size={18} />
            </span>
            <span className="home-quick-text">
              <span className="home-quick-title">내 서류 체크리스트</span>
              <span className="home-quick-sub">합격증명서·성적증명서 등 빠짐없이</span>
            </span>
            <ChevronRight size={16} className="home-quick-arrow" />
          </button>
          <div className="home-divider" />
          <button className="home-quick-row" onClick={() => goTo('forms-guide')}>
            <span className="home-quick-ico ico-gold">
              <BookOpen size={18} />
            </span>
            <span className="home-quick-text">
              <span className="home-quick-title">학생부 대체서식 안내</span>
              <span className="home-quick-sub">학종 지원할 때 내는 서류</span>
            </span>
            <ChevronRight size={16} className="home-quick-arrow" />
          </button>
          <div className="home-divider" />
          <button className="home-quick-row" onClick={() => goTo('help')}>
            <span className="home-quick-ico ico-green">
              <MessageCircle size={18} />
            </span>
            <span className="home-quick-text">
              <span className="home-quick-title">담임에게 물어보기</span>
              <span className="home-quick-sub">막히면 여기서 바로 질문해요</span>
            </span>
            <ChevronRight size={16} className="home-quick-arrow" />
          </button>
          <div className="home-divider" />
          <button className="home-quick-row" onClick={() => goTo('dreamdrive')}>
            <span className="home-quick-ico ico-coral">
              <Heart size={18} />
            </span>
            <span className="home-quick-text">
              <span className="home-quick-title">꿈드림센터 찾기</span>
              <span className="home-quick-sub">검정고시·자립 무료 지원 기관 전국 안내</span>
            </span>
            <ChevronRight size={16} className="home-quick-arrow" />
          </button>
        </div>
      </div>

      {/* 입시 용어 FAQ — 2열 그리드 */}
      <div className="home-section">
        <p className="home-section-label">입시 용어 &amp; 궁금한 점</p>
        <div className="home-faq-grid">
          {HELP.map(({ icon: Icon, color, title, topic }) => (
            <button
              key={topic}
              className={`home-faq-item faq-${color}`}
              onClick={() => goTo('guide', { topic })}
            >
              <span className={`home-faq-ico ico-${color}`}>
                <Icon size={16} />
              </span>
              <span className="home-faq-title">{title}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="note" style={{ marginTop: 28 }}>
        검정고시로 대학을 준비하는
        <br />
        학교 밖 청소년을 위한 앱이에요.
      </p>
    </div>
  );
}
