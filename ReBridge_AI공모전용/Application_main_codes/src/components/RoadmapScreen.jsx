import { useMemo, useEffect, useRef } from 'react';
import {
  ArrowLeft, ChevronRight, ClipboardList, FileText, Scale,
  CalendarDays, Target, MessageCircle, CheckCircle2,
  Info, Search, Flag, CalendarClock, Check,
} from 'lucide-react';
import { buildRoadmap, gradeRoadmap } from '../lib/roadmap.js';
import { getUniversityDetail } from '../lib/analysis.js';
import { evaluateAdmission, admissionChance } from '../lib/scoreEngine.js';
import { getBookmarks } from '../lib/bookmarks.js';
import { loadProfile, gradeOption } from '../lib/persona.js';
import ChecklistSection from './ChecklistSection.jsx';
import imgGed from '../assets/icons3d/step-ged.png';
import imgScore from '../assets/icons3d/step-score.png';
import imgUniv from '../assets/icons3d/step-univ.png';
import imgApply from '../assets/icons3d/step-apply.png';
import '../styles.home.css';

const STEP_IMG = { ged: imgGed, score: imgScore, univ: imgUniv, apply: imgApply };
import {
  CUTLINE_GAP_NOTE, CUTLINE_NO_DATA_SHORT,
  ADMISSION_DATA_YEAR, GED_2027_SOURCE_LABEL, applyDeadline,
} from '../data/meta.js';

// 관심 대학 중 원서 접수 마감이 남은 곳 — 가까운 순.
// applyCloseDate가 있는 건 2027 자료가 있는 대학뿐이라, 없는 대학은 애초에 대상이 아니다.
// (없는 날짜를 지어내지 않는다)
const DEADLINE_ALERT_DAYS = 30; // 한 달 안쪽만 알림 — 그보다 멀면 로드맵 단계로 충분

function upcomingDeadlines(bookmarkIds, today) {
  const out = [];
  for (const id of bookmarkIds) {
    const d = getUniversityDetail(id);
    if (!d) continue;
    let best = null;
    for (const r of d.rows) {
      if (!r.applyCloseDate) continue;
      if (r.gedEligible !== '가능' && r.gedEligible !== '조건부') continue;
      const dl = applyDeadline(r.applyCloseDate, r.applyCloseTime, today);
      if (!dl || dl.past || dl.days > DEADLINE_ALERT_DAYS) continue;
      if (!best || dl.days < best.dl.days) best = { dl, row: r };
    }
    if (best) {
      out.push({
        univId: id,
        name: d.univ.name,
        phase: best.row.phase || '원서',
        dl: best.dl,
      });
    }
  }
  return out.sort((a, b) => a.dl.days - b.dl.days);
}

const ICONS = {
  ClipboardList, FileText, Scale, CalendarDays, Target, MessageCircle, CheckCircle2,
};

