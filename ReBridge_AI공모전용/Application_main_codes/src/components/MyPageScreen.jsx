import { ArrowLeft, User, Pencil, Bookmark, BookOpen, ChevronRight } from 'lucide-react';

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
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">프로필</span>
      </header>

      <div className="profile-card">
        <span className="profile-avatar">
          <User size={32} />
        </span>

        {hasProfile ? (
          <>
            <span className="profile-name">나의 입시 프로필</span>
            <span className="profile-summary">입력한 정보를 바탕으로 맞춤 대학을 찾아드려요.</span>
            <div className="profile-chips">
              {chips.map((c) => (
                <span className="pchip" key={c}>
                  {c}
                </span>
              ))}
            </div>
            <button className="btn-outline" onClick={() => goTo('profile')}>
              <Pencil size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
              내 정보 수정
            </button>
          </>
        ) : (
          <>
            <span className="profile-name">아직 내 정보가 없어요</span>
            <span className="profile-summary">
              몇 가지만 알려주면
              <br />
              나에게 맞는 대학을 찾아드릴게요.
            </span>
            <button className="btn-outline" onClick={() => goTo('profile')}>
              정보 입력하기
            </button>
          </>
        )}
      </div>

      <div className="menu-list">
        <button className="menu-row" onClick={() => goTo('saved')}>
          <span className="help-ico">
            <Bookmark size={20} />
          </span>
          <span className="menu-title">관심 대학</span>
          <ChevronRight size={18} className="menu-arrow" />
        </button>

        <button className="menu-row" onClick={() => goTo('guide', { topic: 'types' })}>
          <span className="help-ico">
            <BookOpen size={20} />
          </span>
          <span className="menu-title">전형 다시 보기</span>
          <ChevronRight size={18} className="menu-arrow" />
        </button>
      </div>

      <p className="note">
        입력한 정보는 이 기기에만 저장돼요.
        <br />
        로그인 없이 편하게 써요.
      </p>

      <p className="build-stamp">build {__BUILD_TIME__}</p>
    </div>
  );
}
