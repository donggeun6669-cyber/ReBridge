import { useState } from 'react';
import { UserRound, Check } from 'lucide-react';

import { loadProfile, gradeOption, getHomeRegion, isHiddenScreen } from '../lib/persona.js';
import { getBookmarks } from '../lib/bookmarks.js';
import { gradeRoadmap } from '../lib/roadmap.js';
import imgRoadmap from '../assets/icons3d/roadmap.png';
import imgCommunity from '../assets/icons3d/community.png';
import imgAsk from '../assets/icons3d/ask.png';
import imgDreamdrim from '../assets/icons3d/dreamdrim.png';
import '../styles.home.css';

// 대입 홈 (2026-09-18 동근님 재구성)
//   레퍼런스: 필라이즈(회백색 바탕 + 큰 흰 카드 + 3D 그림 + 꽉 찬 버튼) · 여기어때(큰 3D 아이콘)
//   · 로드맵은 홈 본문이 아니라 '입구 카드' 하나로 둔다. 카드는 학년·상황별로 달라진다.
//   · 홈에서 가는 곳은 MY + 로드맵 + 아이콘 3개 = 5곳, 각각 버튼 하나.
//     검정고시·내 점수·대학 찾기는 로드맵 안에서, 관심 대학은 MY에서 들어간다.
//     여기에 같은 화면으로 가는 버튼을 더 만들지 말 것.
//   · 색: 회백색 바탕, 노랑 = '지금 단계'·D-day, 파랑 = 버튼·완료 표시.
//   · 3D 아이콘: Microsoft Fluent Emoji (MIT) — assets/icons3d/LICENSE-fluentui-emoji.txt

const TILES = [
  { screen: 'community',  img: imgCommunity, title: '커뮤니티',          sub: '같은 길 가는 친구들', tone: 'blue' },
  { screen: 'help',       img: imgAsk,       title: '담임에게 물어보기', sub: '용어·자주 묻는 질문', tone: 'yellow' },
  { screen: 'dreamdrive', img: imgDreamdrim, title: '꿈드림센터',        sub: '가까운 센터·지원 혜택', tone: 'blue' },
];

export default function JourneyHome({ goTo = () => {} }) {
  // 홈은 다른 화면에서 돌아올 때마다 다시 그려지므로 여기서 한 번 읽으면 최신이다.
  const [profile] = useState(() => loadProfile());
  const [rm] = useState(() => gradeRoadmap(profile, getBookmarks().length));
  const grade = gradeOption(profile?.grade);
  const region = getHomeRegion(profile);
  const tiles = TILES.filter((t) => !isHiddenScreen(t.screen));

  return (
    <div className="screen hm-screen">
      <header className="hm-top">
        <span className="hm-chips">
          {grade && <span className="hm-chip">{grade.label}</span>}
          {region && <span className="hm-chip">{region}</span>}
        </span>
        <button type="button" className="hm-icon" aria-label="마이페이지" onClick={() => goTo('mypage')}>
          <UserRound size={22} aria-hidden="true" />
        </button>
      </header>

      <h1 className="hm-title">우리, 대학 한번<br />가 볼까요?</h1>

      {/* 로드맵 입구 — 카드 전체가 버튼 하나 */}
      <button type="button" className="hm-road" onClick={() => goTo('roadmap')}>
        <span className="hm-road-head">
          <span className="hm-road-label">나의 대입 로드맵</span>
          {rm.nearest && (
            <span className="hm-dday">{rm.nearest.label} {rm.nearest.dday}</span>
          )}
        </span>
        <span className="hm-road-body">
          <span className="hm-road-text">
            <span className="hm-road-title">{rm.headline}</span>
            <span className="hm-road-note">{rm.peerNote}</span>
          </span>
          <img className="hm-road-img" src={imgRoadmap} alt="" width="76" height="76" />
        </span>
        <span className="hm-steps" aria-hidden="true">
          {rm.steps.map((s) => (
            <span key={s.id} className={`hm-step is-${s.status}`}>
              <span className="hm-step-dot">{s.status === 'done' ? <Check size={12} strokeWidth={3} /> : null}</span>
              <span className="hm-step-label">{s.title}</span>
            </span>
          ))}
        </span>
        <span className="hm-cta">내 로드맵 보기</span>
      </button>

      <div className={`hm-tiles cols-${tiles.length}`}>
        {tiles.map((t) => (
          <button key={t.screen} type="button" className="hm-tile" onClick={() => goTo(t.screen)}>
            <span className={`hm-tile-art tone-${t.tone}`}>
              <img src={t.img} alt="" width="56" height="56" />
            </span>
            <span className="hm-tile-title">{t.title}</span>
            <span className="hm-tile-sub">{t.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
