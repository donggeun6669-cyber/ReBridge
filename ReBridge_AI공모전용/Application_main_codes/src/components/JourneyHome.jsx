import { useLayoutEffect, useRef, useState } from 'react';
import { UserRound, Flag, MapPin, MessageCircle } from 'lucide-react';

import { loadProfile, getPersona } from '../lib/persona.js';
import { getBookmarks } from '../lib/bookmarks.js';
import '../styles.home.css';

// 대입 홈 — '대학으로 가는 길' (2026-09-17 동근님 전달 시안)
// 원본: DEAN/03_PROJECTS/Gumgomentor/ReBridge/디자인/2026-09-17_메인_전달시안/
//   · 회백색 바탕, 노랑은 '지금 추천하는 곳' 정거장 한 곳에만.
//   · 홈의 목적지는 8개(MY·정거장 5·도움 2)이고 각각 입구가 하나뿐이다.
//     같은 화면으로 가는 버튼을 여기에 더 만들지 말 것.
//   · 추천은 잠금·진행률이 아니다. 모든 정거장은 항상 열린다.

const STOPS = [
  { screen: 'ged-guide',    title: '검정고시 안내',   desc: () => '일정과 응시 조건부터 살펴봐요' },
  { screen: 'results',      title: '내 점수 살펴보기', desc: (s) => (s.hasScore ? '입력한 점수로 대학별 결과 보기' : '점수를 넣고 대학별 환산 확인') },
  { screen: 'univ-explore', title: '대학 찾기',       desc: () => '지역과 전형으로 찾아봐요' },
  { screen: 'saved',        title: '관심 대학',       desc: (s) => (s.bookmarkCount > 0 ? `담아둔 대학 ${s.bookmarkCount}곳` : '마음에 드는 대학을 모아봐요') },
  { screen: 'roadmap',      title: '일정·서류 챙기기', desc: () => '원서부터 등록까지 준비해요' },
];

const HELPERS = [
  { screen: 'dreamdrive', Icon: MapPin,        title: '꿈드림센터 · 지원 혜택', desc: '준비하는 동안 도움받을 수 있어요' },
  { screen: 'help',       Icon: MessageCircle, title: '담임에게 물어보기',     desc: '모르는 말과 궁금한 질문을 찾아요' },
];

// 준비 상황 → 제목 둘째 줄 + 추천 정거장 번호(0부터)
const STAGE_VIEW = {
  study: { subtitle: '검정고시 준비부터.',   current: 0 },
  score: { subtitle: '지금은, 내 점수부터.', current: 1 },
  apply: { subtitle: '이제, 지원 준비를.',   current: 4 },
};
const NEUTRAL_VIEW = { subtitle: '필요한 곳부터 시작해요.', current: -1 };

// 온보딩 답(stage)과 이 기기에 저장된 것만 보고 판단한다.
//   · 나이로 학년을 추정하지 않는다. 날짜로 완료 처리하지 않는다.
//   · 공부 중인 사람이 넣은 점수는 '목표 점수'라서 점수 확인 단계로 보지 않는다.
//   · 'apply'는 응시 후 점수를 넣고 관심 대학을 1곳 이상 담은 경우다.
//     (2026-09-17 구현 판단 — 동근님 확인 전. 기준을 바꾸려면 이 함수만 고치면 된다)
//   · 판단할 근거가 없으면 null → 특정 정거장을 추천하지 않는다.
export function journeyStage(profile, bookmarkCount) {
  const persona = getPersona(profile);
  if (!persona || persona.goal !== 'university') return null;
  if (persona.stage === 'studying') return 'study';
  if (persona.stage === 'tested') {
    return profile?.gedAvg != null && bookmarkCount > 0 ? 'apply' : 'score';
  }
  return null;
}

