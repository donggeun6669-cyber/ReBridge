// 프로필 + 데이터(universities/admissions) → 맞춤 대학 추천
// 규칙 기반(AI 없음). baseline 데이터에서도 동작하고, 데이터가 채워질수록 정확해짐.
//
// ⚠️ 학년도가 두 개다. 섞으면 안 된다.
//   · 2027 (admissions_2027.min.json) — 대교협 「2027학년도 검정고시 출신자 지원 가능 전형」.
//     지금 원서를 쓰는 학년도이고, "검정고시로 지원할 수 있는가"의 1차 소스다.
//     이 자료에 실렸다는 것 자체가 지원 가능하다는 뜻이라 gedEligible은 가능/조건부뿐이다.
//     대신 전형방법·수능최저·모집인원 같은 구조 정보는 없다. 195개 대학만 수록.
//   · 2028 (admissions.json) — 대학입학전형 시행계획. 구조 정보는 풍부하지만 학년도가 다르다.
//     2027 자료가 없는 대학(156개, 전문대 138 포함)만 여기로 폴백한다.
// 모든 전형 행에는 어느 쪽에서 왔는지 dataYear(2027|2028)를 붙여 화면이 구분해 표시한다.
import universities from './universityList.js';
import admissions from '../data/admissions.json';
import admissions2027 from '../data/admissions_2027.min.json';
import cutlines4y from '../data/cutlines_2026.json';
import cutlines4yPrev from '../data/cutlines_2025.json';
import cutlinesCollege from '../data/cutlines_college_2026.json';
import cutlinesCollegePrev from '../data/cutlines_college_2025.json';
import comparative from '../data/comparative_2027.json';
import { evaluateAdmission, admissionChance, gedSubjectCount } from './scoreEngine.js';

// 4년제·전문대는 원천이 다르지만 univId가 겹치지 않는다 (scoreEngine 머리말 참조).
const cutlines = { ...cutlines4y, ...cutlinesCollege };
const cutlinesPrev = { ...cutlines4yPrev, ...cutlinesCollegePrev };
import { ADMISSION_DATA_YEAR, PLAN_YEAR } from '../data/meta.js';
// 상위권 제외 목록(src/data/topTierExclude.js)은 남겨두되 여기서는 쓰지 않는다.
// 목록에서 통째로 빼면 "왜 이 대학이 안 보이지?"가 되기 때문에, 목록에는 넣고
// 합격선 자료가 없으면 행에서 '자료 없음'으로 정직하게 표시한다.
// (ExploreScreen의 추천순 정렬은 여전히 그 파일을 직접 쓴다)

const METRO = new Set(['서울', '경기', '인천']);

// admissions는 불변 정적 데이터 — univId별 인덱스는 모듈 로드 시 한 번만 만든다.
const ADMISSIONS_BY_UNIV = new Map();
for (const r of admissions) {
  if (!ADMISSIONS_BY_UNIV.has(r.univId)) ADMISSIONS_BY_UNIV.set(r.univId, []);
  ADMISSIONS_BY_UNIV.get(r.univId).push({ ...r, dataYear: PLAN_YEAR });
}

// 슬림 파일(scripts/prepare2027.mjs)이 잘라낸 출처 앞부분.
// 화면에는 원문 그대로 붙여서 보여준다 — 스크립트의 SOURCE_PREFIX와 반드시 같아야 한다.
const SOURCE_PREFIX = '2027학년도 검정고시 출신자 지원 가능 전형(한국대학교육협의회) ';

