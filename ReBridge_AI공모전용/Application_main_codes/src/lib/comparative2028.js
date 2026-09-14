import comparative2028 from '../data/comparative_2028.json';

// ── 2028학년도 비교내신(5등급제 전환) 조회 ──────────────────────────────
//
// 왜 따로 두나
//   2028학년도 입학부터 고교 내신이 9등급제 → 5등급제로 바뀐다.
//   대학 시행계획을 보면 상당수가 환산표를 '두 벌' 둔다.
//     · 5등급 체계 — 2028년 이후 졸업(예정)자
//     · 9등급 체계 — 2027년 이전 졸업자
//   검정고시 출신자에게 어느 쪽을 적용하는지는 대학마다 다르고,
//   시행계획에 아예 안 적힌 곳도 많다. 그래서 이 파일은 '판정'하지 않는다.
//   무엇이 적혀 있고 무엇이 안 적혀 있는지만 있는 그대로 돌려준다.
//
// ⚠️ 여기서 나온 값으로 합격 가능성(칸수)을 계산하지 말 것.
//    앱의 합격선은 2026학년도(9등급) 입결이라 5등급 등급과 견줄 수 있는 자가 아니다.
//    두 값을 빼는 순간 근거 없는 숫자가 된다. scoreEngine은 2027 자료만 쓴다.

export function getComparative2028(univId) {
  return comparative2028[univId] || null;
}

/**
 * 그 대학 2028 시행계획이 등급 체계에 대해 무엇을 말하고 있는지.
 * @returns {null | {
 *   source: string|null,          // 시행계획 출처(파일·쪽)
 *   raw: string|null,             // 추출한 원문 그대로
 *   mentionsFive: boolean,        // 5등급 체계를 언급하는가
 *   mentionsNine: boolean,        // 9등급 체계를 언급하는가
 *   table: Array|null,            // 검정고시 평균 → 등급 표(파싱된 것만)
 *   tableScale: 5|9|null,         // 그 표가 몇 등급제인가
 *   mentionsGed: boolean,         // 검정고시를 언급하는가
 * }}
 */
export function scale2028(univId) {
  const v = getComparative2028(univId);
  if (!v) return null;

  const raw = v.comparativeGrade || null;
  const table = v.conversion?.gradeTable?.length ? v.conversion.gradeTable : null;
  // 표의 최대 등급으로 체계를 가른다 — 5등급표는 등급이 5를 넘지 않는다.
  let tableScale = null;
  if (table) {
    const max = Math.max(...table.map((r) => Number(r.grade) || 0));
    tableScale = max > 5 ? 9 : 5;
  }

  return {
    source: v.source || null,
    raw,
    mentionsFive: !!raw && raw.includes('5등급'),
    mentionsNine: !!raw && raw.includes('9등급'),
    table,
    tableScale,
    mentionsGed: !!raw && raw.includes('검정고시'),
  };
}
