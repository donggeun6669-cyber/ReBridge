import { useMemo } from 'react';
import {
  ArrowLeft, GraduationCap, BadgeCheck, FileText, MapPin, ExternalLink,
  ArrowUpRight, Sparkles, Lightbulb, ListOrdered,
} from 'lucide-react';
import { loadPrimaryJob } from '../lib/persona.js';
import { pathFor } from '../data/careerMentor.js';
import { getProgram } from '../data/jobData.js';
import '../styles.job.css';

export default function JobTrainingScreen({ goBack = () => {}, goTo = () => {} }) {
  const job = useMemo(loadPrimaryJob, []);

  if (!job) {
    return (
      <div className="screen">
        <header className="topbar center">
          <button className="icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
          <span className="page-title">교육 길</span>
        </header>
        <div className="placeholder">
          <h2>먼저 직업을 골라요</h2>
          <p>관심 직업을 정하면 그 직업의 교육 길을 보여드려요.</p>
          <button className="cta" onClick={() => goTo('job-info')} style={{ marginTop: 16 }}>직업 고르러 가기</button>
        </div>
      </div>
    );
  }

  const path = pathFor(job.name, job.field);
  const program = job.programId ? getProgram(job.programId) : null;

  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
        <span className="page-title">{job.name} 교육 길</span>
      </header>

      <div className="jd-hero">
        <div className="job-prog-tags"><span className="job-tag badge">{job.field}</span></div>
        <h1 className="jd-title">{job.name}, 이렇게 준비해요</h1>
        {path.oneLiner && <p className="jd-summary">{path.oneLiner}</p>}
      </div>

      {/* 되기까지 단계 */}
      <section className="jd-block">
        <h2 className="jd-h"><ListOrdered size={16} /> 이렇게 준비해요</h2>
        <ol className="jt-steps">
          {path.trainingPath.map((t, i) => (
            <li key={t.step} className="jt-step">
              <span className="jt-step-num">{i + 1}</span>
              <span className="jt-step-text">
                <span className="jt-step-title">{t.step}</span>
                <span className="jt-step-detail">{t.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* 관련 자격 */}
      {path.certs && path.certs.length > 0 && (
        <section className="jd-block">
          <h2 className="jd-h"><BadgeCheck size={16} /> 도움 되는 자격</h2>
          <div className="jt-certs">
            {path.certs.map((c) => (
              <div key={c.name} className="jt-cert">
                <span className="jt-cert-name">{c.name}</span>
                {c.note && <span className="jt-cert-note">{c.note}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 포트폴리오 팁 */}
      {path.portfolio && (
        <div className="jt-tip">
          <Sparkles size={15} />
          <p><b>포트폴리오</b> — {path.portfolio}</p>
        </div>
      )}

      {/* 학교 밖 청소년 팁 */}
      {path.youthTips && (
        <div className="jt-tip alt">
          <Lightbulb size={15} />
          <p>{path.youthTips}</p>
        </div>
      )}

      {/* 어디서 배우고 찾나 */}
      {path.whereToFind && path.whereToFind.length > 0 && (
        <section className="jd-block">
          <h2 className="jd-h"><MapPin size={16} /> 배우고 찾는 곳</h2>
          <div className="job-cat-links" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {path.whereToFind.map((w) => (
              w.url ? (
                <a key={w.label} className="job-link" href={w.url} target="_blank" rel="noopener noreferrer">
                  <span className="job-link-body"><span className="job-link-label">{w.label}</span></span>
                  <ExternalLink size={15} />
                </a>
              ) : (
                <span key={w.label} className="job-link"><span className="job-link-body"><span className="job-link-label">{w.label}</span></span></span>
              )
            ))}
          </div>
        </section>
      )}

      {/* 관련 제도 상세 (앱 안 설명) */}
      {program && (
        <button className="ji-connect" onClick={() => goTo('job-detail', { id: program.id })} style={{ marginTop: 6 }}>
          <span className="ji-connect-text">
            <span className="ji-connect-label">{program.title} 자세히</span>
            <span className="ji-connect-sub">{program.desc}</span>
          </span>
          <ChevronRightIcon />
        </button>
      )}

      {/* 지원 준비로 이어가기 */}
      <button className="jd-apply" onClick={() => goTo('job-apply')} style={{ marginTop: 14 }}>
        <FileText size={17} /> 지원·자소서 준비하기
      </button>

      <p className="note jd-foot">
        교육 과정·자격 일정은 곳마다 달라요. 정확한 건 위 공식 사이트에서 확인해요.
      </p>
    </div>
  );
}

function ChevronRightIcon() {
  return <ArrowUpRight size={17} />;
}