// 2027 지원 가능 전형 인덱스. 슬림 파일이라 빈 필드는 아예 없다 —
// admissionType이 없는 행(457건)은 "유형 미상"이므로 합격선 조회를 건너뛰고 '자료 없음'이 된다.
const ADMISSIONS_2027_BY_UNIV = new Map();
for (const r of admissions2027) {
  if (!ADMISSIONS_2027_BY_UNIV.has(r.univId)) ADMISSIONS_2027_BY_UNIV.set(r.univId, []);
  ADMISSIONS_2027_BY_UNIV.get(r.univId).push({
    ...r,
    dataYear: ADMISSION_DATA_YEAR,
    status: 'confirmed',       // 원본에서 전 행이 confirmed였다(슬림 때 제외한 상수)
    year: ADMISSION_DATA_YEAR, // 〃
    nameKey: r.nameKey || r.admissionName,
    quotaOutside: r.quotaOutside === true,
    // srcRef(예: '수도권 p.249') → 출처 원문 복원
    source: r.source || (r.srcRef ? SOURCE_PREFIX + r.srcRef : ''),
  });
}

/**
 * 그 대학의 전형 목록을 「2027이 있으면 2027, 없으면 2028」로 고른다.
 * @param {string} univId
 * @param {{ includeQuotaOutside?: boolean }} opts
 *        includeQuotaOutside=false(기본)면 정원외 특별전형을 뺀다.
 *        정원외는 농어촌·기초생활수급자 등 별도 자격이 필요해 일반 학생 대상이 아니다.
 * @returns {{ dataYear: 2027|2028, rows: object[], is2027: boolean }}
 */
export function admissionRowsFor(univId, { includeQuotaOutside = false } = {}) {
  const rows2027 = ADMISSIONS_2027_BY_UNIV.get(univId);
  if (rows2027 && rows2027.length > 0) {
    const rows = includeQuotaOutside ? rows2027 : rows2027.filter((r) => !r.quotaOutside);
    // 정원외만 있는 대학은 없지만(전 대학 확인함), 방어적으로 비면 정원외까지 보여준다
    return {
      dataYear: ADMISSION_DATA_YEAR,
      is2027: true,
      rows: rows.length > 0 ? rows : rows2027,
    };
  }
  return {
    dataYear: PLAN_YEAR,
    is2027: false,
    rows: ADMISSIONS_BY_UNIV.get(univId) || [],
  };
}

// 정원외 특별전형만 따로 (대학 상세의 접힌 섹션용)
export function quotaOutsideRowsFor(univId) {
  return (ADMISSIONS_2027_BY_UNIV.get(univId) || []).filter((r) => r.quotaOutside);
}

// 2027 자료가 있는 대학 / 없는 대학 수 — 화면 고지문과 점검용.
// meta.js의 ADMISSION_DATA_UNIV_COUNT가 이 값과 맞는지 확인할 때 쓴다.
export function admissionDataCoverage() {
  let with2027 = 0;
  for (const u of universities) if (ADMISSIONS_2027_BY_UNIV.has(u.univId)) with2027 += 1;
  return { total: universities.length, with2027, without2027: universities.length - with2027 };
}

// 수시 합격선이 실제로 있는지. cutlines_2025.json은 전형유형별 객체라
// 정시(수능위주) 블록만 있어도 !!cut 이 참이 됐다 — 수시 화면에선 거짓말이 된다.
function hasSusiCutline(cut) {
  if (!cut) return false;
  return Object.entries(cut).some(([type, v]) => {
    if (type === '수능위주') return false;
    if (!v || typeof v !== 'object') return false;
    return (v.cutGradeAvg ?? v.cutGrade70 ?? v.cutScoreAvg ?? v.cutScore70) != null;
  });
}

// 비교내신 자료 유형 — 환산표 있음(numeric) / 서술만(prose) / 없음(none)
function comparativeTypeOf(comp) {
  if (!comp) return 'none';
  return comp.comparativeGradeType === 'numeric_table' ? 'numeric' : 'prose';
}

// 공통 정렬: 검정고시 '가능' 우선 → 유리한 전형 유형 순
function byGedThenType(a, b) {
  const e = (b.gedEligible === '가능') - (a.gedEligible === '가능');
  if (e) return e;
  return (TYPE_RANK[b.admissionType] || 0) - (TYPE_RANK[a.admissionType] || 0);
}

