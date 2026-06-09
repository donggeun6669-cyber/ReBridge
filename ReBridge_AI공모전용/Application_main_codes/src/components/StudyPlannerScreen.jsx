import { useMemo, useState } from 'react';
import {
  CalendarClock, ChevronRight, Circle, Loader, CheckCircle2, Sparkles,
  Target, Flame, BookOpen, Square, CheckSquare,
} from 'lucide-react';
import { GED_SUBJECT_GUIDE, getNextSession, daysUntil } from '../data/gedGuide.js';
import { loadProfile } from '../lib/persona.js';
import '../styles.studyplanner.css';

const PROGRESS_KEY = 'rebridge_study_progress';
const TASKS_KEY = 'rebridge_study_tasks';

// 과목 상태 사이클: 시작 전 → 공부 중 → 완료 → 시작 전
const ORDER = ['todo', 'doing', 'done'];
const STATE = {
  todo:  { label: '시작 전', icon: Circle,       cls: 'st-todo' },
  doing: { label: '공부 중', icon: Loader,       cls: 'st-doing' },
  done:  { label: '완료',    icon: CheckCircle2, cls: 'st-done' },
};

// 오늘의 공부 체크리스트(습관)
const DAILY_TASKS = [
  { id: 'study30', label: '오늘 30분 이상 공부하기' },
  { id: 'weak', label: '약한 과목 1개 집중하기' },
  { id: 'past', label: '기출 문제 풀어보기' },
  { id: 'review', label: '틀린 문제 다시 보기' },
];

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; }
  catch { return {}; }
}

function ddayMessage(d) {
  if (d == null) return '다음 시험을 차근차근 준비해요.';
  if (d <= 0) return '오늘이 시험날! 긴장 풀고 아는 것부터 풀어요. 💪';
  if (d <= 14) return '곧 시험이에요. 컨디션 관리도 공부의 일부예요.';
  if (d <= 30) return '마무리 점검 기간! 기출 위주로 약점을 메워요.';
  if (d <= 60) return '지금이 실력 올리기 딱 좋은 때예요. 꾸준히!';
  return '아직 시간은 충분해요. 기초부터 탄탄히 쌓아요.';
}

export default function StudyPlannerScreen({ goTo = () => {} }) {
  const [progress, setProgress] = useState(() => load(PROGRESS_KEY));
  const [tasks, setTasks] = useState(() => load(TASKS_KEY));

  const session = useMemo(() => getNextSession(), []);
  const dday = session ? daysUntil(session.examDate) : null;
  const profile = useMemo(loadProfile, []);
  const targetAvg = profile?.scoreMode === 'target' ? profile.gedAvg : null;

  function cycle(key) {
    setProgress((prev) => {
      const cur = prev[key] || 'todo';
      const next = ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length];
      const updated = { ...prev, [key]: next };
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(updated)); } catch { /* 무시 */ }
      return updated;
    });
  }

  function toggleTask(id) {
    setTasks((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(TASKS_KEY, JSON.stringify(updated)); } catch { /* 무시 */ }
      return updated;
    });
  }

  const total = GED_SUBJECT_GUIDE.length;
  const doneCount = GED_SUBJECT_GUIDE.filter((s) => progress[s.key] === 'done').length;
  const doingCount = GED_SUBJECT_GUIDE.filter((s) => progress[s.key] === 'doing').length;
  const pct = Math.round((doneCount / total) * 100);
  const nextSubject =
    GED_SUBJECT_GUIDE.find((s) => (progress[s.key] || 'todo') === 'todo') ||
    GED_SUBJECT_GUIDE.find((s) => progress[s.key] === 'doing') || null;

  const taskDone = DAILY_TASKS.filter((t) => tasks[t.id]).length;

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

      {/* 동기부여 메시지 */}
      <div className="planner-motiv">
        <span className="planner-motiv-ico"><Flame size={18} /></span>
        <span className="planner-motiv-text">{ddayMessage(dday)}</span>
      </div>

      {/* 목표 점수 카드 */}
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

      {/* 진행률 */}
      <div className="planner-progress">
        <div className="planner-progress-top">
          <span className="planner-progress-label">과목 진행률</span>
          <span className="planner-progress-num">
            완료 {doneCount} · 공부 중 {doingCount} · 전체 {total}
          </span>
        </div>
        <div className="planner-bar">
          <span className="planner-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="planner-progress-pct">{pct}%</span>
      </div>

      {/* 다음 추천 */}
      {nextSubject ? (
        <button className="planner-next" onClick={() => goTo('ged-guide')}>
          <span className="planner-next-ico"><Sparkles size={18} /></span>
          <span className="planner-next-body">
            <span className="planner-next-kicker">다음엔 이거 어때요?</span>
            <span className="planner-next-title">{nextSubject.key}부터 시작하기</span>
            <span className="planner-next-sub">{nextSubject.summary}</span>
          </span>
          <ChevronRight size={18} />
        </button>
      ) : (
        <div className="planner-done-all">
          <CheckCircle2 size={20} /> 모든 과목을 끝냈어요! 기출로 마무리해요 👏
        </div>
      )}

      {/* 오늘의 할 일 체크리스트 */}
      <p className="planner-list-label">
        오늘의 할 일 <span>({taskDone}/{DAILY_TASKS.length} 완료)</span>
      </p>
      <div className="planner-tasks">
        {DAILY_TASKS.map((t) => {
          const done = !!tasks[t.id];
          return (
            <button
              key={t.id}
              className={`planner-task ${done ? 'on' : ''}`}
              onClick={() => toggleTask(t.id)}
            >
              {done ? <CheckSquare size={18} /> : <Square size={18} />}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 과목별 진행 */}
      <p className="planner-list-label">
        과목별 진행 <span>(눌러서 시작 전 → 공부 중 → 완료)</span>
      </p>
      <div className="planner-subjects">
        {GED_SUBJECT_GUIDE.map((s) => {
          const state = progress[s.key] || 'todo';
          const meta = STATE[state];
          const Icon = meta.icon;
          return (
            <button key={s.key} className={`planner-subj ${meta.cls}`} onClick={() => cycle(s.key)}>
              <span className="planner-subj-name">{s.key}</span>
              <span className="planner-subj-state">
                <Icon size={15} /> {meta.label}
              </span>
            </button>
          );
        })}
      </div>

      <button className="planner-guide-link" onClick={() => goTo('ged-guide')}>
        <BookOpen size={16} /> 과목별 공부법·기출 보러 가기 <ChevronRight size={15} />
      </button>

      <p className="note" style={{ marginTop: 18 }}>
        체크와 진행 상태는 이 기기에만 저장돼요. 매일 조금씩 채워봐요.
      </p>
    </div>
  );
}
