import homeIcon from '../assets/icons3d/home.png';
import dreamdriveIcon from '../assets/icons3d/dreamdrim.png';
import studyIcon from '../assets/icons3d/step-ged.png';
import communityIcon from '../assets/icons3d/community.png';
import mypageIcon from '../assets/icons3d/mypage.png';
import '../styles.tabbar.css';

// 하단 탭 5개 — 2026-09 리디자인으로 다시 도입.
// 탭마다 화면 스택을 따로 들고 있어서(App.jsx), 다른 탭에서 뭘 보다가
// 탭을 눌러 돌아와도 보던 화면 그대로 남아 있다. 같은 탭을 다시 누르면 그 탭의 첫 화면으로.
// 홈을 가운데(3번째)에 둔다 — 2026-09 동근님 지시.
export const TABS = [
  { key: 'dreamdrive', label: '꿈드림센터', icon: dreamdriveIcon, root: 'dreamdrive' },
  { key: 'study',      label: '진학지원',   icon: studyIcon,      root: 'roadmap' },
  { key: 'home',       label: '홈',        icon: homeIcon,       root: 'home' },
  { key: 'community',  label: '커뮤니티',   icon: communityIcon,  root: 'community' },
  { key: 'mypage',     label: '마이페이지', icon: mypageIcon,     root: 'mypage' },
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
              <img src={t.icon} alt="" className="tabbar-icon" />
            </span>
            <span className="tabbar-label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