// 검정고시생에게 유리한 순서 (높을수록 우선 추천)
const TYPE_RANK = {
  학생부종합: 4,
  논술: 3,
  '일반(서류)': 3,
  학생부교과: 2,
  수능위주: 1,
};

function regionMatches(uniRegion, pref) {
  if (!pref || pref === '전국 다 좋아요' || pref === '아직 몰라요') return true;
  if (pref === '서울·수도권') return METRO.has(uniRegion);
  if (pref === '지방') return !METRO.has(uniRegion);
  return true;
}

// 수능 최저 표시 간소화
function csatHint(raw) {
  if (!raw) return '모집요강 확인';
  if (raw.includes('해당없음')) return '';
  if (raw.includes('없음')) return '수능 최저 없음';
  if (raw.includes('확인') || raw.includes('적용')) return '수능 최저 모집요강 확인';
  return raw;
}

function nextAction(type, interview) {
  switch (type) {
    case '학생부종합':
      return interview
        ? '자기소개서와 활동을 정리하고, 면접도 미리 연습해봐요.'
        : '자기소개서와 활동 경험부터 정리해봐요.';
    case '논술':
      return '지원하려는 대학의 기출 논술 문제를 한 번 풀어봐요.';
    case '일반(서류)':
      return '제출 서류와 모집 일정을 먼저 확인해봐요.';
    case '학생부교과':
      return '검정고시 점수가 내신으로 어떻게 환산되는지(비교내신) 확인해봐요.';
    case '수능위주':
      return '모의고사를 풀어서 내 수능 위치부터 확인해봐요.';
    default:
      return '모집요강을 한 번 확인해봐요.';
  }
}

function guideNote(csatPlan) {
  if (csatPlan === '안 볼 거예요')
    return '수능을 안 볼 거니까, 수능 최저가 없는 학생부종합·논술 위주로 골랐어요.';
  if (csatPlan === '볼 거예요')
    return '수능까지 준비하면 정시와 수능 최저가 있는 수시까지 넓어져요.';
  return '수능을 볼지 정하면 더 정확하게 추천해드릴 수 있어요.';
}

function isConfirmedStatus(status) {
  return status === 'confirmed' || status === 'confirmed_detail' || status === 'confirmed_summary';
}

// 'baseline' = 대교협 2028 기본사항에서 만든 템플릿 행(현재 359행).
// 그 대학이 실제로 그렇게 뽑는다는 확인이 아니라 "검정고시생 수시 지원은 보장된다"는
// 일반 안내다. 합격 가능성 계산에 넣으면 근거 없는 숫자가 되므로 게이지에서 뺀다.
function isBaselineStatus(status) {
  return status === 'baseline';
}

// 검정고시 가능 → 조건부 → 불가 순, 같은 등급이면 유리한 전형 순
const ELIG_RANK = { 가능: 0, 조건부: 1, 불가: 2 };
function byEligThenType(a, b) {
  const e = (ELIG_RANK[a.gedEligible] ?? 3) - (ELIG_RANK[b.gedEligible] ?? 3);
  if (e) return e;
  return (TYPE_RANK[b.admissionType] || 0) - (TYPE_RANK[a.admissionType] || 0);
}

