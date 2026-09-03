import { useState, useMemo } from 'react';
import {
  ArrowRight, ChevronRight,
  Route, School, ClipboardList, Gift, MapPin, BookOpen, MessageCircle, ListChecks,
  Calendar, Compass, Briefcase, GraduationCap, Pencil,
  HelpCircle, Scale, Target, Zap,
  Search, X,
} from 'lucide-react';

import LogoMark from './LogoMark.jsx';
import { searchAll } from '../lib/homeSearch.js';
import { V1_UNIV_ONLY, isHiddenScreen } from '../lib/persona.js';

// 상단 트랙 스위처. v1(V1_UNIV_ONLY)에서는 대입만 남고, 1개뿐이면 스위처 자체를 감춘다.
const ALL_TRACK_ICONS = [
  { id: 'study', Icon: Pencil,    label: '검정고시' },
  { id: 'univ',  Icon: School,    label: '대입' },
  { id: 'job',   Icon: Briefcase, label: '일·진로' },
];
const TRACK_ICONS = V1_UNIV_ONLY
  ? ALL_TRACK_ICONS.filter((t) => t.id === 'univ')
  : ALL_TRACK_ICONS;

const SUGGEST = {
  study: ['검정고시 일정', '꿈드림센터', '공부 플래너', '지원 혜택'],
  univ:  ['성균관대학교', '비교내신', '꿈드림센터', '수시 전형'],
  job:   ['직업 탐색', '진로 검사', '국비지원', '꿈드림센터'],
};

