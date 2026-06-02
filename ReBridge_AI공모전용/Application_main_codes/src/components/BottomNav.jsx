import { Home, Search, User } from 'lucide-react';

const TABS = [
  { id: 'home', label: '홈', icon: Home },
  { id: 'explore', label: '탐색', icon: Search },
  { id: 'mypage', label: '프로필', icon: User },
];

export default function BottomNav({ active, goTo = () => {} }) {
  return (
    <nav className="tab-bar" aria-label="하단 메뉴">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`tab-item ${active === id ? 'active' : ''}`}
          onClick={() => goTo(id)}
          aria-current={active === id ? 'page' : undefined}
        >
          <Icon size={22} />
          {label}
        </button>
      ))}
    </nav>
  );
}
