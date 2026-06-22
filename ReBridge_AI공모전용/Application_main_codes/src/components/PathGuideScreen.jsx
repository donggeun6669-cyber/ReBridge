import { ArrowLeft, ExternalLink, CheckCircle2, Info, Users } from 'lucide-react';
import { CAREER_PATHS } from '../data/careerPaths.js';
import '../styles.career.css';

export default function PathGuideScreen({ pathKey, goBack = () => {} }) {
  const p = CAREER_PATHS[pathKey];

  if (!p) {
    return (
      <div className="screen">
        <header className="topbar center">
          <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
            <ArrowLeft size={22} />
          </button>
          <span className="page-title">진로 안내</span>
        </header>
        <p className="empty-line">안내를 찾을 수 없어요.</p>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">{p.title}</span>
      </header>

      <div className={`path-hero ph-${p.color}`}>
        <span className="path-hero-emoji">{p.emoji}</span>
        <span className="path-hero-title">{p.title}</span>
        <span className="path-hero-tag">{p.tagline}</span>
      </div>

      <p className="path-intro">{p.intro}</p>

      {/* 이런 사람에게 맞아요 */}
      <div className="path-section">
        <div className="path-section-head">
          <Users size={15} /> 이런 사람에게 맞아요
        </div>
        <ul className="path-list">
          {p.who.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </div>

      {/* 첫걸음 */}
      <div className="path-section">
        <div className="path-section-head">
          <CheckCircle2 size={15} /> 첫걸음
        </div>
        <ol className="path-steps">
          {p.steps.map((s, i) => (
            <li key={i}>
              <span className="path-step-num">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* 공식 사이트 */}
      <div className="path-section">
        <div className="path-section-head">공식 사이트 바로가기</div>
        <div className="path-links">
          {p.links.map((l) => (
            <a
              key={l.url}
              className="path-link"
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="path-link-body">
                <span className="path-link-label">{l.label}</span>
                <span className="path-link-host">{l.host}</span>
              </span>
              <ExternalLink size={16} />
            </a>
          ))}
        </div>
      </div>

      {p.tip && (
        <div className="path-tip">
          <Info size={14} /> <span>{p.tip}</span>
        </div>
      )}

      <p className="note" style={{ marginTop: 18 }}>
        정확한 자격·일정·비용은 위 공식 기관에서 확인해요. 앱은 길 안내만 해요.
      </p>
    </div>
  );
}
