import {
  User, Pencil, Bookmark, BookOpen, ChevronRight,
  MapPin, GraduationCap, ClipboardCheck, Heart,
  RefreshCw, Target, Briefcase, HelpCircle, RotateCcw, Route,
} from 'lucide-react';

// 테스트/초기화용 — 저장된 모든 정보 지우고 첫 화면(스플래시→온보딩)부터 다시
function resetEverything() {
  try {
    localStorage.removeItem('rebridge_profile');
    localStorage.removeItem('rebridge_study_progress');
  } catch { /* 무시 */ }
  window.location.reload();
}
import { getPersona, loadProfile } from '../lib/persona';
import '../styles.mypage.css';

// 검정고시 점수/조건을 칩 문구로 변환
function toChips(p) {
  if (!p) return [];
  const chips = [];
  if (p.gedAvg != null) {
    chips.push(`${p.scoreMode === 'target' ? '목표 평균' : '검정고시 평균'} ${p.gedAvg}점`);
    if (p.gedGrade != null) chips.push(`추정 ${p.gedGrade}등급`);
  } else if (p.gedScore) {
    chips.push(p.gedScore === '아직 몰라요' ? '검정고시 점수 미정' : `검정고시 ${p.gedScore}`);
  }
  if (p.csatPlan) {
    const map = {
      '볼 거예요': '수능 볼 예정',
      '안 볼 거예요': '수능 안 봄',
      '고민 중이에요': '수능 고민 중',
    };
    chips.push(map[p.csatPlan] || p.csatPlan);
  }
  if (p.region && p.region !== '아직 몰라요') chips.push(p.region);
  if (p.field && p.field !== '아직 몰라요') chips.push(p.field);
  return chips;
}

// 취업 프로필(jobProfile)을 칩 문구로 변환
function toJobChips(jp) {
  if (!jp) return [];
  const chips = [];
  if (jp.interest && jp.interest !== '아직 몰라요') chips.push(jp.interest);
  if (jp.startWith && jp.startWith !== '고민 중이에요') chips.push(jp.startWith);
  if (jp.hasCert) chips.push(jp.hasCert === '있어요' ? '자격증 있음' : '자격증 준비 전');
  if (jp.workType && jp.workType !== '상관없어요') chips.push(jp.workType);
  return chips;
}

const STAGE_LABEL = {
  studying: '지금 공부 중',
  tested: '검정고시 응시 완료',
};
const GOAL_LABEL = {
  university: '대학 진학 목표',
  job: '취업·직업훈련 목표',
  undecided: '아직 고민 중',
};

function GoalIcon({ goal, size = 13 }) {
  if (goal === 'university') return <Target size={size} />;
  if (goal === 'job') return <Briefcase size={size} />;
  return <HelpCircle size={size} />;
}

