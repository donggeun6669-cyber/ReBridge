import { ChevronRight, BookOpen, Calculator, Search, FileText, HelpCircle, Bookmark } from 'lucide-react';
import { loadProfile } from '../lib/persona.js';
import { gradeRoadmap } from '../lib/roadmap.js';
import { getBookmarks } from '../lib/bookmarks.js';
import '../styles.v3.css';

// 진학 탭 첫 화면 (PRD v2 부가 기능 F9·F10 — 2026-09-26 시연판)
//   동근님: "우리 하던 거 좀 간략하게". 기존 로드맵(lib/roadmap.js gradeRoadmap)을 한 장으로 요약하고,
//   네 단계는 원래 있던 화면으로 그대로 보낸다(검정고시 안내·점수·대학 찾기·원서 서류).
//   점수 엔진은 규칙 기반이고 결과는 참고용 — 합격을 보장하는 말은 쓰지 않는다.

const STEP_META = {
  ged:   { Icon: BookOpen,   screen: 'ged-guide' },
  score: { Icon: Calculator, screen: 'results' },
  univ:  { Icon: Search,     screen: 'univ-explore' },
  apply: { Icon: FileText,   screen: 'roadmap' },
};

export default function UnivHomeScreen({ goTo = () => {} }) {
  const profile = loadProfile();
  const bookmarks = getBookmarks();
  const rm = gradeRoadmap(profile, bookmarks.length);
  const hasScore = profile?.gedAvg != null;

  return (
    <div className="screen v3-screen">
      <header className="v3-top root">
        <span className="v3-top-title">진학</span>
      </header>

      <div className="v3-card">
        <div className="v3-card-body">
          <p className="v3-eyebrow" style={{ marginTop: 0 }}>{rm.peerNote}</p>
          <p style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.4, margin: 0, letterSpacing: '-0.02em' }}>{rm.headline}</p>
          <p className="v3-lead" style={{ fontSize: 14, marginTop: 4 }}>{rm.nextTodo}</p>
          <div className="v3-progress" aria-hidden="true">
            {rm.steps.map((s) => (
              <span key={s.id} className={s.status === 'done' ? 'done' : s.status === 'current' ? 'now' : ''} />
            ))}
          </div>
          <div className="v3-progress-labels" aria-hidden="true">
            {rm.steps.map((s) => <span key={s.id}>{s.title}</span>)}
          </div>
        </div>
      </div>

      <h2 className="v3-sec-title">순서대로 하기</h2>
      <div className="v3-list">
        {rm.steps.map((s, i) => {
          const { Icon, screen } = STEP_META[s.id];
          // 점수를 아직 안 넣었으면 결과 화면 대신 입력 화면으로
          const target = s.id === 'score' && !hasScore ? 'profile' : screen;
          return (
            <button key={s.id} type="button" className="v3-row" onClick={() => goTo(target)}>
              <span className={`v3-row-ico${s.status === 'current' ? ' green' : ''}`}><Icon size={18} /></span>
              <span className="v3-row-main">
                <span className="v3-row-title">
                  {i + 1}. {s.title}{' '}
                  {s.status === 'current' && <span className="v3-tag green">지금</span>}
                  {s.status === 'done' && <span className="v3-tag">했어요</span>}
                </span>
                <span className="v3-row-sub">{s.id === 'score' && !hasScore ? '검정고시 점수 넣기' : s.sub}</span>
              </span>
              <ChevronRight size={18} className="v3-row-end" />
            </button>
          );
        })}
      </div>

      {rm.keyDates.length > 0 && (
        <>
          <h2 className="v3-sec-title">다가오는 일정</h2>
          <div className="v3-list">
            {rm.keyDates.slice(0, 3).map((d) => (
              <div key={d.id} className="v3-row">
                <span className="v3-row-main">
                  <span className="v3-row-title" style={{ fontWeight: 500 }}>{d.label}</span>
                  <span className="v3-row-sub">{d.text}{d.confirmed ? '' : ' · 공고 전'}</span>
                </span>
                {d.dday && <span className="v3-tag warn">{d.dday}</span>}
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="v3-sec-title">더 알아보기</h2>
      <div className="v3-list">
        <button type="button" className="v3-row" onClick={() => goTo('help')}>
          <span className="v3-row-ico"><HelpCircle size={18} /></span>
          <span className="v3-row-main">
            <span className="v3-row-title">담임에게 물어보기</span>
            <span className="v3-row-sub">입시 용어·자주 묻는 질문</span>
          </span>
          <ChevronRight size={18} className="v3-row-end" />
        </button>
        <button type="button" className="v3-row" onClick={() => goTo('saved')}>
          <span className="v3-row-ico"><Bookmark size={18} /></span>
          <span className="v3-row-main">
            <span className="v3-row-title">관심 대학</span>
            <span className="v3-row-sub">{bookmarks.length ? `${bookmarks.length}곳 담았어요` : '아직 담은 대학이 없어요'}</span>
          </span>
          <ChevronRight size={18} className="v3-row-end" />
        </button>
      </div>

      <p className="v3-note">
        합격 가능성은 작년 합격선과 비교한 참고 정보예요. 중요한 건 대학 모집요강으로 한 번 더 확인해 주세요.
        진학 고민은 꿈드림 선생님과 같이 보면 더 좋아요.
      </p>
    </div>
  );
}
