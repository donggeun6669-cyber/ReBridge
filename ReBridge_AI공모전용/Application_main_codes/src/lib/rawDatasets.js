// 데이터 원본 목록 — '데이터 원본' 화면(RawDataScreen)이 읽는 유일한 목록.
//
// 왜 있나:
//   UI를 고치려면 화면에 뭐가 그려지는지가 아니라 "우리가 들고 있는 값이 뭔지"를
//   먼저 봐야 한다. 이 목록은 src/data/ 의 파일을 가공 없이 그대로 보여주기 위한 것이다.
//   점수 엔진·필터·라벨을 전혀 거치지 않는다. 있는 그대로다.
//
// ⚠️ 여기 있는 loader는 전부 동적 import다. 데이터 파일 합이 4MB가 넘어서
//    정적으로 물면 첫 로딩 번들이 그만큼 무거워진다. 정적 import로 바꾸지 말 것.
//
// 새 데이터 파일을 만들면 여기에 한 줄 추가하면 화면에 자동으로 뜬다.

// 데이터 묶음 — 화면에서 이 순서·이 구분으로 그린다.
export const GROUPS = [
  { id: 'admission', label: '입시 데이터 (수집·가공한 것)' },
  { id: 'guide', label: '안내 콘텐츠 (직접 쓴 것)' },
  { id: 'career', label: '진로·직업 (v1에서는 화면이 숨겨져 있음)' },
];

/**
 * 데이터셋 하나의 설명.
 * @property {string} key      화면 내부에서 쓰는 식별자
 * @property {string} group    GROUPS 의 id
 * @property {string} title    사람이 읽는 이름
 * @property {string} file     src/ 기준 실제 파일 경로 (화면에 그대로 노출한다)
 * @property {string} note     이 데이터가 뭔지 한 줄
 * @property {string} [source] 출처. 수집 데이터에는 반드시 적는다.
 * @property {string} [warn]   다룰 때 주의할 점
 * @property {string} [join]   다른 데이터와 이어붙이는 방법
 * @property {Function} load   () => Promise<any>  — 동적 import
 */
// 대학 관련 데이터는 대부분 대학 이름을 들고 있지 않고 univId 만 있다.
// 화면에서 이름을 보여주려면 대학 목록(universities.json)과 이어붙여야 한다.
// 이걸 모르면 "왜 검색이 안 되지?"에서 시간을 버린다.
const JOIN_UNIV = '대학 이름은 이 파일에 없어요. univId 로 「대학 목록」(universities.json)과 이어붙여야 이름이 나와요.';

