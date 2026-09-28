import { useEffect, useMemo, useState } from 'react';
import {
  Bell, MapPin, GraduationCap, Users, CircleHelp, Sparkles, Settings2, Navigation,
  Clock3, ArrowRight, ChevronRight, FileCheck2, Search,
} from 'lucide-react';
import { loadProfile } from '../lib/persona.js';
import { suggestedCenter, filterCenters, locationAllowed, requestPosition, distLabel } from '../lib/centers.js';
import { aRoadmap, checklistItems, loadChecked, issuerShort } from './aUtil.js';
import './sy-a.css';

// 홈 — 서연 UI 시안 「홈 · 처음 켠 상태」 / 「홈 · 정보 입력 후 · 일정 공고 전」(2026-09-28)
//   학년·사는 지역이 없으면 '처음 켠 상태', 둘 다 있으면 '정보 입력 후'.
//   로드맵 카드의 네 단계는 aUtil.aRoadmap(= lib/roadmap.js + data/schedule.js) 한 곳에서 계산한다.
//   원서 일정이 공고로 확정된 학년도면 '일정 공고 전' 자리에 D-day 가 뜬다(확정 일정에만).

const QUICK = [
  { id: 'centers', label: '꿈드림센터', Icon: MapPin, tone: 'green', screen: 'centers' },
  { id: 'univ', label: '대학찾기', Icon: GraduationCap, tone: 'blue', screen: 'univ-explore' },
  { id: 'community', label: '커뮤니티', Icon: Users, tone: 'purple', screen: 'community' },
  { id: 'help', label: '담임 질문', Icon: CircleHelp, tone: 'peach', screen: 'help' },
];

export default function SyHome({ goTo = () => {} }) {
  const profile = useMemo(() => loadProfile(), []);
  const rm = useMemo(() => aRoadmap(profile), [profile]);
  const first = !rm.infoDone;

  return (
    <div className="sy-screen sy-a-home">
      <header className="sy-a-home-top">
        <div>
          <h1 className="sy-a-home-title">검고담임</h1>
          {!first && rm.place && <p className="sy-a-home-place">{rm.place}</p>}
        </div>
        <button type="button" className="sy-a-bell" aria-label="알림" onClick={() => goTo('noti-scrap')}>
          <Bell size={20} strokeWidth={1.9} />
        </button>
      </header>

      <nav className={`sy-a-quick${first ? '' : ' tight'}`} aria-label="바로가기">
        {QUICK.map(({ id, label, Icon, tone, screen }) => (
          <button key={id} type="button" className="sy-a-quick-item" onClick={() => goTo(screen)}>
            <span className={`sy-a-quick-box ${tone}`}><Icon size={22} strokeWidth={1.8} /></span>
            <span className="sy-a-quick-label">{label}</span>
          </button>
        ))}
      </nav>

      <RoadmapCard rm={rm} first={first} goTo={goTo} />

      {first ? (
        <>
          <button type="button" className="sy-a-banner" onClick={() => goTo('centers')}>
            <span className="sy-a-banner-ico"><MapPin size={22} strokeWidth={1.9} /></span>
            <span className="sy-a-banner-text">
              <b>꿈드림센터 지원을 찾아봐요</b>
              <span>상담·학습·진학 지원을 받을 수 있어요.</span>
            </span>
            <ArrowRight size={22} strokeWidth={1.9} />
          </button>

          <button type="button" className="sy-a-ask" onClick={() => goTo('help')}>
            <span className="sy-a-ask-ico"><CircleHelp size={20} strokeWidth={1.9} /></span>
            <span className="sy-a-ask-text">
              <b>담임에게 물어보기</b>
              <span>자주 묻는 질문을 모았어요</span>
            </span>
            <ChevronRight size={18} strokeWidth={2} />
          </button>
        </>
      ) : (
        <NowList profile={profile} region={rm.region} goTo={goTo} />
      )}
    </div>
  );
}

