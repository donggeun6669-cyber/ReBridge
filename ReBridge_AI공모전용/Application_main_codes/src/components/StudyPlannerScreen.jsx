import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock, ChevronRight, ChevronLeft, Target, Flame, CalendarDays,
  Plus, X, Wand2, Clock, CheckCircle2, Circle, Pencil,
  Play, Pause, Square, RotateCcw, Timer, Hourglass, Coffee,
  BarChart3, TrendingUp, Trophy, AlertCircle,
} from 'lucide-react';
import { GED_SUBJECT_GUIDE, getNextSession, daysUntil } from '../data/gedGuide.js';
import { loadProfile } from '../lib/persona.js';
import '../styles.studyplanner.css';
import '../styles.study.css';

const DAYS_KEY = 'rebridge_planner_days';
const TIMER_KEY = 'rebridge_planner_timer';
const MOCK_KEY = 'rebridge_mock_scores';
const GOAL_KEY = 'rebridge_study_weekgoal';
// day = { comment, minutes, bySubject:{}, tasks:[{id, subject, text, done}], pomos, reflect:{mood,focus,note} }
// timer = { mode:'free'|'pomo', running, startTs, accumSec, subject, phase:'focus'|'break', cycles }

const QUICK_MIN = [10, 30, 60];
const SUBJECTS = [...GED_SUBJECT_GUIDE.map((s) => s.key), '기타'];
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const PASS_LINE = 60;

const POMO_FOCUS_SEC = 25 * 60;
const POMO_BREAK_SEC = 5 * 60;

const GOAL_PRESETS = [300, 600, 900, 1200]; // 분: 5h/10h/15h/20h
const DEFAULT_GOAL = 600;

// 추천 플래너 템플릿
const TEMPLATES = [
  {
    key: 'basic', title: '기초 다지기', sub: '하루 2~3시간 · 처음 시작',
    tasks: [
      { subject: '국어', text: '기출 지문 3개 읽고 풀기' },
      { subject: '수학', text: '개념 1단원 정리 + 예제 풀기' },
      { subject: '영어', text: '기초 단어 30개 외우기' },
      { subject: '한국사', text: '시대 흐름 한 번 훑어보기' },
    ],
  },
  {
    key: 'weak', title: '약점 집중', sub: '부족한 과목 위주',
    tasks: [
      { subject: '수학', text: '틀린 유형만 다시 풀기' },
      { subject: '영어', text: '독해 지문 2개 + 단어 복습' },
      { subject: '과학', text: '헷갈리는 개념 정리' },
    ],
  },
  {
    key: 'finish', title: '마무리 점검', sub: '시험 2주 전',
    tasks: [
      { subject: '국어', text: '기출 1회분 풀기' },
      { subject: '수학', text: '기출 1회분 풀기' },
      { subject: '영어', text: '기출 1회분 풀기' },
      { subject: '사회', text: '오답 정리' },
      { subject: '과학', text: '오답 정리' },
      { subject: '한국사', text: '오답 정리' },
    ],
  },
];

const MOODS = [
  { key: 'great', emoji: '😄', label: '좋아요' },
  { key: 'ok', emoji: '🙂', label: '보통' },
  { key: 'tired', emoji: '😮‍💨', label: '지침' },
  { key: 'hard', emoji: '😣', label: '힘듦' },
];