export const DATASETS = [
  // ── 입시 데이터 ────────────────────────────────────────────
  {
    key: 'universities',
    group: 'admission',
    title: '대학 목록',
    file: 'src/data/universities.json',
    note: '앱이 다루는 전체 대학. 4년제·전문대가 kind로 섞여 있다. 좌표(lat/lng)는 지도용.',
    source: '대학알리미 + 각 대학 입학처',
    load: () => import('../data/universities.json').then((m) => m.default),
  },
  {
    key: 'admissions_2027_min',
    join: JOIN_UNIV,
    group: 'admission',
    title: '2027학년도 전형 — 경량본 (앱이 실제로 쓰는 것)',
    file: 'src/data/admissions_2027.min.json',
    note: '검정고시 지원 가부 판정에 쓰는 본체. 화면에 필요한 필드만 남긴 판이다.',
    source: '대교협 「2027학년도 검정고시 출신자 지원 가능 전형」',
    load: () => import('../data/admissions_2027.min.json').then((m) => m.default),
  },
  {
    key: 'admissions_2027',
    join: JOIN_UNIV,
    group: 'admission',
    title: '2027학년도 전형 — 전체 필드 원본',
    file: 'src/data/admissions_2027.json',
    note: '위 경량본을 만들기 전의 원본. 평가방법·면접·수능최저·모집인원까지 다 들어 있다. 1.6MB.',
    source: '대교협 「2027학년도 검정고시 출신자 지원 가능 전형」',
    warn: '앱 화면은 이 파일을 읽지 않는다. 필드를 새로 쓰고 싶으면 경량본(min)에 옮겨야 한다.',
    load: () => import('../data/admissions_2027.json').then((m) => m.default),
  },
  {
    key: 'admissions_2028',
    join: JOIN_UNIV,
    group: 'admission',
    title: '2028학년도 시행계획 전형',
    file: 'src/data/admissions.json',
    note: '2027 자료가 없는 대학의 폴백. 학년도가 달라서 2027과 같은 줄에 놓고 비교하면 안 된다.',
    source: '각 대학 「2028학년도 대학입학전형 시행계획」',
    load: () => import('../data/admissions.json').then((m) => m.default),
  },
  {
    key: 'cutlines_2026',
    join: JOIN_UNIV,
    group: 'admission',
    title: '4년제 합격선 — 2026학년도 (판정 기준)',
    file: 'src/data/cutlines_2026.json',
    note: '대학×전형유형 집계값. 학과 단위 원본은 여기 없다. meta에 산출 방법이 적혀 있다.',
    source: '대교협 대입정보포털 어디가(adiga.kr) 2026학년도 전형결과',
    warn: '학생부교과·학생부종합·수능위주 3개 유형만 있다. 논술·실기가 없는 건 누락이 아니라 원천에 없는 것.',
    load: () => import('../data/cutlines_2026.json').then((m) => m.default),
  },
  {
    key: 'cutlines_2025',
    join: JOIN_UNIV,
    group: 'admission',
    title: '4년제 합격선 — 2025학년도 (비교용)',
    file: 'src/data/cutlines_2025.json',
    note: '2026과 함께 보여주려고 들고 있다. 두 해를 평균내지 않는다.',
    source: '대교협 어디가 2025학년도 전형결과',
    load: () => import('../data/cutlines_2025.json').then((m) => m.default),
  },
  {
    key: 'cutlines_college_2026',
    join: JOIN_UNIV,
    group: 'admission',
    title: '전문대 합격선 — 2026학년도',
    file: 'src/data/cutlines_college_2026.json',
    note: '대학×전형 집계값만. 4년제와 출처가 다르다.',
    source: '전문대교협 전문대학포털 프로칼리지 2026학년도 전형결과',
    warn: '무단 복제·배포가 금지된 자료라 학과 단위 원본은 싣지 않는다. 화면에 낼 때 출처를 반드시 함께 밝힐 것.',
    load: () => import('../data/cutlines_college_2026.json').then((m) => m.default),
  },
  {
    key: 'cutlines_college_2025',
    join: JOIN_UNIV,
    group: 'admission',
    title: '전문대 합격선 — 2025학년도 (비교용)',
    file: 'src/data/cutlines_college_2025.json',
    note: '전문대 2026과 함께 보여주는 이전 학년도.',
    source: '전문대교협 전문대학포털 프로칼리지 2025학년도 전형결과',
    load: () => import('../data/cutlines_college_2025.json').then((m) => m.default),
  },
  {
    key: 'comparative_2027',
    join: JOIN_UNIV,
    group: 'admission',
    title: '비교내신 환산 — 2027학년도',
    file: 'src/data/comparative_2027.json',
    note: '검정고시 점수를 내신 등급으로 바꾸는 대학별 환산표. 모집요강 원문 그대로라 줄바꿈·표가 텍스트로 들어 있다.',
    source: '각 대학 2027학년도 수시·정시 모집요강',
    load: () => import('../data/comparative_2027.json').then((m) => m.default),
  },
  {
    key: 'comparative_2028',
    join: JOIN_UNIV,
    group: 'admission',
    title: '비교내신 환산 — 2028학년도',
    file: 'src/data/comparative_2028.json',
    note: '2028 시행계획 기준 환산표. 2028학년도부터 고교 내신이 5등급제라 2027과 체계가 다르다.',
    source: '각 대학 2028학년도 대학입학전형 시행계획',
    load: () => import('../data/comparative_2028.json').then((m) => m.default),
  },
  {
    key: 'ged_freshmen',
    join: JOIN_UNIV,
    group: 'admission',
    title: '검정고시 출신 신입생 통계',
    file: 'src/data/ged_freshmen.json',
    note: '대학별로 검정고시 출신 신입생이 실제로 몇 명 들어갔는지. byYear에 연도별 수치가 있다.',
    source: '대학알리미(academyinfo.go.kr) 신입생의 출신고교유형별 현황 — 4년제',
    warn: '전문대는 이 통계가 없다.',
    load: () => import('../data/ged_freshmen.json').then((m) => m.default),
  },
  {
    key: 'kkumdrim',
    group: 'admission',
    title: '꿈드림 센터 (학교밖청소년지원센터)',
    file: 'src/data/kkumdrim.json',
    note: '전국 센터 목록. 주소·전화·좌표·제공 혜택(benefits)이 들어 있다.',
    source: '여성가족부 학교밖청소년지원센터 꿈드림',
    load: () => import('../data/kkumdrim.json').then((m) => m.default),
  },
  {
    key: 'excludedUniversities',
    join: JOIN_UNIV,
    group: 'admission',
    title: '목록에서 제외하는 대학',
    file: 'src/data/excludedUniversities.js',
    note: '대학이 아닌 기관, 사내대학 등 일반 지원 대상이 아닌 곳.',
    module: true,
    load: () => import('../data/excludedUniversities.js'),
  },
  {
    key: 'topTierExclude',
    join: JOIN_UNIV,
    group: 'admission',
    title: '상위권 추천에서 빼는 대학',
    file: 'src/data/topTierExclude.js',
    note: '추천 결과에서 제외하는 목록.',
    module: true,
    load: () => import('../data/topTierExclude.js'),
  },
  {
    key: 'meta',
    group: 'admission',
    title: '학년도·출처 라벨 (단일 소스)',
    file: 'src/data/meta.js',
    note: '화면에 나오는 "2027학년도", "대교협 어디가 …" 같은 연도·출처 문구가 전부 여기서 나온다.',
    warn: '문구를 바꾸려면 화면이 아니라 이 파일을 고쳐야 앱 전체가 같이 바뀐다.',
    module: true,
    load: () => import('../data/meta.js'),
  },

  // ── 안내 콘텐츠 ────────────────────────────────────────────
  {
    key: 'gedGuide',
    group: 'guide',
    title: '검정고시 안내',
    file: 'src/data/gedGuide.js',
    note: '과목·합격 기준·응시 결격 등. 주석에 확인한 공식 출처가 적혀 있다.',
    warn: '사실 확인 없이 고치지 말 것. 이 앱이 여기서 틀리면 존재 이유가 없어진다.',
    module: true,
    load: () => import('../data/gedGuide.js'),
  },
  {
    key: 'schedule',
    group: 'guide',
    title: '일정 (검정고시·입시)',
    file: 'src/data/schedule.js',
    note: 'GED_CONFIRMED_YEARS 에 있는 연도만 확정 날짜다. 공고 전 연도는 화면이 날짜를 감춘다.',
    warn: '새 연도 일정을 넣을 때는 날짜와 CONFIRMED_YEARS 를 반드시 같이 고친다.',
    module: true,
    load: () => import('../data/schedule.js'),
  },
  {
    key: 'glossary',
    group: 'guide',
    title: '용어 사전',
    file: 'src/data/glossary.js',
    note: '입시·진로 용어 풀이. 트랙별로 나뉘어 있다.',
    module: true,
    load: () => import('../data/glossary.js'),
  },
  {
    key: 'checklists',
    group: 'guide',
    title: '체크리스트',
    file: 'src/data/checklists.js',
    note: '트랙·프로필에 따라 만들어지는 준비 항목.',
    module: true,
    load: () => import('../data/checklists.js'),
  },
  {
    key: 'commonSupport',
    group: 'guide',
    title: '공통 지원 제도',
    file: 'src/data/commonSupport.js',
    note: '누구에게나 해당하는 지원 제도 목록.',
    module: true,
    load: () => import('../data/commonSupport.js'),
  },
  {
    key: 'benefitCategories',
    group: 'guide',
    title: '혜택 분류',
    file: 'src/data/benefitCategories.js',
    note: '꿈드림 센터의 benefits 값을 묶는 분류표.',
    module: true,
    load: () => import('../data/benefitCategories.js'),
  },
  {
    key: 'policies',
    group: 'guide',
    title: '개인정보처리방침 · 이용약관',
    file: 'src/data/policies.js',
    note: '법 문서 원문. 화면(PolicyScreen)은 이 값을 그대로 그린다.',
    module: true,
    load: () => import('../data/policies.js'),
  },

  // ── 진로·직업 ──────────────────────────────────────────────
  {
    key: 'careerData',
    group: 'career',
    title: '직업 카탈로그 · 심리검사',
    file: 'src/data/careerData.js',
    note: '분야별 직업 목록과 검사 문항.',
    module: true,
    load: () => import('../data/careerData.js'),
  },
  {
    key: 'careerMentor',
    group: 'career',
    title: '직업별 경로 안내',
    file: 'src/data/careerMentor.js',
    note: '직업마다의 단계별 진행 경로.',
    module: true,
    load: () => import('../data/careerMentor.js'),
  },
  {
    key: 'careerPaths',
    group: 'career',
    title: '진로 갈래 · 근로 안전',
    file: 'src/data/careerPaths.js',
    note: '큰 갈래 설명과 청소년 근로 관련 안내.',
    module: true,
    load: () => import('../data/careerPaths.js'),
  },
  {
    key: 'jobData',
    group: 'career',
    title: '취업·훈련 프로그램',
    file: 'src/data/jobData.js',
    note: '직업훈련 프로그램 목록과 매칭 질문.',
    module: true,
    load: () => import('../data/jobData.js'),
  },
];