// 로드맵 카드 — 지금 단계 + 네 칸 진행 막대 + 큰 버튼
function RoadmapCard({ rm, first, goTo }) {
  const idx = rm.steps.findIndex((s) => s.status === 'current');
  const ap = rm.apply;
  return (
    <section className="sy-a-rcard">
      <div className="sy-a-rcard-head">
        {first ? (
          <span className="sy-a-pill green"><Sparkles size={13} strokeWidth={2.2} /> 지금 첫 단계예요</span>
        ) : (
          <span className="sy-a-pill green"><Navigation size={13} strokeWidth={2.2} /> 지금 여기</span>
        )}
        {first ? (
          <button type="button" className="sy-a-rcard-set" aria-label="내 정보 바꾸기"
            onClick={() => goTo('onboarding', { step: 'grade' })}>
            <Settings2 size={22} strokeWidth={1.8} />
          </button>
        ) : (
          <span className="sy-a-pill neutral">
            <Clock3 size={14} strokeWidth={2} /> {ap.confirmed ? `원서 ${ap.dday}` : '일정 공고 전'}
          </span>
        )}
      </div>

      <h2 className="sy-a-rcard-title">{first ? '내 정보를 준비해요' : '대학을 알아볼 때예요'}</h2>
      <p className="sy-a-rcard-sub">
        {first ? '학년과 지역을 알려주면 일정을 맞춰드려요.' : '모집 일정이 나오면 날짜를 바로 채워드려요.'}
      </p>

      <ol className="sy-a-bar" aria-label="대입까지 네 걸음">
        {rm.steps.map((s, i) => (
          <li key={s.id} className={`${i <= idx ? 'on' : ''}${i === idx ? ' cur' : ''}`}
            aria-current={i === idx ? 'step' : undefined}>
            <i />
            <span>{s.short}</span>
          </li>
        ))}
      </ol>

      <button type="button" className="sy-btn sy-a-rcard-btn"
        onClick={() => (first ? goTo('roadmap') : goTo('results'))}>
        {first ? '로드맵 시작하기' : '나와 맞는 대학 보기'}
      </button>
    </section>
  );
}

// 지금 챙기면 좋아요 — 아직 체크 안 한 서류 하나 + 사는 지역 대학 + 가까운 꿈드림센터
function NowList({ profile, region, goTo }) {
  const doc = useMemo(() => {
    const checked = loadChecked();
    return checklistItems(profile).find((it) => !checked[it.id]) || null;
  }, [profile]);

  const [center, setCenter] = useState(() => {
    const c = suggestedCenter(region);
    return c ? { c, dist: null } : null;
  });

  // 위치를 이미 허락한 기기면 내 위치에서 가장 가까운 센터·거리를 보여 준다(새로 묻지 않는다)
  useEffect(() => {
    if (!locationAllowed()) return undefined;
    let alive = true;
    requestPosition().then((pos) => {
      if (!alive || !pos) return;
      const near = filterCenters({ pos })[0];
      if (near && Number.isFinite(near._dist)) setCenter({ c: near, dist: near._dist });
    });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <h2 className="sy-a-sec">지금 챙기면 좋아요</h2>
      <div className="sy-card sy-a-list">
        {doc && (
          <button type="button" className="sy-a-row" onClick={() => goTo('checklist')}>
            <span className="sy-a-row-ico"><FileCheck2 size={20} strokeWidth={1.8} /></span>
            <span className="sy-a-row-text">
              <b>{doc.title}</b>
              <span>{issuerShort(doc.issuer)}에서 발급할 수 있어요</span>
            </span>
            <ChevronRight size={18} strokeWidth={2} />
          </button>
        )}
        <button type="button" className="sy-a-row" onClick={() => goTo('univ-explore', { region })}>
          <span className="sy-a-row-ico"><Search size={20} strokeWidth={1.8} /></span>
          <span className="sy-a-row-text">
            <b>{region} 지역 대학 살펴보기</b>
            <span>조건을 고르고 비교해요</span>
          </span>
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      </div>

      {center && (
        <div className="sy-card sy-a-list">
          <button type="button" className="sy-a-row tall" onClick={() => goTo('center', { centerId: center.c.id })}>
            <span className="sy-a-row-ico"><MapPin size={20} strokeWidth={1.8} /></span>
            <span className="sy-a-row-text">
              <b>가까운 꿈드림센터</b>
              <span>{center.c.name}{center.dist != null ? ` · ${distLabel(center.dist)}` : ''}</span>
            </span>
            <ChevronRight size={18} strokeWidth={2} />
          </button>
        </div>
      )}
    </>
  );
}
