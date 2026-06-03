// 프로필 + 데이터(universities/admissions) → 맞춤 대학 추천
// 규칙 기반(AI 없음). baseline 데이터에서도 동작하고, 데이터가 채워질수록 정확해짐.
import universities from '../data/universities.json';
import admissions from '../data/admissions.json';
import cutlines from '../data/cutlines_2025.json';
import comparative from '../data/comparative_2028.json';
import { evaluateAdmission, admissionChance } from './scoreEngine.js';

const METRO = new Set(['서울', '경기', '인천']);

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

// 대학 상세: univId로 대학 정보 + 전형 목록(검정고시 관점 정렬) 반환
export function getUniversityDetail(univId) {
  const u = universities.find((x) => x.univId === univId);
  if (!u) return null;
  const rows = admissions.filter((r) => r.univId === univId);

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
  const rowsById = new Map();
  for (const r of admissions) {
    if (!rowsById.has(r.univId)) rowsById.set(r.univId, []);
    rowsById.get(r.univId).push(r);
  }

  const out = [];
  for (const u of universities) {
    const rows = rowsById.get(u.univId) || [];
    const eligible = rows.filter((r) => r.gedEligible === '가능' || r.gedEligible === '조건부');
    // 가장 유리한 전형 1개 (가능 우선 > 유형 우선)
    const sorted = [...eligible].sort((a, b) => {
      const e = (b.gedEligible === '가능') - (a.gedEligible === '가능');
      if (e) return e;
      return (TYPE_RANK[b.admissionType] || 0) - (TYPE_RANK[a.admissionType] || 0);
    });
    const best = sorted[0] || null;

    const comp = comparative[u.univId] || null;
    const comparativeType =
      comp?.comparativeGradeType === 'numeric_table'
        ? 'numeric'
        : comp
          ? 'prose'
          : 'none';
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
      hasCutline: !!cut,
      // 데이터 충실도 점수(둘러보기 정렬용): 합격선·환산표·전형수
      dataScore:
        (cut ? 3 : 0) +
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

export function analyzeProfile(profile = {}) {
  const { region, csatPlan } = profile;

  // univId → 대학 정보
  const byId = new Map(universities.map((u) => [u.univId, u]));
  // univId → 전형 행들
  const rowsById = new Map();
  for (const r of admissions) {
    if (!rowsById.has(r.univId)) rowsById.set(r.univId, []);
    rowsById.get(r.univId).push(r);
  }

  const results = [];

  for (const u of universities) {
    if (!regionMatches(u.region, region)) continue;

    let rows = rowsById.get(u.univId) || [];
    // 검정고시 지원 가능/조건부만
    rows = rows.filter((r) => r.gedEligible === '가능' || r.gedEligible === '조건부');
    // 수능 안 볼 거면 정시(수능위주) 제외
    if (csatPlan === '안 볼 거예요') {
      rows = rows.filter((r) => r.phase !== '정시' && r.admissionType !== '수능위주');
    }
    if (rows.length === 0) continue;

    // 가장 유리한 전형 1개 선택 (가능 우선 > 유형 우선)
    rows.sort((a, b) => {
      const elig = (b.gedEligible === '가능') - (a.gedEligible === '가능');
      if (elig) return elig;
      return (TYPE_RANK[b.admissionType] || 0) - (TYPE_RANK[a.admissionType] || 0);
    });
    const best = rows[0];

    // 합격 가능성(칸수) — 점수가 있고 합격선 자료가 있을 때만.
    const ev = evaluateAdmission(profile, {
      univId: u.univId,
      admissionType: best.admissionType,
      admissionName: best.admissionName,
      gedEligible: best.gedEligible,
    });
    const chance = ev.applicable ? admissionChance(ev) : null;
    const comp = comparative[u.univId] || null;
    const comparativeType = comp?.comparativeGradeType === 'numeric_table' ? 'numeric' : comp ? 'prose' : 'none';

    results.push({
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
      chance,
      _score:
        (TYPE_RANK[best.admissionType] || 0) * 10 +
        rows.length +
        (isConfirmedStatus(best.status) ? 2 : 0) +
        (best.gedEligible === '가능' ? 5 : 0),
    });
  }

  // 가능성순(칸수) 정렬 — 칸수가 있는 곳을 위로(높은 순), 자료 없는 곳은 _score로.
  results.sort((a, b) => {
    const la = a.chance ? a.chance.level : 0;
    const lb = b.chance ? b.chance.level : 0;
    if (lb !== la) return lb - la;
    return b._score - a._score || a.name.localeCompare(b.name);
  });
  const top = results.slice(0, 30);

  return {
    total: results.length,
    shown: top.length,
    note: guideNote(csatPlan),
    results: top,
  };
}