export default function MyPageScreen({ goTo = () => {}, goBack = () => {} }) {
  const profile = loadProfile();
  const persona = getPersona(profile);
  const chips = toChips(profile);

  const stage = persona?.stage;
  const goal = persona?.goal;
  const isJob = goal === 'job';
  const jp = profile?.jobProfile || null;
  const jobChips = toJobChips(jp);

  // 대학 관련 메뉴는 university/undecided 목표일 때만 노출
  const showUnivMenus = !persona || goal === 'university' || goal === 'undecided';

  return (
    <div className="screen">
      <header className="topbar">
        <span className="page-title">프로필</span>
      </header>

      {/* 내 상황 카드 — persona가 설정된 경우만 표시 */}
      {persona && (
        <div className="mp-persona-card">
          <div className="mp-persona-top">
            <span className="mp-persona-label">내 상황</span>
            <button className="mp-persona-reset" onClick={() => goTo('onboarding')}>
              <RefreshCw size={12} />
              상황 다시 고르기
            </button>
          </div>
          <div className="mp-persona-chips">
            <span className="mp-persona-chip mp-persona-chip--stage">
              {stage === 'studying'
                ? <GraduationCap size={13} />
                : <ClipboardCheck size={13} />}
              {STAGE_LABEL[stage] || stage}
            </span>
            <span className="mp-persona-chip mp-persona-chip--goal">
              <GoalIcon goal={goal} />
              {GOAL_LABEL[goal] || goal}
            </span>
          </div>
        </div>
      )}

      {/* 프로필 카드 */}
      <div className="mp-card" style={{ marginTop: persona ? 18 : 6 }}>
        <div className="mp-card-header">
          <span className="mp-avatar">
            <User size={30} color="#fff" />
          </span>
          <div className="mp-card-header-text">
            <span className="mp-card-name">{isJob ? '나의 취업 프로필' : '나의 입시 프로필'}</span>
            <span className="mp-card-sub">
              {isJob
                ? (jp ? '답변에 맞춰 길을 안내하고 있어요' : '몇 가지 질문에 답하면 맞춤 안내해드려요')
                : stage === 'tested'
                ? '검정고시 맞춤 입시 분석 중'
                : stage === 'studying'
                ? (profile?.gedAvg != null ? '목표 점수로 갈 대학 분석 중' : '목표 점수를 정해볼까요?')
                : chips.length > 0
                ? '검정고시 맞춤 입시 분석 중'
                : '정보를 입력하면 대학을 찾아드려요'}
            </span>
          </div>
          {/* 점수/목표/답변 수정 버튼 */}
          {isJob ? (
            jp && (
              <button className="mp-edit-btn" onClick={() => goTo('job-questions')}>
                <Pencil size={14} />
                답변 수정
              </button>
            )
          ) : (stage === 'tested'
            || (stage === 'studying' && profile?.gedAvg != null)
            || (!persona && chips.length > 0)) && (
            <button className="mp-edit-btn" onClick={() => goTo('profile')}>
              <Pencil size={14} />
              {stage === 'studying' ? '목표 수정' : stage === 'tested' ? '점수 수정' : '수정'}
            </button>
          )}
        </div>

        {/* 취업 — 답변 칩 + 직업 사전 CTA */}
        {isJob && jobChips.length > 0 && (
          <div className="mp-chips">
            {jobChips.map((c) => (
              <span className="pchip" key={c}>{c}</span>
            ))}
          </div>
        )}
        {isJob && !jp && (
          <button className="mp-setup-cta" onClick={() => goTo('job-questions')}>
            <Briefcase size={16} />
            내 취업 유형 알아보기
            <ChevronRight size={15} />
          </button>
        )}

        {/* tested — 기존 점수 칩 표시 */}
        {!isJob && stage === 'tested' && chips.length > 0 && (
          <div className="mp-chips">
            {chips.map((c) => (
              <span className="pchip" key={c}>{c}</span>
            ))}
          </div>
        )}

        {/* studying — 목표 점수 미설정: 목표 점수 정하기 CTA */}
        {!isJob && stage === 'studying' && profile?.gedAvg == null && (
          <button className="mp-setup-cta" onClick={() => goTo('profile')}>
            <Target size={16} />
            목표 점수 정하고 대학 찾기
            <ChevronRight size={15} />
          </button>
        )}

        {/* studying — 목표 점수 설정됨: 칩 + 목표 대학 찾기 */}
        {!isJob && stage === 'studying' && profile?.gedAvg != null && (
          <>
            <div className="mp-chips">
              {chips.map((c) => (
                <span className="pchip" key={c}>{c}</span>
              ))}
            </div>
            <button className="mp-setup-cta" onClick={() => goTo('univ-explore')}>
              <Target size={16} />
              목표로 갈 수 있는 대학 보기
              <ChevronRight size={15} />
            </button>
          </>
        )}

        {/* persona 없음 + 프로필 없음: 처음 입력 CTA */}
        {!persona && chips.length === 0 && (
          <button className="mp-setup-cta" onClick={() => goTo('profile')}>
            <GraduationCap size={16} />
            내 정보 입력하고 맞춤 대학 찾기
            <ChevronRight size={15} />
          </button>
        )}

        {/* persona 없음 + 기존 칩 있음: 칩 표시 */}
        {!persona && chips.length > 0 && (
          <div className="mp-chips">
            {chips.map((c) => (
              <span className="pchip" key={c}>{c}</span>
            ))}
          </div>
        )}
      </div>

      {/* 메뉴 그룹 */}
      <p className="mp-section-label">{isJob ? '취업 도구' : '학습 도구'}</p>
      <div className="mp-menu-group">
        {/* 취업 목표 — 직업 사전 / 준비 로드맵 */}
        {isJob && (
          <>
            <button className="mp-menu-row" onClick={() => goTo('job-info')}>
              <span className="mp-menu-ico ico-brand"><Briefcase size={18} /></span>
              <span className="mp-menu-text">
                <span className="mp-menu-title">직업 사전</span>
                <span className="mp-menu-sub">지금 닿을 수 있는 직업·진로검사</span>
              </span>
              <ChevronRight size={16} className="mp-menu-arrow" />
            </button>
            <div className="mp-row-divider" />
            <button className="mp-menu-row" onClick={() => goTo('job-roadmap')}>
              <span className="mp-menu-ico ico-green"><Route size={18} /></span>
              <span className="mp-menu-text">
                <span className="mp-menu-title">취업 준비 로드맵</span>
                <span className="mp-menu-sub">관심 파악 → 역량 → 일자리</span>
              </span>
              <ChevronRight size={16} className="mp-menu-arrow" />
            </button>
            <div className="mp-row-divider" />
          </>
        )}

        {showUnivMenus && (
          <>
            <button className="mp-menu-row" onClick={() => goTo('saved')}>
              <span className="mp-menu-ico ico-brand"><Bookmark size={18} /></span>
              <span className="mp-menu-text">
                <span className="mp-menu-title">관심 대학</span>
                <span className="mp-menu-sub">저장한 대학교 목록</span>
              </span>
              <ChevronRight size={16} className="mp-menu-arrow" />
            </button>
            <div className="mp-row-divider" />
          </>
        )}

        {!isJob && (
          <button className="mp-menu-row" onClick={() => goTo('checklist')}>
            <span className="mp-menu-ico ico-coral"><ClipboardCheck size={18} /></span>
            <span className="mp-menu-text">
              <span className="mp-menu-title">서류 체크리스트</span>
              <span className="mp-menu-sub">제출 서류 빠짐없이 확인</span>
            </span>
            <ChevronRight size={16} className="mp-menu-arrow" />
          </button>
        )}

        {showUnivMenus && (
          <>
            <div className="mp-row-divider" />
            <button className="mp-menu-row" onClick={() => goTo('map')}>
              <span className="mp-menu-ico ico-green"><MapPin size={18} /></span>
              <span className="mp-menu-text">
                <span className="mp-menu-title">대학 지도</span>
                <span className="mp-menu-sub">내 주변 검정고시 지원 대학</span>
              </span>
              <ChevronRight size={16} className="mp-menu-arrow" />
            </button>
          </>
        )}

        {!isJob && <div className="mp-row-divider" />}
        <button className="mp-menu-row" onClick={() => goTo('dreamdrive')}>
          <span className="mp-menu-ico ico-coral"><Heart size={18} /></span>
          <span className="mp-menu-text">
            <span className="mp-menu-title">꿈드림센터 찾기</span>
            <span className="mp-menu-sub">검정고시·자립 무료 지원 기관</span>
          </span>
          <ChevronRight size={16} className="mp-menu-arrow" />
        </button>

        {!isJob && (
          <>
            <div className="mp-row-divider" />
            <button className="mp-menu-row" onClick={() => goTo('guide', { topic: 'types' })}>
              <span className="mp-menu-ico ico-gold"><BookOpen size={18} /></span>
              <span className="mp-menu-text">
                <span className="mp-menu-title">입시 용어 가이드</span>
                <span className="mp-menu-sub">전형 종류부터 서류까지 한 번에</span>
              </span>
              <ChevronRight size={16} className="mp-menu-arrow" />
            </button>
          </>
        )}
      </div>

      <p className="note" style={{ marginTop: 28 }}>
        입력한 정보는 이 기기에만 저장돼요.
        <br />
        로그인 없이 편하게 써요.
      </p>

      {/* 처음부터 다시 시작 (로그아웃처럼) — 저장된 정보 모두 삭제 */}
      <button className="mp-reset-btn" onClick={resetEverything}>
        <RotateCcw size={15} />
        처음부터 다시 시작
      </button>
      <p className="mp-reset-hint">입력한 모든 정보를 지우고 첫 화면으로 돌아가요.</p>

      <p className="build-stamp">build {__BUILD_TIME__}</p>
    </div>
  );
}
