import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, ChevronRight, ChevronLeft, Target, Flame, CalendarDays,
  Plus, X, Wand2, Clock, CheckCircle2, Circle, Pencil,
  Play, Pause, Square, RotateCcw,
} from 'lucide-react';
import { GED_SUBJECT_GUIDE, getNextSession, daysUntil } from '../data/gedGuide.js';
import { loadProfile } from '../lib/persona.js';
import '../styles.studyplanner.css';

const DAYS_KEY = 'rebridge_planner_days';
const TIMER_KEY = 'rebridge_planner_timer';
// day = { comment, minutes, bySubject:{}, tasks:[{id, subject, text, done}] }
// timer = { running, startTs, accumSec, subject }

const QUICK_MIN = [10, 30, 60];
const SUBJECTS = [...GED_SUBJECT_GUIDE.map((s) => s.key), '기타'];
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

// 추천 플래너 템플릿 — 어떻게 공부할지 모르는 학생이 그대로 따라할 수 있게
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

function load() {
  try { return JSON.parse(localStorage.getItem(DAYS_KEY)) || {}; }
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

  const [days, setDays] = useState(load);
  const [selected, setSelected] = useState(todayStr);
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [taskText, setTaskText] = useState('');
  const [subj, setSubj] = useState('국어');
  const [showCal, setShowCal] = useState(false);

  const session = useMemo(() => getNextSession(), []);
  const dday = session ? daysUntil(session.examDate) : null;
  const profile = useMemo(loadProfile, []);
  const targetAvg = profile?.scoreMode === 'target' ? profile.gedAvg : null;

  const day = days[selected] || { comment: '', minutes: 0, bySubject: {}, tasks: [] };

  function updateDay(patch) {
    setDays((prev) => {
      const cur = prev[selected] || { comment: '', minutes: 0, bySubject: {}, tasks: [] };
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

  // ── 공부 타이머 (백그라운드·새로고침에도 이어짐) ──
  const [timer, setTimer] = useState(loadTimer);
  const [, setNowTick] = useState(0);

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

  function startTimer() {
    setTimer({ running: true, startTs: Date.now(), accumSec: 0, subject: subj });
  }
  function pauseTimer() {
    setTimer((t) => (t ? { ...t, running: false, accumSec: t.accumSec + Math.floor((Date.now() - t.startTs) / 1000) } : t));
  }
  function resumeTimer() {
    setTimer((t) => (t ? { ...t, running: true, startTs: Date.now() } : t));
  }
  function stopTimer() {
    const mins = Math.round(elapsedSec / 60);
    const subject = timer?.subject || subj;
    setTimer(null);
    if (mins >= 1) addMinutesTo(subject, mins);
  }

  // ── 못 끝낸 할 일 이어가기 (오늘 기준, 가장 최근 미완료일) ──
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

  // 과목별로 묶은 할 일
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

      {/* 날짜 + 오늘의 다짐 */}
      <div className="planner-day-card">
        <div className="planner-day-top">
          <span className="planner-day-label"><CalendarDays size={15} /> {selLabel}</span>
          {selected !== todayStr && (
            <button className="planner-day-today" onClick={() => setSelected(todayStr)}>오늘로</button>
          )}
        </div>
        <div className="planner-comment">
          <Pencil size={14} />
          <input
            value={day.comment || ''}
            onChange={(e) => updateDay({ comment: e.target.value })}
            placeholder="오늘의 다짐 한마디 (예: 끝까지 집중!)"
            aria-label="오늘의 다짐"
          />
        </div>
        <div className="planner-time-row">
          <span className="planner-time-total"><Clock size={18} /> {fmtMin(day.minutes || 0)}</span>
          {(day.minutes > 0) && <button className="planner-time-reset" onClick={resetTime}>시간 초기화</button>}
        </div>
      </div>

      {/* ───────── 이번 주 학습 요약 ───────── */}
      <div className="planner-week">
        <div className="planner-week-stats">
          <div className="planner-week-stat">
            <span className="planner-week-num"><Flame size={18} /> {stats.streak}일</span>
            <span className="planner-week-lbl">연속 공부</span>
          </div>
          <div className="planner-week-divider" />
          <div className="planner-week-stat">
            <span className="planner-week-num">{fmtMin(stats.weekTotal)}</span>
            <span className="planner-week-lbl">이번 주 공부</span>
          </div>
        </div>
        {stats.byArr.length > 0 ? (
          <div className="planner-week-bars">
            {stats.byArr.map(([s, m]) => (
              <div key={s} className="planner-week-bar">
                <span className="planner-week-bar-name">{s}</span>
                <span className="planner-week-bar-track">
                  <span className="planner-week-bar-fill" style={{ width: `${Math.round((m / stats.byArr[0][1]) * 100)}%` }} />
                </span>
                <span className="planner-week-bar-val">{fmtMin(m)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="planner-week-empty">이번 주 공부 기록이 아직 없어요. 타이머로 시작해 볼까요?</p>
        )}
      </div>

      {/* ───────── 공부 시간 기록 ───────── */}
      <div className="planner-section-head"><Clock size={15} /> 공부 시간 기록</div>
      <p className="planner-hint">과목을 고른 뒤 타이머로 공부 시간을 재요.</p>
      <div className="planner-subj-chips">
        {SUBJECTS.map((s) => (
          <button key={s} className={`planner-subj-chip ${subj === s ? 'on' : ''}`} onClick={() => setSubj(s)}>
            {s}{day.bySubject?.[s] ? ` ${fmtMin(day.bySubject[s])}` : ''}
          </button>
        ))}
      </div>

      {/* 타이머 — 오늘만 */}
      {selected === todayStr ? (
        <div className={`planner-timer ${timer?.running ? 'run' : ''}`}>
          <div className="planner-timer-info">
            <span className="planner-timer-subj">
              {timer ? `${timer.subject} 공부 중` : `${subj} 준비`}
            </span>
            <span className="planner-timer-clock">{fmtClock(elapsedSec)}</span>
          </div>
          <div className="planner-timer-btns">
            {!timer && (
              <button className="planner-timer-btn start" onClick={startTimer}><Play size={17} /> 시작</button>
            )}
            {timer?.running && (
              <button className="planner-timer-btn pause" onClick={pauseTimer}><Pause size={17} /> 일시정지</button>
            )}
            {timer && !timer.running && (
              <button className="planner-timer-btn start" onClick={resumeTimer}><Play size={17} /> 이어서</button>
            )}
            {timer && (
              <button className="planner-timer-btn stop" onClick={stopTimer}><Square size={15} /> 정지·기록</button>
            )}
          </div>
        </div>
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

      {/* ───────── 할 일 ───────── */}
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

      {/* 추천 플래너 템플릿 */}
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

      {/* 달력 — 숨김, 버튼으로 펼침 */}
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

      <p className="note" style={{ marginTop: 18 }}>
        플래너·시간·달력은 모두 이 기기에만 저장돼요. 매일 조금씩 채워봐요.
      </p>
    </div>
  );
}
