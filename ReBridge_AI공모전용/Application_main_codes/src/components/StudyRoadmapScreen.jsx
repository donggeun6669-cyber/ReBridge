import { useMemo } from 'react';
import {
  BookOpen, ClipboardList, FileText, Award, Building2, Briefcase, Compass,
  ChevronRight, Flame, ListChecks,
} from 'lucide-react';
import { getNextSession, daysUntil, formatKDate, PASS_RULE, GED_SUBJECT_GUIDE } from '../data/gedGuide.js';
import { getPersona } from '../lib/persona.js';
import '../styles.studyroadmap.css';
import '../styles.study.css';

const DAYS_KEY = 'rebridge_planner_days';
const MOCK_KEY = 'rebridge_mock_scores';

function loadDays() {
  try { return JSON.parse(localStorage.getItem(DAYS_KEY)) || {}; }
  catch { return {}; }
}
function loadScores() {
  try { return JSON.parse(localStorage.getItem(MOCK_KEY)) || {}; }
  catch { return {}; }
}
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtMin(m) {
  if (!m) return '0분';
  const h = Math.floor(m / 60), mm = m % 60;
  return h > 0 ? `${h}시간 ${mm ? `${mm}분` : ''}`.trim() : `${mm}분`;
}

// 목표별 마지막 단계(검정고시 합격 이후)
const GOAL_FINAL = {
  university: {
    icon: Building2,
    title: '목표 대학 정하기',
    todo: '합격 점수가 나오면 비교내신으로 갈 수 있는 대학을 좁혀요.',
    cta: { label: '대학 둘러보기', screen: 'univ-explore' },
  },
  job: {
    icon: Briefcase,
    title: '직업훈련·자격증 첫걸음',
    todo: '관심 분야를 정하고 내일배움카드·자격증으로 시작해요.',
    cta: { label: '진로 보기', screen: 'explore' },
  },
  undecided: {
    icon: Compass,
    title: '진로 정하기',
    todo: '대학·직업훈련·자격증 중 나에게 맞는 길을 천천히 골라요.',
    cta: { label: '진로 탐색', screen: 'explore' },
  },
};

