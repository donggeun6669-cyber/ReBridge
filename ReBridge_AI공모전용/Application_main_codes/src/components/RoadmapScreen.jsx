import { useMemo } from 'react';
import {
  ChevronRight, ClipboardList, FileText, Scale,
  CalendarDays, Target, MessageCircle, CheckCircle2, Compass,
  Info, Search, Bookmark,
} from 'lucide-react';
import { buildRoadmap } from '../lib/roadmap.js';
import { getExploreList } from '../lib/analysis.js';
import { evaluateAdmission, admissionChance, estimateGrade } from '../lib/scoreEngine.js';
import { getBookmarks } from '../lib/bookmarks.js';

const STORAGE_KEY = 'rebridge_profile';

// 프로필 점수로 전체 대학을 훑어 칸수 분포(안정/적정/소신)를 센다 — 로드맵 개인화용.
function computeFit(profile) {
  const list = getExploreList();
  let safe = 0;
  let fit = 0;
  let reach = 0;
  for (const s of list) {
    if (!s.bestType) continue;
    const ev = evaluateAdmission(profile, {
      univId: s.univId,
      admissionType: s.bestType,
      admissionName: s.bestName,
      gedEligible: s.bestGedEligible,
    });
    if (!ev.applicable) continue;
    const c = admissionChance(ev);
    if (!c) continue;
    if (c.level >= 5) safe += 1;
    else if (c.level === 4) fit += 1;
    else if (c.level === 3) reach += 1;
  }
  return { safe, fit, reach };
}

const ICONS = {
  ClipboardList, FileText, Scale, CalendarDays, Target, MessageCircle, CheckCircle2,
};

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

