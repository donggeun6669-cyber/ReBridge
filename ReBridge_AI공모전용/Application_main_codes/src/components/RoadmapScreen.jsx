import { useMemo } from 'react';
import {
  ArrowLeft, ChevronRight, ClipboardList, FileText, Scale,
  CalendarDays, Target, MessageCircle, CheckCircle2, Compass,
} from 'lucide-react';
import { buildRoadmap } from '../lib/roadmap.js';

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

  return (
    <div className="screen">
      <header className="topbar center">
        <span className="page-title">내 로드맵</span>
      </header>

      <div className="intro-line">지금 너는 여기 있어요</div>
      <div className="intro-sub">
        검정고시부터 대학 등록까지, 다음에 뭘 언제 해야 하는지 같이 챙길게요.
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

      {/* 비입시 경로 분기 — 대학 말고 다른 길도 있다는 걸 보여줘요 */}
      <button className="rm-branch" onClick={() => goTo('explore')}>
        <span className="rm-branch-ico">
          <Compass size={20} />
        </span>
        <span className="rm-branch-body">
          <span className="rm-branch-title">대학 말고 다른 길도 있어요</span>
          <span className="rm-branch-desc">
            취업·직업훈련·자격증… 검정고시 뒤에 갈 수 있는 길은 하나가 아니에요.
          </span>
        </span>
        <ChevronRight size={18} />
      </button>

      <p className="note">
        일정은 예년 패턴 기준이에요. 정확한 날짜는 시도교육청·대학 입학처 공고로 꼭 확인해요.
      </p>
    </div>
  );
}