// 대학 상세: univId로 대학 정보 + 전형 목록(검정고시 관점 정렬) 반환
//   rows      : 화면 주(主) 목록. 2027 자료가 있으면 2027, 없으면 2028.
//   planRows  : 2028학년도 시행계획 행(전형방법·수능최저 등 구조 참고용). 항상 2028.
//   quotaRows : 2027 정원외 특별전형(기본 목록에서 뺀 것). 상세에서 접힌 섹션으로 보여준다.
export function getUniversityDetail(univId) {
  const u = universities.find((x) => x.univId === univId);
  if (!u) return null;

  const picked = admissionRowsFor(univId);
  const rows = [...picked.rows].sort(byEligThenType); // 정렬하므로 복사본
  const planRows = [...(ADMISSIONS_BY_UNIV.get(univId) || [])].sort(byEligThenType);
  const quotaRows = [...quotaOutsideRowsFor(univId)].sort(byEligThenType);

  const eligible = rows.filter((r) => r.gedEligible === '가능' || r.gedEligible === '조건부');
  return {
    univ: u,
    rows,
    dataYear: picked.dataYear,
    is2027: picked.is2027,
    planRows,
    quotaRows,
    eligibleCount: eligible.length,
    hasConfirmed: rows.some((r) => isConfirmedStatus(r.status)),
  };
}

// 이름으로 대학 상세 찾기 (탐색 탭 등 univId가 없을 때)
export function getUniversityDetailByName(name) {
  if (!name) return null;
  const norm = (s) => s.replace(/학교$/, '').replace(/\s/g, '');
  const u =
    universities.find((x) => x.univId === name) ||
    universities.find((x) => x.name === name) ||
    universities.find((x) => norm(x.name) === norm(name)) ||
    universities.find((x) => norm(x.name).includes(norm(name)));
  return u ? getUniversityDetail(u.univId) : null;
}

// 탐색(둘러보기)용 전체 대학 목록 — 유웨이식 입시정보 요약 카드.
// 프로필 없이도 동작하며, 각 대학의 검정고시 관점 데이터 충실도를 함께 반환.
export function getExploreList() {
  const out = [];
  for (const u of universities) {
    const picked = admissionRowsFor(u.univId);
    const rows = picked.rows;
    const eligible = rows.filter((r) => r.gedEligible === '가능' || r.gedEligible === '조건부');
    // 가장 유리한 전형 1개 (가능 우선 > 유형 우선)
    const sorted = [...eligible].sort(byGedThenType);
    const best = sorted[0] || null;

    const comp = comparative[u.univId] || null;
    const comparativeType = comparativeTypeOf(comp);
    // 합격선은 두 학년도 중 한 곳에라도 수시 값이 있으면 '있다'고 본다.
    // 최신 연도에만 없다고 자료 없음으로 적으면, 실제로 있는 근거를 감추게 된다.
    const cut = cutlines[u.univId] || null;
    const cutPrev = cutlinesPrev[u.univId] || null;
    const hasCut = hasSusiCutline(cut) || hasSusiCutline(cutPrev);

    out.push({
      univId: u.univId,
      name: u.name,
      region: u.region,
      kind: u.kind || '대학교',
      establishment: u.establishment || '',
      eligibleCount: eligible.length,
      hasAny: rows.length > 0,
      dataYear: picked.dataYear,
      is2027: picked.is2027,
      comparativeType,
      hasCutline: hasCut,
      // 데이터 충실도 점수(둘러보기 정렬용): 합격선·환산표·전형수
      dataScore:
        (hasCut ? 3 : 0) +
        (comparativeType === 'numeric' ? 3 : comparativeType === 'prose' ? 1 : 0) +
        Math.min(eligible.length, 5),
      // 프로필 점수 비교용(best 전형)
      bestType: best?.admissionType || null,
      bestName: best?.admissionName || null,
      bestGedEligible: best?.gedEligible || null,
    });
  }
  return out;
}

