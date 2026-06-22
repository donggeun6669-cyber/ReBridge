import { useState, useMemo } from 'react';
import {
  Search, X, ArrowLeftRight, Route, ListChecks, School, BookOpen,
  Gift, MessageCircle, Briefcase, Compass, GraduationCap,
} from 'lucide-react';
import LogoMark from './LogoMark.jsx';
import { searchAll } from '../lib/homeSearch.js';

// 트랙 확정 시 홈 = 검색(상단) + 빠른 메뉴(하단). 로드맵은 빠른 메뉴 첫 칸으로.
const TRACK_META = {
  study: { label: '검정고시 학습', kicker: '검정고시 준비 중' },
  univ:  { label: '대입', kicker: '대입 준비 중' },
  job:   { label: '일·진로', kicker: '진로 탐색 중' },
};

const QUICK = {
  study: [
    { label: '내 로드맵', icon: Route, screen: 'study-roadmap' },
    { label: '공부 플래너', icon: ListChecks, screen: 'study-planner' },
    { label: '대학 찾기', icon: School, screen: 'univ-explore' },
    { label: '입시 용어', icon: BookOpen, screen: 'glossary', params: { track: 'univ' } },
    { label: '지원 혜택', icon: Gift, screen: 'support' },
    { label: '커뮤니티', icon: MessageCircle, screen: 'community' },
  ],
  univ: [
    { label: '내 로드맵', icon: Route, screen: 'roadmap' },
    { label: '대학 찾기', icon: School, screen: 'univ-explore' },
    { label: '내 점수', icon: GraduationCap, screen: 'results' },
    { label: '입시 용어', icon: BookOpen, screen: 'glossary', params: { track: 'univ' } },
    { label: '지원 혜택', icon: Gift, screen: 'support' },
    { label: '커뮤니티', icon: MessageCircle, screen: 'community' },
  ],
  job: [
    { label: '내 로드맵', icon: Route, screen: 'job-roadmap' },
    { label: '직업 탐색', icon: Compass, screen: 'job-info' },
    { label: '진로 검사', icon: ListChecks, screen: 'job-psych' },
    { label: '진로 용어', icon: BookOpen, screen: 'glossary', params: { track: 'job' } },
    { label: '지원 혜택', icon: Gift, screen: 'support' },
    { label: '커뮤니티', icon: MessageCircle, screen: 'community' },
  ],
};

export default function TrackHome({ track, goTo = () => {}, onSwitch = () => {} }) {
  const meta = TRACK_META[track] || TRACK_META.univ;
  const quick = QUICK[track] || QUICK.univ;
  const [q, setQ] = useState('');
  const res = useMemo(() => searchAll(q), [q]);
  const glossTrack = track === 'job' ? 'job' : 'univ';
  const noHit = !res.empty && !res.univs.length && !res.jobs.length && !res.terms.length;

  return (
    <div className="screen th-screen">
      <header className="topbar between">
        <span className="brand-lockup">
          <LogoMark size={22} />
          <span className="wordmark">검고담임</span>
        </span>
        <button className="th-switch" onClick={onSwitch}>
          <ArrowLeftRight size={13} /> 바꾸기
        </button>
      </header>

      <p className="th-kicker">{meta.kicker}</p>

      <div className="th-search">
        <Search size={18} className="th-search-ico" />
        <input
          className="th-search-input"
          placeholder="대학·직업·용어 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button className="th-search-clear" aria-label="지우기" onClick={() => setQ('')}>
            <X size={16} />
          </button>
        )}
      </div>

      {!res.empty ? (
        <div className="th-results">
          {noHit && <p className="th-no">검색 결과가 없어요.</p>}
          {res.univs.length > 0 && (
            <div className="th-res-group">
              <p className="th-res-label">대학</p>
              {res.univs.map((u) => (
                <button key={u.univId} className="th-res-row"
                  onClick={() => goTo('detail', { univId: u.univId, univName: u.name })}>
                  <School size={15} /><span className="th-res-name">{u.name}</span>
                  <span className="th-res-sub">{u.region}</span>
                </button>
              ))}
            </div>
          )}
          {res.jobs.length > 0 && (
            <div className="th-res-group">
              <p className="th-res-label">직업</p>
              {res.jobs.map((j) => (
                <button key={j.name} className="th-res-row" onClick={() => goTo('job-info')}>
                  <Briefcase size={15} /><span className="th-res-name">{j.name}</span>
                  <span className="th-res-sub">{j.field}</span>
                </button>
              ))}
            </div>
          )}
          {res.terms.length > 0 && (
            <div className="th-res-group">
              <p className="th-res-label">용어</p>
              {res.terms.map((t) => (
                <button key={t.term} className="th-res-row"
                  onClick={() => goTo('glossary', { track: glossTrack })}>
                  <BookOpen size={15} /><span className="th-res-name">{t.term}</span>
                  <span className="th-res-sub">{(t.short || '').slice(0, 16)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="th-section">빠른 메뉴</p>
          <div className="th-grid">
            {quick.map(({ label, icon: Icon, screen, params }) => (
              <button key={label} className="th-tile" onClick={() => goTo(screen, params || {})}>
                <span className="th-tile-ico"><Icon size={22} /></span>
                <span className="th-tile-label">{label}</span>
              </button>
            ))}
          </div>
          <p className="note" style={{ marginTop: 22 }}>
            지금 트랙: {meta.label}
            <br />위에서 검색하거나 메뉴를 골라요.
          </p>
        </>
      )}
    </div>
  );
}