export default function RoadmapScreen({ goTo = () => {} }) {
  const profile = useMemo(loadProfile, []);
  const data = useMemo(() => (profile ? buildRoadmap(profile) : null), [profile]);

  if (!profile) {
    return (
      <div className="screen">
        <header className="topbar center">
          <span className="page-title">내 로드맵</span>
        </header>
        <div className="profile-card" style={{ marginTop: 40 }}>
          <span className="profile-name">먼저 내 정보를 알려주세요</span>
          <span className="profile-summary">
            몇 가지만 입력하면 검정고시부터 대학 등록까지 나만의 일정표를 만들어 드려요.
          </span>
          <button className="btn-outline" onClick={() => goTo('profile')}>
            정보 입력하기
          </button>
        </div>
      </div>
    );
  }

  const { stages, nextStage } = data;

  // 개인 맞춤 — 점수가 있으면 칸수 분포, 관심 대학 수.
  const hasScore = !!(profile.gedScores && profile.gedAvg != null);
  const myGrade = hasScore ? estimateGrade(profile.gedAvg) : null;
  const fit = useMemo(() => (hasScore ? computeFit(profile) : null), [profile, hasScore]);
  const bookmarkCount = useMemo(() => getBookmarks().length, []);

  // 단계별 개인 맞춤 액션(버튼) — id로 매칭.
  function stageAction(id) {
    if (id === 'target') {
      return hasScore
        ? { label: '내 점수로 가능성순 보기', icon: Search, onClick: () => goTo('explore') }
        : { label: '대학 둘러보기', icon: Search, onClick: () => goTo('explore') };
    }
    if (id === 'susi') {
      return bookmarkCount > 0
        ? { label: `관심 대학 ${bookmarkCount}곳 보기`, icon: Bookmark, onClick: () => goTo('saved') }
        : { label: '관심 대학 담으러 가기', icon: Bookmark, onClick: () => goTo('explore') };
    }
    return null;
  }

  return (
    <div className="screen">
      <header className="topbar center">
        <span className="page-title">내 로드맵</span>
      </header>

      <div className="intro-line">지금 너는 여기 있어요</div>
      <div className="intro-sub">
        검정고시부터 대학 등록까지, 다음에 뭘 언제 해야 하는지 같이 챙길게요.
      </div>

      {/* 내 상황 — 점수/관심대학과 연동한 개인 맞춤 요약 */}
      {(hasScore || bookmarkCount > 0) && (
        <div className="rm-mystatus">
          <span className="mini-label">내 상황</span>
          {hasScore && (
            <p className="rm-mystatus-line">
              평균 <b>{profile.gedAvg}점</b>
              {myGrade != null ? ` · 추정 ${myGrade}등급` : ''} 기준,
              지금 점수로 <b className="tone-good">안정 {fit.safe}</b> ·{' '}
              <b className="tone-ok">적정 {fit.fit}</b> · <b className="tone-warn">소신 {fit.reach}</b>곳이 있어요.
            </p>
          )}
          {!hasScore && (
            <p className="rm-mystatus-line">
              점수를 넣으면 지금 어디가 안정·적정인지 로드맵에 맞춰 알려드려요.
            </p>
          )}
          <div className="rm-mystatus-actions">
            <button className="rm-chip-btn" onClick={() => goTo('explore')}>
              <Search size={14} /> {hasScore ? '가능성순으로 보기' : '대학 둘러보기'}
            </button>
            {bookmarkCount > 0 ? (
              <button className="rm-chip-btn" onClick={() => goTo('saved')}>
                <Bookmark size={14} /> 관심 대학 {bookmarkCount}곳
              </button>
            ) : (
              !hasScore && (
                <button className="rm-chip-btn" onClick={() => goTo('profile')}>
                  내 점수 입력
                </button>
              )
            )}
          </div>
          {hasScore && (
            <p className="rm-mystatus-note">
              <Info size={11} /> 안정·적정·소신은 작년 합격선 자료가 있는 전형 기준이에요(참고용).
            </p>
          )}
        </div>
      )}

      {nextStage && (
        <div className="rm-next">
          <span className="mini-label">다음 할 일</span>
          <div className="rm-next-row">
            <strong>{nextStage.title}</strong>
            {nextStage.dday && <span className="rm-dday">{nextStage.dday}</span>}
          </div>
          <p>{nextStage.todo}</p>
        </div>
      )}

      <div className="rm-timeline">
        {stages.map((s) => {
          const Icon = ICONS[s.icon] || CheckCircle2;
          return (
            <div className={`rm-stage rm-${s.status}`} key={s.id}>
              <span className="rm-dot">
                <Icon size={16} />
              </span>
              <div className="rm-stage-body">
                <div className="rm-stage-head">
                  <span className="rm-stage-title">{s.title}</span>
                  {s.status === 'current' && <span className="rm-badge-now">지금 여기</span>}
                  {s.status === 'done' && <span className="rm-badge-done">완료</span>}
                  {s.optional && <span className="rm-badge-opt">선택</span>}
                </div>
                <div className="rm-stage-when">
                  {s.dateLabel}
                  {s.dday && s.status !== 'done' && <b> · {s.dday}</b>}
                </div>
                <p className="rm-stage-todo">{s.todo}</p>
                {s.term && (
                  <p className="rm-stage-term">
                    <Info size={12} /> {s.term}
                  </p>
                )}
                {(() => {
                  const act = stageAction(s.id);
                  return act ? (
                    <button className="rm-stage-action" onClick={act.onClick}>
                      <act.icon size={14} /> {act.label}
                    </button>
                  ) : null;
                })()}
                {s.guideTopic && (
                  <button
                    className="rm-guide-link"
                    onClick={() => goTo('guide', { topic: s.guideTopic })}
                  >
                    자세히 알아보기 <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 비입시 경로 분기 — 대학 말고 다른 길도 있다는 걸 보여줘요 */}
      <button className="rm-branch" onClick={() => goTo('explore')}>
        <span className="rm-branch-ico">
          <Compass size={20} />
        </span>
        <span className="rm-branch-body">
          <span className="rm-branch-title">대학 말고 다른 길도 있어요</span>
          <span className="rm-branch-desc">
            취업·직업훈련·자격증… 검정고시 뒤에 갈 수 있는 길은 하나가 아니에요.
          </span>
        </span>
        <ChevronRight size={18} />
      </button>

      <p className="note">
        일정은 예년 패턴 기준이에요. 정확한 날짜는 시도교육청·대학 입학처 공고로 꼭 확인해요.
      </p>
    </div>
  );
}
