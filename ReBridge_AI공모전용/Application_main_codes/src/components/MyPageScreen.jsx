import { useMemo } from 'react';
import {
  User, Pencil, Bookmark, BookOpen, ChevronRight,
  MapPin, GraduationCap, ClipboardCheck, Heart,
  RefreshCw, Target, Briefcase, HelpCircle, RotateCcw, Route,
  Award, FileText, ShieldCheck, ScrollText,
} from 'lucide-react';
import { getPersona, loadProfile, getActiveTrack } from '../lib/persona';
import '../styles.mypage.css';

// 테스트/초기화용 — 저장된 모든 정보 지우고 첫 화면(스플래시→온보딩)부터 다시.
// 프로필·플래너·북마크·모의점수 등 rebridge_* 키 전부 + 지역 선택 + 트랙 선택 세션까지 지운다.
// (커뮤니티 로그인/게시글은 별개 계정 데이터라 유지)
function resetEverything() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith('rebridge_')) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem('spt-region');
    sessionStorage.removeItem('rb_track_picked');
  } catch { /* 무시 */ }
  window.location.reload();
}

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
// 현재 보고 있는 트랙(상황) 라벨
const TRACK_LABEL = {
  study: '검정고시 준비 중',
  univ: '대학 진학 준비 중',
  job: '일·진로 찾는 중',
};

function GoalIcon({ goal, size = 13 }) {
  if (goal === 'university') return <Target size={size} />;
  if (goal === 'job') return <Briefcase size={size} />;
  return <HelpCircle size={size} />;
}

// 작은 메뉴 행 헬퍼
function MenuRow({ ico, icoClass, title, sub, onClick }) {
  const Icon = ico;
  return (
    <button className="mp-menu-row" onClick={onClick}>
      <span className={`mp-menu-ico ${icoClass}`}><Icon size={18} /></span>
      <span className="mp-menu-text">
        <span className="mp-menu-title">{title}</span>
        <span className="mp-menu-sub">{sub}</span>
      </span>
      <ChevronRight size={16} className="mp-menu-arrow" />
    </button>
  );
}