const TRACK_DATA = {
  study: {
    kicker: '검정고시 준비 중',
    heroLine1: '검정고시,',
    heroLine2: '같이 준비해요',
    ctaSub: '나에게 맞는 공부 계획',
    ctaMain: '학습 로드맵 보기',
    ctaScreen: 'study-roadmap',
    faqTitle: '검정고시 궁금한 점',
    icons: [
      { label: '내 로드맵',   icon: Route,        c1: '#4FA8E6', c2: '#1C6FB2', screen: 'study-roadmap' },
      { label: '공부 플래너', icon: ListChecks,    c1: '#52C97A', c2: '#248B41', screen: 'study-planner' },
      { label: '대학 찾기',   icon: School,        c1: '#FFD166', c2: '#F59E0B', screen: 'univ-explore' },
      { label: '지원 혜택',   icon: Gift,          c1: '#7ECAF5', c2: '#2E8BD0', screen: 'support' },
      { label: '꿈드림센터',  icon: MapPin,        c1: '#A78BFA', c2: '#6D28D9', screen: 'dreamdrive' },
      { label: '입시 용어',   icon: BookOpen,      c1: '#FCA5A5', c2: '#DC2626', screen: 'glossary', params: { track: 'univ' } },
      { label: '커뮤니티',    icon: MessageCircle, c1: '#6EE7B7', c2: '#059669', screen: 'community' },
      { label: '체크리스트',  icon: ListChecks,    c1: '#FDB87A', c2: '#EA580C', screen: 'checklist' },
    ],
    shortcuts: [
      { icon: Calendar,       bg: '#E7F1FB', color: '#2E8BD0', title: '지금 뭘 공부해야 할 때일까요?', sub: '오늘 할 일 · 시험 D-day 확인',  screen: 'study-planner' },
      { icon: MessageCircle,  bg: '#E4F6E9', color: '#248B41', title: '담임에게 물어보기',              sub: '막히면 여기서 바로 질문해요',    screen: 'help' },
    ],
    faqs: [
      { icon: Calendar,      bg: '#E7F1FB', color: '#2E8BD0', label: '시험 일정이 언제에요?',    screen: 'ged-guide' },
      { icon: HelpCircle,    bg: '#E4F6E9', color: '#248B41', label: '어떤 과목을 봐야 해요?',   screen: 'ged-guide' },
      { icon: Target,        bg: '#FFF4E5', color: '#EA580C', label: '합격 점수가 뭐에요?',      screen: 'ged-guide' },
      { icon: MapPin,        bg: '#F0EBFF', color: '#6D28D9', label: '꿈드림센터가 뭐에요?',     screen: 'dreamdrive' },
    ],
  },
  univ: {
    kicker: '검정고시 맞춤 입시',
    heroLine1: '우리가 갈 수 있는',
    heroLine2: '대학, 찾아드려요',
    ctaSub: '내 검정고시 점수로',
    ctaMain: '맞는 대학 찾기',
    ctaScreen: 'results',
    faqTitle: '입시 용어 & 궁금한 점',
    icons: [
      { label: '내 로드맵',  icon: Route,        c1: '#4FA8E6', c2: '#1C6FB2', screen: 'roadmap' },
      { label: '대학 찾기',  icon: School,        c1: '#52C97A', c2: '#248B41', screen: 'univ-explore' },
      { label: '내 점수',    icon: ClipboardList, c1: '#FFD166', c2: '#F59E0B', screen: 'results' },
      { label: '지원 혜택',  icon: Gift,          c1: '#7ECAF5', c2: '#2E8BD0', screen: 'support' },
      { label: '꿈드림센터', icon: MapPin,        c1: '#A78BFA', c2: '#6D28D9', screen: 'dreamdrive' },
      { label: '입시 용어',  icon: BookOpen,      c1: '#FCA5A5', c2: '#DC2626', screen: 'glossary', params: { track: 'univ' } },
      { label: '커뮤니티',   icon: MessageCircle, c1: '#6EE7B7', c2: '#059669', screen: 'community' },
      { label: '체크리스트', icon: ListChecks,    c1: '#FDB87A', c2: '#EA580C', screen: 'checklist' },
    ],
    shortcuts: [
      { icon: Calendar,      bg: '#E7F1FB', color: '#2E8BD0', title: '지금 내가 뭘 해야 할 때일까요?', sub: '지금 시기에 맞는 할 일 확인',  screen: 'checklist' },
      { icon: MessageCircle, bg: '#E4F6E9', color: '#248B41', title: '담임에게 물어보기',               sub: '막히면 여기서 바로 질문해요', screen: 'help' },
    ],
    faqs: [
      { icon: HelpCircle, bg: '#E7F1FB', color: '#2E8BD0', label: '전형이 뭐에요?',           screen: 'glossary', params: { track: 'univ' } },
      { icon: Zap,        bg: '#E4F6E9', color: '#248B41', label: '검정고시도 수시 돼요?',     screen: 'glossary', params: { track: 'univ' } },
      { icon: Scale,      bg: '#F0EBFF', color: '#6D28D9', label: '비교내신이 뭐에요?',       screen: 'glossary', params: { track: 'univ' } },
      { icon: Target,     bg: '#FFF4E5', color: '#EA580C', label: '수능 최저가 뭐에요?',      screen: 'glossary', params: { track: 'univ' } },
    ],
  },
  job: {
    kicker: '진로 탐색 중',
    heroLine1: '나에게 맞는',
    heroLine2: '길, 찾아드려요',
    ctaSub: '어떤 직업이 있는지',
    ctaMain: '직업 탐색 보기',
    ctaScreen: 'job-info',
    faqTitle: '진로 궁금한 점',
    icons: [
      { label: '내 로드맵',  icon: Route,        c1: '#4FA8E6', c2: '#1C6FB2', screen: 'job-roadmap' },
      { label: '직업 탐색',  icon: Compass,       c1: '#52C97A', c2: '#248B41', screen: 'job-info' },
      { label: '진로 검사',  icon: ListChecks,    c1: '#FFD166', c2: '#F59E0B', screen: 'job-psych' },
      { label: '지원 혜택',  icon: Gift,          c1: '#7ECAF5', c2: '#2E8BD0', screen: 'support' },
      { label: '꿈드림센터', icon: MapPin,        c1: '#A78BFA', c2: '#6D28D9', screen: 'dreamdrive' },
      { label: '진로 용어',  icon: BookOpen,      c1: '#FCA5A5', c2: '#DC2626', screen: 'glossary', params: { track: 'job' } },
      { label: '커뮤니티',   icon: MessageCircle, c1: '#6EE7B7', c2: '#059669', screen: 'community' },
      { label: '직업훈련',   icon: Briefcase,     c1: '#FDB87A', c2: '#EA580C', screen: 'job-training' },
    ],
    shortcuts: [
      { icon: ListChecks,    bg: '#E7F1FB', color: '#2E8BD0', title: '진로 검사 해보기',    sub: '나에게 맞는 직업 유형 확인',   screen: 'job-psych' },
      { icon: MessageCircle, bg: '#E4F6E9', color: '#248B41', title: '담임에게 물어보기',   sub: '막히면 여기서 바로 질문해요',  screen: 'help' },
    ],
    faqs: [
      { icon: GraduationCap, bg: '#E7F1FB', color: '#2E8BD0', label: '고졸로 취업 돼요?',          screen: 'glossary', params: { track: 'job' } },
      { icon: Zap,           bg: '#E4F6E9', color: '#248B41', label: '국비지원이 뭐에요?',          screen: 'glossary', params: { track: 'job' } },
      { icon: Briefcase,     bg: '#F0EBFF', color: '#6D28D9', label: '직업훈련이 뭐에요?',          screen: 'job-training' },
      { icon: HelpCircle,    bg: '#FFF4E5', color: '#EA580C', label: '검정고시로 뭘 할 수 있어요?', screen: 'glossary', params: { track: 'job' } },
    ],
  },
};

