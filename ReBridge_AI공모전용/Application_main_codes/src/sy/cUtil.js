// 서연 UI 묶음 C(진학지원) 전용 도우미 — 2026-09-28
// 기존 lib 에서 export 되지 않은 판정·상수를 '그대로' 옮겨 왔다.
// 원본을 고치면 여기도 같이 고쳐야 한다(원본 위치를 각 항목에 적어 둠).

// ── 대학 찾기 필터 상수 ─────────────────────────────────────────────────
// 원본: src/components/ExploreScreen.jsx (GEOJEOM · REGIONS · ESTAB · TYPES · matches)
export const GEOJEOM = new Set([
  '부산대학교', '경북대학교', '전남대학교', '충남대학교', '전북대학교',
  '강원대학교', '제주대학교', '충북대학교', '경상국립대학교', '강원대학교(강릉·원주캠퍼스)',
]);
export const REGIONS = ['서울', '경기', '인천', '강원', '대전', '세종', '충북', '충남', '광주', '전북', '전남',
  '대구', '경북', '부산', '울산', '경남', '제주'];
export const ESTAB = { '국립·공립': ['국립', '공립'], '사립': ['사립'], '특별법인': ['특별법법인'] };
// 데이터의 admissionType 값
export const TYPES = ['학생부교과', '학생부종합', '논술', '실기', '수능위주', '일반(서류)', '특별전형'];

// 시안은 한 줄에 값 하나(드롭다운)라 묶음마다 한 개만 고른다. ''(첫 값) = 거르지 않음.
export const EXPLORE_FILTERS = [
  { key: 'region', label: '지역', options: [['', '전체'], ...REGIONS.map((r) => [r, r])] },
  { key: 'kind', label: '학교 종류', options: [['', '전체'], ['대학교', '4년제'], ['전문대학', '전문대']] },
  { key: 'estab', label: '설립', options: [['', '전체'], ...Object.keys(ESTAB).map((k) => [k, k])] },
  { key: 'type', label: '전형', options: [['', '전체'], ...TYPES.map((t) => [t, t])] },
  { key: 'csat', label: '수능최저', options: [['', '전체'], ['none', '없음'], ['has', '있음'], ['unknown', '확인 필요']] },
  { key: 'interview', label: '면접', options: [['', '전체'], ['none', '없음'], ['has', '있음'], ['unknown', '확인 필요']] },
  { key: 'geojeom', label: '지방거점', options: [['', '포함'], ['yes', '지방거점만']] },
];
export const EXPLORE_EMPTY = Object.fromEntries(EXPLORE_FILTERS.map((f) => [f.key, '']));

function triOf(facets) {
  return facets && facets.length ? facets : ['unknown'];
}

// getExploreList() 한 줄이 고른 조건에 맞는지 (원본 matches 와 같은 기준, 값이 하나일 뿐)
export function exploreMatches(s, sel) {
  const ok = (picked, values) => !picked || values.includes(picked);
  return (
    ok(sel.region, [s.region]) &&
    ok(sel.kind, [s.kind]) &&
    ok(sel.estab, Object.keys(ESTAB).filter((k) => ESTAB[k].includes(s.establishment))) &&
    ok(sel.type, s.availableTypes || []) &&
    ok(sel.csat, triOf(s.csatFacets)) &&
    ok(sel.interview, triOf(s.interviewFacets)) &&
    ok(sel.geojeom, GEOJEOM.has(s.name) ? ['yes'] : [])
  );
}

// ── 수능 최저 충족 판정 ─────────────────────────────────────────────────
// 원본: src/lib/analysis.js checkCsatMinimum (export 안 됨 — 같은 코드)
export function checkCsatMinimum(csatMinimum, csatGrades) {
  if (!csatMinimum || csatMinimum.includes('없음') || csatMinimum.includes('미확인')) return null;
  if (!csatGrades) return 'unknown';
  const sumMatch = csatMinimum.match(/(\d+)개?\s*영역\s*(?:등급)?합\s*(\d+)\s*이내/);
  if (sumMatch) {
    const cnt = parseInt(sumMatch[1], 10);
    const limit = parseInt(sumMatch[2], 10);
    const grades = ['국어', '수학', '영어', '탐구1', '탐구2']
      .map((s) => csatGrades[s])
      .filter((v) => v != null && v > 0)
      .sort((a, b) => a - b)
      .slice(0, cnt);
    if (grades.length < cnt) return 'unknown';
    const sum = grades.reduce((a, b) => a + b, 0);
    return sum <= limit ? 'ok' : 'fail';
  }
  return 'unknown';
}

// 결과 행(analyzeProfile 의 수시 행)의 수능 최저 상태 → 시안 아래쪽 배지
//   r.csat 은 analysis.js csatHint() 결과: '' · '수능 최저 없음' · '수능 최저 모집요강 확인' · '모집요강 확인'(자료 없음) · 원문
export function csatBadgeOf(r, csatGrades) {
  const c = r.csat;
  if (c === '모집요강 확인') return { kind: 'none', label: '자료 없음' };
  if (c === '' || c === '수능 최저 없음') return { kind: 'ok', label: '수능 최저 없음' };
  if (c === '수능 최저 모집요강 확인') return { kind: 'unknown', label: '확인 필요' };
  const st = checkCsatMinimum(c, csatGrades);
  if (st === 'ok') return { kind: 'ok', label: '수능 최저 충족' };
  if (st === 'fail') return { kind: 'fail', label: '수능 최저 미달' };
  if (st == null) return { kind: 'ok', label: '수능 최저 없음' };
  return { kind: 'unknown', label: '확인 필요' };
}

// 칸수가 없는 행의 위쪽 배지 문구 — ResultsScreen SusiBadge 와 같은 뜻
export function gapLabelOf(r) {
  if (r.baseline) return '확인 필요';
  if (r.dataGap === 'conversion') return '환산 기준 미공개';
  if (r.dataGap === 'special') return '자격 확인 필요';
  if (r.dataGap === 'cutline') return '자료 없음';
  return '확인 필요';
}
