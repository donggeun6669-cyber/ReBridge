// 사용자 상황(persona)에 따라 UI/탭 구성을 통째로 바꾼다.
// 절대 모든 사용자에게 모든 기능을 보여주지 않는다 — 상황에 맞는 것만.
//
// persona = {
//   stage: 'studying' | 'tested',   // 검정고시 공부 중 / 이미 응시(점수 있음)
//   goal:  'university' | 'job' | 'undecided',
// }

// ⚙️ v1 출시 범위 스위치.
//   true  → 대입(univ) 트랙 + 검정고시 안내 + 지원(꿈드림) 탭만 노출.
//           커뮤니티·인증, 학습(study) 트랙, 직업(job) 트랙을 전부 숨긴다.
//   false → 원래대로 전부 노출 (v1.1에서 되돌릴 때 이 값만 false로).
//   ※ 기능을 지운 게 아니라 가린 것이다. 화면·데이터·로직은 그대로 남아 있다.
export const V1_UNIV_ONLY = true;

// v1에서 가려야 하는 화면인지 판단. (커뮤니티/인증 · 직업 · 학습 · 진로허브)
export function isHiddenScreen(screen) {
  if (!V1_UNIV_ONLY) return false;
  const s = String(screen || '');
  return s === 'community' || s.startsWith('community-')
    || s === 'explore'                      // CareerHubScreen(진로 허브)
    || s.startsWith('job-')
    || s.startsWith('study-');
}

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

// 취업 트랙 — 관심 직업을 1~3개 저장한다. job = { name, field, programId, programLabel }
const MAX_SAVED_JOBS = 3;

export function loadSavedJobs() {
  return loadProfile()?.jobProfile?.savedJobs || [];
}

function persistJobProfile(patch) {
  const prev = loadProfile() || {};
  const jobProfile = { ...(prev.jobProfile || {}), ...patch };
  const next = { ...prev, jobProfile };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
  return next;
}

// 직업 저장 토글. 이미 있으면 제거, 없으면 추가(최대 3개).
// 반환: { jobs, added, full } — full=true면 3개가 차서 추가 못 함.
export function toggleSavedJob(job) {
  const jobs = loadSavedJobs();
  const idx = jobs.findIndex((j) => j.name === job.name && j.field === job.field);
  if (idx >= 0) {
    const nextJobs = jobs.filter((_, i) => i !== idx);
    persistJobProfile({ savedJobs: nextJobs });
    const primary = loadProfile()?.jobProfile?.primaryJob;
    if (primary && primary.name === job.name && primary.field === job.field) {
      persistJobProfile({ primaryJob: nextJobs[0] || undefined });
    }
    return { jobs: nextJobs, added: false, full: false };
  }
  if (jobs.length >= MAX_SAVED_JOBS) return { jobs, added: false, full: true };
  const nextJobs = [...jobs, job];
  persistJobProfile({ savedJobs: nextJobs });
  if (nextJobs.length === 1) persistJobProfile({ primaryJob: job });
  return { jobs: nextJobs, added: true, full: false };
}

export function isJobSaved(name, field) {
  return loadSavedJobs().some((j) => j.name === name && j.field === field);
}

// 주 직업(로드맵을 보여줄 직업) 설정/조회.
export function setPrimaryJob(job) {
  return persistJobProfile({ primaryJob: job || undefined });
}
export function loadPrimaryJob() {
  const jp = loadProfile()?.jobProfile;
  if (!jp) return null;
  return jp.primaryJob || (jp.savedJobs && jp.savedJobs[0]) || jp.target || null;
}

// ── 하위호환: 기존 화면들이 쓰는 단일 target API ──
export function loadJobTarget() {
  return loadPrimaryJob();
}

// ── 직업 준비 단계 진행 체크 (로드맵 멘토용) ──
// 저장: jobProfile.progress = { [`${name}::${field}`]: { [stageKey]: true } }
function jobKey(name, field) { return `${name}::${field}`; }

export function loadJobProgress(name, field) {
  const all = loadProfile()?.jobProfile?.progress || {};
  return all[jobKey(name, field)] || {};
}
export function toggleJobStage(name, field, stageKey) {
  const prev = loadProfile() || {};
  const all = { ...(prev.jobProfile?.progress || {}) };
  const key = jobKey(name, field);
  const cur = { ...(all[key] || {}) };
  cur[stageKey] = !cur[stageKey];
  all[key] = cur;
  persistJobProfile({ progress: all });
  return cur;
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

// 하단 탭은 트랙과 무관하게 항상 고정(홈·지원·커뮤니티·MY).
// v1(V1_UNIV_ONLY)에서는 커뮤니티를 빼서 3탭이 된다.
// 트랙별 화면(학습/대입/직업)은 홈 안의 상단 서브탭(TrackHome)으로 들어간다.
export function getNav() {
  const tabs = [
    { id: 'home',      label: '홈',      icon: 'Home',          screen: 'home' },
    { id: 'support',   label: '지원',    icon: 'Gift',          screen: 'support' },
    { id: 'community', label: '커뮤니티', icon: 'MessageCircle', screen: 'community' },
    { id: 'mypage',    label: 'MY',      icon: 'User',          screen: 'mypage' },
  ];
  return {
    tabs: tabs.filter((t) => !isHiddenScreen(t.screen)),
    landing: 'home',
  };
}

// 현재 화면이 어느 글로벌 탭(홈·지원·커뮤니티·MY)에 속하는지 → 활성 탭 id.
// 트랙 서브화면(학습/대입/직업 관련)은 모두 '홈'에 속한다.
export function activeTabId(screen) {
  // v1에서는 커뮤니티 탭 자체가 없으므로 '홈'으로 떨어뜨린다(활성 탭 없음 방지).
  if (['community', 'community-post', 'community-write', 'community-auth'].includes(screen)) {
    return V1_UNIV_ONLY ? 'home' : 'community';
  }
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