// 공통: 카드 항목 생성
function makeResultItem(u, best, rows, profile, comp) {
  const ev = evaluateAdmission(profile, {
    univId: u.univId,
    admissionType: best.admissionType,
    admissionName: best.admissionName,
    gedEligible: best.gedEligible,
  });
  const baseline = isBaselineStatus(best.status);
  // 템플릿 행은 게이지 계산 대상에서 제외한다 ('예측 불가'가 아니라 '확인 필요')
  const chance = !baseline && ev.applicable ? admissionChance(ev) : null;
  const dataGap = baseline ? 'baseline' : (!ev.applicable ? (ev.dataGap || null) : null);
  const comparativeType = comparativeTypeOf(comp);

  return {
    univId: u.univId,
    name: u.name,
    region: u.region,
    kind: u.kind || '대학교',
    status: best.gedEligible === '가능' ? 'ok' : 'cond',
    bestType: best.admissionType,
    bestName: best.admissionName,
    bestGedEligible: best.gedEligible,
    // 이 행이 몇 학년도 자료에서 왔는지 — 화면이 반드시 구분해 표시한다
    dataYear: best.dataYear ?? PLAN_YEAR,
    applyCloseDate: best.applyCloseDate || null,
    applyCloseTime: best.applyCloseTime || null,
    comparativeType,
    reflection: best.gedReflection || '',
    csat: csatHint(best.csatMinimum),
    interview: !!best.interview,
    next: nextAction(best.admissionType, best.interview),
    eligibleCount: rows.length,
    confirmed: isConfirmedStatus(best.status),
    baseline,                            // 대교협 기본사항 템플릿 행인지
    hasCutline:
      hasSusiCutline(cutlines[u.univId] || null) ||
      hasSusiCutline(cutlinesPrev[u.univId] || null),
    // 이 칸수가 어느 학년도 합격선으로 나온 것인지. 화면은 이걸 반드시 표시한다.
    cutlineYear: ev.cutlineYear ?? null,
    cutlineIsFallbackYear: ev.cutlineIsFallbackYear ?? false,
    // 두 해가 크게 다르면 화면이 둘 다 보여준다 (null이면 비교할 자료가 없다는 뜻)
    cutlineVolatility: ev.cutlineVolatility ?? null,
    hasScore: ev.hasScore,               // 검정고시 점수를 입력했는지
    conversionMethod: ev.conversionMethod, // 'standard'면 추정표(공식 환산표 아님)
    conversionEstimated: ev.conversionEstimated, // 추정표이거나 등급 구간이 추정이면 true
    chance,
    dataGap,
    _score:
      (TYPE_RANK[best.admissionType] || 0) * 10 +
      rows.length +
      (isConfirmedStatus(best.status) ? 2 : 0) +
      (best.gedEligible === '가능' ? 5 : 0),
  };
}

