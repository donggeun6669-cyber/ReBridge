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

// 대입(수시 기준) 주요 일정 — 예년 패턴 기준 근삿값.
// ⚠️ 연도별 확정 일정은 한국대학교육협의회·한국교육과정평가원 공고로 확인할 것.
export const ADMISSION = {
  target: [8, 1], // 비교내신 확인·목표 좁히기 (원서 전 준비)
  susiApply: [9, 9], // 수시 원서 접수
  csat: [11, 19], // 수능
  interview: [11, 29], // 면접·논술(수능 이후 흔함)
  susiResult: [12, 13], // 수시 합격 발표·등록
  jeongsiApply: [12, 31], // 정시 원서 접수
};
