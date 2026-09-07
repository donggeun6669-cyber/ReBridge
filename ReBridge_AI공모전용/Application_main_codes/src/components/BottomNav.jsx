// 2026-09 서연님 UI 개선안: 탭 아이콘을 컬러 이모지로.
// 활성/비활성은 라벨 색과 이모지 밝기(CSS)로 구분한다.
const EMOJI = {
  Home: '🏠', Search: '🔍', Route: '🗺️', User: '🙂',
  GraduationCap: '🎓', Compass: '🧭', ListChecks: '✅',
  Briefcase: '🧰', Users: '👥', Gift: '🎁', MessageCircle: '💬',
};

// 기본 탭(persona 없을 때 폴백) — 기존 입시 앱 구성
const DEFAULT_TABS = [
  { id: 'home', label: '홈', icon: 'Home', screen: 'home' },
  { id: 'explore', label: '탐색', icon: 'Search', screen: 'explore' },
  { id: 'roadmap', label: '내 로드맵', icon: 'Route', screen: 'roadmap' },
  { id: 'mypage', label: '프로필', icon: 'User', screen: 'mypage' },
];

export default function BottomNav({ tabs = DEFAULT_TABS, active, goTo = () => {} }) {
  const list = tabs && tabs.length ? tabs : DEFAULT_TABS;
  return (
    <nav className="tab-bar" aria-label="하단 메뉴">
      {list.map(({ id, label, icon, screen }) => (
        <button
          key={id}
          className={`tab-item ${active === id ? 'active' : ''}`}
          onClick={() => goTo(screen)}
          aria-current={active === id ? 'page' : undefined}
        >
          <span className="tab-ico-wrap" aria-hidden="true">{EMOJI[icon] || EMOJI.Home}</span>
          {label}
        </button>
      ))}
    </nav>
  );
}
