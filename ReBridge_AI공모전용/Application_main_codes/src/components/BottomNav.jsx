import { Home, Search, Route, User, GraduationCap, Compass, ListChecks, Briefcase, Users, Gift, MessageCircle } from 'lucide-react';

// 하단 탭은 선 아이콘으로 둔다(2026-09 서연님).
// 본문 아이콘은 컬러 이모지지만, 탭바는 항상 떠 있는 UI라 이모지를 쓰면
// 화면 아래가 계속 알록달록해서 시선을 뺏는다. 여기만 예외.
const ICONS = { Home, Search, Route, User, GraduationCap, Compass, ListChecks, Briefcase, Users, Gift, MessageCircle };

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
      {list.map(({ id, label, icon, screen }) => {
        const Icon = ICONS[icon] || Home;
        return (
          <button
            key={id}
            className={`tab-item ${active === id ? 'active' : ''}`}
            onClick={() => goTo(screen)}
            aria-current={active === id ? 'page' : undefined}
          >
            <span className="tab-ico-wrap">
              <Icon size={22} strokeWidth={active === id ? 2.2 : 1.8} />
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}
