import { useMemo, useState } from 'react';
import {
  CalendarClock, ChevronRight, ChevronLeft, Sparkles, Target, Flame,
  Plus, X, Wand2, Clock, CheckSquare, Square, Circle, Loader, CheckCircle2,
} from 'lucide-react';
import { GED_SUBJECT_GUIDE, getNextSession, daysUntil } from '../data/gedGuide.js';
import { loadProfile } from '../lib/persona.js';
import '../styles.studyplanner.css';

const PROGRESS_KEY = 'rebridge_study_progress';
const DAYS_KEY = 'rebridge_planner_days'; // { 'YYYY-MM-DD': { tasks:[{id,text,done}], minutes, bySubject:{} } }

const ORDER = ['todo', 'doing', 'done'];
const STATE = {
  todo:  { label: '시작 전', icon: Circle,       cls: 'st-todo' },
  doing: { label: '공부 중', icon: Loader,       cls: 'st-doing' },
  done:  { label: '완료',    icon: CheckCircle2, cls: 'st-done' },
};

const QUICK_MIN = [10, 30, 60];
const SUBJECTS = [...GED_SUBJECT_GUIDE.map((s) => s.key), '기타'];
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; }
  catch { return {}; }
}
function save(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* 무시 */ }
}
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtMin(m) {
  if (!m) return '0분';
  const h = Math.floor(m / 60), mm = m % 60;
  return h > 0 ? `${h}시간 ${mm ? `${mm}분` : ''}`.trim() : `${mm}분`;
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

  const [days, setDays] = useState(() => load(DAYS_KEY));
  const [progress, setProgress] = useState(() => load(PROGRESS_KEY));
  const [selected, setSelected] = useState(todayStr);
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [taskText, setTaskText] = useState('');
  const [subj, setSubj] = useState('기타');

  const session = useMemo(() => getNextSession(), []);
  const dday = session ? daysUntil(session.examDate) : null;
  const profile = useMemo(loadProfile, []);
  const targetAvg = profile?.scoreMode === 'target' ? profile.gedAvg : null;

  const day = days[selected] || { tasks: [], minutes: 0, bySubject: {} };

  function updateDay(patch) {
    setDays((prev) => {
      const cur = prev[selected] || { tasks: [], minutes: 0, bySubject: {} };
      const next = { ...prev, [selected]: { ...cur, ...patch } };
      save(DAYS_KEY, next);
      return next;
    });
  }

  function addTask(text) {
    const t = text.trim();
    if (!t) return;
    updateDay({ tasks: [...(day.tasks || []), { id: String(Date.now()), text: t, done: false }] });
    setTaskText('');
  }
  function toggleTask(id) {
    updateDay({ tasks: (day.tasks || []).map((t) => (t.id === id ? { ...t, done: !t.done } : t)) });
  }
  function removeTask(id) {
    updateDay({ tasks: (day.tasks || []).filter((t) => t.id !== id) });
  }
  function recommend() {
    const existing = new Set((day.tasks || []).map((t) => t.text));
    const recs = [];
    GED_SUBJECT_GUIDE.forEach((s) => {
      if ((progress[s.key] || 'todo') !== 'done') recs.push(`${s.key} 기출 1회분 풀기`);
    });
    recs.push('틀린 문제 오답 정리');
    const fresh = recs.filter((t) => !existing.has(t)).slice(0, 4)
      .map((t, i) => ({ id: `${Date.now()}-${i}`, text: t, done: false }));
    if (fresh.length) updateDay({ tasks: [...(day.tasks || []), ...fresh] });
  }
  function addMinutes(min) {
    const by = { ...(day.bySubject || {}) };
    by[subj] = (by[subj] || 0) + min;
    updateDay({ minutes: (day.minutes || 0) + min, bySubject: by });
  }
  function resetTime() {
    updateDay({ minutes: 0, bySubject: {} });
  }

  function cycleSubject(key) {
    setProgress((prev) => {
      const cur = prev[key] || 'todo';
      const next = ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length];
      const updated = { ...prev, [key]: next };
      save(PROGRESS_KEY, updated);
      return updated;
    });
  }

  // 달력 셀
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
    Object.entries(days).forEach(([k, v]) => {
      if (k.startsWith(`${view.y}-${String(view.m + 1).padStart(2, '0')}`)) sum += v.minutes || 0;
    });
    return sum;
  }, [days, view]);

  const total = GED_SUBJECT_GUIDE.length;
  const doneCount = GED_SUBJECT_GUIDE.filter((s) => progress[s.key] === 'done').length;
  const pct = Math.round((doneCount / total) * 100);

  function prevMonth() { setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 })); }
  function nextMonth() { setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 })); }

  const selDate = new Date(selected + 'T00:00:00');
  const selLabel = selected === todayStr
    ? '오늘'
    : `${selDate.getMonth() + 1}월 ${selDate.getDate()}일 (${DOW[selDate.getDay()]})`;

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

      {/* ── 공부 시간 기록 ── */}
      <div className="planner-time">
        <div className="planner-time-head">
          <span className="planner-time-when">{selLabel} 공부 시간</span>
          {(day.minutes > 0) && (
            <button className="planner-time-reset" onClick={resetTime}>초기화</button>
          )}
        </div>
        <div className="planner-time-total"><Clock size={20} /> {fmtMin(day.minutes || 0)}</div>
        <div className="planner-subj-chips">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              className={`planner-subj-chip ${subj === s ? 'on' : ''}`}
              onClick={() => setSubj(s)}
            >
              {s}{day.bySubject?.[s] ? ` ${fmtMin(day.bySubject[s])}` : ''}
            </button>
          ))}
        </div>
        <div className="planner-time-add">
          {QUICK_MIN.map((m) => (
            <button key={m} className="planner-add-btn" onClick={() => addMinutes(m)}>
              +{m >= 60 ? '1시간' : `${m}분`}
            </button>
          ))}
        </div>
      </div>

      {/* ── 데일리 플래너 ── */}
      <div className="planner-daily-head">
        <span className="planner-list-label2">{selLabel} 할 일</span>
        <button className="planner-rec-btn" onClick={recommend}>
          <Wand2 size={14} /> 추천 받기
        </button>
      </div>
      <div className="planner-task-input">
        <input
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addTask(taskText); }}
          placeholder="할 일을 직접 적어요 (예: 수학 함수 20문제)"
          aria-label="할 일 추가"
        />
        <button className="planner-task-add" aria-label="추가" onClick={() => addTask(taskText)}>
          <Plus size={18} />
        </button>
      </div>
      <div className="planner-tasks">
        {(day.tasks || []).length === 0 ? (
          <p className="planner-empty">아직 할 일이 없어요. 직접 적거나 추천을 받아보세요.</p>
        ) : (
          day.tasks.map((t) => (
            <div key={t.id} className={`planner-task ${t.done ? 'on' : ''}`}>
              <button className="planner-task-check" onClick={() => toggleTask(t.id)}>
                {t.done ? <CheckSquare size={18} /> : <Square size={18} />}
                <span>{t.text}</span>
              </button>
              <button className="planner-task-del" aria-label="삭제" onClick={() => removeTask(t.id)}>
                <X size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* ── 학습 달력 ── */}
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
            const isToday = ds === todayStr;
            const isSel = ds === selected;
            return (
              <button
                key={ds}
                className={`planner-cal-cell lvl${intensity(mins)} ${isToday ? 'today' : ''} ${isSel ? 'sel' : ''}`}
                onClick={() => setSelected(ds)}
              >
                {d}
              </button>
            );
          })}
        </div>
        <p className="planner-cal-legend">진한 칸일수록 그날 공부 시간이 많아요. 날짜를 누르면 그날 플래너로 이동해요.</p>
      </div>

      {/* ── 전체 과목 진행 ── */}
      <div className="planner-progress">
        <div className="planner-progress-top">
          <span className="planner-progress-label">과목 진행률</span>
          <span className="planner-progress-num">{doneCount}/{total}과목 완료</span>
        </div>
        <div className="planner-bar"><span className="planner-bar-fill" style={{ width: `${pct}%` }} /></div>
        <span className="planner-progress-pct">{pct}%</span>
      </div>
      <div className="planner-subjects">
        {GED_SUBJECT_GUIDE.map((s) => {
          const state = progress[s.key] || 'todo';
          const meta = STATE[state];
          const Icon = meta.icon;
          return (
            <button key={s.key} className={`planner-subj ${meta.cls}`} onClick={() => cycleSubject(s.key)}>
              <span className="planner-subj-name">{s.key}</span>
              <span className="planner-subj-state"><Icon size={15} /> {meta.label}</span>
            </button>
          );
        })}
      </div>

      <p className="note" style={{ marginTop: 18 }}>
        플래너·시간·달력은 모두 이 기기에만 저장돼요. 매일 조금씩 채워봐요.
      </p>
    </div>
  );
}
