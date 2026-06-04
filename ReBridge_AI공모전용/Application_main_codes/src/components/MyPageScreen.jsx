import { ArrowLeft, User, Pencil, Bookmark, BookOpen, ChevronRight, MapPin, GraduationCap, ClipboardCheck } from 'lucide-react';

const STORAGE_KEY = 'rebridge_profile';

// 저장된 답변을 친근한 칩 문구로 변환
function toChips(p) {
  if (!p) return [];
  const chips = [];
  if (p.gedAvg != null) {
    chips.push(`검정고시 평균 ${p.gedAvg}점`);
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

export default function MyPageScreen({ goTo = () => {}, goBack = () => {} }) {
  let profile = null;
  try {
    profile = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    profile = null;
  }
  const hasProfile = profile && Object.keys(profile).length > 0;
  const chips = toChips(profile);

  return (
    <div className="screen">
      <header className="topbar">
        <span className="page-title">프로필</span>
      </header>

      {/* 새 프로필 카드 — 그라데이션 헤더 + 정보 요약 */}
      <div className="mp-card">
        <div className="mp-card-header">
          <span className="mp-avatar">
            <User size={30} color="#fff" />
          </span>
          <div className="mp-card-header-text">
            <span className="mp-card-name">
              {hasProfile ? '나의 입시 프로필' : '프로필 없음'}
            </span>
            <span className="mp-card-sub">
              {hasProfile ? '검정고시 맞춤 입시 분석 중' : '정보를 입력하면 대학을 찾아드려요'}
            </span>
          </div>
          <button className="mp-edit-btn" onClick={() => goTo('profile')}>
            <Pencil size={14} />
            {hasProfile ? '수정' : '입력'}
          </button>
        </div>

        {hasProfile && chips.length > 0 && (
          <div className="mp-chips">
            {chips.map((c) => (
              <span className="pchip" key={c}>{c}</span>
            ))}
          </div>
        )}

        {!hasProfile && (
          <button className="mp-setup-cta" onClick={() => goTo('profile')}>
            <GraduationCap size={16} />
            내 정보 입력하고 맞춤 대학 찾기
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      {/* 메뉴 그룹 */}
      <p className="mp-section-label">학습 도구</p>
      <div className="mp-menu-group">
        <button className="mp-menu-row" onClick={() => goTo('saved')}>
          <span className="mp-menu-ico ico-brand"><Bookmark size={18} /></span>
          <span className="mp-menu-text">
            <span className="mp-menu-title">관심 대학</span>
            <span className="mp-menu-sub">저장한 대학교 목록</span>
          </span>
          <ChevronRight size={16} className="mp-menu-arrow" />
        </button>
        <div className="mp-row-divider" />
        <button className="mp-menu-row" onClick={() => goTo('checklist')}>
          <span className="mp-menu-ico ico-coral"><ClipboardCheck size={18} /></span>
          <span className="mp-menu-text">
            <span className="mp-menu-title">서류 체크리스트</span>
            <span className="mp-menu-sub">제출 서류 빠짐없이 확인</span>
          </span>
          <ChevronRight size={16} className="mp-menu-arrow" />
        </button>
        <div className="mp-row-divider" />
        <button className="mp-menu-row" onClick={() => goTo('map')}>
          <span className="mp-menu-ico ico-green"><MapPin size={18} /></span>
          <span className="mp-menu-text">
            <span className="mp-menu-title">대학 지도</span>
            <span className="mp-menu-sub">내 주변 검정고시 지원 대학</span>
          </span>
          <ChevronRight size={16} className="mp-menu-arrow" />
        </button>
        <div className="mp-row-divider" />
        <button className="mp-menu-row" onClick={() => goTo('guide', { topic: 'types' })}>
          <span className="mp-menu-ico ico-gold"><BookOpen size={18} /></span>
          <span className="mp-menu-text">
            <span className="mp-menu-title">입시 용어 가이드</span>
            <span className="mp-menu-sub">전형 종류부터 서류까지 한 번에</span>
          </span>
          <ChevronRight size={16} className="mp-menu-arrow" />
        </button>
      </div>

      <p className="note" style={{ marginTop: 28 }}>
        입력한 정보는 이 기기에만 저장돼요.
        <br />
        로그인 없이 편하게 써요.
      </p>

      <p className="build-stamp">build {__BUILD_TIME__}</p>
    </div>
  );
}