// ── 아래는 화면이 쓰는 정규화 함수 ────────────────────────────
// 어떤 모양이 와도 "행(row)의 배열"로 바꾼다. 값은 손대지 않는다.

/**
 * 불러온 값을 화면이 그릴 수 있는 형태로 정규화한다.
 * 값 자체는 절대 바꾸지 않는다 — 감싸기만 한다.
 *
 * @param {any} data          JSON이면 값 그대로, JS 파일이면 모듈 객체
 * @param {boolean} isModule  DATASETS의 module 플래그. 추측하지 않고 이 값만 믿는다.
 *   (Vite가 JSON에 named export를 붙이기도 해서 모양만 보고 판별하면 틀린다)
 * @returns {{kind:'rows'|'exports', meta:object|null, rows:Array, columns:string[]}}
 */
export function normalize(data, isModule = false) {
  // 1) JS 모듈 — named export 하나하나를 행으로 본다.
  if (isModule) {
    const rows = Object.keys(data || {})
      .filter((k) => k !== 'default' && k !== '__esModule')
      .map((k) => ({ 이름: k, 종류: typeName(data[k]), 값: data[k] }));
    return { kind: 'exports', meta: null, rows, columns: ['이름', '종류', '값'] };
  }

  // 2) 배열 — 그대로 행이 된다.
  if (Array.isArray(data)) {
    return { kind: 'rows', meta: null, rows: data, columns: unionKeys(data) };
  }

  // 3) 객체 맵 — 최상위 키가 대학 id 같은 식별자다. meta 는 따로 뺀다.
  if (data && typeof data === 'object') {
    const { meta = null, ...rest } = data;
    const rows = Object.entries(rest).map(([k, v]) => (
      v && typeof v === 'object' && !Array.isArray(v)
        ? { 키: k, ...v }
        : { 키: k, 값: v }
    ));
    return { kind: 'rows', meta, rows, columns: unionKeys(rows) };
  }

  return { kind: 'rows', meta: null, rows: [], columns: [] };
}

