import { useEffect, useState } from 'react';
import { House, MapPin, GraduationCap, MessagesSquare, UserRound } from 'lucide-react';
import { subscribeMessages, unreadCount } from '../lib/messages.js';

// 하단 탭 5개 (2026-09-26 PRD v2 시연판 — 동근님: 하단 탭 다시 살리기)
// 센터가 핵심 기능이라 '꿈드림'을 홈 바로 옆에 둔다. 진학·커뮤니티는 부가 기능.
// 탭을 누르면 그 탭의 첫 화면으로 돌아간다(App.jsx의 TAB_ROOTS).
export const TABS = [
  { id: 'home',      label: '홈',       Icon: House },
  { id: 'centers',   label: '꿈드림',   Icon: MapPin },
  { id: 'univ-home', label: '진학',     Icon: GraduationCap },
  { id: 'community', label: '커뮤니티', Icon: MessagesSquare },
  { id: 'mypage',    label: 'MY',       Icon: UserRound },
];

export default function TabBarV3({ active, onSelect }) {
  const [unread, setUnread] = useState(() => unreadCount());
  useEffect(() => subscribeMessages(() => setUnread(unreadCount())), []);

  return (
    <nav className="v3-tabbar" aria-label="주요 메뉴">
      {TABS.map(({ id, label, Icon }) => {
        const on = active === id;
        return (
          <button
            key={id}
            type="button"
            className={`v3-tab${on ? ' on' : ''}`}
            aria-current={on ? 'page' : undefined}
            onClick={() => onSelect(id)}
          >
            <Icon size={22} strokeWidth={on ? 2.3 : 1.8} aria-hidden="true" />
            {label}
            {/* 쪽지 답장은 '꿈드림' 탭에 알린다 — 쪽지함 입구가 거기 있다 */}
            {id === 'centers' && unread > 0 && <span className="v3-dot">{unread}</span>}
          </button>
        );
      })}
    </nav>
  );
}
