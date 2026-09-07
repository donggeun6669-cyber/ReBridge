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
import { V1_UNIV_ONLY, isHiddenScreen, loadProfile } from '../lib/persona.js';

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
      { label: '내 로드맵',   emoji: '🗺️', screen: 'study-roadmap' },
      { label: '공부 플래너', emoji: '📝', screen: 'study-planner' },
      { label: '대학 찾기',   emoji: '🏫', screen: 'univ-explore' },
      { label: '지원 혜택',   emoji: '🎁', screen: 'support' },
      { label: '꿈드림센터',  emoji: '📍', screen: 'dreamdrive' },
      { label: '입시 용어',   emoji: '📖', screen: 'glossary', params: { track: 'univ' } },
      { label: '커뮤니티',    emoji: '💬', screen: 'community' },
      { label: '체크리스트',  emoji: '✅', screen: 'checklist' },
    ],
    shortcuts: [
      { emoji: '📅', title: '오늘 할 일 · 시험 D-day', screen: 'study-planner' },
      { emoji: '🙋', title: '담임에게 물어보기', screen: 'help' },
    ],
    faqs: [
      { emoji: '📅', label: '시험 일정이 언제에요?',    screen: 'ged-guide' },
      { emoji: '📚', label: '어떤 과목을 봐야 해요?',   screen: 'ged-guide' },
      { emoji: '🎯', label: '합격 점수가 뭐에요?',      screen: 'ged-guide' },
      { emoji: '📍', label: '꿈드림센터가 뭐에요?',     screen: 'dreamdrive' },
    ],
  },
  univ: {
    kicker: '검정고시 맞춤 입시',
    heroLine1: '갈 수 있는 대학,',
    heroLine2: '우리가 찾아드려요',
    ctaSub: '내 검정고시 점수로',
    ctaMain: '맞는 대학 찾기',
    ctaScreen: 'results',
    faqTitle: '입시 용어 & 궁금한 점',
    icons: [
      { label: '내 로드맵',  emoji: '🗺️', screen: 'roadmap' },
      { label: '대학 찾기',  emoji: '🏫', screen: 'univ-explore' },
      { label: '내 점수',    emoji: '💯', screen: 'results' },
      { label: '지원 혜택',  emoji: '🎁', screen: 'support' },
      { label: '꿈드림센터', emoji: '📍', screen: 'dreamdrive' },
      { label: '입시 용어',  emoji: '📖', screen: 'glossary', params: { track: 'univ' } },
      { label: '커뮤니티',   emoji: '💬', screen: 'community' },
      { label: '체크리스트', emoji: '✅', screen: 'checklist' },
    ],
    shortcuts: [
      { emoji: '📅', title: '지금 시기에 할 일', screen: 'checklist' },
      { emoji: '🙋', title: '담임에게 물어보기', screen: 'help' },
    ],
    // 질문마다 GuideScreen 전용 페이지로 보낸다.
    // 예전엔 넷 다 glossary(용어 목록)로 가서 어느 걸 눌러도 같은 화면이었다(2026-09 서연님 지적).
    faqs: [
      { emoji: '❓', label: '전형이 뭐예요?',        screen: 'guide', params: { topic: 'types' } },
      { emoji: '⚡', label: '검정고시도 수시 돼요?', screen: 'guide', params: { topic: 'susi' } },
      { emoji: '⚖️', label: '비교내신이 뭐예요?',   screen: 'guide', params: { topic: 'compare' } },
      { emoji: '🎯', label: '수능 최저가 뭐예요?',   screen: 'guide', params: { topic: 'csat' } },
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
      { label: '내 로드맵',  emoji: '🗺️', screen: 'job-roadmap' },
      { label: '직업 탐색',  emoji: '🧭', screen: 'job-info' },
      { label: '진로 검사',  emoji: '🧪', screen: 'job-psych' },
      { label: '지원 혜택',  emoji: '🎁', screen: 'support' },
      { label: '꿈드림센터', emoji: '📍', screen: 'dreamdrive' },
      { label: '진로 용어',  emoji: '📖', screen: 'glossary', params: { track: 'job' } },
      { label: '커뮤니티',   emoji: '💬', screen: 'community' },
      { label: '직업훈련',   emoji: '🧰', screen: 'job-training' },
    ],
    shortcuts: [
      { emoji: '🧪', title: '진로 검사', screen: 'job-psych' },
      { emoji: '🙋', title: '담임에게 물어보기', screen: 'help' },
    ],
    faqs: [
      { emoji: '🎓', label: '고졸 학력으로 뭘 할 수 있어요?', screen: 'glossary', params: { track: 'job', termId: '동등학력 (인정자)' } },
      { emoji: '⚡', label: '국비지원이 뭐예요?',          screen: 'glossary', params: { track: 'job', termId: '국비지원 (훈련)' } },
      { emoji: '🧰', label: '직업훈련이 뭐에요?',          screen: 'job-training' },
      { emoji: '❓', label: '검정고시로 뭘 할 수 있어요?', screen: 'glossary', params: { track: 'job' } },
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
  // 점수를 넣은 사람에겐 점수를, 아직인 사람에겐 다음 할 일을 보여준다.
  const hero = useMemo(() => {
    if (track !== 'univ') return { kicker: d.kicker, line1: d.heroLine1, line2: d.heroLine2 };
    const p = loadProfile();
    if (p?.gedAvg != null) {
      return {
        kicker: `검정고시 평균 ${p.gedAvg}점`,
        line1: '지금 지원할 수 있는',
        line2: '대학을 볼까요?',
      };
    }
    return { kicker: null, line1: '검정고시 점수를 넣으면', line2: '갈 수 있는 대학이 보여요' };
  }, [track, d]);
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

      {/* 2026-09 서연님: 앱 안에서 자기소개(광고 카피)를 하지 않는다.
          점수가 있으면 '내 상태'를, 없으면 '지금 할 일'을 띄운다. */}
      <section className="th2-hero">
        {hero.kicker && <span className="th2-chip">{hero.kicker}</span>}
        <h1 className="th2-title">
          {hero.line1}<br />
          <span className="th2-accent">{hero.line2}</span>
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
          {icons.map(({ label, emoji, screen, params }) => (
            <button key={label} className="th2-icon-item" onClick={() => goTo(screen, params || {})}>
              <span className="th2-icon-box" aria-hidden="true">{emoji}</span>
              <span className="th2-icon-label">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="th2-sec-title">지금 바로</p>
      <div className="th2-gray-block">
        <div className="th2-shortcut-list">
          {shortcuts.map(({ emoji, title, sub, screen, params }) => (
            <button key={title} className="th2-shortcut-row" onClick={() => goTo(screen, params || {})}>
              <span className="th2-shortcut-ico" aria-hidden="true">{emoji}</span>
              <span className="th2-shortcut-text">
                <span className="th2-shortcut-title">{title}</span>
                {/* 부제는 제목이 설명을 필요로 할 때만. 되풀이하는 부제는 지웠다(2026-09) */}
                {sub && <span className="th2-shortcut-sub">{sub}</span>}
              </span>
              <ChevronRight size={14} className="th2-chev" />
            </button>
          ))}
        </div>
      </div>

      <p className="th2-sec-title">{d.faqTitle}</p>
      <div className="th2-gray-block">
        <div className="th2-faq-grid">
          {faqs.map(({ emoji, label, screen, params }) => (
            <button key={label} className="th2-faq-card" onClick={() => goTo(screen, params || {})}>
              <span className="th2-faq-ico" aria-hidden="true">{emoji}</span>
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
