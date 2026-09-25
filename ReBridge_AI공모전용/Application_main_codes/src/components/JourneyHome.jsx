import { useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';

import { loadProfile, gradeOption, getHomeRegion, isHiddenScreen } from '../lib/persona.js';
import { getBookmarks } from '../lib/bookmarks.js';
import { gradeRoadmap } from '../lib/roadmap.js';
import imgRoadmap from '../assets/icons3d/roadmap.png';
import imgAsk from '../assets/icons3d/ask.png';
import '../styles.home.css';

// 홈 탭 (2026-09 리디자인)
//   하단 탭(꿈드림센터·진학지원·커뮤니티·마이페이지)이 생기면서 홈은 그 탭들의
//   입구를 다시 만들지 않는다 — '같은 기능은 한 화면에만' 원칙. 홈은:
//     ① 오늘 상태 요약 카드(로드맵) — 누르면 진학지원 탭으로
//     ② 탭에 없는 잔가지 바로가기(담임에게 물어보기·관심 대학)만 목록으로
//   색: 회백색 바탕, 노랑 = '지금 단계'·D-day, 파랑 = 버튼·완료 표시. 유지.
//   3D 아이콘: Microsoft Fluent Emoji (MIT) — assets/icons3d/LICENSE-fluentui-emoji.txt

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

  return (
    <div className="screen hm-screen">
      <header className="hm-top">
        <span className="hm-chips">
          {grade && <span className="hm-chip">{grade.label}</span>}
          {region && <span className="hm-chip">{region}</span>}
        </span>
      </header>

      <h1 className="hm-title">우리, 대학 한번<br />가 볼까요?</h1>

      {/* 로드맵 입구 — 카드 전체가 버튼 하나. 진학지원 탭으로 전환된다 */}
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
          <img className="hm-road-img" src={imgRoadmap} alt="" width="88" height="88" />
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

      <p className="hm-sec-title">지금 바로</p>
      <div className="hm-shortcut-list">
        {shortcuts.map((s) => (
          <button key={s.screen} type="button" className="hm-shortcut" onClick={() => goTo(s.screen)}>
            <span className="hm-shortcut-ico">
              {s.img ? <img src={s.img} alt="" width="40" height="40" /> : <s.Icon size={22} />}
            </span>
            <span className="hm-shortcut-text">
              <span className="hm-shortcut-title">{s.title}</span>
              <span className="hm-shortcut-sub">{s.sub}</span>
            </span>
            <ChevronRight size={20} className="hm-shortcut-arrow" />
          </button>
        ))}
      </div>
    </div>
  );
}
