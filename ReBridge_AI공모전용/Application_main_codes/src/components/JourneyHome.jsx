import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

import { loadProfile, gradeOption, getHomeRegion, isHiddenScreen } from '../lib/persona.js';
import { getBookmarks } from '../lib/bookmarks.js';
import { gradeRoadmap } from '../lib/roadmap.js';
import imgRoadmap from '../assets/icons3d/roadmap.png';
import imgAsk from '../assets/icons3d/ask.png';
import '../styles.home.css';

// 홈 탭 — 2026-09 전면 리디자인(레퍼런스 기반, 기존 hm-* 레이아웃 폐기).
//   하단 탭(꿈드림센터·진학지원·커뮤니티·마이페이지)이 생기면서 홈은 그 탭들의
//   입구를 다시 만들지 않는다 — '같은 기능은 한 화면에만' 원칙. 홈은:
//     ① 오늘 상태 카드(로드맵) 하나 — 색이 있는 카드로 확실히 강조, 누르면 진학지원 탭으로
//     ② 탭에 없는 잔가지 바로가기(담임에게 물어보기)만 아래에 목록으로
//   색은 기존 토큰(--brand·--accent 등) 그대로 쓰되, 레이아웃·타이포·카드 구성은 새로 짬.

// '관심 대학'은 마이페이지에 이미 입구가 있어 여기 또 만들지 않는다(같은 기능은 한 화면에만).
const SHORTCUTS = [
  { screen: 'help', img: imgAsk, title: '담임에게 물어보기', sub: '용어·자주 묻는 질문' },
];

export default function JourneyHome({ goTo = () => {} }) {
  // 홈은 다른 화면에서 돌아올 때마다 다시 그려지므로 여기서 한 번 읽으면 최신이다.
  const [profile] = useState(() => loadProfile());
  const [rm] = useState(() => gradeRoadmap(profile, getBookmarks().length));
  const grade = gradeOption(profile?.grade);
  const region = getHomeRegion(profile);
  const shortcuts = SHORTCUTS.filter((s) => !isHiddenScreen(s.screen));
  const currentIdx = rm.steps.findIndex((s) => s.status === 'current');

  return (
    <div className="screen jh-screen">
      <header className="jh-greet">
        <span className="jh-eyebrow">
          {[grade?.label, region].filter(Boolean).join(' · ') || '검고담임'}
        </span>
        <h1 className="jh-title">우리, 대학<br />한번 가 볼까요?</h1>
      </header>

      {/* 오늘의 카드 — 색이 있는 큰 카드 하나로 강조. 진학지원 탭으로 전환된다 */}
      <button type="button" className="jh-hero" onClick={() => goTo('roadmap')}>
        <img className="jh-hero-badge" src={imgRoadmap} alt="" width="104" height="104" />

        <span className="jh-hero-row">
          <span className="jh-hero-kicker">나의 대입 로드맵</span>
          {rm.nearest && (
            <span className="jh-hero-dday">
              <b>{rm.nearest.dday}</b> {rm.nearest.label}
            </span>
          )}
        </span>

        <span className="jh-hero-headline">{rm.headline}</span>
        <span className="jh-hero-note">{rm.peerNote}</span>

        <span className="jh-hero-track" aria-hidden="true">
          {rm.steps.map((s, i) => (
            <span key={s.id} className={`jh-hero-seg${i <= currentIdx ? ' fill' : ''}`} />
          ))}
        </span>
        <span className="jh-hero-labels" aria-hidden="true">
          {rm.steps.map((s) => (
            <span key={s.id} className={`jh-hero-step-label${s.status === 'current' ? ' now' : ''}`}>
              {s.title}
            </span>
          ))}
        </span>

        <span className="jh-hero-cta">내 로드맵 보기<ChevronRight size={18} /></span>
      </button>

      <p className="jh-sec-title">지금 바로</p>
      <div className="jh-quick-list">
        {shortcuts.map((s) => (
          <button key={s.screen} type="button" className="jh-quick" onClick={() => goTo(s.screen)}>
            <span className="jh-quick-ico">
              {s.img ? <img src={s.img} alt="" width="34" height="34" /> : <s.Icon size={22} />}
            </span>
            <span className="jh-quick-text">
              <span className="jh-quick-title">{s.title}</span>
              <span className="jh-quick-sub">{s.sub}</span>
            </span>
            <ChevronRight size={20} className="jh-quick-arrow" />
          </button>
        ))}
      </div>
    </div>
  );
}
