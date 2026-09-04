// 마스터(universities.json)에는 있지만 화면에 내보내지 않는 대학
//
// universities.json은 어디가(adiga.kr) 마스터를 그대로 옮긴 것이라 직접 고치지 않는다.
// 대신 여기서 제외 사유와 함께 관리한다. 원본을 남겨야 나중에 "왜 이 대학이 없지?"를
// 추적할 수 있고, 판단이 틀렸을 때 되돌리기도 쉽다.
//
// 공통 근거
//   대학알리미(academyinfo.go.kr)는 고등교육법상 정규 4년제 대학을 전수 공시한다.
//   아래 대학은 2024·2025·2026 3개 연도 신입생 현황 공시에 한 번도 등장하지 않는다.
//   조사 전문: data-pipeline/v2/out/master_fix_proposal.md (2026-09-03)

// ── 대학이 아니거나 이미 없어진 곳 ─────────────────────────────────────
// 검색·목록·지도 어디에도 나오지 않는다.
export const NOT_A_UNIVERSITY = {
  uA0000639: {
    name: 'KCUE대학교',
    reason: '대학이 아니라 한국대학교육협의회(어디가 운영기관) 자체다. 직접 조회하면 여러 대학 학과가 뒤섞인 수치 0의 테스트 데이터가 나온다.',
  },
  uA0002698: {
    name: 'KDB금융대학교',
    reason: '한국산업은행 사내대학. 2018학년도 이후 신입생 모집을 중단했다.',
  },
  uA0002749: {
    name: '가야대학교(고령)',
    reason: '2004년 모집 중단, 2012년 학과 전원 김해캠퍼스로 이전 완료. 가야대학교는 김해(본교)만 실재한다.',
  },
};

// ── 실재하지만 일반 대입 대상이 아닌 곳 ───────────────────────────────
// 평생교육법상 사내대학이라 소속 임직원만 지원할 수 있다.
// 검정고시생이 원서를 낼 수 없으므로 추천·검색 목록에서 뺀다.
// 다만 실재하는 교육기관이므로 정보를 아예 지우지는 않는다.
export const CORPORATE_UNIVERSITY = {
  uA0000288: { name: '정석대학', restrictedTo: '한진그룹 임직원' },
  uA0000289: { name: '삼성전자공과대학교', restrictedTo: '삼성전자 임직원' },
  uA0002699: { name: 'LH토지주택대학교', restrictedTo: '한국토지주택공사 임직원 및 협력업체 직원' },
};

// 화면에 내보내지 않을 univId 전체
export const EXCLUDED_UNIV_IDS = new Set([
  ...Object.keys(NOT_A_UNIVERSITY),
  ...Object.keys(CORPORATE_UNIVERSITY),
]);

/** 이 대학을 일반 대입 목록에 넣어도 되는가 */
export function isGeneralAdmission(univId) {
  return !EXCLUDED_UNIV_IDS.has(univId);
}

/** 제외 사유(없으면 null) — 화면에서 안내가 필요할 때 쓴다 */
export function exclusionOf(univId) {
  if (NOT_A_UNIVERSITY[univId]) {
    return { kind: 'not_a_university', ...NOT_A_UNIVERSITY[univId] };
  }
  if (CORPORATE_UNIVERSITY[univId]) {
    const it = CORPORATE_UNIVERSITY[univId];
    return {
      kind: 'corporate',
      ...it,
      reason: `평생교육법상 사내대학이라 ${it.restrictedTo}만 지원할 수 있어요.`,
    };
  }
  return null;
}