export default function StudyRoadmapScreen({ goTo = () => {} }) {
  const persona = getPersona();
  const goal = persona?.goal || 'undecided';
  const session = useMemo(() => getNextSession(), []);
  const final = GOAL_FINAL[goal] || GOAL_FINAL.undecided;

  // 살아있는 진행 — 플래너·모의점수와 연동
  const live = useMemo(() => {
    const days = loadDays();
    const scores = loadScores();
    const today = new Date();
    const todayStr = ymd(today);

    let totalMin = 0;
    const studied = (dd) => !!dd && ((dd.minutes || 0) > 0 || (dd.tasks || []).some((t) => t.done));
    Object.values(days).forEach((d) => { totalMin += d.minutes || 0; });

    // 연속일
    let streak = 0;
    const cur = new Date(today);
    if (!studied(days[todayStr])) cur.setDate(cur.getDate() - 1);
    for (;;) { if (studied(days[ymd(cur)])) { streak++; cur.setDate(cur.getDate() - 1); } else break; }

    // 모의 평균
    const entered = GED_SUBJECT_GUIDE.map((s) => scores[s.key]).filter((v) => v != null && v !== '');
    const avg = entered.length ? Math.round(entered.reduce((a, b) => a + b, 0) / entered.length) : null;
    const passLine = PASS_RULE.passAverage;

    // 합격까지 진행률 — 평균 점수 기준(없으면 공부일로 가늠)
    let pct, msg;
    if (avg != null) {
      pct = Math.min(100, Math.round((avg / passLine) * 100));
      msg = avg >= passLine
        ? `모의 평균 ${avg}점 — 합격선을 넘었어요! 이대로 굳혀요.`
        : `모의 평균 ${avg}점 — 합격선까지 평균 ${passLine - avg}점 남았어요.`;
    } else {
      pct = totalMin > 0 ? Math.min(60, Math.round(totalMin / 60)) : 0;
      msg = '과목 가이드에서 모의 점수를 적으면 합격까지 진행률이 보여요.';
    }
    return { totalMin, streak, avg, passLine, pct, msg, hasData: totalMin > 0 || avg != null };
  }, []);

  const steps = useMemo(() => {
    const list = [
      {
        id: 'study',
        icon: BookOpen,
        title: '지금 — 검정고시 공부',
        date: null,
        todo: '과목별 가이드로 약한 과목부터 채워요. 평균 60점이면 합격이에요.',
        cta: { label: '학습 홈에서 과목 가이드 보기', screen: 'ged-guide' },
        forceCurrent: true,
      },
    ];
    if (session) {
      list.push(
        { id: 'apply', icon: ClipboardList, title: '원서접수', date: session.applyDate,
          todo: '거주지 시·도교육청에서 접수해요. 기간을 놓치면 다음 회차로 밀려요.' },
        { id: 'exam', icon: FileText, title: `검정고시 시험 (${session.label})`, date: session.examDate,
          todo: '시험 당일! 그동안 푼 기출이 힘이 돼요.' },
        { id: 'result', icon: Award, title: '합격발표', date: session.resultDate,
          todo: '합격하면 합격증명서를 미리 발급해 두면 다음 단계가 편해요.' },
      );
    }
    list.push({
      id: 'final',
      icon: final.icon,
      title: final.title,
      date: null,
      todo: final.todo,
      cta: final.cta,
      isFinal: true,
    });

    // 상태 계산
    let currentMarked = false;
    return list.map((s) => {
      let status = 'upcoming';
      if (s.forceCurrent) { status = 'current'; currentMarked = true; }
      else if (s.date) {
        const d = daysUntil(s.date);
        if (d < 0) status = 'done';
        else if (!currentMarked) { status = 'current'; currentMarked = true; }
      } else if (s.isFinal) {
        status = 'upcoming';
      }
      const dday = s.date ? daysUntil(s.date) : null;
      return { ...s, status, dday };
    });
  }, [session, final]);

  return (
    <div className="screen">
      <header className="topbar">
        <span className="page-title">내 로드맵</span>
      </header>

      <div className="srm-intro">
        <span className="srm-intro-kicker">검정고시 준비 로드맵</span>
        <h2 className="srm-intro-title">
          지금부터 {goal === 'university' ? '대학' : goal === 'job' ? '취업' : '내 길'}까지,<br />
          한 걸음씩 같이 가요
        </h2>
      </div>

      {/* 살아있는 진행 — 플래너·모의점수 연동 */}
      <div className="study-rm-progress">
        <div className="study-rm-progress-head">
          <span className="study-rm-progress-title">검정고시 합격까지</span>
          <span className="study-rm-progress-pct">{live.pct}%</span>
        </div>
        <div className="study-rm-progress-bar">
          <span className="study-rm-progress-fill" style={{ width: `${live.pct}%` }} />
        </div>
        <p className="study-rm-progress-sub">{live.msg}</p>
        {live.hasData && (
          <p className="study-rm-progress-sub" style={{ marginTop: 6 }}>
            지금까지 <b>{fmtMin(live.totalMin)}</b> 공부
            {live.streak > 0 && <> · <b><Flame size={12} style={{ verticalAlign: '-1px' }} /> {live.streak}일 연속</b></>}
          </p>
        )}
        <button className="study-rm-link" onClick={() => goTo('study-planner')}>
          <ListChecks size={14} /> 오늘 할 일·타이머 하러 가기
        </button>
      </div>

      <div className="srm-timeline">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const last = i === steps.length - 1;
          return (
            <div key={s.id} className={`srm-step srm-${s.status}`}>
              <div className="srm-rail">
                <span className="srm-node"><Icon size={16} /></span>
                {!last && <span className="srm-line" />}
              </div>
              <div className="srm-card">
                <div className="srm-card-head">
                  <span className="srm-card-title">{s.title}</span>
                  {s.status === 'current' && <span className="srm-badge cur">지금</span>}
                  {s.dday != null && s.status !== 'done' && s.dday >= 0 && (
                    <span className="srm-badge dday">{s.dday === 0 ? 'D-DAY' : `D-${s.dday}`}</span>
                  )}
                  {s.status === 'done' && <span className="srm-badge done">완료</span>}
                </div>
                {s.date && <div className="srm-date">{formatKDate(s.date)}</div>}
                <p className="srm-todo">{s.todo}</p>
                {s.cta && (
                  <button className="srm-cta" onClick={() => goTo(s.cta.screen)}>
                    {s.cta.label} <ChevronRight size={15} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="note" style={{ marginTop: 8 }}>
        접수·시험일은 예년 패턴 기준이에요. 정확한 날짜는 시·도교육청 공고로 확인하세요.
      </p>
    </div>
  );
}
