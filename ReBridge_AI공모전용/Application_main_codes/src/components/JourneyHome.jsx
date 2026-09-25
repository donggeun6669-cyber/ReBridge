import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

import { loadProfile, gradeOption, getHomeRegion, isHiddenScreen } from '../lib/persona.js';
import { getBookmarks } from '../lib/bookmarks.js';
import { gradeRoadmap } from '../lib/roadmap.js';
import imgRoadmap from '../assets/icons3d/roadmap.png';
import imgAsk from '../assets/icons3d/ask.png';
import imgDreamdrive from '../assets/icons3d/dreamdrim.png';
import imgStudy from '../assets/icons3d/step-ged.png';
import imgCommunity from '../assets/icons3d/community.png';
import '../styles.home.css';

// 홈 탭 — 2026-09 재구성 (동근님 지시).
//   ① 꿈드림센터 찾기 — 제일 중요한 기능이라 가로로 긴 배너 하나로 따로 뺌
//   ② 진학지원·커뮤니티 — 그 아래 2열 아이콘 그리드(기존 크기 유지)
//     마이페이지는 이미 탭에 있으니 홈에서 뺀다(같은 기능은 한 화면에만).
//   ③ 지금 바로 — 탭에 없는 잔가지(담임에게 물어보기)
//   ④ 로드맵 카드 — 맨 아래, 스크롤해야 보임

const PRIMARY_FEATURE = { screen: 'dreamdrive', img: imgDreamdrive, title: '꿈드림센터', sub: '가까운 센터 찾기·지원 혜택' };
const FEATURES = [
  { screen: 'roadmap',   img: imgStudy,     title: '진학지원', sub: '검정고시·내 점수·대학 찾기' },
  { screen: 'community', img: imgCommunity, title: '커뮤니티', sub: '같은 길 가는 친구들' },
];

// '관심 대학'은 마이페이지 안에 이미 입구가 있어 여기 또 만들지 않는다(같은 기능은 한 화면에만).
const SHORTCUTS = [
  { screen: 'help', img: imgAsk, title: '담임에게 물어보기', sub: '용어·자주 묻는 질문' },
];

export default function JourneyHome({ goTo = () => {} }) {
  // 홈은 다른 화면에서 돌아올 때마다 다시 그려지므로 여기서 한 번 읽으면 최신이다.
  const [profile] = useState(() => loadProfile());
  const [rm] = useState(() => gradeRoadmap(profile, getBookmarks().length));
  const grade = gradeOption(profile?.grade);
  const region = getHomeRegion(profile);
  const showPrimary = !isHiddenScreen(PRIMARY_FEATURE.screen);
  const features = FEATURES.filter((f) => !isHiddenScreen(f.screen));
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

      {/* 가장 중요한 기능 — 가로로 긴 배너 하나로 따로 강조 */}
      {showPrimary && (
        <button type="button" className="jh-feature-wide" onClick={() => goTo(PRIMARY_FEATURE.screen)}>
          <span className="jh-feature-wide-ico"><img src={PRIMARY_FEATURE.img} alt="" width="48" height="48" /></span>
          <span className="jh-feature-wide-text">
            <span className="jh-feature-wide-title">{PRIMARY_FEATURE.title}</span>
            <span className="jh-feature-wide-sub">{PRIMARY_FEATURE.sub}</span>
          </span>
          <ChevronRight size={22} className="jh-feature-wide-arrow" />
        </button>
      )}

      <div className="jh-feature-grid">
        {features.map((f) => (
          <button key={f.screen} type="button" className="jh-feature" onClick={() => goTo(f.screen)}>
            <span className="jh-feature-ico"><img src={f.img} alt="" width="56" height="56" /></span>
            <span className="jh-feature-title">{f.title}</span>
            <span className="jh-feature-sub">{f.sub}</span>
          </button>
        ))}
      </div>

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

      {/* 로드맵 — 보조 위치. 스크롤을 내려야 보인다 */}
      <button type="button" className="jh-hero" onClick={() => goTo('roadmap')}>
        <img className="jh-hero-badge" src={imgRoadmap} alt="" width="88" height="88" />

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
    </div>
  );
}