export function analyzeProfile(profile = {}) {
  const { region, csatPlan } = profile;

  const susiResults = [];
  const jeongsiResults = [];
  // 어느 학년도 자료로 만든 목록인지 집계 — 화면 고지문에 쓴다
  let with2027 = 0;
  let without2027 = 0;

  for (const u of universities) {
    if (!regionMatches(u.region, region)) continue;

    const picked = admissionRowsFor(u.univId);
    const allRows = picked.rows.filter(
      (r) => r.gedEligible === '가능' || r.gedEligible === '조건부'
    );
    if (allRows.length === 0) continue;
    if (picked.is2027) with2027 += 1; else without2027 += 1;

    const comp = comparative[u.univId] || null;

    // ── 수시 ──────────────────────────────────────────────────────────────
    // 상위권 대학도 빼지 않는다(자료가 없으면 행에서 '자료 없음'으로 표시).
    {
      const susiRows = allRows.filter(
        (r) => r.phase !== '정시' && r.admissionType !== '수능위주'
      );
      if (susiRows.length > 0) {
        susiRows.sort(byGedThenType);
        susiResults.push(makeResultItem(u, susiRows[0], susiRows, profile, comp));
      }
    }

    // ── 정시 ──────────────────────────────────────────────────────────────
    // 수능 안 볼 예정이면 정시 탭 자체를 안 쓰므로 건너뜀
    if (csatPlan !== '안 볼 거예요') {
      const jeongsiRows = allRows.filter(
        (r) => r.phase === '정시' || r.admissionType === '수능위주'
      );
      if (jeongsiRows.length > 0) {
        jeongsiRows.sort((a, b) =>
          (TYPE_RANK[b.admissionType] || 0) - (TYPE_RANK[a.admissionType] || 0)
        );
        const best = jeongsiRows[0];
        jeongsiResults.push({
          univId: u.univId,
          name: u.name,
          region: u.region,
          kind: u.kind || '대학교',
          status: best.gedEligible === '가능' ? 'ok' : 'cond',
          bestType: best.admissionType,
          bestName: best.admissionName,
          bestGedEligible: best.gedEligible,
          dataYear: best.dataYear ?? PLAN_YEAR,
          applyCloseDate: best.applyCloseDate || null,
          applyCloseTime: best.applyCloseTime || null,
          csat: csatHint(best.csatMinimum),
          eligibleCount: jeongsiRows.length,
          confirmed: isConfirmedStatus(best.status),
          baseline: isBaselineStatus(best.status),
          // 정시는 합격 예측 없이 지원 자격만 표시
          chance: null,
          dataGap: 'csat',
        });
      }
    }
  }

  // 수시: 가능성 순 정렬
  susiResults.sort((a, b) => {
    const la = a.chance ? a.chance.level : 0;
    const lb = b.chance ? b.chance.level : 0;
    if (lb !== la) return lb - la;
    return b._score - a._score || a.name.localeCompare(b.name);
  });

  // 정시: 이름 순
  jeongsiResults.sort((a, b) => a.name.localeCompare(b.name));

  // 페이지네이션이 ResultsScreen에서 처리되므로 전체 결과 반환
  return {
    note: guideNote(csatPlan),
    hasScore: gedSubjectCount(profile.gedScores) > 0,
    // 목록에 들어간 대학 중 몇 곳이 2027 자료 기준인지 (나머지는 2028 폴백)
    yearMix: { with2027, without2027 },
    susi: {
      total: susiResults.length,
      shown: susiResults.length,
      excludedCount: 0, // 상위권 제외 중단 — 필드는 호환 위해 남김
      results: susiResults,
    },
    jeongsi: {
      total: jeongsiResults.length,
      shown: jeongsiResults.length,
      available: csatPlan !== '안 볼 거예요',
      results: jeongsiResults,
    },
  };
}

