import { useMemo } from 'react';
import { ChevronRight, School, Briefcase, Pencil, User } from 'lucide-react';

import { loadProfile, V1_UNIV_ONLY, isHiddenScreen } from '../lib/persona.js';

// 상단 트랙 스위처. v1(V1_UNIV_ONLY)에서는 대입만 남고, 1개뿐이면 스위처 자체를 감춘다.
const ALL_TRACK_ICONS = [
  { id: 'study', Icon: Pencil,    label: '검정고시' },
  { id: 'univ',  Icon: School,    label: '대입' },
  { id: 'job',   Icon: Briefcase, label: '일·진로' },
];
const TRACK_ICONS = V1_UNIV_ONLY
  ? ALL_TRACK_ICONS.filter((t) => t.id === 'univ')
  : ALL_TRACK_ICONS;

// 2026-09-17 동근님 정리 — 홈은 "바로가기"와 "지금 바로" 두 덩어리만 둔다.
//   · 검색창·추천 검색어·'맞는 대학 찾기' CTA·'입시 용어 & 궁금한 점'은 뺐다.
//   · 같은 기능이 두 입구로 갈리지 않게 합쳤다.
//       내 로드맵 + 체크리스트  → '지금 시기에 할 일' (roadmap)
//       입시 용어 + Q&A         → '담임에게 물어보기' (help)
//       지원 혜택 + 꿈드림센터   → '꿈드림센터' (dreamdrive)
//   · 하단 탭은 없앴고, 마이페이지는 우측 상단 아이콘으로 연다.
const TRACK_DATA = {
  study: {
    kicker: '검정고시 준비 중',
    heroLine1: '검정고시,',
    heroLine2: '같이 준비해요',
    icons: [
      { label: '내 로드맵',   emoji: '🗺️', screen: 'study-roadmap' },
      { label: '공부 플래너', emoji: '📝', screen: 'study-planner' },
      { label: '대학 찾기',   emoji: '🏫', screen: 'univ-explore' },
      { label: '꿈드림센터',  emoji: '📍', screen: 'dreamdrive' },
      { label: '커뮤니티',    emoji: '💬', screen: 'community' },
    ],
    shortcuts: [
      { emoji: '📅', title: '오늘 할 일 · 시험 D-day', screen: 'study-planner' },
      { emoji: '🙋', title: '담임에게 물어보기', screen: 'help' },
    ],
  },
  univ: {
    kicker: null,
    heroLine1: '우리, 대학 한번',
    heroLine2: '가 볼까요?',
    icons: [
      { label: '대학 찾기',  emoji: '🏫', screen: 'univ-explore' },
      { label: '내 점수',    emoji: '💯', screen: 'results' },
      { label: '꿈드림센터', emoji: '📍', screen: 'dreamdrive', sub: '지원 혜택까지' },
    ],
    shortcuts: [
      { emoji: '📅', title: '지금 시기에 할 일', sub: '일정 순서와 챙길 서류', screen: 'roadmap' },
      { emoji: '🙋', title: '담임에게 물어보기', sub: '자주 묻는 질문과 입시 용어', screen: 'help' },
    ],
  },
  job: {
    kicker: '진로 탐색 중',
    heroLine1: '나에게 맞는',
    heroLine2: '길, 찾아드려요',
    icons: [
      { label: '내 로드맵',  emoji: '🗺️', screen: 'job-roadmap' },
      { label: '직업 탐색',  emoji: '🧭', screen: 'job-info' },
      { label: '진로 검사',  emoji: '🧪', screen: 'job-psych' },
      { label: '꿈드림센터', emoji: '📍', screen: 'dreamdrive' },
      { label: '커뮤니티',   emoji: '💬', screen: 'community' },
      { label: '직업훈련',   emoji: '🧰', screen: 'job-training' },
    ],
    shortcuts: [
      { emoji: '🧪', title: '진로 검사', screen: 'job-psych' },
      { emoji: '🙋', title: '담임에게 물어보기', screen: 'help' },
    ],
  },
};

// 숨긴 화면으로 가는 바로가기/단축 항목을 걸러낸다(v1 전용, 평소엔 그대로 통과).
function visible(items) {
  return (items || []).filter((it) => !isHiddenScreen(it.screen));
}

export default function TrackHome({ track, goTo = () => {}, onSwitch = () => {} }) {
  const d = TRACK_DATA[track] || TRACK_DATA.univ;
  const icons = visible(d.icons);
  const shortcuts = visible(d.shortcuts);
  // 제목은 고정 문구. 점수를 넣은 사람에겐 제목 위 칩으로 점수만 보여준다.
  const kicker = useMemo(() => {
    if (track !== 'univ') return d.kicker;
    const p = loadProfile();
    return p?.gedAvg != null ? `검정고시 평균 ${p.gedAvg}점` : null;
  }, [track, d]);

  return (
    <div className="screen th-screen">
      {/* 로고는 뺐다(2026-09-17). 왼쪽은 트랙 스위처(v2에서만 보임), 오른쪽은 마이페이지 */}
      <header className="topbar between th3-topbar">
        {TRACK_ICONS.length > 1 ? (
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
        ) : <span />}
        <button className="th3-my-btn" aria-label="마이페이지" onClick={() => goTo('mypage')}>
          <User size={22} />
        </button>
      </header>

      <section className="th2-hero th3-hero">
        {kicker && <span className="th2-chip">{kicker}</span>}
        <h1 className="th2-title">
          {d.heroLine1}<br />
          <span className="th2-accent">{d.heroLine2}</span>
        </h1>
      </section>

      <p className="th2-sec-title">바로가기</p>
      <div className={`th3-icon-grid cols-${Math.min(icons.length, 3)}`}>
        {icons.map(({ label, emoji, sub, screen, params }) => (
          <button key={label} className="th3-icon-card" onClick={() => goTo(screen, params || {})}>
            <span className="th3-icon-box" aria-hidden="true">{emoji}</span>
            <span className="th3-icon-label">{label}</span>
            {sub && <span className="th3-icon-sub">{sub}</span>}
          </button>
        ))}
      </div>

      <p className="th2-sec-title">지금 바로</p>
      <div className="th3-shortcut-list">
        {shortcuts.map(({ emoji, title, sub, screen, params }) => (
          <button key={title} className="th3-shortcut-card" onClick={() => goTo(screen, params || {})}>
            <span className="th3-shortcut-ico" aria-hidden="true">{emoji}</span>
            <span className="th3-shortcut-text">
              <span className="th3-shortcut-title">{title}</span>
              {sub && <span className="th3-shortcut-sub">{sub}</span>}
            </span>
            <ChevronRight size={20} className="th3-chev" />
          </button>
        ))}
      </div>
    </div>
  );
}
