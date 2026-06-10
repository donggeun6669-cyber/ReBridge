import { useMemo } from 'react';
import {
  ArrowRight, ChevronRight, Sparkles, Briefcase, Target,
} from 'lucide-react';
import LogoMark from './LogoMark.jsx';
import { loadProfile, loadJobTarget } from '../lib/persona.js';
import { matchPrograms, matchReason } from '../data/jobData.js';
import '../styles.job.css';

export default function JobHomeScreen({ goTo = () => {} }) {
  const profile = useMemo(loadProfile, []);
  const jp = profile?.jobProfile || null;
  const target = loadJobTarget();

  // 맞춤 인사 — 질문에 답했으면 관심분야 반영
  const greeting = jp?.interest && jp.interest !== '아직 몰라요'
    ? `${jp.interest} 쪽을 보고 있군요`
    : '나에게 맞는 일,';

  // 답변에 맞춰 추천 우선 정렬 (우다다 X)
  const { recommended } = useMemo(() => matchPrograms(jp), [jp]);
  const reason = matchReason(jp);

  return (
    <div className="screen">
      <header className="topbar">
        <span className="brand-lockup">
          <LogoMark size={24} />
          <span className="wordmark">검고담임</span>
        </span>
      </header>

      <section className="home-hero">
        <p className="home-kicker">검정고시·학교 밖 청년 취업</p>
        <h1 className="home-title">
          {greeting}<br />
          <span className="accent">같이 찾아드려요</span>
        </h1>
      </section>

      {/* 메인 CTA — 내 취업 유형 (답변 있으면 다시 보기) */}
      <button className="home-cta-card job-cta" onClick={() => goTo('job-questions')}>
        <div className="home-cta-inner">
          <span className="home-cta-label">{jp ? '답변 바꾸면 추천도 바뀌어요' : '몇 가지 질문으로'}</span>
          <span className="home-cta-title">{jp ? '내 취업 유형 다시 보기' : '내 취업 유형 알아보기'}</span>
        </div>
        <span className="home-cta-arrow"><ArrowRight size={24} /></span>
      </button>

      {/* 내 목표 직업 — 정했으면 로드맵으로, 아니면 직업 사전으로 */}
      <div className="home-section">
        <p className="home-section-label">
          <Target size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          내 목표 직업
        </p>
        {target ? (
          <button className="home-quick-row" onClick={() => goTo('job-roadmap')}>
            <span className="home-quick-ico ico-green"><Target size={18} /></span>
            <span className="home-quick-text">
              <span className="home-quick-title">{target.name}</span>
              <span className="home-quick-sub">준비 로드맵 이어보기</span>
            </span>
            <ChevronRight size={16} className="home-quick-arrow" />
          </button>
        ) : (
          <button className="home-quick-row" onClick={() => goTo('job-info')}>
            <span className="home-quick-ico ico-gold"><Briefcase size={18} /></span>
            <span className="home-quick-text">
              <span className="home-quick-title">목표 직업 정하기</span>
              <span className="home-quick-sub">
                {jp?.interest && jp.interest !== '아직 몰라요' ? `${jp.interest} 관련 직업부터` : '직업 사전에서 골라보기'}
              </span>
            </span>
            <ChevronRight size={16} className="home-quick-arrow" />
          </button>
        )}
      </div>

      {/* 맞춤 추천 프로그램 — 클릭 시 앱 안에서 상세 설명 */}
      <div className="home-section">
        <p className="home-section-label">
          <Sparkles size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          {jp ? '나에게 맞는 지원이에요' : '이런 지원, 받을 수 있어요'}
        </p>
        {reason && <p className="job-reason">{reason}</p>}
        <div className="job-prog-list">
          {recommended.map((p) => (
            <button
              key={p.id}
              className="job-prog"
              onClick={() => goTo('job-detail', { id: p.id })}
            >
              <div className="job-prog-top">
                <div className="job-prog-tags">
                  {p.badge && <span className="job-tag badge">{p.badge}</span>}
                  {p.tags.map((t) => <span key={t} className="job-tag">{t}</span>)}
                </div>
                <ChevronRight size={16} className="job-prog-go" />
              </div>
              <span className="job-prog-title">{p.title}</span>
              <span className="job-prog-desc">{p.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="note" style={{ marginTop: 24 }}>
        대학 말고도 길은 많아요.<br />
        학교 밖 청소년·청년의 첫 일을 응원해요.
      </p>
    </div>
  );
}