// '나의 대입 로드맵' — 2026-09-17 동근님: '내 로드맵'과 '서류 체크리스트'를 한 화면으로 합쳤다.
//   2026-09-18: 맨 위에 학년별 4단계(검정고시·내 점수·대학 찾기·원서·서류)와 주요 일정 D-day를 얹었다.
//     네 단계의 입구는 여기뿐이다. 홈·MY 메뉴에 같은 화면 버튼을 두지 않는다.
//     그래서 아래 타임라인의 단계별 버튼(대학 둘러보기·관심 대학 보기)은 뺐다 — 위 단계와 겹쳐서.
//   위: 일정 순서(마감 알림 · 다음 할 일 · 단계별 타임라인)
//   아래: 챙길 서류(체크리스트 — 체크 기능 그대로) · 목표 대학까지
// focus='docs' 로 열리면(예전 '체크리스트' 링크) 서류 구역으로 바로 내려간다.
export default function RoadmapScreen({ goTo = () => {}, goBack = () => {}, focus = null }) {
  const profile = useMemo(loadProfile, []);
  const data = useMemo(() => (profile ? buildRoadmap(profile) : null), [profile]);
  const journey = useMemo(() => gradeRoadmap(profile, getBookmarks().length), [profile]);
  const grade = gradeOption(profile?.grade);
  const docsRef = useRef(null);
  const planRef = useRef(null);

  useEffect(() => {
    if (focus !== 'docs') return;
    const t = setTimeout(() => docsRef.current?.scrollIntoView({ block: 'start' }), 60);
    return () => clearTimeout(t);
  }, [focus]);

  const jump = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const header = (
    <>
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
        <span className="page-title">나의 대입 로드맵</span>
      </header>

      <section className="rj-card" aria-label="나의 단계">
        <span className="rj-kicker">
          {grade ? `${grade.label} · ` : ''}{journey.peerNote}
        </span>
        <h2 className="rj-title">{journey.headline}</h2>
        <p className="rj-sub">{journey.nextTodo}</p>
        <ol className="rj-steps">
          {journey.steps.map((st, i) => {
            const inner = (
              <>
                <img className="rj-step-img" src={STEP_IMG[st.id]} alt="" width="44" height="44" />
                <span className="rj-step-text">
                  <span className="rj-step-title">
                    <span className="rj-step-no">{i + 1}</span>{st.title}
                  </span>
                  <span className="rj-step-sub">{st.sub}</span>
                </span>
                {st.status === 'current' && <span className="rj-badge now">지금 여기</span>}
                {st.status === 'done' && <span className="rj-badge done"><Check size={12} strokeWidth={3} /> 완료</span>}
                <ChevronRight size={18} className="rj-step-arrow" aria-hidden="true" />
              </>
            );
            // 원서·서류는 이 화면 안 — 일정 순서로 내려간다
            const onClick = st.screen ? () => goTo(st.screen) : () => jump(planRef);
            return (
              <li key={st.id}>
                <button type="button" className={`rj-step is-${st.status}`} onClick={onClick}
                  aria-current={st.status === 'current' ? 'step' : undefined}>
                  {inner}
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {journey.keyDates.length > 0 && (
        <section className="rj-dates" aria-label="주요 일정">
          <p className="rj-dates-title"><CalendarClock size={14} /> 주요 일정</p>
          <ul>
            {journey.keyDates.map((d) => (
              <li key={d.id} className="rj-date">
                <span className="rj-date-label">{d.label}</span>
                <span className="rj-date-when">{d.text}</span>
                {d.dday
                  ? <span className="rj-dday">{d.dday}</span>
                  : <span className="rj-dday approx">공고 전</span>}
              </li>
            ))}
          </ul>
          <p className="rj-dates-note">
            <Info size={11} /> D-day는 공고로 확정된 일정에만 붙여요. 나머지는 예년 기준이라 공고로 꼭 확인해요.
          </p>
        </section>
      )}

      <div className="rm-jump">
        <button className="rm-jump-chip" onClick={() => jump(planRef)}>🗓️ 일정 순서</button>
        <button className="rm-jump-chip" onClick={() => jump(docsRef)}>📄 챙길 서류</button>
      </div>
    </>
  );

  const docsBlock = (
    <section className="rm-docs" ref={docsRef}>
      <p className="rm-sec-title">챙길 서류</p>
      <ChecklistSection goTo={goTo} />
    </section>
  );

  if (!profile) {
    // 정보가 없어도 서류 체크리스트는 쓸 수 있다 — 일정만 입력을 요청한다.
    return (
      <div className="screen">
        {header}
        <section ref={planRef}>
          <p className="rm-sec-title">일정 순서</p>
          <div className="profile-card">
            <span className="profile-name">먼저 내 정보를 알려주세요</span>
            <span className="profile-summary">
              몇 가지만 입력하면 검정고시부터 대학 등록까지 나만의 일정표를 만들어 드려요.
            </span>
            <button className="btn-outline" onClick={() => goTo('profile')}>
              정보 입력하기
            </button>
          </div>
        </section>
        {docsBlock}
      </div>
    );
  }

  const { stages, nextStage } = data;

  // 개인 맞춤 — 점수가 있으면 칸수 분포, 관심 대학 수.
  const hasScore = !!(profile.gedScores && profile.gedAvg != null);

  // 관심 대학 원서 접수 마감 알림 — 자료가 있는 대학만 뜬다
  const deadlineAlerts = useMemo(
    () => upcomingDeadlines(getBookmarks(), new Date()),
    []
  );

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
    return { tone: 'mute', text: CUTLINE_NO_DATA_SHORT };
  }

  return (
    <div className="screen">
      {header}

      <section ref={planRef}>
      <p className="rm-sec-title">일정 순서</p>

      {/* 관심 대학 원서 접수 마감 — 코앞인 것부터 */}
      {deadlineAlerts.length > 0 && (
        <div className="rm-deadlines">
          <span className="mini-label"><CalendarClock size={12} /> 원서 접수 마감이 다가와요</span>
          <ul className="rm-deadline-list">
            {deadlineAlerts.map((a) => (
              <li key={a.univId}>
                <button
                  className="rm-deadline-row"
                  onClick={() => goTo('detail', { univ: a.name, univId: a.univId })}
                >
                  <span className="rm-deadline-text">
                    <b>{a.name}</b> {a.phase} 접수
                  </span>
                  <span className={`dday-badge dday-${a.dl.days <= 3 ? 'urgent' : a.dl.days <= 10 ? 'soon' : 'far'}`}>
                    {a.dl.label}
                  </span>
                  <ChevronRight size={15} className="rm-target-arrow" />
                </button>
                <span className="rm-deadline-date">{a.dl.dateLabel} 마감</span>
              </li>
            ))}
          </ul>
          <p className="rm-targets-note">
            <Info size={11} /> {ADMISSION_DATA_YEAR}학년도 마감일은 {GED_2027_SOURCE_LABEL} 기준이에요.
            {' '}이 자료에 없는 대학은 여기 뜨지 않아요 — 입학처 공고로 확인하세요.
          </p>
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
      </section>

      {docsBlock}

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
              <button className="rm-chip-btn" onClick={() => goTo('univ-explore')}>
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
              <Info size={11} /> {CUTLINE_GAP_NOTE}
            </p>
          )}
        </div>

      <p className="note">
        일정은 예년 패턴 기준이에요. 정확한 날짜는 시도교육청·대학 입학처 공고로 꼭 확인해요.
      </p>
    </div>
  );
}
