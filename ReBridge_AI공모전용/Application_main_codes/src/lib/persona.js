// 사용자 상황(persona)에 따라 UI/탭 구성을 통째로 바꾼다.
// 절대 모든 사용자에게 모든 기능을 보여주지 않는다 — 상황에 맞는 것만.
//
// persona = {
//   stage: 'studying' | 'tested',   // 검정고시 공부 중 / 이미 응시(점수 있음)
//   goal:  'university' | 'job' | 'undecided',
// }

const STORAGE_KEY = 'rebridge_profile';

export function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

// 온보딩을 마쳐 persona가 정해졌는지
export function getPersona(profile) {
  const p = profile ?? loadProfile();
  if (!p || !p.stage) return null;
  return { stage: p.stage, goal: p.goal || 'undecided' };
}

export function savePersona({ stage, goal }) {
  const prev = loadProfile() || {};
  const next = { ...prev, stage, goal };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
  return next;
}

// 취업 트랙 — '내 목표 직업' 저장/조회. target = { name, field, programId, programLabel } | null
export function setJobTarget(target) {
  const prev = loadProfile() || {};
  const jobProfile = { ...(prev.jobProfile || {}), target: target || undefined };
  const next = { ...prev, jobProfile };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
  return next;
}

export function loadJobTarget() {
  return loadProfile()?.jobProfile?.target || null;
}

// 활성 트랙(목표) — 'study' | 'univ' | 'job' | null(미정). 홈이 이 값으로 상태를 그린다.
export function getActiveTrack() {
  return loadProfile()?.activeTrack || null;
}
export function setActiveTrack(track) {
  const prev = loadProfile() || {};
  const next = { ...prev, activeTrack: track || undefined };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
  return next;
}

// 하단 탭은 트랙과 무관하게 항상 고정 4개(홈·지원·커뮤니티·MY).
// 트랙별 화면(학습/대입/직업)은 홈 안의 상단 서브탭(TrackShell)으로 들어간다.
export function getNav() {
  return {
    tabs: [
      { id: 'home',      label: '홈',      icon: 'Home',          screen: 'home' },
      { id: 'support',   label: '지원',    icon: 'Gift',          screen: 'support' },
      { id: 'community', label: '커뮤니티', icon: 'MessageCircle', screen: 'community' },
      { id: 'mypage',    label: 'MY',      icon: 'User',          screen: 'mypage' },
    ],
    landing: 'home',
  };
}

// 현재 화면이 어느 글로벌 탭(홈·지원·커뮤니티·MY)에 속하는지 → 활성 탭 id.
// 트랙 서브화면(학습/대입/직업 관련)은 모두 '홈'에 속한다.
export function activeTabId(screen) {
  if (['community', 'community-post', 'community-write', 'community-auth'].includes(screen)) return 'community';
  if (['support', 'dreamdrive', 'map'].includes(screen)) return 'support';
  if (['mypage', 'saved', 'help', 'profile'].includes(screen)) return 'mypage';
  return 'home'; // home + 모든 트랙 화면·서브화면
}

// persona가 진로 허브에서 어떤 카드를 보여줄지
export function careerCardsFor(persona) {
  if (!persona) return ['university', 'training', 'cert'];
  if (persona.goal === 'job') return ['training', 'cert']; // 취업 목표면 대학 카드 숨김
  if (persona.goal === 'university') return ['university'];
  return ['university', 'training', 'cert'];
}