export default function MyPageScreen({ goTo = () => {}, goBack = () => {} }) {
  // localStorage 읽기+파싱은 렌더마다 반복할 필요 없음 — 마운트 시 1회.
  const profile = useMemo(loadProfile, []);
  const persona = getPersona(profile);
  const chips = toChips(profile);

  // 사용자 유형 = 활성 트랙. (홈에서 고른 길) — 없으면 persona.goal로 보조 추론.
  let track = useMemo(getActiveTrack, []);
  if (!track && persona) {
    if (persona.goal === 'job') track = 'job';
    else if (persona.stage === 'studying' && persona.goal !== 'university') track = 'study';
    else track = 'univ';
  }

  const isJob = track === 'job';
  const isStudy = track === 'study';
  const isUniv = track === 'univ';
  // 대학 전용 메뉴(관심 대학/대학 지도/입시 용어 등)는 취업 트랙에서 숨긴다.
  const showUnivMenus = !isJob; // univ/study/미정에서 노출

  const stage = persona?.stage;
  const goal = persona?.goal;
  const jp = profile?.jobProfile || null;
  const jobChips = toJobChips(jp);

  const toolsLabel = isJob ? '취업 도구' : isStudy ? '검정고시 도구' : '학습·입시 도구';

  return (
    <div className="screen">
      <header className="topbar">
        <span className="page-title">프로필</span>
      </header>

      {/* 프로필 카드 */}
      <div className="mp-card" style={{ marginTop: 6 }}>
        <div className="mp-card-header">
          <span className="mp-avatar">
            <User size={30} color="#fff" />
          </span>
          <div className="mp-card-header-text">
            <span className="mp-card-name">
              {isJob ? '나의 취업 프로필' : isStudy ? '나의 검정고시 프로필' : '나의 입시 프로필'}
            </span>
            <span className="mp-card-sub">
              {isJob
                ? (jp ? '답변에 맞춰 길을 안내하고 있어요' : '몇 가지 질문에 답하면 맞춤 안내해드려요')
                : isStudy
                ? (profile?.gedAvg != null ? '목표 점수로 검정고시를 준비 중' : '시험 일정·공부 계획을 함께 챙겨요')
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
            {isStudy ? '목표 점수 정하기' : '목표 점수 정하고 대학 찾기'}
            <ChevronRight size={15} />
          </button>
        )}

        {/* studying — 목표 점수 설정됨: 칩 + (입시면) 목표 대학 찾기 */}
        {!isJob && stage === 'studying' && profile?.gedAvg != null && (
          <>
            <div className="mp-chips">
              {chips.map((c) => (
                <span className="pchip" key={c}>{c}</span>
              ))}
            </div>
            {!isStudy && (
              <button className="mp-setup-cta" onClick={() => goTo('univ-explore')}>
                <Target size={16} />
                목표로 갈 수 있는 대학 보기
                <ChevronRight size={15} />
              </button>
            )}
          </>
        )}

        {/* persona 없음 + 프로필 없음: 처음 입력 CTA (취업은 위 '취업 유형 알아보기'가 대신함) */}
        {!persona && !isJob && chips.length === 0 && (
          <button className="mp-setup-cta" onClick={() => goTo('profile')}>
            <GraduationCap size={16} />
            {isStudy ? '내 정보 입력하고 공부 계획 세우기' : '내 정보 입력하고 맞춤 대학 찾기'}
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

      {/* 내 상황 카드 — persona가 설정된 경우만 표시 */}
      {persona && (
        <div className="mp-persona-card" style={{ marginTop: 18 }}>
          <div className="mp-persona-top">
            <span className="mp-persona-label">내 상황</span>
            <button className="mp-persona-reset" onClick={() => goTo('onboarding')}>
              <RefreshCw size={12} />
              상황 다시 고르기
            </button>
          </div>
          <div className="mp-persona-chips">
            {track && (
              <span className="mp-persona-chip mp-persona-chip--stage">
                {isJob ? <Briefcase size={13} /> : isStudy ? <GraduationCap size={13} /> : <Target size={13} />}
                {TRACK_LABEL[track]}
              </span>
            )}
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

      {/* 메뉴 그룹 */}
      <p className="mp-section-label">{toolsLabel}</p>
      <div className="mp-menu-group">
        {/* ── 취업 트랙 전용 ── */}
        {isJob && (
          <>
            <MenuRow ico={Briefcase} icoClass="ico-brand" title="직업 사전"
              sub="지금 닿을 수 있는 직업·진로검사" onClick={() => goTo('job-info')} />
            <div className="mp-row-divider" />
            <MenuRow ico={Route} icoClass="ico-green" title="취업 준비 로드맵"
              sub="관심 파악 → 역량 → 일자리" onClick={() => goTo('job-roadmap')} />
            <div className="mp-row-divider" />
            <MenuRow ico={FileText} icoClass="ico-coral" title="서류 체크리스트"
              sub="이력서·자소서·자격증 챙기기" onClick={() => goTo('checklist')} />
            <div className="mp-row-divider" />
            <MenuRow ico={Award} icoClass="ico-gold" title="자격증·직업훈련 알아보기"
              sub="국비지원·자격증으로 시작하기" onClick={() => goTo('job-explore')} />
          </>
        )}

        {/* ── 검정고시(학습) 트랙 전용 ── */}
        {isStudy && (
          <>
            <MenuRow ico={BookOpen} icoClass="ico-brand" title="검정고시 도우미"
              sub="일정·과목별 공부 가이드" onClick={() => goTo('ged-guide')} />
            <div className="mp-row-divider" />
            <MenuRow ico={Route} icoClass="ico-green" title="공부 로드맵"
              sub="시험까지 무엇을 할지" onClick={() => goTo('study-roadmap')} />
            <div className="mp-row-divider" />
            <MenuRow ico={ClipboardCheck} icoClass="ico-coral" title="준비물 체크리스트"
              sub="접수·시험 당일·합격 후 챙기기" onClick={() => goTo('checklist')} />
          </>
        )}

        {/* ── 입시(대학) 트랙 + 미정 ── */}
        {isUniv || (!isJob && !isStudy) ? (
          <>
            <MenuRow ico={Bookmark} icoClass="ico-brand" title="관심 대학"
              sub="저장한 대학교 목록" onClick={() => goTo('saved')} />
            <div className="mp-row-divider" />
            <MenuRow ico={ClipboardCheck} icoClass="ico-coral" title="서류 체크리스트"
              sub="제출 서류 빠짐없이 확인" onClick={() => goTo('checklist')} />
            <div className="mp-row-divider" />
            <MenuRow ico={MapPin} icoClass="ico-green" title="대학 지도"
              sub="내 주변 검정고시 지원 대학" onClick={() => goTo('map')} />
          </>
        ) : null}
      </div>

      {/* 공통: 용어 가이드 + 지원 기관 */}
      <p className="mp-section-label">알아두면 좋아요</p>
      <div className="mp-menu-group">
        {showUnivMenus ? (
          <MenuRow ico={BookOpen} icoClass="ico-gold" title="입시 용어 풀이"
            sub="수시·정시·비교내신 쉬운 말로" onClick={() => goTo('glossary', { track: isStudy ? 'study' : 'univ' })} />
        ) : (
          <MenuRow ico={BookOpen} icoClass="ico-gold" title="진로·취업 용어 풀이"
            sub="국비지원·자격증·근로계약 쉬운 말로" onClick={() => goTo('glossary', { track: 'job' })} />
        )}
        <div className="mp-row-divider" />
        <MenuRow ico={Heart} icoClass="ico-coral" title="꿈드림센터 찾기"
          sub="검정고시·자립 무료 지원 기관" onClick={() => goTo('dreamdrive')} />
      </div>

      {/* 약관·정책 — 청소년 대상 서비스 필수 고지 */}
      <p className="mp-section-label">약관·정책</p>
      <div className="mp-menu-group">
        <MenuRow ico={ShieldCheck} icoClass="ico-brand" title="개인정보처리방침"
          sub="어떤 정보를 다루는지" onClick={() => goTo('privacy')} />
        <div className="mp-row-divider" />
        <MenuRow ico={ScrollText} icoClass="ico-gold" title="이용약관"
          sub="서비스 이용 약속과 한계" onClick={() => goTo('terms')} />
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
