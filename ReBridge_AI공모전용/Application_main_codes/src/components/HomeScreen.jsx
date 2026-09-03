import { useState, useEffect } from 'react';
import { Pencil, School, Briefcase, ChevronRight } from 'lucide-react';
import LogoMark from './LogoMark.jsx';
import TrackHome from './TrackHome.jsx';
import { getActiveTrack, setActiveTrack, V1_UNIV_ONLY } from '../lib/persona.js';

// 길을 아직 안 정한 사람에게 보여줄 예시(=부드러운 트랙 선택). 필터를 앞에 강요하지 않는다.
// v1(V1_UNIV_ONLY)에서는 대입만 남으므로 선택지가 1개 → 아래에서 자동 선택해 이 화면을 건너뛴다.
const ALL_EXAMPLES = [
  { track: 'study', icon: Pencil,    title: '검정고시부터 준비할래요', sub: '시험 일정·공부 플래너' },
  { track: 'univ',  icon: School,    title: '대학에 가고 싶어요',     sub: '내 점수로 갈 수 있는 곳' },
  { track: 'job',   icon: Briefcase, title: '일·진로를 찾고 있어요',   sub: '어떤 일이 있는지 보기' },
];
const EXAMPLES = V1_UNIV_ONLY
  ? ALL_EXAMPLES.filter((e) => e.track === 'univ')
  : ALL_EXAMPLES;

// 홈 = "지금 내 상태".
//  - 앱 첫 진입(세션당 1회): 트랙 선택 화면을 항상 보여줌 — 기능 소개 목적.
//  - 트랙 선택 후: 검색(상단) + 빠른 메뉴(하단) 대시보드(TrackHome).
// v1처럼 선택지가 하나뿐이면 "고를 것"이 없다 → 첫 렌더부터 그 트랙으로 시작한다.
const ONLY_TRACK = EXAMPLES.length === 1 ? EXAMPLES[0].track : null;

export default function HomeScreen({ goTo = () => {}, goBack = () => {} }) {
  const [track, setTrack] = useState(() => ONLY_TRACK || getActiveTrack());
  // 세션에서 이미 트랙을 선택했으면 true (sessionStorage — 탭/앱 닫으면 리셋)
  const [picked, setPicked] = useState(() => !!ONLY_TRACK || !!sessionStorage.getItem('rb_track_picked'));

  // 자동 선택한 트랙도 저장해 둔다(MY·다른 화면이 activeTrack을 읽는다).
  useEffect(() => {
    if (ONLY_TRACK && getActiveTrack() !== ONLY_TRACK) setActiveTrack(ONLY_TRACK);
  }, []);

  function choose(t) {
    setActiveTrack(t);
    setTrack(t);
    sessionStorage.setItem('rb_track_picked', '1');
    setPicked(true);
    window.scrollTo(0, 0);
  }
  function switchTrack(newTrackId) {
    if (newTrackId) {
      setActiveTrack(newTrackId);
      setTrack(newTrackId);
    } else {
      setActiveTrack(null);
      setTrack(null);
    }
    window.scrollTo(0, 0);
  }

  if (track && picked) {
    return <TrackHome track={track} goTo={goTo} onSwitch={switchTrack} />;
  }

  return (
    <div className="screen">
      <header className="topbar">
        <span className="brand-lockup">
          <LogoMark size={24} />
          <span className="wordmark">검고담임</span>
        </span>
      </header>

      <section className="home-hero">
        <p className="home-kicker">함께 가요</p>
        <h1 className="home-title">아직 시작 전이에요</h1>
        <p className="home-lead">비슷한 친구들은 이렇게 시작했어요.<br />눌러보면 나에게 맞춰드려요.</p>
      </section>

      <div className="home-examples">
        {EXAMPLES.map(({ track: t, icon: Icon, title, sub }) => (
          <button key={t} className="home-example-row" onClick={() => choose(t)}>
            <span className="home-example-ico"><Icon size={20} /></span>
            <span className="home-example-text">
              <span className="home-example-title">{title}</span>
              <span className="home-example-sub">{sub}</span>
            </span>
            <ChevronRight size={18} className="home-example-arrow" />
          </button>
        ))}
      </div>

      {/* 커뮤니티 둘러보기 — v1에서는 커뮤니티를 숨기므로 함께 감춘다. */}
      {!V1_UNIV_ONLY && (
        <button className="home-browse" onClick={() => goTo('community')}>
          아직 잘 모르겠어요 · 다른 친구들 이야기 둘러보기
        </button>
      )}

      <p className="note" style={{ marginTop: 28 }}>
        검정고시·진학·진로, 학교 밖 청소년의
        <br />
        다음 한 걸음을 함께 찾는 앱이에요.
      </p>
    </div>
  );
}
