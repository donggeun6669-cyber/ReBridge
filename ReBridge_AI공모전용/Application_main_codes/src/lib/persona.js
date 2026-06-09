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

// persona → 하단 탭 구성 + 첫 진입 화면
// 각 탭: { id, label, icon(이름), screen }
export function getNav(persona) {
  if (!persona) return { tabs: [], landing: 'onboarding' };
  const { stage, goal } = persona;

  const TAB = {
    studyHome: { id: 'home', label: '학습 홈', icon: 'GraduationCap', screen: 'ged-guide' },
    exploreHome: { id: 'home', label: '홈', icon: 'Home', screen: 'home' },
    targetUniv: { id: 'explore', label: '목표 대학', icon: 'Search', screen: 'univ-explore' },
    univExplore: { id: 'explore', label: '대학 탐색', icon: 'Search', screen: 'univ-explore' },
    careerJob: { id: 'explore', label: '진로', icon: 'Compass', screen: 'explore' },
    careerHub: { id: 'explore', label: '진로 탐색', icon: 'Compass', screen: 'explore' },
    roadmap: { id: 'roadmap', label: '로드맵', icon: 'Route', screen: 'roadmap' },
    mypage: { id: 'mypage', label: '프로필', icon: 'User', screen: 'mypage' },
  };

  if (stage === 'studying') {
    // 공부 중 — 학습 홈이 중심. 점수가 없으니 합격 게이지는 안 씀(탐색은 '목표 잡기' 용도).
    let mid;
    if (goal === 'university') mid = TAB.targetUniv;
    else if (goal === 'job') mid = TAB.careerJob;
    else mid = TAB.careerHub;
    return {
      tabs: [TAB.studyHome, mid, TAB.roadmap, TAB.mypage],
      landing: 'ged-guide',
    };
  }

  // tested — 이미 응시(점수 있음). 완성된 입시 기능 풀 사용.
  if (goal === 'job') {
    return {
      tabs: [TAB.careerJob, TAB.roadmap, TAB.mypage],
      landing: 'explore',
    };
  }
  if (goal === 'undecided') {
    return {
      tabs: [TAB.careerHub, TAB.roadmap, TAB.mypage],
      landing: 'explore',
    };
  }
  // tested + university = 기존 완성 앱
  return {
    tabs: [TAB.exploreHome, TAB.univExplore, TAB.roadmap, TAB.mypage],
    landing: 'home',
  };
}

// 현재 화면이 어느 탭에 속하는지 (서브화면 포함) → 활성 탭 id
export function activeTabId(screen) {
  if (['home', 'ged-guide'].includes(screen)) return 'home';
  if (['explore', 'univ-explore', 'path', 'detail', 'documents', 'map', 'results'].includes(screen)) {
    return 'explore';
  }
  if (['roadmap', 'checklist', 'forms-guide', 'dreamdrive'].includes(screen)) return 'roadmap';
  if (['mypage', 'saved', 'help'].includes(screen)) return 'mypage';
  return 'home';
}

// persona가 진로 허브에서 어떤 카드를 보여줄지
export function careerCardsFor(persona) {
  if (!persona) return ['university', 'training', 'cert'];
  if (persona.goal === 'job') return ['training', 'cert']; // 취업 목표면 대학 카드 숨김
  if (persona.goal === 'university') return ['university'];
  return ['university', 'training', 'cert'];
}