// ─── 논술 전형 목록 생성 ────────────────────────────────────────────────────
// evalMethod 텍스트에서 논술 비중 파싱
function parseEssayWeight(evalMethod) {
  if (!evalMethod) return null;
  const m = evalMethod.match(/논술\s*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// 논술 전형 유형 분류
function essayCategory(adm) {
  const w = parseEssayWeight(adm.evalMethod);
  if (w === 100 || adm.evalMethod?.includes('100%') || adm.evalMethod?.trim() === '논술 100') {
    return { cat: 'essay100', label: '논술 100%', star: 3, desc: '내신 반영 없음 — 검정고시생 최우선 추천', color: 'green' };
  }
  if (adm.gedReflection?.includes('역산') || adm.note?.includes('역산')) {
    return { cat: 'inverse', label: '논술 성적으로 내신 역산', star: 3, desc: '논술 점수로 비교내신 자동 부여', color: 'green' };
  }
  if (w != null && w >= 90) {
    return { cat: 'essay90', label: `논술 ${w}%`, star: 2, desc: '내신 비중 매우 낮음 — 검정고시 유리', color: 'brand' };
  }
  if (w != null && w >= 80) {
    return { cat: 'essay80', label: `논술 ${w}%`, star: 2, desc: '내신 소폭 반영 — 조건부 추천', color: 'brand' };
  }
  if (w != null && w >= 70) {
    return { cat: 'essay70', label: `논술 ${w}%`, star: 1, desc: '내신 30% 반영 — 비교내신 격차 확인 필요', color: 'gold' };
  }
  return { cat: 'mixed', label: '논술+내신 혼합', star: 1, desc: '모집요강에서 실질 내신 반영 비율 확인 필요', color: 'gold' };
}

// 수능 최저 충족 여부 판단 (간단 파싱)
function checkCsatMinimum(csatMinimum, csatGrades) {
  if (!csatMinimum || csatMinimum.includes('없음') || csatMinimum.includes('미확인')) return null;
  if (!csatGrades) return 'unknown';

  // "등급합 N 이내" 패턴 파싱
  const sumMatch = csatMinimum.match(/(\d+)개?\s*영역\s*(?:등급)?합\s*(\d+)\s*이내/);
  if (sumMatch) {
    const cnt = parseInt(sumMatch[1], 10);
    const limit = parseInt(sumMatch[2], 10);
    // 국수영탐1탐2 중 낮은 순으로 cnt개 선택해서 합산
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

// 2027 논술 행에는 전형방법(evalMethod)·수능최저가 없다. 대교협 지원가능전형 자료가
// 전형 구조를 싣지 않기 때문이다. 그 대학의 2028 시행계획에 논술 전형이 '딱 하나'일 때만
// 그 전형방법을 참고값으로 빌려 쓰고, methodYear로 2028임을 밝힌다.
// (전형 이름이 서로 달라 이름 매칭은 되지 않는다 — 2027 "논술(논술우수자전형)" vs 2028 "논술전형")
function planEssayRowFor(univId) {
  const rows = (ADMISSIONS_BY_UNIV.get(univId) || []).filter((r) => r.admissionType === '논술');
  return rows.length === 1 ? rows[0] : null;
}

export function getEssayList(profile = {}) {
  const { region, csatGrades } = profile;

  const results = [];
  for (const u of universities) {
    if (!regionMatches(u.region, region)) continue;
    // 목록의 기준 학년도는 대학마다 「2027 있으면 2027, 없으면 2028」
    const picked = admissionRowsFor(u.univId);
    const rows = picked.rows.filter(
      (r) => r.admissionType === '논술' && (r.gedEligible === '가능' || r.gedEligible === '조건부')
    );
    if (rows.length === 0) continue;

    const planRow = picked.is2027 ? planEssayRowFor(u.univId) : null;

    for (const adm of rows) {
      // 2027 행이면 전형 구조는 2028 시행계획에서 빌려 온다(있을 때만).
      const methodSource = adm.evalMethod ? adm : planRow;
      const methodYear = adm.evalMethod
        ? adm.dataYear
        : (planRow ? PLAN_YEAR : null);
      const cat = methodSource
        ? essayCategory(methodSource)
        : {
            cat: 'mixed',
            label: '전형방법 미공개',
            star: 1,
            desc: `${ADMISSION_DATA_YEAR}학년도 자료에 전형방법이 없어요 — 모집요강에서 논술 반영 비율을 확인하세요`,
            color: 'gold',
          };
      const csatMinimum = adm.csatMinimum || methodSource?.csatMinimum || '';
      const csatStatus = checkCsatMinimum(csatMinimum, csatGrades);
      results.push({
        univId: u.univId,
        name: u.name,
        region: u.region,
        kind: u.kind || '대학교',
        admissionName: adm.admissionName,
        dataYear: adm.dataYear ?? PLAN_YEAR,
        // 전형방법·수능최저가 몇 학년도 자료에서 온 값인지 (null이면 자료 없음)
        methodYear,
        applyCloseDate: adm.applyCloseDate || null,
        applyCloseTime: adm.applyCloseTime || null,
        evalMethod: methodSource?.evalMethod || '',
        csatMinimum,
        csatStatus, // 'ok' | 'fail' | 'unknown' | null
        gedEligible: adm.gedEligible,
        note: adm.note || '',
        ...cat,
        // 정렬용
        _sortScore: (cat.star * 10) + (adm.gedEligible === '가능' ? 5 : 0) + (csatStatus === 'ok' ? 3 : 0),
      });
    }
  }

  results.sort((a, b) => b._sortScore - a._sortScore || a.name.localeCompare(b.name));
  return results;
}