// 숨긴 화면으로 가는 바로가기/단축/FAQ 항목을 걸러낸다(v1 전용, 평소엔 그대로 통과).
function visible(items) {
  return (items || []).filter((it) => !isHiddenScreen(it.screen));
}

export default function TrackHome({ track, goTo = () => {}, onSwitch = () => {} }) {
  const d = TRACK_DATA[track] || TRACK_DATA.univ;
  const suggests = SUGGEST[track] || SUGGEST.univ;
  const icons = visible(d.icons);
  const shortcuts = visible(d.shortcuts);
  const faqs = visible(d.faqs);
  const [q, setQ] = useState('');
  const res = useMemo(() => searchAll(q), [q]);
  const noHit = !res.empty && !res.univs.length && !res.jobs.length && !res.terms.length && !res.menus.length && !res.centers.length && !res.supports.length;

  return (
    <div className="screen th-screen">
      <header className="topbar between">
        <span className="brand-lockup">
          <LogoMark size={24} />
          <span className="wordmark">검고담임</span>
        </span>
        {TRACK_ICONS.length > 1 && (
        <div className="th-track-switcher">
          {TRACK_ICONS.map(({ id, Icon, label }) => (
            <button
              key={id}
              className={`th-track-icon-btn${track === id ? ' active' : ''}`}
              onClick={() => onSwitch(id)}
              title={label}
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        )}
      </header>

      <section className="th2-hero">
        <span className="th2-chip">{d.kicker}</span>
        <h1 className="th2-title">
          {d.heroLine1}<br />
          <span className="th2-accent">{d.heroLine2}</span>
        </h1>
      </section>

      {/* 검색창 */}
      <div className="th2-search">
        <Search size={15} className="th2-search-ico" />
        <input
          className="th2-search-input"
          placeholder={V1_UNIV_ONLY ? '대학·용어 검색' : '대학·직업·용어 검색'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button className="th2-search-clear" onClick={() => setQ('')}>
            <X size={14} />
          </button>
        )}
      </div>
      {!q && (
        <div className="th2-suggest-wrap">
          <span className="th2-suggest-label">추천 검색어</span>
          <div className="th2-suggest-grid">
            {suggests.map((s) => (
              <button key={s} className="th2-suggest-chip2" onClick={() => setQ(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* 검색 결과 */}
      {!res.empty ? (
        <div className="th-results">
          {noHit && (
            <div className="th-nohit">
              <span className="th-nohit-emoji"><Search size={28} strokeWidth={1.5} /></span>
              <p className="th-nohit-title">찾는 내용이 없어요</p>
              {/* v1에서는 커뮤니티를 숨기므로 '커뮤니티에 질문하기'를 걸지 않는다. */}
              {V1_UNIV_ONLY ? (
                <p className="th-nohit-sub">
                  <b>"{q}"</b>에 맞는 결과를 찾지 못했어요.<br />다른 말로 검색해 볼까요?
                </p>
              ) : (
                <>
                  <p className="th-nohit-sub">
                    <b>"{q}"</b>에 대해 커뮤니티에서<br />친구들한테 바로 물어볼 수 있어요
                  </p>
                  <button
                    className="th-nohit-btn"
                    onClick={() => goTo('community-write', { board: 'talk', initialTitle: q })}
                  >
                    <MessageCircle size={14} /> 커뮤니티에 질문하기
                  </button>
                </>
              )}
            </div>
          )}
          {res.menus.length > 0 && (
            <div className="th-res-group">
              <p className="th-res-label">메뉴</p>
              {res.menus.map((m) => (
                <button key={m.label} className="th-res-row"
                  onClick={() => goTo(m.screen, m.params || {})}>
                  <Search size={15} /><span className="th-res-name">{m.label}</span>
                </button>
              ))}
            </div>
          )}
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
          {/* 직업 검색 결과 — v1에서는 직업 트랙을 숨기므로 블록째 감춘다. */}
          {!V1_UNIV_ONLY && res.jobs.length > 0 && (
            <div className="th-res-group">
              <p className="th-res-label">직업</p>
              {res.jobs.map((j) => (
                <button key={j.name} className="th-res-row" onClick={() => goTo('job-info', { q: j.name })}>
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
                  onClick={() => goTo('glossary', { track: track === 'job' ? 'job' : 'univ', termId: t.term })}>
                  <BookOpen size={15} /><span className="th-res-name">{t.term}</span>
                  <span className="th-res-sub">{(t.short || '').slice(0, 16)}</span>
                </button>
              ))}
            </div>
          )}
          {res.centers.length > 0 && (
            <div className="th-res-group">
              <p className="th-res-label">꿈드림센터</p>
              {res.centers.map((c) => (
                <button key={c.id} className="th-res-row" onClick={() => goTo('dreamdrive', { centerId: c.id })}>
                  <MapPin size={15} /><span className="th-res-name">{c.name}</span>
                  <span className="th-res-sub">{c.district || c.region}</span>
                </button>
              ))}
            </div>
          )}
          {res.supports.length > 0 && (
            <div className="th-res-group">
              <p className="th-res-label">지원·혜택</p>
              {res.supports.map((s) => (
                <button key={s.id} className="th-res-row" onClick={() => goTo('support', { supportId: s.id })}>
                  <Gift size={15} /><span className="th-res-name">{s.title}</span>
                  <span className="th-res-sub">{s.summary.slice(0, 18)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
      <button className="th2-cta" onClick={() => goTo(d.ctaScreen)}>
        <span className="th2-cta-left">
          <span className="th2-cta-sub">{d.ctaSub}</span>
          <span className="th2-cta-main">{d.ctaMain}</span>
        </span>
        <span className="th2-cta-arrow"><ArrowRight size={16} /></span>
      </button>

      <div className="th2-white-block">
        <p className="th2-sec-title">바로가기</p>
        <div className="th2-icon-grid">
          {icons.map(({ label, icon: Icon, c1, c2, screen, params }) => (
            <button key={label} className="th2-icon-item" onClick={() => goTo(screen, params || {})}>
              <span className="th2-icon-box" style={{ background: `linear-gradient(135deg,${c1},${c2})` }}>
                <Icon size={22} color="#fff" />
              </span>
              <span className="th2-icon-label">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="th2-sec-title">지금 바로</p>
      <div className="th2-gray-block">
        <div className="th2-shortcut-list">
          {shortcuts.map(({ icon: Icon, bg, color, title, sub, screen, params }) => (
            <button key={title} className="th2-shortcut-row" onClick={() => goTo(screen, params || {})}>
              <span className="th2-shortcut-ico" style={{ background: bg }}>
                <Icon size={20} color={color} />
              </span>
              <span className="th2-shortcut-text">
                <span className="th2-shortcut-title">{title}</span>
                <span className="th2-shortcut-sub">{sub}</span>
              </span>
              <ChevronRight size={14} className="th2-chev" />
            </button>
          ))}
        </div>
      </div>

      <p className="th2-sec-title">{d.faqTitle}</p>
      <div className="th2-gray-block">
        <div className="th2-faq-grid">
          {faqs.map(({ icon: Icon, bg, color, label, screen, params }) => (
            <button key={label} className="th2-faq-card" onClick={() => goTo(screen, params || {})}>
              <span className="th2-faq-ico" style={{ background: bg }}>
                <Icon size={18} color={color} />
              </span>
              <span className="th2-faq-label">{label}</span>
            </button>
          ))}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
