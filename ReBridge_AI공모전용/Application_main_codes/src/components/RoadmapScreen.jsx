import { useMemo } from 'react';
import {
  ChevronRight, ClipboardList, FileText, Scale,
  CalendarDays, Target, MessageCircle, CheckCircle2,
  Info, Search, Bookmark, Flag,
} from 'lucide-react';
import { buildRoadmap } from '../lib/roadmap.js';
import { getUniversityDetail } from '../lib/analysis.js';
import { evaluateAdmission, admissionChance } from '../lib/scoreEngine.js';
import { getBookmarks } from '../lib/bookmarks.js';

const STORAGE_KEY = 'rebridge_profile';

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

  // 목표 대학(=관심 대학)까지 몇 점 더 필요한지 — 점수가 있을 때.
  const targets = useMemo(() => {
    if (!hasScore) return [];
    return getBookmarks()
      .slice()
      .reverse()
      .map((id) => {
        const d = getUniversityDetail(id);
        if (!d) return null;
        const best = d.rows.find((r) => r.gedEligible === '가능' || r.gedEligible === '조건부');
        if (!best) return null;
        const ev = evaluateAdmission(profile, { ...best, univId: id });
        const chance = ev.applicable ? admissionChance(ev) : null;
        return { id, name: d.univ.name, best, ev, chance };
      })
      .filter(Boolean);
  }, [profile, hasScore]);

  function gapText(t) {
    if (t.chance && t.ev.shortPoints > 0) {
      return { tone: 'warn', text: `평균 ${t.ev.shortPoints}점 더 · 과목당 약 ${t.ev.perSubjectQuestions}문제` };
    }
    if (t.chance) {
      return { tone: 'good', text: `지금 점수로 ${t.chance.label}권이에요` };
    }
    if (t.ev?.dataGap === 'csat') return { tone: 'mute', text: '수능 기준 전형 — 점수 비교 어려움' };
    return { tone: 'mute', text: '작년 합격선 자료 없음' };
  }

  return (
    <div className="screen">
      <header className="topbar center">
        <span className="page-title">내 로드맵</span>
      </header>

      <div className="intro-line">지금 나는 여기 있어요</div>
      <div className="intro-sub">
        검정고시부터 대학 등록까지, 다음에 뭘 언제 해야 하는지 같이 챙길게요.
      </div>

      {/* 목표 대학까지 — 관심 대학을 등록하면 합격선까지 몇 점 더 필요한지 */}
      <div className="rm-targets">
          <span className="mini-label"><Flag size={12} /> 목표 대학까지</span>
          {!hasScore ? (
            <div className="rm-targets-empty">
              <p><b>내 점수</b>를 넣고 관심 대학을 담으면, 합격선까지 <b>몇 점이 더 필요한지</b> 챙겨드려요.</p>
              <button className="rm-chip-btn" onClick={() => goTo('profile')}>
                내 점수 입력
              </button>
            </div>
          ) : targets.length === 0 ? (
            <div className="rm-targets-empty">
              <p>가고 싶은 대학을 <b>관심 대학</b>으로 담으면, 합격선까지 <b>몇 점이 더 필요한지</b> 여기서 챙겨드려요.</p>
              <button className="rm-chip-btn" onClick={() => goTo('explore')}>
                <Search size={14} /> 대학 담으러 가기
              </button>
            </div>
          ) : (
            <ul className="rm-target-list">
              {targets.map((t) => {
                const g = gapText(t);
                const showQuestions = t.ev?.shortPoints > 0 && t.ev?.perSubjectQuestions > 0;
                return (
                  <li key={t.id}>
                    <button
                      className="rm-target-row"
                      onClick={() => goTo('detail', { univ: t.name, univId: t.id })}
                    >
                      <div className="rm-target-info">
                        <span className="rm-target-name">{t.name}</span>
                        <span className={`rm-target-gap tone-${g.tone}`}>{g.text}</span>
                        {showQuestions && (
                          <div className="rm-inverse-msg">
                            <span className="rm-inverse-ico">🎯</span>
                            <span>
                              <b>과목당 {t.ev.perSubjectQuestions}문제</b>씩
                              더 맞히면 돼요
                              {t.ev.totalQuestions > 0 && (
                                <span className="rm-total-q">
                                  (전체 약 {t.ev.totalQuestions}문제)
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                      <ChevronRight size={16} className="rm-target-arrow" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {hasScore && targets.length > 0 && (
            <p className="rm-targets-note">
              <Info size={11} /> 부족 점수는 작년(2025) 합격선 기준 추정이에요 · 참고용.
            </p>
          )}
        </div>

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

      <p className="note">
        일정은 예년 패턴 기준이에요. 정확한 날짜는 시도교육청·대학 입학처 공고로 꼭 확인해요.
      </p>
    </div>
  );
}
