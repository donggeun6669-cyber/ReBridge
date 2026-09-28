import { useEffect, useState } from 'react';
import { House, MapPin, GraduationCap, Users, UserRound } from 'lucide-react';
import { subscribeMessages, unreadCount } from '../lib/messages.js';

// 서연 UI 하단 탭 (2026-09-28 시안) — 홈 · 꿈드림 · 진학지원 · 커뮤니티 · 마이
// 화면 id 는 prd2-center-demo 의 TAB_ROOTS 그대로 쓴다.
export const SY_TABS = [
  { id: 'home',      label: '홈',       Icon: House },
  { id: 'centers',   label: '꿈드림',   Icon: MapPin },
  { id: 'univ-home', label: '진학지원', Icon: GraduationCap },
  { id: 'community', label: '커뮤니티', Icon: Users },
  { id: 'mypage',    label: '마이',     Icon: UserRound },
];

export default function SyTabBar({ active, onSelect }) {
  const [unread, setUnread] = useState(() => unreadCount());
  useEffect(() => subscribeMessages(() => setUnread(unreadCount())), []);

  return (
    <nav className="sy-tabbar" aria-label="주요 메뉴">
      {SY_TABS.map(({ id, label, Icon }) => {
        const on = active === id;
        return (
          <button
            key={id}
            type="button"
            className={`sy-tab${on ? ' on' : ''}`}
            aria-current={on ? 'page' : undefined}
            onClick={() => onSelect(id)}
          >
            <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
            {label}
            {id === 'centers' && unread > 0 && <span className="sy-dot">{unread}</span>}
          </button>
        );
      })}
    </nav>
  );
}
