// 프로필 + 데이터(universities/admissions) → 맞춤 대학 추천
// 규칙 기반(AI 없음). baseline 데이터에서도 동작하고, 데이터가 채워질수록 정확해짐.
import universities from '../data/universities.json';
import admissions from '../data/admissions.json';
import cutlines from '../data/cutlines_2025.json';
import comparative from '../data/comparative_2028.json';
import { evaluateAdmission, admissionChance, gedSubjectCount } from './scoreEngine.js';
// 상위권 제외 목록(src/data/topTierExclude.js)은 남겨두되 여기서는 쓰지 않는다.
// 목록에서 통째로 빼면 "왜 이 대학이 안 보이지?"가 되기 때문에, 목록에는 넣고
// 합격선 자료가 없으면 행에서 '자료 없음'으로 정직하게 표시한다.
// (ExploreScreen의 추천순 정렬은 여전히 그 파일을 직접 쓴다)

const METRO = new Set(['서울', '경기', '인천']);

// admissions는 불변 정적 데이터 — univId별 인덱스는 모듈 로드 시 한 번만 만든다.
const ADMISSIONS_BY_UNIV = new Map();
for (const r of admissions) {
  if (!ADMISSIONS_BY_UNIV.has(r.univId)) ADMISSIONS_BY_UNIV.set(r.univId, []);
  ADMISSIONS_BY_UNIV.get(r.univId).push(r);
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

// 대학 상세: univId로 대학 정보 + 전형 목록(검정고시 관점 정렬) 반환
export function getUniversityDetail(univId) {
  const u = universities.find((x) => x.univId === univId);
  if (!u) return null;
  const rows = [...(ADMISSIONS_BY_UNIV.get(univId) || [])]; // 정렬하므로 복사본

  // 검정고시 가능 → 조건부 → 불가 순, 같은 등급이면 유리한 전형 순
  const ELIG_RANK = { 가능: 0, 조건부: 1, 불가: 2 };
  rows.sort((a, b) => {
    const e = (ELIG_RANK[a.gedEligible] ?? 3) - (ELIG_RANK[b.gedEligible] ?? 3);
    if (e) return e;
    return (TYPE_RANK[b.admissionType] || 0) - (TYPE_RANK[a.admissionType] || 0);
  });

  const eligible = rows.filter((r) => r.gedEligible === '가능' || r.gedEligible === '조건부');
  return {
    univ: u,
    rows,
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
    const rows = ADMISSIONS_BY_UNIV.get(u.univId) || [];
    const eligible = rows.filter((r) => r.gedEligible === '가능' || r.gedEligible === '조건부');
    // 가장 유리한 전형 1개 (가능 우선 > 유형 우선)
    const sorted = [...eligible].sort(byGedThenType);
    const best = sorted[0] || null;

    const comp = comparative[u.univId] || null;
    const comparativeType = comparativeTypeOf(comp);
    const cut = cutlines[u.univId] || null;

    out.push({
      univId: u.univId,
      name: u.name,
      region: u.region,
      kind: u.kind || '대학교',
      establishment: u.establishment || '',
      eligibleCount: eligible.length,
      hasAny: rows.length > 0,
      comparativeType,
      hasCutline: hasSusiCutline(cut),
      // 데이터 충실도 점수(둘러보기 정렬용): 합격선·환산표·전형수
      dataScore:
        (hasSusiCutline(cut) ? 3 : 0) +
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
    comparativeType,
    reflection: best.gedReflection || '',
    csat: csatHint(best.csatMinimum),
    interview: !!best.interview,
    next: nextAction(best.admissionType, best.interview),
    eligibleCount: rows.length,
    confirmed: isConfirmedStatus(best.status),
    baseline,                            // 대교협 기본사항 템플릿 행인지
    hasCutline: hasSusiCutline(cutlines[u.univId] || null),
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

  for (const u of universities) {
    if (!regionMatches(u.region, region)) continue;

    const allRows = (ADMISSIONS_BY_UNIV.get(u.univId) || []).filter(
      (r) => r.gedEligible === '가능' || r.gedEligible === '조건부'
    );
    if (allRows.length === 0) continue;

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

export function getEssayList(profile = {}) {
  const { region, csatGrades } = profile;

  const results = [];
  for (const u of universities) {
    if (!regionMatches(u.region, region)) continue;
    const rows = (ADMISSIONS_BY_UNIV.get(u.univId) || []).filter(
      (r) => r.admissionType === '논술' && (r.gedEligible === '가능' || r.gedEligible === '조건부')
    );
    if (rows.length === 0) continue;

    for (const adm of rows) {
      const cat = essayCategory(adm);
      const csatStatus = checkCsatMinimum(adm.csatMinimum, csatGrades);
      results.push({
        univId: u.univId,
        name: u.name,
        region: u.region,
        kind: u.kind || '대학교',
        admissionName: adm.admissionName,
        evalMethod: adm.evalMethod || '',
        csatMinimum: adm.csatMinimum || '',
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
