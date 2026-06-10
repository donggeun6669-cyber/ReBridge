import {
  Compass, GraduationCap, Search, FileText, Sparkles, ChevronRight,
} from 'lucide-react';
import { JOB_ROADMAP } from '../data/jobData.js';
import '../styles.studyroadmap.css';

const ICONS = { Compass, GraduationCap, Search, FileText, Sparkles };

export default function JobRoadmapScreen({ goTo = () => {} }) {
  return (
    <div className="screen">
      <header className="topbar">
        <span className="page-title">취업 준비</span>
      </header>

      <div className="srm-intro">
        <span className="srm-intro-kicker">취업 준비 로드맵</span>
        <h2 className="srm-intro-title">
          관심 파악부터 첫 출근까지,<br />
          한 단계씩 같이 가요
        </h2>
      </div>

      <div className="srm-timeline">
        {JOB_ROADMAP.map((s, i) => {
          const Icon = ICONS[s.icon] || Compass;
          const last = i === JOB_ROADMAP.length - 1;
          // 첫 단계를 '지금'으로 강조
          const status = i === 0 ? 'current' : 'upcoming';
          return (
            <div key={s.id} className={`srm-step srm-${status}`}>
              <div className="srm-rail">
                <span className="srm-node"><Icon size={16} /></span>
                {!last && <span className="srm-line" />}
              </div>
              <div className="srm-card">
                <div className="srm-card-head">
                  <span className="srm-card-title">{s.title}</span>
                  {i === 0 && <span className="srm-badge cur">지금</span>}
                </div>
                <p className="srm-todo">{s.todo}</p>
                {s.cta && (
                  <button className="srm-cta" onClick={() => goTo(s.cta.screen, s.cta.params || {})}>
                    {s.cta.label} <ChevronRight size={15} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="note" style={{ marginTop: 8 }}>
        각 단계의 자세한 정보는 공식 기관으로 연결돼요. 막히면 청소년상담 1388에 도움을 청해요.
      </p>
    </div>
  );
}
