import { useState, useMemo, useCallback } from 'react';
import {
  Compass, GraduationCap, Search, FileText, Award, Sparkles, BadgeCheck,
  ChevronRight, Check, Plus, Target,
} from 'lucide-react';
import {
  loadSavedJobs, loadPrimaryJob, setPrimaryJob, loadJobProgress, toggleJobStage,
} from '../lib/persona.js';
import { stagesForJob, pathFor } from '../data/careerMentor.js';
import '../styles.studyroadmap.css';
import '../styles.job.css';

// cta.kind → 단계 아이콘
const STAGE_ICON = {
  self: Compass, train: GraduationCap, make: Sparkles, portfolio: FileText,
  practice: BadgeCheck, cert: Award, find: Search, apply: FileText,
  interview: Target, first: Award,
};

export default function JobRoadmapScreen({ goTo = () => {} }) {
  const saved = useMemo(loadSavedJobs, []);
  const [primary, setPrimary] = useState(() => loadPrimaryJob());

  // 아직 저장한 직업이 없으면 — 탐색으로 유도
  if (!saved.length || !primary) {
    return (
      <div className="screen">
        <header className="topbar"><span className="page-title">취업 준비</span></header>
        <div className="srm-intro">
          <span className="srm-intro-kicker">멘토 로드맵</span>
          <h2 className="srm-intro-title">먼저 하고 싶은 일을<br />골라볼까요?</h2>
        </div>
        <p className="job-reason" style={{ marginBottom: 16 }}>
          관심 직업을 고르면, <b>그 직업을 갖기까지 단계별로</b> 무엇을 할지 멘토처럼 알려드려요.
        </p>
        <button className="home-cta-card job-cta" onClick={() => goTo('job-info')}>
          <div className="home-cta-inner">
            <span className="home-cta-label">탐색 · 심리검사</span>
            <span className="home-cta-title">하고 싶은 일 고르기</span>
          </div>
          <span className="home-cta-arrow"><Plus size={24} /></span>
        </button>
        <button className="ji-connect" onClick={() => goTo('job-psych')} style={{ marginTop: 14 }}>
          <span className="ji-connect-text">
            <span className="ji-connect-label">뭐가 맞을지 모르겠어요</span>
            <span className="ji-connect-sub">무료 진로심리검사로 나부터 알아봐요</span>
          </span>
          <Compass size={17} />
        </button>
      </div>
    );
  }

  return <MentorBody saved={saved} primary={primary} setPrimary={setPrimary} goTo={goTo} />;
}

function MentorBody({ saved, primary, setPrimary, goTo }) {
  const stages = useMemo(() => stagesForJob(primary.name, primary.field), [primary]);
  const path = useMemo(() => pathFor(primary.name, primary.field), [primary]);
  const [progress, setProgress] = useState(() => loadJobProgress(primary.name, primary.field));

  const switchJob = useCallback((job) => {
    setPrimaryJob(job);
    setPrimary(job);
    setProgress(loadJobProgress(job.name, job.field));
  }, [setPrimary]);

  const onToggleStage = useCallback((stageKey) => {
    const next = toggleJobStage(primary.name, primary.field, stageKey);
    setProgress({ ...next });
  }, [primary]);

  const doneCount = stages.filter((s) => progress[s.key]).length;
  const pct = Math.round((doneCount / stages.length) * 100);

  const runCta = useCallback((kind) => {
    if (kind === 'self') return goTo('job-psych');
    if (kind === 'training') return goTo('job-training');
    if (kind === 'certs') return goTo('job-detail', { id: 'technician-cert' });
    if (kind === 'find') return goTo('job-explore');
    if (kind === 'apply') return goTo('job-apply');
  }, [goTo]);

  return (
    <div className="screen">
      <header className="topbar"><span className="page-title">취업 준비</span></header>

      <div className="srm-intro">
        <span className="srm-intro-kicker">멘토 로드맵</span>
        <h2 className="srm-intro-title">{primary.name},<br />첫 출근까지 같이 가요</h2>
      </div>

      {/* 저장한 직업 전환 (1~3개) */}
      <div className="jm-tabs">
        {saved.map((j) => (
          <button
            key={`${j.name}::${j.field}`}
            className={`jm-tab ${j.name === primary.name && j.field === primary.field ? 'on' : ''}`}
            onClick={() => switchJob(j)}
          >
            {j.name}
          </button>
        ))}
        <button className="jm-tab jm-tab--add" onClick={() => goTo('job-info')} aria-label="직업 더 고르기">
          <Plus size={15} />
        </button>
      </div>

      {/* 진행률 */}
      <div className="study-rm-progress">
        <div className="study-rm-progress-head">
          <span className="study-rm-progress-title">{primary.name} 준비</span>
          <span className="study-rm-progress-pct">{pct}%</span>
        </div>
        <div className="study-rm-progress-bar">
          <span className="study-rm-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="study-rm-progress-sub">
          {path.oneLiner || '단계를 끝내면 체크해요. 나만의 속도로 가면 돼요.'}
        </p>
        <button className="study-rm-link" onClick={() => goTo('job-training')}>
          <GraduationCap size={14} /> {primary.name} 교육 길 자세히 보기
        </button>
      </div>

      {/* 단계 타임라인 — 체크 가능 */}
      <div className="srm-timeline">
        {stages.map((s, i) => {
          const Icon = STAGE_ICON[s.key] || Compass;
          const last = i === stages.length - 1;
          const done = !!progress[s.key];
          // '지금' = 완료 안 된 첫 단계
          const firstUndone = stages.findIndex((x) => !progress[x.key]);
          const isNow = i === firstUndone;
          const status = done ? 'done' : isNow ? 'current' : 'upcoming';
          return (
            <div key={s.key} className={`srm-step srm-${status}`}>
              <div className="srm-rail">
                <button
                  className={`srm-node jm-node ${done ? 'done' : ''}`}
                  onClick={() => onToggleStage(s.key)}
                  aria-label={done ? '완료 취소' : '완료 표시'}
                >
                  {done ? <Check size={16} /> : <Icon size={16} />}
                </button>
                {!last && <span className="srm-line" />}
              </div>
              <div className="srm-card">
                <div className="srm-card-head">
                  <span className="srm-card-title">{s.title}</span>
                  {isNow && <span className="srm-badge cur">지금</span>}
                  {done && <span className="srm-badge done">완료</span>}
                </div>
                <p className="srm-todo">{s.todo}</p>
                {s.cta && (
                  <button className="srm-cta" onClick={() => runCta(s.cta.kind)}>
                    {s.cta.label} <ChevronRight size={15} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="note" style={{ marginTop: 8 }}>
        막히면 혼자 끙끙대지 말고 1388에 전화해요. 24시간 무료예요.
      </p>
    </div>
  );
}
