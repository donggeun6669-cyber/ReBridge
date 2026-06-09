import { useMemo, useState } from 'react';
import { CalendarClock, ChevronRight, Circle, Loader, CheckCircle2, Sparkles } from 'lucide-react';
import { GED_SUBJECT_GUIDE, getNextSession, daysUntil } from '../data/gedGuide.js';
import '../styles.studyplanner.css';

const PROGRESS_KEY = 'rebridge_study_progress';
// 상태 사이클: 시작 전 → 공부 중 → 완료 → 시작 전
const ORDER = ['todo', 'doing', 'done'];
const STATE = {
  todo:  { label: '시작 전', icon: Circle,        cls: 'st-todo' },
  doing: { label: '공부 중', icon: Loader,        cls: 'st-doing' },
  done:  { label: '완료',    icon: CheckCircle2,  cls: 'st-done' },
};

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
  catch { return {}; }
}

export default function StudyPlannerScreen({ goTo = () => {} }) {
  const [progress, setProgress] = useState(loadProgress);
  const session = useMemo(() => getNextSession(), []);
  const dday = session ? daysUntil(session.examDate) : null;

  function cycle(key) {
    setProgress((prev) => {
      const cur = prev[key] || 'todo';
      const next = ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length];
      const updated = { ...prev, [key]: next };
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(updated)); } catch { /* 무시 */ }
      return updated;
    });
  }

  const total = GED_SUBJECT_GUIDE.length;
  const doneCount = GED_SUBJECT_GUIDE.filter((s) => progress[s.key] === 'done').length;
  const pct = Math.round((doneCount / total) * 100);
  // 다음 추천: 아직 시작 안 한 첫 과목, 없으면 공부 중인 첫 과목
  const nextSubject =
    GED_SUBJECT_GUIDE.find((s) => (progress[s.key] || 'todo') === 'todo') ||
    GED_SUBJECT_GUIDE.find((s) => progress[s.key] === 'doing') ||
    null;

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

      {/* 진행률 */}
      <div className="planner-progress">
        <div className="planner-progress-top">
          <span className="planner-progress-label">전체 진행률</span>
          <span className="planner-progress-num">{doneCount}/{total}과목 완료</span>
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

      {/* 과목 체크 */}
      <p className="planner-list-label">과목별 진행 상태 <span>(눌러서 바꿔요)</span></p>
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

      <p className="note" style={{ marginTop: 20 }}>
        체크는 이 기기에만 저장돼요. 과목을 누르면 시작 전 → 공부 중 → 완료로 바뀌어요.
        <br />
        과목별 공부법은 <b>학습 홈</b>에서 볼 수 있어요.
      </p>
    </div>
  );
}
