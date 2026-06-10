import {
  ArrowLeft, Users, Gift, ListOrdered, Info, ArrowUpRight,
} from 'lucide-react';
import { getProgram } from '../data/jobData.js';
import '../styles.job.css';

export default function JobDetailScreen({ id, goBack = () => {} }) {
  const p = getProgram(id);

  if (!p) {
    return (
      <div className="screen">
        <header className="topbar center">
          <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
            <ArrowLeft size={22} />
          </button>
          <span className="page-title">정보</span>
        </header>
        <div className="placeholder">
          <h2>정보를 찾을 수 없어요</h2>
          <p>이전 화면으로 돌아가 다시 시도해 주세요.</p>
        </div>
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

      {/* 헤더 카드 */}
      <div className="jd-hero">
        <div className="job-prog-tags">
          {p.badge && <span className="job-tag badge">{p.badge}</span>}
          {p.tags.map((t) => <span key={t} className="job-tag">{t}</span>)}
        </div>
        <h1 className="jd-title">{p.title}</h1>
        {p.plain && <p className="jd-plain">{p.plain}</p>}
        <p className="jd-summary">{p.summary}</p>
      </div>

      {/* 이런 분께 */}
      <section className="jd-block">
        <h2 className="jd-h"><Users size={16} /> 이런 분께 맞아요</h2>
        <ul className="jd-list">
          {p.who.map((w) => <li key={w}>{w}</li>)}
        </ul>
      </section>

      {/* 받는 것 */}
      <section className="jd-block">
        <h2 className="jd-h"><Gift size={16} /> 이런 걸 받아요</h2>
        <ul className="jd-list">
          {p.benefit.map((b) => <li key={b}>{b}</li>)}
        </ul>
      </section>

      {/* 신청 절차 */}
      <section className="jd-block">
        <h2 className="jd-h"><ListOrdered size={16} /> 신청은 이렇게</h2>
        <ol className="jd-steps">
          {p.steps.map((s, i) => (
            <li key={s}><span className="jd-step-num">{i + 1}</span><span>{s}</span></li>
          ))}
        </ol>
      </section>

      {/* 주의 */}
      <section className="jd-note">
        <h2 className="jd-h"><Info size={16} /> 알아두기</h2>
        <p>{p.cautions}</p>
      </section>

      {/* 외부 연결은 '신청' 한 곳만 */}
      <a className="jd-apply" href={p.applyUrl} target="_blank" rel="noopener noreferrer">
        {p.applyLabel} <ArrowUpRight size={18} />
      </a>
      <p className="note jd-foot">
        설명은 앱에서 끝까지 안내했어요. 위 버튼은 <b>실제 신청·접수</b>를 위해 공식 사이트로 연결돼요.
      </p>
    </div>
  );
}
