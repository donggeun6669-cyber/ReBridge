import { useMemo } from 'react';
import {
  ArrowRight, ChevronRight, Compass, Route, ArrowUpRight, Sparkles,
} from 'lucide-react';
import LogoMark from './LogoMark.jsx';
import { loadProfile } from '../lib/persona.js';
import { JOB_PROGRAMS } from '../data/jobData.js';
import '../styles.job.css';

export default function JobHomeScreen({ goTo = () => {} }) {
  const profile = useMemo(loadProfile, []);
  const jp = profile?.jobProfile || null;

  // 맞춤 인사 — 질문에 답했으면 관심분야 반영
  const greeting = jp?.interest && jp.interest !== '아직 몰라요'
    ? `${jp.interest} 쪽을 보고 있군요`
    : '나에게 맞는 일,';

  const featured = JOB_PROGRAMS.slice(0, 3);

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

      {/* 메인 CTA — 내 취업 유형 알아보기 (차별점: 진단) */}
      <button className="home-cta-card job-cta" onClick={() => goTo('job-questions')}>
        <div className="home-cta-inner">
          <span className="home-cta-label">{jp ? '내 답변 다시 보기' : '몇 가지 질문으로'}</span>
          <span className="home-cta-title">내 취업 유형 알아보기</span>
        </div>
        <span className="home-cta-arrow"><ArrowRight size={24} /></span>
      </button>

      {/* 빠른 접근 */}
      <div className="home-section">
        <p className="home-section-label">바로가기</p>
        <div className="home-quick-list">
          <button className="home-quick-row" onClick={() => goTo('job-explore')}>
            <span className="home-quick-ico ico-brand"><Compass size={18} /></span>
            <span className="home-quick-text">
              <span className="home-quick-title">고용정책·프로그램 둘러보기</span>
              <span className="home-quick-sub">훈련·자격증·지원금 정보 모음</span>
            </span>
            <ChevronRight size={16} className="home-quick-arrow" />
          </button>
          <div className="home-divider" />
          <button className="home-quick-row" onClick={() => goTo('job-roadmap')}>
            <span className="home-quick-ico ico-green"><Route size={18} /></span>
            <span className="home-quick-text">
              <span className="home-quick-title">취업 준비 로드맵</span>
              <span className="home-quick-sub">관심 파악 → 역량 → 일자리까지</span>
            </span>
            <ChevronRight size={16} className="home-quick-arrow" />
          </button>
        </div>
      </div>

      {/* 추천 프로그램 */}
      <div className="home-section">
        <p className="home-section-label">
          <Sparkles size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          이런 지원, 받을 수 있어요
        </p>
        <div className="job-prog-list">
          {featured.map((p) => (
            <a key={p.title} className="job-prog" href={p.url} target="_blank" rel="noopener noreferrer">
              <div className="job-prog-top">
                <div className="job-prog-tags">
                  {p.badge && <span className="job-tag badge">{p.badge}</span>}
                  {p.tags.map((t) => <span key={t} className="job-tag">{t}</span>)}
                </div>
                <ArrowUpRight size={16} className="job-prog-go" />
              </div>
              <span className="job-prog-title">{p.title}</span>
              <span className="job-prog-desc">{p.desc}</span>
            </a>
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