// 행마다 필드가 다를 수 있으니 전부 모아서 열을 만든다. 앞쪽 행 순서를 지킨다.
function unionKeys(rows) {
  const seen = [];
  const set = new Set();
  for (const r of rows.slice(0, 300)) {
    if (!r || typeof r !== 'object') continue;
    for (const k of Object.keys(r)) {
      if (!set.has(k)) { set.add(k); seen.push(k); }
    }
  }
  return seen;
}

export function typeName(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `배열(${v.length})`;
  if (v instanceof Set) return `Set(${v.size})`;
  if (v instanceof Map) return `Map(${v.size})`;
  if (typeof v === 'function') return '함수';
  if (typeof v === 'object') return `객체(${Object.keys(v).length})`;
  return typeof v;
}

// 표 칸에 넣을 한 줄 문자열. 원본을 바꾸지 않고 보여주기만 줄인다.
export function cellText(v) {
  if (v === undefined) return '';
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'function') return '함수 (표시 안 함)';
  return safeStringify(v);
}

// Set/Map/함수가 섞여 있어도 죽지 않는 JSON 변환.
export function safeStringify(v, space = 0) {
  return JSON.stringify(v, (_k, val) => {
    if (val instanceof Set) return [...val];
    if (val instanceof Map) return Object.fromEntries(val);
    if (typeof val === 'function') return `[함수 ${val.name || '익명'}]`;
    return val;
  }, space);
}