// 정거장 원의 실제 중심을 잇는 곡선. 시안 home()의 SVG 경로와 같은 곡률 비율을 쓴다.
// 좌표를 재서 그리므로 글자가 커져 줄 간격이 늘어나도 길이 원을 따라간다.
function buildRoute(pts) {
  if (pts.length < 2) return '';
  const r = (n) => Math.round(n * 10) / 10;
  const [x0, y0] = pts[0];
  let d = `M ${r(x0)} ${r(y0)}`;
  for (let i = 1; i < pts.length; i += 1) {
    const [x, y] = pts[i];
    const gap = y - pts[i - 1][1];
    d += i === 1
      ? ` C ${r(x0)} ${r(y0 + gap * 0.42)} ${r(x)} ${r(y - gap * 0.56)} ${r(x)} ${r(y)}`
      : ` S ${r(x)} ${r(y - gap * 0.62)} ${r(x)} ${r(y)}`;
  }
  return d;
}

export default function JourneyHome({ goTo = () => {} }) {
  // 홈은 다른 화면에서 돌아올 때마다 다시 그려지므로, 여기서 한 번 읽으면 최신이다.
  const [profile] = useState(() => loadProfile());
  const [bookmarkCount] = useState(() => getBookmarks().length);
  const stage = journeyStage(profile, bookmarkCount);
  const view = STAGE_VIEW[stage] || NEUTRAL_VIEW;
  const descState = { hasScore: profile?.gedAvg != null, bookmarkCount };

  const mapRef = useRef(null);
  const dotRefs = useRef([]);
  const [route, setRoute] = useState(null);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const measure = () => {
      const box = map.getBoundingClientRect();
      const pts = dotRefs.current.filter(Boolean).map((el) => {
        const b = el.getBoundingClientRect();
        return [b.left - box.left + b.width / 2, b.top - box.top + b.height / 2];
      });
      setRoute({ w: box.width, h: box.height, d: buildRoute(pts) });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(map);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="screen jh-screen">
      <header className="jh-top">
        <span className="jh-crumb">나의 대입 여정</span>
        <button type="button" className="jh-icon" aria-label="마이페이지" onClick={() => goTo('mypage')}>
          <UserRound size={20} aria-hidden="true" />
        </button>
      </header>

      <main className="jh-main">
        <div className="jh-intro">
          <div>
            <h1 className="jh-title">대학으로 가는 길.<br />{view.subtitle}</h1>
            <p className="jh-lead">내 속도로, 필요한 곳부터 가요.</p>
          </div>
          {/* 장식 — 누르는 곳이 아니다 */}
          <span className="jh-landmark" aria-hidden="true"><Flag /></span>
        </div>

        <div className="jh-map" ref={mapRef}>
          {route && (
            <svg
              className="jh-route"
              width={route.w}
              height={route.h}
              viewBox={`0 0 ${route.w} ${route.h}`}
              aria-hidden="true"
              focusable="false"
            >
              <path d={route.d} />
            </svg>
          )}
          <ol className="jh-stops">
            {STOPS.map((s, i) => {
              const isCurrent = i === view.current;
              return (
                <li key={s.screen}>
                  <button
                    type="button"
                    className={`jh-stop ${i % 2 ? 'is-left' : 'is-right'}${isCurrent ? ' is-current' : ''}`}
                    aria-current={isCurrent ? 'step' : undefined}
                    onClick={() => goTo(s.screen)}
                  >
                    <span className="jh-dot" ref={(el) => { dotRefs.current[i] = el; }} aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="jh-copy">
                      {isCurrent && <span className="jh-now">지금 추천하는 곳</span>}
                      <span className="jh-stop-title">{s.title}</span>
                      <span className="jh-stop-desc">{s.desc(descState)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="jh-finish">
            <Flag size={15} aria-hidden="true" />대학 입학 · 함께 준비해요
          </p>
        </div>

        <div className="jh-helpers">
          {HELPERS.map(({ screen, Icon, title, desc }) => (
            <button key={screen} type="button" className="jh-row" onClick={() => goTo(screen)}>
              <Icon size={20} aria-hidden="true" />
              <span className="jh-row-text">
                <b>{title}</b>
                <small>{desc}</small>
              </span>
              <span className="jh-chevron" aria-hidden="true">›</span>
            </button>
          ))}
        </div>

        <p className="jh-end">
          순서대로 끝내지 않아도 괜찮아요.<br />
          어느 정거장이든 바로 열어볼 수 있어요.
        </p>
      </main>
    </div>
  );
}
