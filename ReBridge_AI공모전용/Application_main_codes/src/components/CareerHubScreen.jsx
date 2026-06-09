import { GraduationCap, Wrench, BadgeCheck, ChevronRight, Compass, Phone } from 'lucide-react';
import { CAREER_PATHS, WORK_SAFETY } from '../data/careerPaths.js';
import '../styles.career.css';

const ICONS = { Wrench, BadgeCheck };

export default function CareerHubScreen({ goTo = () => {} }) {
  return (
    <div className="screen">
      <header className="topbar">
        <span className="page-title">진로 탐색</span>
      </header>

      <div className="career-intro">
        <span className="career-intro-ico"><Compass size={18} /></span>
        <p>
          검정고시 다음, 길은 하나가 아니에요.<br />
          <b>나에게 맞는 길</b>부터 골라봐요.
        </p>
      </div>

      <div className="career-cards">
        {/* 대학 진학 — 우리 강점(실데이터 매칭) */}
        <button className="career-card cc-brand" onClick={() => goTo('univ-explore')}>
          <span className="career-card-emoji">🎓</span>
          <span className="career-card-body">
            <span className="career-card-title">대학 진학</span>
            <span className="career-card-tag">내 점수로 갈 대학을 찾고 싶어요</span>
          </span>
          <span className="career-card-arrow"><GraduationCap size={20} /></span>
        </button>

        {/* 직업훈련 / 자격증·취업 — 안내 + 공식 연결 */}
        {Object.values(CAREER_PATHS).map((p) => {
          const Icon = ICONS[p.icon] || Wrench;
          return (
            <button
              key={p.key}
              className={`career-card cc-${p.color}`}
              onClick={() => goTo('path', { key: p.key })}
            >
              <span className="career-card-emoji">{p.emoji}</span>
              <span className="career-card-body">
                <span className="career-card-title">{p.title}</span>
                <span className="career-card-tag">{p.tagline}</span>
              </span>
              <span className="career-card-arrow"><Icon size={20} /></span>
            </button>
          );
        })}
      </div>

      {/* 일하는 청소년 안전망 */}
      <div className="career-safety">
        <span className="career-safety-title">{WORK_SAFETY.title}</span>
        <p className="career-safety-desc">{WORK_SAFETY.desc}</p>
        {WORK_SAFETY.links.map((l) => (
          <a key={l.label} className="career-safety-link" href={`tel:${l.tel}`}>
            <Phone size={15} /> {l.label}
          </a>
        ))}
      </div>

      <p className="note" style={{ marginTop: 20 }}>
        직업훈련·자격증 정보는 <b>공식 기관으로 바로 연결</b>해요.
        <br />
        (앱이 임의로 지어내지 않아요 — 정확한 건 해당 기관에서 확인)
      </p>
    </div>
  );
}
