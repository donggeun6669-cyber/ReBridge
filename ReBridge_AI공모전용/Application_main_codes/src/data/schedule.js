// 검정고시·대입 일정 상수
// 날짜는 [월, 일] 형식.
//
// ⚠️ 이 파일의 가장 중요한 규칙: **공고된 연도와 추정을 섞지 말 것.**
//    검정고시는 매년 시·도교육청이 따로 공고한다. 예년 패턴이 비슷하다고 해서
//    공고 전인 연도의 날짜를 확정처럼 보여주면 "추측 금지" 원칙을 어기는 것이다.
//    (2026-08-30 점검: 2026년 2회까지 끝난 시점에 앱이 "2027년 4월 4일"을
//     확정 날짜처럼 표시하고 있었다. 2027년 일정은 그때까지 공고 전이었다.)

// 고졸 검정고시: 연 2회.
// 아래 [월,일]은 **GED_CONFIRMED_YEARS에 있는 연도에만 확정값**이고,
// 그 외 연도에는 "예년엔 이맘때였다"는 참고용 패턴으로만 쓴다.
export const GED_SESSIONS = [
  { round: 1, label: '1회', apply: [2, 9],  exam: [4, 4],  result: [5, 8]  },
  { round: 2, label: '2회', apply: [6, 26], exam: [8, 11], result: [8, 28] },
];

// 공식 공고로 확인된 연도만 넣는다.
// 새 연도가 공고되면 (1) 위 GED_SESSIONS의 날짜를 그 해 값으로 교체하고
//                  (2) 여기에 연도를 추가한다.
// 출처: 국가평생교육진흥원 검정고시지원센터 / 거주지 시·도교육청 공고
export const GED_CONFIRMED_YEARS = [2026];

export function isGedYearConfirmed(year) {
  return GED_CONFIRMED_YEARS.includes(year);
}

// 공고 전 연도에 쓰는 '대략 언제쯤' 문구. 날짜를 찍지 않는다.
export const GED_TYPICAL_HINT = {
  1: { apply: '2월쯤', exam: '4월 초', result: '5월 초' },
  2: { apply: '6월쯤', exam: '8월 중순', result: '8월 말' },
};

// ─────────────────────────────────────────────────────────────
// 대입 일정
//
// 검정고시와 같은 규칙을 쓴다: **확정 연도와 추정을 섞지 않는다.**
// ADMISSION_CONFIRMED_YEARS에 있는 학년도만 확정 날짜·D-day를 보여주고,
// 그 밖의 학년도는 "예년 9월 초"처럼 근사 표기만 한다.
//
// ⚠️ 여기서 '학년도'는 입학 연도다. 원서를 내는 달력연도 + 1.
//    (2026년 9월 수시 원서 = 2027학년도)
// ─────────────────────────────────────────────────────────────

// 예년 패턴 기준 근삿값. offset은 '수시 원서를 내는 달력연도' 대비 몇 년 뒤인지.
export const ADMISSION_APPROX = {
  target:       { md: [8, 1],   offset: 0, hint: '예년 8월 초' },        // 앱이 정한 준비 단계(공식 일정 아님)
  susiApply:    { md: [9, 9],   offset: 0, hint: '예년 9월 초' },
  csat:         { md: [11, 19], offset: 0, hint: '예년 11월 셋째 주 목요일' },
  interview:    { md: [11, 29], offset: 0, hint: '예년 11월 말~12월 초' }, // 대학마다 달라 기본사항에 없음
  susiResult:   { md: [12, 13], offset: 0, hint: '예년 12월 중순' },
  jeongsiApply: { md: [1, 4],   offset: 1, hint: '예년 1월 초' },
};

// 공식 공고로 확인된 학년도만 넣는다. (검정고시의 GED_CONFIRMED_YEARS와 같은 방식)
export const ADMISSION_CONFIRMED_YEARS = [2027];

export function isAdmissionYearConfirmed(admissionYear) {
  return ADMISSION_CONFIRMED_YEARS.includes(admissionYear);
}

// 확정 일정 — 날짜는 'YYYY-MM-DD'. start/end가 있으면 기간, date면 하루.
//
// 출처: 한국대학교육협의회 「2027학년도 대학입학전형기본사항」(2026-07 개정본).
//       ※ 대교협 원문 PDF와 한 번 더 대조하고 갱신할 것.
// target·interview는 기본사항에 없는 항목이라 확정값을 두지 않고 근사 표기를 쓴다.
export const ADMISSION_CONFIRMED = {
  2027: {
    susiApply:       { start: '2026-09-07', end: '2026-09-11' }, // 수시 원서접수
    csat:            { date:  '2026-11-19' },                    // 수능
    csatResult:      { date:  '2026-12-11' },                    // 수능 성적 통지
    susiResult:      { end:   '2026-12-18' },                    // 수시 합격자 발표(마감)
    susiRegister:    { start: '2026-12-21', end: '2026-12-23' }, // 수시 등록
    jeongsiApply:    { start: '2027-01-04', end: '2027-01-07' }, // 정시 원서접수
    jeongsiResult:   { end:   '2027-02-05' },                    // 정시 합격자 발표(마감)
    jeongsiRegister: { start: '2027-02-10', end: '2027-02-12' }, // 정시 등록
    extraApply:      { start: '2027-02-19', end: '2027-02-26' }, // 추가모집
  },
};

// 'YYYY-MM-DD' → Date(자정)
function isoToDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * 대입 일정 한 건을 푼다.
 * @param susiYear 수시 원서를 내는 달력연도 (2026이면 2027학년도)
 * @param key      ADMISSION_APPROX / ADMISSION_CONFIRMED의 키
 * 반환: { date, confirmed, admissionYear, hint, range }
 *   confirmed=false면 date는 예년 패턴 추정이다 — D-day를 붙이지 말 것.
 */
export function admissionEvent(susiYear, key) {
  const admissionYear = susiYear + 1;
  const approx = ADMISSION_APPROX[key];
  const conf = isAdmissionYearConfirmed(admissionYear)
    ? ADMISSION_CONFIRMED[admissionYear]?.[key]
    : null;

  if (conf) {
    const iso = conf.start ?? conf.date ?? conf.end;
    return {
      date: isoToDate(iso),
      confirmed: true,
      admissionYear,
      hint: null,
      range: conf,
    };
  }

  const [m, d] = approx.md;
  return {
    date: new Date(susiYear + approx.offset, m - 1, d),
    confirmed: false,
    admissionYear,
    hint: approx.hint,
    range: null,
  };
}

// 하위호환 — 근사 [월,일]만 필요한 곳에서 쓰던 형태.
export const ADMISSION = Object.fromEntries(
  Object.entries(ADMISSION_APPROX).map(([k, v]) => [k, v.md])
);