function load() {
  try { return JSON.parse(localStorage.getItem(DAYS_KEY)) || {}; }
  catch { return {}; }
}
function loadScores() {
  try { return JSON.parse(localStorage.getItem(MOCK_KEY)) || {}; }
  catch { return {}; }
}
function loadGoal() {
  try {
    const v = JSON.parse(localStorage.getItem(GOAL_KEY));
    return v && typeof v.goalMin === 'number' ? v.goalMin : DEFAULT_GOAL;
  } catch { return DEFAULT_GOAL; }
}
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtMin(m) {
  if (!m) return '0분';
  const h = Math.floor(m / 60), mm = m % 60;
  return h > 0 ? `${h}시간 ${mm ? `${mm}분` : ''}`.trim() : `${mm}분`;
}
function fmtHourShort(m) {
  if (!m) return '0분';
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60), mm = m % 60;
  return mm ? `${h}.${Math.round((mm / 60) * 10)}h` : `${h}시간`;
}
function fmtClock(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
function loadTimer() {
  try { return JSON.parse(localStorage.getItem(TIMER_KEY)) || null; }
  catch { return null; }
}
function ddayMessage(d) {
  if (d == null) return '다음 시험을 차근차근 준비해요.';
  if (d <= 0) return '오늘이 시험날! 긴장 풀고 아는 것부터 풀어요. 💪';
  if (d <= 14) return '곧 시험이에요. 컨디션 관리도 공부의 일부예요.';
  if (d <= 30) return '마무리 점검 기간! 기출 위주로 약점을 메워요.';
  if (d <= 60) return '지금이 실력 올리기 딱 좋은 때예요. 꾸준히!';
  return '아직 시간은 충분해요. 기초부터 탄탄히 쌓아요.';
}
function intensity(min) {
  if (!min) return 0;
  if (min < 30) return 1;
  if (min < 90) return 2;
  if (min < 180) return 3;
  return 4;
}

export default function StudyPlannerScreen({ goTo = () => {} }) {
  const today = useMemo(() => new Date(), []);
  const todayStr = ymd(today);

  const [tab, setTab] = useState('today'); // 'today' | 'stats'
  const [days, setDays] = useState(load);
  const [selected, setSelected] = useState(todayStr);
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [taskText, setTaskText] = useState('');
  const [subj, setSubj] = useState('국어');
  const [showCal, setShowCal] = useState(false);
  const [timerMode, setTimerMode] = useState('pomo'); // 'pomo' | 'free'

  const session = useMemo(() => getNextSession(), []);
  const dday = session ? daysUntil(session.examDate) : null;
  const profile = useMemo(loadProfile, []);
  const targetAvg = profile?.scoreMode === 'target' ? profile.gedAvg : null;
  const scores = useMemo(loadScores, []);

  const day = days[selected] || { comment: '', minutes: 0, bySubject: {}, tasks: [], pomos: 0, reflect: null };

  function updateDay(patch) {
    setDays((prev) => {
      const cur = prev[selected] || { comment: '', minutes: 0, bySubject: {}, tasks: [], pomos: 0, reflect: null };
      const next = { ...prev, [selected]: { ...cur, ...patch } };
      try { localStorage.setItem(DAYS_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
      return next;
    });
  }

  function addTask(text) {
    const t = text.trim();
    if (!t) return;
    updateDay({ tasks: [...(day.tasks || []), { id: String(Date.now()), subject: subj, text: t, done: false }] });
    setTaskText('');
  }
  function toggleTask(id) {
    updateDay({ tasks: (day.tasks || []).map((t) => (t.id === id ? { ...t, done: !t.done } : t)) });
  }
  function removeTask(id) {
    updateDay({ tasks: (day.tasks || []).filter((t) => t.id !== id) });
  }
  function applyTemplate(tpl) {
    const existing = new Set((day.tasks || []).map((x) => `${x.subject}|${x.text}`));
    const add = tpl.tasks
      .filter((x) => !existing.has(`${x.subject}|${x.text}`))
      .map((x, i) => ({ id: `${Date.now()}-${i}`, subject: x.subject, text: x.text, done: false }));
    if (add.length) updateDay({ tasks: [...(day.tasks || []), ...add] });
  }
  function addMinutesTo(subject, min) {
    const by = { ...(day.bySubject || {}) };
    by[subject] = (by[subject] || 0) + min;
    updateDay({ minutes: (day.minutes || 0) + min, bySubject: by });
  }
  function resetTime() { updateDay({ minutes: 0, bySubject: {} }); }

  // ── 약점 과목 추천 (모의점수 ↔ 플래너 연결) ──
  const weakSubject = useMemo(() => {
    const entered = GED_SUBJECT_GUIDE
      .map((s) => ({ key: s.key, v: scores[s.key] }))
      .filter((x) => x.v != null && x.v !== '');
    if (!entered.length) return null;
    const under = entered.filter((x) => x.v < PASS_LINE).sort((a, b) => a.v - b.v);
    const lowest = (under[0] || entered.sort((a, b) => a.v - b.v)[0]);
    return { key: lowest.key, score: lowest.v, under: lowest.v < PASS_LINE };
  }, [scores]);

  function addWeakTask() {
    if (!weakSubject) return;
    const text = weakSubject.under
      ? '약점 보완 — 기출 오답 다시 풀기'
      : '실력 굳히기 — 기출 1회분 풀기';
    const existing = new Set((day.tasks || []).map((x) => `${x.subject}|${x.text}`));
    if (existing.has(`${weakSubject.key}|${text}`)) { setSubj(weakSubject.key); return; }
    updateDay({ tasks: [...(day.tasks || []), { id: String(Date.now()), subject: weakSubject.key, text, done: false }] });
    setSubj(weakSubject.key);
  }

  // ── 공부 타이머 (자유 / 뽀모도로) ──
  const [timer, setTimer] = useState(loadTimer);
  const [, setNowTick] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!timer?.running) return;
    const id = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [timer?.running]);

  useEffect(() => {
    try {
      if (timer) localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
      else localStorage.removeItem(TIMER_KEY);
    } catch { /* 무시 */ }
  }, [timer]);

  const elapsedSec = timer
    ? timer.accumSec + (timer.running ? Math.floor((Date.now() - timer.startTs) / 1000) : 0)
    : 0;

  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioRef.current || (audioRef.current = new Ctx());
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.12;
      o.start(); o.stop(ctx.currentTime + 0.18);
    } catch { /* 무시 */ }
  }

  // 자유 타이머
  function startFree() {
    setTimer({ mode: 'free', running: true, startTs: Date.now(), accumSec: 0, subject: subj });
  }
  function pauseTimer() {
    setTimer((t) => (t ? { ...t, running: false, accumSec: t.accumSec + Math.floor((Date.now() - t.startTs) / 1000) } : t));
  }
  function resumeTimer() {
    setTimer((t) => (t ? { ...t, running: true, startTs: Date.now() } : t));
  }
  function stopFree() {
    const mins = Math.round(elapsedSec / 60);
    const subject = timer?.subject || subj;
    setTimer(null);
    if (mins >= 1) addMinutesTo(subject, mins);
  }

  // 뽀모도로
  function startPomo() {
    setTimer({ mode: 'pomo', running: true, startTs: Date.now(), accumSec: 0, subject: subj, phase: 'focus', cycles: 0 });
  }
  function logPomoFocus(subject) {
    addMinutesTo(subject, 25);
    updateDay({ pomos: (day.pomos || 0) + 1 });
  }
  function nextPhase() {
    // 현재 phase 완료 처리
    setTimer((t) => {
      if (!t) return t;
      if (t.phase === 'focus') {
        logPomoFocus(t.subject);
        return { ...t, phase: 'break', running: true, startTs: Date.now(), accumSec: 0, cycles: (t.cycles || 0) + 1 };
      }
      return { ...t, phase: 'focus', running: true, startTs: Date.now(), accumSec: 0 };
    });
    beep();
  }
  function stopPomo() {
    // 진행 중 집중 시간은 분 단위로 부분 기록
    if (timer?.phase === 'focus') {
      const mins = Math.round(elapsedSec / 60);
      if (mins >= 1) addMinutesTo(timer.subject, mins);
    }
    setTimer(null);
  }

  // 뽀모도로 자동 단계 전환 감지
  const pomoTarget = timer?.phase === 'break' ? POMO_BREAK_SEC : POMO_FOCUS_SEC;
  useEffect(() => {
    if (timer?.mode === 'pomo' && timer.running && elapsedSec >= pomoTarget) {
      nextPhase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSec, timer?.mode, timer?.running, timer?.phase]);

  // ── 일일 회고 ──
  const reflect = day.reflect || {};
  function setReflect(patch) {
    updateDay({ reflect: { ...(day.reflect || {}), ...patch } });
  }

  // ── 못 끝낸 할 일 이어가기 ──
  const carryover = useMemo(() => {
    if (selected !== todayStr) return null;
    const past = Object.keys(days).filter((k) => k < todayStr).sort().reverse();
    for (const k of past) {
      const undone = (days[k].tasks || []).filter((t) => !t.done);
      if (undone.length) {
        const d = new Date(k + 'T00:00:00');
        return { date: k, label: `${d.getMonth() + 1}월 ${d.getDate()}일`, tasks: undone };
      }
    }
    return null;
  }, [days, selected, todayStr]);

  function carryOver() {
    if (!carryover) return;
    const existing = new Set((day.tasks || []).map((x) => `${x.subject}|${x.text}`));
    const add = carryover.tasks
      .filter((x) => !existing.has(`${x.subject}|${x.text}`))
      .map((x, i) => ({ id: `${Date.now()}-c${i}`, subject: x.subject, text: x.text, done: false }));
    if (add.length) updateDay({ tasks: [...(day.tasks || []), ...add] });
  }

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const startDow = first.getDay();
    const dim = new Date(view.y, view.m + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < startDow; i++) arr.push(null);
    for (let d = 1; d <= dim; d++) arr.push(d);
    return arr;
  }, [view]);
  const monthTotal = useMemo(() => {
    let sum = 0;
    const pre = `${view.y}-${String(view.m + 1).padStart(2, '0')}`;
    Object.entries(days).forEach(([k, v]) => { if (k.startsWith(pre)) sum += v.minutes || 0; });
    return sum;
  }, [days, view]);

  function prevMonth() { setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 })); }
  function nextMonth() { setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 })); }

  const selDate = new Date(selected + 'T00:00:00');
  const selLabel = selected === todayStr ? '오늘' : `${selDate.getMonth() + 1}월 ${selDate.getDate()}일 (${DOW[selDate.getDay()]})`;

  const grouped = SUBJECTS
    .map((s) => ({ subject: s, items: (day.tasks || []).filter((t) => (t.subject || '기타') === s) }))
    .filter((g) => g.items.length > 0);
  const taskTotal = (day.tasks || []).length;
  const taskDone = (day.tasks || []).filter((t) => t.done).length;

  // ── 주간·연속 통계 ──
  const stats = useMemo(() => {
    const studied = (dd) => !!dd && ((dd.minutes || 0) > 0 || (dd.tasks || []).some((t) => t.done));
    let streak = 0;
    const cur = new Date(today);
    if (!studied(days[todayStr])) cur.setDate(cur.getDate() - 1);
    for (;;) {
      if (studied(days[ymd(cur)])) { streak++; cur.setDate(cur.getDate() - 1); }
      else break;
    }
    const wd = (today.getDay() + 6) % 7; // 월요일 시작
    const ws = new Date(today); ws.setDate(ws.getDate() - wd);
    let weekTotal = 0; const by = {};
    for (let i = 0; i < 7; i++) {
      const dt = new Date(ws); dt.setDate(ws.getDate() + i);
      const dd = days[ymd(dt)];
      if (dd) {
        weekTotal += dd.minutes || 0;
        Object.entries(dd.bySubject || {}).forEach(([s, m]) => { by[s] = (by[s] || 0) + m; });
      }
    }
    const byArr = Object.entries(by).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]);
    return { streak, weekTotal, byArr };
  }, [days, today, todayStr]);

  // ── 누적(전체) 통계 ──
  const cum = useMemo(() => {
    let totalMin = 0, totalDays = 0, totalPomos = 0;
    const bySubj = {};
    let best = 0;
    Object.values(days).forEach((d) => {
      const m = d.minutes || 0;
      totalMin += m;
      if (m > 0 || (d.tasks || []).some((t) => t.done)) totalDays += 1;
      totalPomos += d.pomos || 0;
      if (m > best) best = m;
      Object.entries(d.bySubject || {}).forEach(([s, mm]) => { bySubj[s] = (bySubj[s] || 0) + mm; });
    });
    const subjArr = Object.entries(bySubj).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]);
    const subjMax = subjArr[0]?.[1] || 1;
    return { totalMin, totalDays, totalPomos, best, subjArr, subjMax };
  }, [days]);

  // 월별 일별 막대
  const monthBars = useMemo(() => {
    const dim = new Date(view.y, view.m + 1, 0).getDate();
    const arr = [];
    let max = 1;
    for (let d = 1; d <= dim; d++) {
      const ds = `${view.y}-${String(view.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const m = days[ds]?.minutes || 0;
      if (m > max) max = m;
      arr.push({ d, ds, m });
    }
    return { arr, max };
  }, [days, view]);
  const isCurrentMonth = view.y === today.getFullYear() && view.m === today.getMonth();

  // ── 주간 목표 ──
  const [goalMin, setGoalMin] = useState(loadGoal);
  const [editGoal, setEditGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(loadGoal()));
  function saveGoal(min) {
    const v = Math.max(30, Math.min(6000, parseInt(min, 10) || DEFAULT_GOAL));
    setGoalMin(v);
    setGoalDraft(String(v));
    setEditGoal(false);
    try { localStorage.setItem(GOAL_KEY, JSON.stringify({ goalMin: v })); } catch { /* 무시 */ }
  }
  const goalPct = Math.min(100, Math.round((stats.weekTotal / goalMin) * 100));
  const goalDone = stats.weekTotal >= goalMin;

  // ── 뱃지 ──
  const badges = useMemo(() => [
    { key: 'first', emoji: '🌱', name: '첫 기록', earned: cum.totalDays >= 1 },
    { key: 'streak3', emoji: '🔥', name: '3일 연속', earned: stats.streak >= 3 },
    { key: 'streak7', emoji: '⚡', name: '7일 연속', earned: stats.streak >= 7 },
    { key: 'pomo10', emoji: '🍅', name: '집중 10회', earned: cum.totalPomos >= 10 },
    { key: 'h10', emoji: '⏱️', name: '누적 10시간', earned: cum.totalMin >= 600 },
    { key: 'h50', emoji: '🏅', name: '누적 50시간', earned: cum.totalMin >= 3000 },
    { key: 'goal', emoji: '🎯', name: '주간목표 달성', earned: goalDone },
    { key: 'allsubj', emoji: '📚', name: '전과목 공부', earned: cum.subjArr.length >= 6 },
  ], [cum, stats.streak, goalDone]);

  // ── 전체 잔디 (최근 ~20주) ──
  const grass = useMemo(() => {
    const weeks = 20;
    const end = new Date(today);
    const endDow = (end.getDay() + 6) % 7;
    const start = new Date(end); start.setDate(end.getDate() - endDow - (weeks - 1) * 7);
    const cols = [];
    const cur = new Date(start);
    for (let w = 0; w < weeks; w++) {
      const col = [];
      for (let i = 0; i < 7; i++) {
        const ds = ymd(cur);
        col.push({ ds, lvl: intensity(days[ds]?.minutes || 0), isToday: ds === todayStr, future: cur > today });
        cur.setDate(cur.getDate() + 1);
      }
      cols.push(col);
    }
    return cols;
  }, [days, today, todayStr]);

  // ====================== 기록(통계) 탭 ======================
  const StatsTab = (
    <>
      <div className="study-dash-hero">
        <span className="study-dash-hero-lbl">지금까지 쌓은 공부</span>
        <div className="study-dash-hero-val">{fmtMin(cum.totalMin)}</div>
        <span className="study-dash-hero-sub">한 걸음씩 모인 시간이에요. 잘하고 있어요.</span>
        <div className="study-dash-hero-stats">
          <div className="study-dash-hero-stat">
            <div className="study-dash-hero-stat-num">{cum.totalDays}일</div>
            <div className="study-dash-hero-stat-lbl">공부한 날</div>
          </div>
          <div className="study-dash-hero-stat">
            <div className="study-dash-hero-stat-num">{cum.totalPomos}회</div>
            <div className="study-dash-hero-stat-lbl">집중 세션</div>
          </div>
          <div className="study-dash-hero-stat">
            <div className="study-dash-hero-stat-num">{fmtHourShort(cum.best)}</div>
            <div className="study-dash-hero-stat-lbl">하루 최고</div>
          </div>
        </div>
      </div>

      {/* 스트릭 */}
      <div className="study-streak">
        <span className={`study-flame ${stats.streak === 0 ? 'cold' : ''}`}>
          <Flame size={30} />
          {stats.streak > 0 && <span className="study-flame-num">{stats.streak}</span>}
        </span>
        <div className="study-streak-body">
          <div className="study-streak-title">
            {stats.streak > 0 ? `${stats.streak}일 연속 공부 중` : '오늘부터 다시 시작해요'}
          </div>
          <p className="study-streak-sub">
            {stats.streak >= 7 ? '대단해요! 불꽃이 활활 타오르고 있어요. 🔥'
              : stats.streak > 0 ? '잔디를 끊기지 않게 오늘도 조금만 채워봐요.'
              : '하루 10분이라도 기록하면 불꽃이 켜져요.'}
          </p>
        </div>
      </div>

      {/* 주간 목표 */}
      <div className="study-goal">
        <div className="study-goal-head">
          <span className="study-goal-title"><Target size={16} /> 이번 주 목표</span>
          {!editGoal && (
            <button className="study-goal-edit" onClick={() => { setEditGoal(true); setGoalDraft(String(goalMin)); }}>목표 수정</button>
          )}
        </div>
        <div className="study-goal-bar">
          <span className={`study-goal-fill ${goalDone ? 'done' : ''}`} style={{ width: `${goalPct}%` }} />
        </div>
        <div className="study-goal-row">
          <span className="study-goal-cur">{fmtMin(stats.weekTotal)} 공부 ({goalPct}%)</span>
          <span className="study-goal-tgt">목표 {fmtMin(goalMin)}</span>
        </div>
        {goalDone && <p className="study-streak-sub" style={{ marginTop: 8 }}>🎉 이번 주 목표를 달성했어요!</p>}
        {editGoal && (
          <>
            <div className="study-goal-chips">
              {GOAL_PRESETS.map((p) => (
                <button key={p} className={`study-goal-chip ${goalMin === p ? 'on' : ''}`} onClick={() => saveGoal(p)}>
                  주 {Math.round(p / 60)}시간
                </button>
              ))}
            </div>
            <div className="study-goal-edit-row">
              <input
                className="study-goal-input" inputMode="numeric"
                value={goalDraft} onChange={(e) => setGoalDraft(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="분 단위 (예: 600)" aria-label="주간 목표 분"
              />
              <button className="study-goal-save" onClick={() => saveGoal(goalDraft)}>저장</button>
            </div>
          </>
        )}
      </div>

      {/* 월별 일별 그래프 */}
      <div className="study-card">
        <div className="study-card-head"><BarChart3 size={16} /> 월별 공부 기록</div>
        <div className="study-monthnav">
          <button className="study-monthnav-btn" aria-label="이전 달" onClick={prevMonth}><ChevronLeft size={17} /></button>
          <span className="study-monthnav-title">{view.y}년 {view.m + 1}월 · 총 {fmtMin(monthTotal)}</span>
          <button className="study-monthnav-btn" aria-label="다음 달" onClick={nextMonth} disabled={isCurrentMonth}><ChevronRight size={17} /></button>
        </div>
        <div className="study-bars">
          {monthBars.arr.map((b) => (
            <div key={b.ds} className="study-bar-col" title={`${b.d}일 · ${fmtMin(b.m)}`}>
              <span
                className={`study-bar ${b.m === 0 ? 'zero' : ''} ${b.ds === todayStr ? 'today' : ''}`}
                style={{ height: `${Math.max(b.m === 0 ? 4 : 6, Math.round((b.m / monthBars.max) * 100))}%` }}
              />
            </div>
          ))}
        </div>
        <div className="study-bars-axis"><span>1일</span><span>{monthBars.arr.length}일</span></div>
      </div>

      {/* 과목별 누적 비중 */}
      <div className="study-card">
        <div className="study-card-head"><TrendingUp size={16} /> 과목별 누적
          <span className="study-card-aside">{fmtMin(cum.totalMin)}</span>
        </div>
        <p className="study-card-sub">어떤 과목에 시간을 많이 썼는지 한눈에 보여요.</p>
        {cum.subjArr.length === 0 ? (
          <p className="study-empty">아직 기록이 없어요. 오늘 탭에서 타이머로 시작해 볼까요?</p>
        ) : (
          <div className="study-subjbars">
            {cum.subjArr.map(([s, m]) => {
              const pct = cum.totalMin ? Math.round((m / cum.totalMin) * 100) : 0;
              return (
                <div key={s} className="study-subjbar">
                  <span className="study-subjbar-name">{s}</span>
                  <span className="study-subjbar-track">
                    <span className="study-subjbar-fill" style={{ width: `${Math.round((m / cum.subjMax) * 100)}%` }} />
                  </span>
                  <span className="study-subjbar-val"><span className="study-subjbar-pct">{pct}%</span> · {fmtMin(m)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 뱃지 */}
      <div className="study-card">
        <div className="study-card-head"><Trophy size={16} /> 뱃지
          <span className="study-card-aside">{badges.filter((b) => b.earned).length}/{badges.length}</span>
        </div>
        <div className="study-badges">
          {badges.map((b) => (
            <div key={b.key} className={`study-badge ${b.earned ? 'earned' : ''}`}>
              <span className="study-badge-ico">{b.emoji}</span>
              <span className="study-badge-name">{b.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 전체 잔디 */}
      <div className="study-card">
        <div className="study-card-head"><CalendarDays size={16} /> 공부 잔디</div>
        <p className="study-card-sub">최근 20주 동안의 공부 흔적이에요. 칸이 진할수록 오래 공부한 날.</p>
        <div className="study-grass-wrap">
          <div className="study-grass">
            {grass.map((col, ci) => col.map((c, ri) => (
              <span
                key={`${ci}-${ri}`}
                className={`study-grass-cell ${c.future ? '' : `lvl${c.lvl}`} ${c.isToday ? 'today' : ''}`}
                title={c.future ? '' : `${c.ds} · ${fmtMin(days[c.ds]?.minutes || 0)}`}
              />
            )))}
          </div>
        </div>
        <div className="study-grass-legend">
          적음 <i className="study-grass-cell" /><i className="study-grass-cell lvl1" /><i className="study-grass-cell lvl2" /><i className="study-grass-cell lvl3" /><i className="study-grass-cell lvl4" /> 많음
        </div>
      </div>
    </>
  );

  // ====================== 오늘 탭 ======================
  const isToday = selected === todayStr;
  const isPomoRun = timer?.mode === 'pomo';
  const pomoPhase = timer?.phase || 'focus';
  const ringRemain = Math.max(0, pomoTarget - elapsedSec);
  const R = 86, C = 2 * Math.PI * R;
  const ringPct = Math.min(1, elapsedSec / pomoTarget);

  const TodayTab = (
    <>
      <div className="planner-motiv">
        <span className="planner-motiv-ico"><Flame size={18} /></span>
        <span className="planner-motiv-text">{ddayMessage(dday)}</span>
      </div>

      <button className="planner-target" onClick={() => goTo('profile')}>
        <span className="planner-target-ico"><Target size={18} /></span>
        <span className="planner-target-body">
          {targetAvg != null ? (
            <>
              <span className="planner-target-label">내 목표 점수</span>
              <span className="planner-target-val">평균 {targetAvg}점</span>
            </>
          ) : (
            <>
              <span className="planner-target-label">목표 점수를 정하면</span>
              <span className="planner-target-val">갈 수 있는 대학이 보여요</span>
            </>
          )}
        </span>
        <ChevronRight size={18} />
      </button>

      {/* 약점 과목 추천 (모의점수 연동) */}
      {weakSubject && isToday && (
        <div className="study-weak">
          <span className="study-weak-ico"><AlertCircle size={20} /></span>
          <span className="study-weak-body">
            <span className="study-weak-title">
              {weakSubject.under
                ? `${weakSubject.key}이(가) 합격선 아래예요 (${weakSubject.score}점)`
                : `${weakSubject.key} 점수가 가장 낮아요 (${weakSubject.score}점)`}
            </span>
            <span className="study-weak-sub">오늘 할 일에 {weakSubject.key} 보완을 넣어드릴까요?</span>
          </span>
          <button className="study-weak-cta" onClick={addWeakTask}>+ 담기</button>
        </div>
      )}

      {/* 날짜 + 시간 카드 */}
      <div className="planner-day-card">
        <div className="planner-day-top">
          <span className="planner-day-label"><CalendarDays size={15} /> {selLabel}</span>
          {!isToday && (
            <button className="planner-day-today" onClick={() => setSelected(todayStr)}>오늘로</button>
          )}
        </div>
        <div className="planner-time-row">
          <span className="planner-time-total"><Clock size={18} /> {fmtMin(day.minutes || 0)}</span>
          {(day.minutes > 0) && <button className="planner-time-reset" onClick={resetTime}>시간 초기화</button>}
        </div>
      </div>

      {/* 과목 선택 */}
      <div className="planner-section-head"><Clock size={15} /> 공부 시간 기록</div>
      <p className="planner-hint">과목을 고른 뒤 타이머로 시간을 재요.</p>
      <div className="planner-subj-chips">
        {SUBJECTS.map((s) => (
          <button key={s} className={`planner-subj-chip ${subj === s ? 'on' : ''}`} onClick={() => setSubj(s)}>
            {s}{day.bySubject?.[s] ? ` ${fmtMin(day.bySubject[s])}` : ''}
          </button>
        ))}
      </div>

      {/* 타이머 — 오늘만 */}
      {isToday ? (
        <>
          {/* 모드 토글: 타이머 작동 중엔 잠금 */}
          {!timer && (
            <div className="study-mode">
              <button className={`study-mode-btn ${timerMode === 'pomo' ? 'on' : ''}`} onClick={() => setTimerMode('pomo')}>
                <Hourglass size={14} /> 집중(뽀모도로)
              </button>
              <button className={`study-mode-btn ${timerMode === 'free' ? 'on' : ''}`} onClick={() => setTimerMode('free')}>
                <Timer size={14} /> 자유 타이머
              </button>
            </div>
          )}

          {(timerMode === 'pomo' && (!timer || timer.mode === 'pomo')) ? (
            <div className={`study-pomo ${pomoPhase === 'break' ? 'brk' : 'focus'}`}>
              <span className="study-pomo-phase">
                {pomoPhase === 'break' ? <><Coffee size={14} /> 휴식 5분</> : <><Hourglass size={14} /> 집중 25분</>}
              </span>
              <div className="study-ring">
                <svg viewBox="0 0 196 196">
                  <circle className="study-ring-track" cx="98" cy="98" r={R} strokeWidth="12" />
                  <circle
                    className="study-ring-prog" cx="98" cy="98" r={R} strokeWidth="12"
                    strokeDasharray={C} strokeDashoffset={C * (1 - ringPct)}
                  />
                </svg>
                <div className="study-ring-center">
                  <span className="study-ring-time">{fmtClock(timer ? ringRemain : POMO_FOCUS_SEC)}</span>
                  <span className="study-ring-sub">{timer ? (timer.running ? '진행 중' : '일시정지') : `${subj} 준비`}</span>
                </div>
              </div>
              {timer && <div className="study-pomo-subjrow"><b>{timer.subject}</b> 집중 중</div>}
              <div className="study-pomo-btns">
                {!timer && <button className="study-pomo-btn primary" onClick={startPomo}><Play size={17} /> 집중 시작</button>}
                {timer?.running && <button className="study-pomo-btn ghost" onClick={pauseTimer}><Pause size={16} /> 일시정지</button>}
                {timer && !timer.running && <button className="study-pomo-btn primary" onClick={resumeTimer}><Play size={16} /> 이어서</button>}
                {timer && <button className="study-pomo-btn ghost" onClick={stopPomo}><Square size={14} /> 종료·기록</button>}
              </div>
              <div className="study-pomo-cycles">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={`study-pomo-dot ${(timer?.cycles || day.pomos || 0) % 4 > i || (timer?.cycles || 0) >= 4 ? 'on' : ''}`} />
                ))}
                <span className="study-pomo-cyclelbl">오늘 집중 {day.pomos || 0}회</span>
              </div>
            </div>
          ) : (
            <div className={`planner-timer ${timer?.running ? 'run' : ''}`}>
              <div className="planner-timer-info">
                <span className="planner-timer-subj">{timer ? `${timer.subject} 공부 중` : `${subj} 준비`}</span>
                <span className="planner-timer-clock">{fmtClock(elapsedSec)}</span>
              </div>
              <div className="planner-timer-btns">
                {!timer && <button className="planner-timer-btn start" onClick={startFree}><Play size={17} /> 시작</button>}
                {timer?.running && <button className="planner-timer-btn pause" onClick={pauseTimer}><Pause size={17} /> 일시정지</button>}
                {timer && !timer.running && <button className="planner-timer-btn start" onClick={resumeTimer}><Play size={17} /> 이어서</button>}
                {timer && <button className="planner-timer-btn stop" onClick={stopFree}><Square size={15} /> 정지·기록</button>}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="planner-hint">지난 날짜는 아래 버튼으로 시간을 더할 수 있어요.</p>
      )}

      {/* 빠른 추가(보조) */}
      <div className="planner-time-add">
        {QUICK_MIN.map((m) => (
          <button key={m} className="planner-add-btn" onClick={() => addMinutesTo(subj, m)}>
            +{m >= 60 ? '1시간' : `${m}분`}
          </button>
        ))}
      </div>

      {/* 할 일 */}
      <div className="planner-section-head" style={{ marginTop: 22 }}>
        <CheckCircle2 size={15} /> {selLabel} 할 일
        {taskTotal > 0 && <span className="planner-task-count">{taskDone}/{taskTotal} 완료</span>}
      </div>

      {carryover && (
        <button className="planner-carry" onClick={carryOver}>
          <RotateCcw size={15} />
          <span>{carryover.label}에 못 끝낸 할 일 {carryover.tasks.length}개 이어가기</span>
        </button>
      )}

      <div className="planner-task-input">
        <span className="planner-task-subj">{subj}</span>
        <input
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addTask(taskText); }}
          placeholder="할 일 추가 (예: 기출 3개 풀기)"
          aria-label="할 일 추가"
        />
        <button className="planner-task-add" aria-label="추가" onClick={() => addTask(taskText)}>
          <Plus size={18} />
        </button>
      </div>

      {/* 추천 템플릿 */}
      <div className="planner-tpl">
        <div className="planner-tpl-head"><Wand2 size={15} /> 어떻게 짤지 모르겠다면 — 추천 플래너</div>
        <div className="planner-tpl-list">
          {TEMPLATES.map((t) => (
            <button key={t.key} className="planner-tpl-card" onClick={() => applyTemplate(t)}>
              <span className="planner-tpl-title">{t.title}</span>
              <span className="planner-tpl-sub">{t.sub}</span>
              <span className="planner-tpl-apply">+ 담기</span>
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="planner-empty">아직 할 일이 없어요. 위에서 직접 적거나 추천 플래너를 담아보세요.</p>
      ) : (
        <div className="planner-groups">
          {grouped.map((g) => (
            <div key={g.subject} className="planner-group">
              <span className="planner-group-name">{g.subject}</span>
              <div className="planner-group-tasks">
                {g.items.map((t) => (
                  <div key={t.id} className={`planner-task ${t.done ? 'on' : ''}`}>
                    <button className="planner-task-check" onClick={() => toggleTask(t.id)}>
                      {t.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                      <span>{t.text}</span>
                    </button>
                    <button className="planner-task-del" aria-label="삭제" onClick={() => removeTask(t.id)}>
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 일일 회고 */}
      <div className="study-reflect">
        <div className="study-reflect-head"><Pencil size={16} /> {isToday ? '오늘' : '이날'} 회고</div>
        <p className="study-reflect-q">오늘 기분은 어땠나요?</p>
        <div className="study-faces">
          {MOODS.map((m) => (
            <button
              key={m.key}
              className={`study-face ${reflect.mood === m.key ? 'on' : ''}`}
              onClick={() => setReflect({ mood: reflect.mood === m.key ? null : m.key })}
            >
              <span>{m.emoji}</span>
              <span className="study-face-lbl">{m.label}</span>
            </button>
          ))}
        </div>
        <p className="study-reflect-q">집중은 잘 됐나요?</p>
        <div className="study-focusrow">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`study-focus-pip ${reflect.focus >= n ? 'on' : ''}`}
              onClick={() => setReflect({ focus: reflect.focus === n ? 0 : n })}
            >
              {n}
            </button>
          ))}
        </div>
        <textarea
          className="study-reflect-input" rows={2}
          value={reflect.note || ''}
          onChange={(e) => setReflect({ note: e.target.value })}
          placeholder="오늘 한 줄 회고 (예: 수학 함수 단원을 끝냈다!)"
          aria-label="오늘 회고"
        />
        {(reflect.mood || reflect.focus || reflect.note) && (
          <span className="study-reflect-saved"><CheckCircle2 size={13} /> 저장됐어요</span>
        )}
      </div>

      {/* 학습 달력(숨김) */}
      <button className="planner-cal-toggle" onClick={() => setShowCal((v) => !v)}>
        <CalendarDays size={16} /> 학습 달력 {showCal ? '닫기' : '보기'}
        <ChevronRight size={15} className={`planner-cal-toggle-chev ${showCal ? 'open' : ''}`} />
      </button>
      {showCal && (
        <div className="planner-cal">
          <div className="planner-cal-head">
            <button className="planner-cal-nav" aria-label="이전 달" onClick={prevMonth}><ChevronLeft size={18} /></button>
            <span className="planner-cal-title">{view.y}년 {view.m + 1}월 · 총 {fmtMin(monthTotal)}</span>
            <button className="planner-cal-nav" aria-label="다음 달" onClick={nextMonth}><ChevronRight size={18} /></button>
          </div>
          <div className="planner-cal-grid">
            {DOW.map((d) => <span key={d} className="planner-cal-dow">{d}</span>)}
            {cells.map((d, i) => {
              if (d == null) return <span key={`e${i}`} className="planner-cal-cell empty" />;
              const ds = `${view.y}-${String(view.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const mins = days[ds]?.minutes || 0;
              return (
                <button
                  key={ds}
                  className={`planner-cal-cell lvl${intensity(mins)} ${ds === todayStr ? 'today' : ''} ${ds === selected ? 'sel' : ''}`}
                  onClick={() => setSelected(ds)}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <p className="planner-cal-legend">진한 칸일수록 그날 공부 시간이 많아요. 날짜를 누르면 그날 플래너로 이동해요.</p>
        </div>
      )}
    </>
  );

  return (
    <div className="screen">
      <header className="topbar">
        <span className="page-title">공부 플래너</span>
        {session && (
          <span className="planner-dday">
            <CalendarClock size={14} /> {dday > 0 ? `시험 D-${dday}` : dday === 0 ? '시험 D-DAY' : '시험 준비'}
          </span>
        )}
      </header>

      {/* 서브탭 */}
      <div className="study-subtab">
        <button className={`study-subtab-btn ${tab === 'today' ? 'on' : ''}`} onClick={() => setTab('today')}>오늘</button>
        <button className={`study-subtab-btn ${tab === 'stats' ? 'on' : ''}`} onClick={() => setTab('stats')}>기록·통계</button>
      </div>

      {tab === 'today' ? TodayTab : StatsTab}

      <p className="note" style={{ marginTop: 18 }}>
        플래너·시간·회고·통계는 모두 이 기기에만 저장돼요. 매일 조금씩 채워봐요.
      </p>
    </div>
  );
}
