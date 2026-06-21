import {
  Compass, GraduationCap, Search, FileText, Sparkles, ChevronRight, Target, Check,
} from 'lucide-react';
import { JOB_ROADMAP } from '../data/jobData.js';
import { loadProfile, loadJobTarget } from '../lib/persona.js';
import '../styles.studyroadmap.css';
import '../styles.job.css';

const ICONS = { Compass, GraduationCap, Search, FileText, Sparkles };

export default function JobRoadmapScreen({ goTo = () => {} }) {
  const jp = loadProfile()?.jobProfile || null;
  const target = loadJobTarget();

  // 진행 단계: 1) 나 알아보기(질문) 2) 직업 고르기(목표) 3) 준비
  const stepDone = { profile: !!jp, target: !!target };

  // 목표 직업이 연결 프로그램을 가지면, '기술·자격 쌓기' 단계 CTA를 그 프로그램으로 바꾼다.
  const steps = JOB_ROADMAP.map((s) => {
    if (s.id === 'skill' && target?.programId) {
      return {
        ...s,
        cta: {
          label: target.programLabel || `${target.name} 준비 알아보기`,
          screen: 'job-detail',
          params: { id: target.programId },
        },
      };
    }
    return s;
  });

  return (
    <div className="screen">
      <header className="topbar">
        <span className="page-title">취업 준비</span>
      </header>

      <div className="srm-intro">
        <span className="srm-intro-kicker">3단계 · 준비 로드맵</span>
        <h2 className="srm-intro-title">
          {target
            ? <>{target.name},<br />여기까지 같이 가요</>
            : <>관심 파악부터 첫 출근까지,<br />한 단계씩 같이 가요</>}
        </h2>
      </div>

      {/* 진행 단계 안내 — 지금 어디까지 왔는지 한눈에 */}
      <div className="job-steps">
        <button className={`job-step ${stepDone.profile ? 'done' : 'now'}`} onClick={() => goTo('job-questions')}>
          <span className="job-step-num">{stepDone.profile ? <Check size={13} /> : 1}</span>
          <span className="job-step-label">나 알아보기</span>
        </button>
        <span className="job-step-line" />
        <button
          className={`job-step ${stepDone.target ? 'done' : stepDone.profile ? 'now' : ''}`}
          onClick={() => goTo('job-info')}
        >
          <span className="job-step-num">{stepDone.target ? <Check size={13} /> : 2}</span>
          <span className="job-step-label">직업 고르기</span>
        </button>
        <span className="job-step-line" />
        <span className={`job-step ${stepDone.target ? 'now' : ''}`}>
          <span className="job-step-num">3</span>
          <span className="job-step-label">준비하기</span>
        </span>
      </div>

      {target ? (
        <button className="srm-cta" onClick={() => goTo('job-info')} style={{ margin: '0 0 14px' }}>
          <Target size={15} /> 내 목표 직업 · {target.name} (바꾸기)
        </button>
      ) : (
        <button className="ji-connect" onClick={() => goTo('job-info')} style={{ marginBottom: 14 }}>
          <span className="ji-connect-text">
            <span className="ji-connect-label">먼저 목표 직업을 정해볼까요?</span>
            <span className="ji-connect-sub">직업을 고르면 단계마다 할 일이 또렷해져요</span>
          </span>
          <ChevronRight size={17} />
        </button>
      )}

      <div className="srm-timeline">
        {steps.map((s, i) => {
          const Icon = ICONS[s.icon] || Compass;
          const last = i === steps.length - 1;
          const status = i === 0 ? 'current' : 'upcoming';
          return (
            <div key={s.id} className={`srm-step srm-${status}`}>
              <div className="srm-rail">
                <span className="srm-node"><Icon size={16} /></span>
                {!last && <span className="srm-line" />}
              </div>
              <div className="srm-card">
                <div className="srm-card-head">
                  <span className="srm-card-title">{s.title}</span>
                  {i === 0 && <span className="srm-badge cur">지금</span>}
                </div>
                <p className="srm-todo">{s.todo}</p>
                {s.cta && (
                  <button className="srm-cta" onClick={() => goTo(s.cta.screen, s.cta.params || {})}>
                    {s.cta.label} <ChevronRight size={15} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="note" style={{ marginTop: 8 }}>
        각 단계의 자세한 정보는 공식 기관으로 연결돼요. 막히면 청소년상담 1388에 도움을 청해요.
      </p>
    </div>
  );
}
