// 사용자 상황(persona)에 따라 UI/탭 구성을 통째로 바꾼다.
// 절대 모든 사용자에게 모든 기능을 보여주지 않는다 — 상황에 맞는 것만.
//
// persona = {
//   stage: 'studying' | 'tested',   // 검정고시 공부 중 / 이미 응시(점수 있음)
//   goal:  'university' | 'job' | 'undecided',
// }

// ⚙️ v1 출시 범위 스위치.
//   true  → 대입(univ) 트랙 + 검정고시 안내 + 지원(꿈드림) + 커뮤니티만 노출.
//           학습(study) 트랙, 직업(job) 트랙, 진로 허브를 숨긴다.
//   false → 원래대로 전부 노출 (v1.1에서 되돌릴 때 이 값만 false로).
//   ※ 기능을 지운 게 아니라 가린 것이다. 화면·데이터·로직은 그대로 남아 있다.
//   ※ 커뮤니티는 2026-09-18 동근님 지시로 v1에 넣었다(킨텍스 EXPO 시연).
//     앱 출시 때 뺄지는 다시 정한다 → 빼려면 COMMUNITY_IN_V1 만 false로.
export const V1_UNIV_ONLY = true;
export const COMMUNITY_IN_V1 = true;

// v1에서 가려야 하는 화면인지 판단. (직업 · 학습 · 진로허브, 그리고 COMMUNITY_IN_V1=false면 커뮤니티)
export function isHiddenScreen(screen) {
  if (!V1_UNIV_ONLY) return false;
  const s = String(screen || '');
  if (s === 'community' || s.startsWith('community-')) return !COMMUNITY_IN_V1;
  return s === 'explore'                    // CareerHubScreen(진로 허브)
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

export function savePersona({ stage, goal, age, grade, homeRegion }) {
  const prev = loadProfile() || {};
  const next = { ...prev, stage, goal };
  if (age !== undefined) next.age = age;
  if (grade !== undefined) next.grade = grade;
  if (homeRegion !== undefined) next.homeRegion = homeRegion;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
  return next;
}

// ── 학년 (2026-09-18 동근님: 시작 질문에 학년·지역) ──────────────────────────
// 학교 밖이라 '재학 학년'이 없다. "학교에 다녔다면 지금 몇 학년일 나이인지"를 받는다.
// 로드맵은 이 값으로 사람마다 다르게 그린다(lib/roadmap.js의 gradeRoadmap).
// min/max는 만 나이·한국 나이 차이를 감안해 넉넉히 잡은 범위다 — 꿈드림 대상(9~24세) 판단에만 쓴다.
export const GRADE_OPTIONS = [
  { key: 'm',   label: '중학생 나이', short: '중학생', min: 13, max: 16 },
  { key: 'h1',  label: '고1 나이',    short: '고1',    min: 15, max: 17 },
  { key: 'h2',  label: '고2 나이',    short: '고2',    min: 16, max: 18 },
  { key: 'h3',  label: '고3 나이',    short: '고3',    min: 17, max: 19 },
  { key: 'a20', label: '20~24세',     short: '20대 초반', min: 20, max: 24 },
  { key: 'a25', label: '25세 이상',   short: '25세 이상', min: 25, max: 200 },
];

export function getGrade(p = loadProfile()) {
  return p?.grade || null;
}
export function gradeOption(key = getGrade()) {
  return GRADE_OPTIONS.find((o) => o.key === key) || null;
}

// ── 사는 지역 — 꿈드림센터 목록의 기본 지역으로 쓴다 ─────────────────────────
// ⚠️ profile.region 은 ProfileScreen의 '가고 싶은 대학 지역'이다. 다른 값이라 키를 따로 둔다.
// 이름은 kkumdrim.json·대학 탐색 필터와 같은 짧은 표기.
export const HOME_REGIONS = [
  '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];
export function getHomeRegion(p = loadProfile()) {
  return p?.homeRegion || null;
}

// ── 나이 (2026-09 서연님 UI 개선안: 시작 화면에서 나이를 묻고 맞춤 안내) ─────────
// 생년월일이 아니라 '나이대'만 받는다. 개인 식별이 안 되고, 이 기기(localStorage)에만 남는다.
// 서버로 보내지 않는다 — 보내려는 리팩터링을 하지 말 것.
export const AGE_OPTIONS = [
  { key: 'u15', label: '15세 이하', min: 0,  max: 15 },
  { key: '16',  label: '16세',      min: 16, max: 16 },
  { key: '17',  label: '17세',      min: 17, max: 17 },
  { key: '18',  label: '18세',      min: 18, max: 18 },
  { key: '19',  label: '19세',      min: 19, max: 19 },
  { key: '20t', label: '20~24세',   min: 20, max: 24 },
  { key: 'o25', label: '25세 이상', min: 25, max: 200 },
];

export function saveAge(ageKey) {
  const prev = loadProfile() || {};
  const next = { ...prev, age: ageKey };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
  return next;
}

export function getAge() {
  return loadProfile()?.age || null;
}

// 학년을 고른 사람(2026-09-18 이후 온보딩)은 학년 선택지가 나이 범위를 대신한다.
// 인자 없이 부르면 학년 → 예전 나이대 순으로 찾는다.
export function ageOption(ageKey) {
  if (ageKey === undefined) {
    const g = gradeOption();
    if (g) return g;
    ageKey = getAge();
  }
  return AGE_OPTIONS.find((o) => o.key === ageKey) || null;
}

// 꿈드림(학교밖청소년지원센터)은 만 9~24세가 대상이다.
// 근거는 src/data/commonSupport.js — 거기 요약문과 같은 기준을 쓴다.
//
// 나이를 '나이대'로만 받기 때문에 구간이 기준선에 걸칠 수 있다.
// 예: '15세 이하'에는 만 9세 미만도 들어간다 → 무조건 '가능'이라고 하면 거짓말이 된다.
//   'yes'     구간 전체가 9~24세 안 → 대상
//   'partial' 구간이 걸쳐 있음 → 단정하지 말고 기준만 알려준다
//   'no'      구간 전체가 범위 밖 → 대상 아님
//   null      나이를 안 골랐음 → 아무 말도 하지 않는다
export const DREAMDRIM_MIN_AGE = 9;
export const DREAMDRIM_MAX_AGE = 24;

export function dreamdrimEligibility(ageKey) {
  const o = ageOption(ageKey);
  if (!o) return null;
  const inside = o.min >= DREAMDRIM_MIN_AGE && o.max <= DREAMDRIM_MAX_AGE;
  if (inside) return 'yes';
  const overlaps = o.min <= DREAMDRIM_MAX_AGE && o.max >= DREAMDRIM_MIN_AGE;
  return overlaps ? 'partial' : 'no';
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
// goal/stage → 트랙. 온보딩은 goal만 저장하는데 홈은 activeTrack을 본다.
// 이 다리가 없으면 점수까지 다 넣은 사람에게도 '어디서부터 시작할까요?'가
// 다시 떠서, 입력 직후 화면과 홈이 따로 논다(2026-09 서연님 지적).
export function trackFromPersona(p = loadProfile()) {
  if (!p) return null;
  if (p.goal === 'job') return 'job';
  if (p.goal === 'university') {
    // 대입이 목표여도 아직 시험 전이면 검정고시(학습) 트랙이 더 맞다.
    // 단 점수를 이미 넣었으면 대입 화면으로 바로 보낸다.
    if (p.stage === 'studying' && p.gedAvg == null) return 'study';
    return 'univ';
  }
  return null;
}

export function getActiveTrack() {
  // 사용자가 홈에서 직접 고른 트랙이 1순위, 없으면 온보딩 답에서 유추한다.
  return loadProfile()?.activeTrack || trackFromPersona() || null;
}
export function setActiveTrack(track) {
  const prev = loadProfile() || {};
  const next = { ...prev, activeTrack: track || undefined };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
  return next;
}

// 온보딩을 마친 뒤 도착할 화면. 하단 탭은 2026-09-17에 없앴다(동근님) —
// 모든 화면은 홈에서 들어가고, 마이페이지는 홈 우측 상단 아이콘으로 연다.
export function getNav() {
  return { landing: 'home' };
}

// persona가 진로 허브에서 어떤 카드를 보여줄지
export function careerCardsFor(persona) {
  if (!persona) return ['university', 'training', 'cert'];
  if (persona.goal === 'job') return ['training', 'cert']; // 취업 목표면 대학 카드 숨김
  if (persona.goal === 'university') return ['university'];
  return ['university', 'training', 'cert'];
}
