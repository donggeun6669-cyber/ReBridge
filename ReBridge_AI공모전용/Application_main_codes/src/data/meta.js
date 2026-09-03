// 학년도(연도) 단일 소스 — single source of truth
//
// 화면마다 "2025", "2028", "2026" 같은 연도가 하드코딩돼 있어서
// 해가 바뀔 때 일부만 고쳐지고 서로 어긋나는 문제가 있었다.
// 연도가 들어가는 안내 문구는 전부 이 파일에서 읽는다.
//
// ⚠️ 여기 값을 바꾸면 앱 전체 안내가 같이 바뀐다. 근거 없이 올리지 말 것.
// ⚠️ "작년"이라는 상대 표현은 쓰지 않는다. 항상 "2025학년도"처럼 학년도를 밝힌다.

// 지금 원서를 쓰는 학년도(= 현재 입시 시즌).
// 2026년 9월에 접수하는 수시는 2027학년도 입시다.
export const TARGET_ADMISSION_YEAR = 2027;

// 앱이 들고 있는 admissions.json이 기반한 「대학입학전형 시행계획」 학년도.
// 지원 학년도(TARGET_ADMISSION_YEAR)와 다르므로 화면에서 반드시 구분해 안내한다.
export const PLAN_YEAR = 2028;

// 합격선 데이터(cutlines_2025.json)의 학년도와 내신 등급 체계.
export const CUTLINE_YEAR = 2025;
export const CUTLINE_GRADE_SCALE = 9;

// 고교 내신 5등급제가 적용되는 첫 대입 학년도.
// 즉 2027학년도 지원자까지는 9등급제, 2028학년도 입학부터 5등급제.
export const FIVE_GRADE_FROM = 2028;

// ── 파생 문구 ─────────────────────────────────────────────
// 합격선 블록 제목
export const CUTLINE_LABEL = `${CUTLINE_YEAR}학년도 합격선`;

// 합격선 자료가 없을 때
export const CUTLINE_NO_DATA_LABEL = `${CUTLINE_YEAR}학년도 합격선 자료가 없어요`;
export const CUTLINE_NO_DATA_SHORT = `${CUTLINE_YEAR}학년도 합격선 자료 없음`;

// 등급제 전환 고지 — 대상 학년도를 구분해서 말한다.
// (2027학년도 지원자는 아직 9등급제라 "이 합격선은 못 쓴다"고 말하면 틀린다.)
export const CUTLINE_SCALE_NOTICE =
  `이 합격선은 ${CUTLINE_YEAR}학년도(${CUTLINE_GRADE_SCALE}등급제) 결과예요. ` +
  `${FIVE_GRADE_FROM}학년도 입학부터 내신 5등급제로 바뀌므로 ` +
  `${FIVE_GRADE_FROM}학년도 지원자는 참고만 하세요.`;

// 전형 정보의 근거 학년도 고지 — 시행계획 학년도 ≠ 지원 학년도.
export const PLAN_BASIS_NOTICE =
  `전형 정보는 ${PLAN_YEAR}학년도 시행계획 기준이며, ` +
  `${TARGET_ADMISSION_YEAR}학년도 모집요강과 다를 수 있어요. ` +
  `반드시 입학처 모집요강을 확인하세요.`;

// 대학별 공식 환산표가 없어 표준 추정표를 쓴 경우.
export const STANDARD_CONVERSION_NOTICE =
  '대학 공식 환산표가 없어 표준 추정표로 계산한 참고값이에요.';

// 부족 점수 안내(로드맵)
export const CUTLINE_GAP_NOTE =
  `부족 점수는 ${CUTLINE_YEAR}학년도 합격선 기준 추정이에요 · 참고용.`;

// 이용약관 제3조에 들어가는 등급제 비교 한계 문구
export const POLICY_SCALE_CLAUSE =
  `${CUTLINE_YEAR}학년도 입시 결과는 ${CUTLINE_GRADE_SCALE}등급제 기준이고 ` +
  `${FIVE_GRADE_FROM}학년도 전형부터는 5등급제로 바뀌기 때문에, 두 값을 그대로 비교할 수 없어요. ` +
  `서비스는 이 한계를 화면에 표시해요.`;

// 대체서식 규격표의 기준 학년도
export const FORMS_BASIS_LABEL = `대학별 대체서식 규격 (${CUTLINE_YEAR}학년도 기준)`;

// ── 현재 날짜 기준 값 ─────────────────────────────────────
// "당해 연도 2회차" 경고처럼 달력 연도가 필요한 곳에 쓴다.
export function currentYear(today = new Date()) {
  return today.getFullYear();
}

// 검정고시 합격 연도 선택 목록 — 현재 연도 기준으로 만든다.
// 반환: [{ value, label }] — value는 저장값(기존 프로필과 호환되게 문자열 연도).
export function examYearOptions(today = new Date(), recent = 4) {
  const y = currentYear(today);
  const list = [];
  for (let i = 0; i < recent; i += 1) {
    list.push({ value: String(y - i), label: `${y - i}년` });
  }
  list.push({ value: `${y - recent} 이전`, label: `${y - recent}년 이전` });
  return list;
}
