import { MapPin, GraduationCap, Home, MessageCircle, User } from 'lucide-react';
import '../styles.tabbar.css';

// 하단 탭 5개 — 2026-09 리디자인으로 다시 도입.
// 탭마다 화면 스택을 따로 들고 있어서(App.jsx), 다른 탭에서 뭘 보다가
// 탭을 눌러 돌아와도 보던 화면 그대로 남아 있다. 같은 탭을 다시 누르면 그 탭의 첫 화면으로.
// 홈을 가운데(3번째)에 둔다 — 2026-09 동근님 지시.
// 아이콘은 3D 대신 lucide 2D 선 아이콘으로(동근님 지시) — 다른 화면의 3D 아이콘과는
// 구분되는, 늘 눈에 붙는 탭바 특유의 가벼운 느낌을 위해서다.
export const TABS = [
  { key: 'dreamdrive', label: '꿈드림센터', Icon: MapPin,        root: 'dreamdrive' },
  { key: 'study',      label: '진학지원',   Icon: GraduationCap, root: 'roadmap' },
  { key: 'home',       label: '홈',        Icon: Home,          root: 'home' },
  { key: 'community',  label: '커뮤니티',   Icon: MessageCircle, root: 'community' },
  { key: 'mypage',     label: '마이페이지', Icon: User,          root: 'mypage' },
];

export default function TabBar({ active, onSelect }) {
  return (
    <nav className="tabbar" aria-label="주요 메뉴">
      {TABS.map((t) => {
        const isOn = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            className={`tabbar-btn${isOn ? ' on' : ''}`}
            aria-current={isOn ? 'page' : undefined}
            onClick={() => onSelect(t.key)}
          >
            <span className="tabbar-icon-wrap">
              <t.Icon size={24} strokeWidth={isOn ? 2.4 : 2} className="tabbar-icon" />
            </span>
            <span className="tabbar-label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
