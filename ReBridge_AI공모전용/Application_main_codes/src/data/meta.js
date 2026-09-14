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

// 「검정고시로 지원할 수 있는가」를 판단하는 1차 데이터의 학년도.
// 대교협이 해마다 내는 검정고시 출신자 지원 가능 전형 자료 기준이며,
// 지금 원서를 쓰는 학년도(TARGET_ADMISSION_YEAR)와 같다.
// 이 자료가 없는 대학만 PLAN_YEAR(2028) 시행계획으로 폴백한다.
export const ADMISSION_DATA_YEAR = 2027;

// 2027 자료가 있는 대학 수 / 전체 대학 수 (src/data/admissions_2027.min.json 기준).
// "왜 우리 학교는 2027 자료가 없지?"를 화면에서 정직하게 설명하려고 둔다.
export const ADMISSION_DATA_UNIV_COUNT = 195;

// 출처 라벨 — 2027 지원 가부 정보를 보여주는 화면에는 반드시 붙인다.
export const GED_2027_SOURCE_LABEL =
  '대교협 「2027학년도 검정고시 출신자 지원 가능 전형」';

// 합격선 데이터의 학년도와 내신 등급 체계.
// 판정 기준은 2026학년도 전형결과(대교협 어디가) — cutlines_2026.json.
// 2025학년도(cutlines_2025.json)는 '비교용'으로 함께 읽는다. 두 해를 평균내지는 않는다.
// 한 해만 보면 그 해의 우연에 휘둘리기 때문에, 두 해가 크게 다른 대학은 화면에서
// 둘 다 보여주고 알린다. 자세한 이유는 lib/scoreEngine.js 머리말 참조.
export const CUTLINE_YEAR = 2026;
export const CUTLINE_PREV_YEAR = 2025;
export const CUTLINE_GRADE_SCALE = 9;

// 합격선 출처 — 어디가는 학생부교과·학생부종합·수능위주 3갈래만 공개한다.
// 논술·실기 전형에 합격선이 없는 건 누락이 아니라 원천에 없는 것이다.
export const CUTLINE_SOURCE_LABEL = `대교협 어디가 ${CUTLINE_YEAR}학년도 전형결과`;

// 전문대는 자료를 낸 곳이 다르다 — 공공누리가 아니고 무단 복제·배포가 금지돼 있어
// 학과 단위 원본은 싣지 않고 대학×전형 집계값만 쓴다. 출처는 반드시 함께 밝힌다.
export const CUTLINE_SOURCE_LABEL_COLLEGE =
  `전문대교협 전문대학포털 ${CUTLINE_YEAR}학년도 전형결과`;
// 4년제·전문대가 한 목록에 섞여 나오는 화면(결과·둘러보기)에서 쓰는 합친 표기
export const CUTLINE_SOURCE_LABEL_ALL =
  `${CUTLINE_SOURCE_LABEL} · 전문대는 전문대교협 전문대학포털`;
export const CUTLINE_TYPE_COVERAGE = ['학생부교과', '학생부종합', '수능위주'];
export const CUTLINE_TYPE_NOTICE =
  `${CUTLINE_SOURCE_LABEL}는 학생부교과·학생부종합·수능위주 3개 유형만 공개해요. ` +
  '논술·실기 전형은 합격선 자료가 원래 없어요.';

// 고교 내신 5등급제가 적용되는 첫 대입 학년도.
// 즉 2027학년도 지원자까지는 9등급제, 2028학년도 입학부터 5등급제.
export const FIVE_GRADE_FROM = 2028;

// ── 5등급제 전환이 검정고시생에게 뜻하는 것 ────────────────────────────
// 2026-09 확인. 근거는 src/data/comparative_2028.json(대학 2028 시행계획 발췌)이다.
//
// 시행계획을 열어 보면 대학 상당수가 환산표를 '두 벌' 둔다.
//   · 5등급 체계 — 2028년 이후 졸업(예정)자
//   · 9등급 체계 — 2027년 이전 졸업자
// 검정고시 출신자에게 어느 쪽을 적용하는지 시행계획에 안 적은 대학이 더 많다.
//
// 그리고 공개된 5등급 표는 구간이 훨씬 좁다. 실제 값:
//   · 성공회대   검정고시 100점 → 2등급, 96.99점 이하는 전부 5등급
//   · 국립금오공대 90점 이상 → 3등급, 60점 미만은 등급 없음
//   · 상명대 5등급 환산점수 100/95/93/70/0 (9등급표는 100/98/96/94/90/80/60/40/0)
// 즉 만점을 받아도 1등급이 안 되고, 한 등급만 내려가도 손실이 9등급제보다 크다.
// 이건 '아마 그럴 것'이 아니라 대학이 낸 표에 그렇게 적혀 있는 것이다.
export const FIVE_GRADE_TITLE = `${FIVE_GRADE_FROM}학년도부터 내신 5등급제`;

// 실측값 — src/data/comparative_2028.json 기준(2028 시행계획 발췌 188개 대학).
//   '5등급' 언급 62곳, 그중 '9등급'도 함께 적은 곳 45곳.
// 다시 세려면: node -e "const a=require('./src/data/comparative_2028.json');
//   const t=o=>o.comparativeGrade||''; console.log(Object.values(a).filter(v=>t(v).includes('5등급')).length)"
export const FIVE_GRADE_PLAN_TOTAL = 188;
export const FIVE_GRADE_PLAN_FIVE = 62;
export const FIVE_GRADE_PLAN_BOTH = 45;

export const FIVE_GRADE_SUMMARY =
  `${FIVE_GRADE_FROM}학년도 입학부터 고교 내신이 9등급제에서 5등급제로 바뀌어요. ` +
  `${FIVE_GRADE_FROM}학년도 시행계획을 낸 ${FIVE_GRADE_PLAN_TOTAL}개 대학 중 ${FIVE_GRADE_PLAN_FIVE}곳이 ` +
  `5등급 체계를 적었고, 그중 ${FIVE_GRADE_PLAN_BOTH}곳은 9등급 표를 함께 둬요` +
  `(보통 5등급은 ${FIVE_GRADE_FROM}년 이후 졸업자, 9등급은 ${FIVE_GRADE_FROM - 1}년 이전 졸업자).`;

// 5등급 표가 왜 검정고시생에게 불리하게 작동하는지 — 전부 대학이 낸 표에 적힌 값이다.
export const FIVE_GRADE_HARSH =
  '공개된 5등급 표는 구간이 훨씬 좁아요. 검정고시 100점을 1등급이 아니라 2등급으로 보는 대학(성공회대), ' +
  '90점 이상을 3등급으로 보는 대학(국립금오공대)이 있어요. ' +
  '등급 하나 차이로 잃는 점수도 9등급제보다 커요.';

export const FIVE_GRADE_UNKNOWN =
  '검정고시 출신자에게 5등급 표와 9등급 표 중 어느 쪽을 적용하는지 ' +
  '시행계획에 적지 않은 대학이 더 많아요. 이건 입학처에 직접 물어봐야 알 수 있어요.';

// ⚠️ 앱은 지원 학년도를 묻지 않는다. 그래서 "2028 지원은 계산 안 한다"고 쓰면 거짓말이 된다.
//    사실 그대로 — 칸수의 기준이 무엇인지 밝히고, 2028 지원자는 쓸 수 없다고 말한다.
export const FIVE_GRADE_NO_CHANCE =
  `앱의 칸수(합격 가능성)는 ${CUTLINE_YEAR}학년도 9등급제 입결과 ` +
  `${TARGET_ADMISSION_YEAR}학년도 환산표로 계산한 값이에요. ` +
  `${FIVE_GRADE_FROM}학년도에 지원한다면 이 칸수를 그대로 쓰면 안 돼요.`;

// ── 파생 문구 ─────────────────────────────────────────────
// 합격선 블록 제목
export const CUTLINE_LABEL = `${CUTLINE_YEAR}학년도 합격선`;

// 합격선 자료가 없을 때 — 두 해 모두 없다는 뜻이다.
export const CUTLINE_NO_DATA_LABEL =
  `${CUTLINE_PREV_YEAR}·${CUTLINE_YEAR}학년도 합격선 자료가 없어요`;
export const CUTLINE_NO_DATA_SHORT = `${CUTLINE_YEAR}학년도 합격선 자료 없음`;

// ── 두 학년도 합격선 ──────────────────────────────────────
// 최신 연도에 값이 없어 이전 연도로 내려간 경우 (연도를 감추지 않는다)
export const cutlineFallbackNotice = (year) =>
  `${CUTLINE_YEAR}학년도 자료가 없어 ${year}학년도 합격선을 보여드려요. 한 해 전 결과라 지금과 다를 수 있어요.`;

// 두 해가 크게 다를 때 — 한 해만 믿으면 안 된다고 알린다.
// 비교할 수 없는 자료(집계 학과 수가 너무 다름)면 차이를 '변동'이라고 말하지 않는다.
export const cutlineVolatilityNotice = (v) => {
  if (!v || v.level === 'low') return null;
  if (v.level === 'incomparable') {
    return `${CUTLINE_PREV_YEAR}학년도 자료도 있지만, 두 해가 집계한 학과 수가 달라 ` +
      `(${v.prevN}개 → ${v.recentN}개) 곧바로 견주기는 어려워요. ` +
      `${CUTLINE_YEAR}학년도 기준으로 보고 있어요.`;
  }
  const 강 = v.level === 'high' ? '많이' : '꽤';
  const 방향 = v.harder === 'recent'
    ? `${CUTLINE_YEAR}학년도가 더 높은 성적을 요구했어요`
    : v.harder === 'prev'
      ? `${CUTLINE_PREV_YEAR}학년도가 더 높은 성적을 요구했어요`
      : '두 해가 비슷했어요';
  return `이 전형은 합격선이 해마다 ${강} 달라져요. ` +
    `${CUTLINE_PREV_YEAR}학년도 ${v.prevGrade}등급 → ${CUTLINE_YEAR}학년도 ${v.recentGrade}등급 ` +
    `(차이 ${v.gradeDiff}등급, ${방향}). 한 해 결과만 믿지 말고 여유를 두세요.`;
};

// 두 해 비교 블록 제목
export const CUTLINE_COMPARE_LABEL = `${CUTLINE_PREV_YEAR}·${CUTLINE_YEAR}학년도 합격선 비교`;

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

// ── 2027 / 2028 구분 안내 ────────────────────────────────
// 두 학년도가 한 화면에 같이 나오므로, 무엇이 무엇인지 매번 밝힌다.
export const ADMISSION_2027_SECTION_TITLE = `${ADMISSION_DATA_YEAR}학년도 지원 가능 전형`;
export const PLAN_SECTION_TITLE = `${PLAN_YEAR}학년도 전형 구조(참고)`;

// 2027 섹션 하단 출처 문구
export const ADMISSION_2027_SOURCE_NOTICE =
  `출처: ${GED_2027_SOURCE_LABEL}. ` +
  '이 자료에 실렸다는 것 자체가 검정고시로 지원할 수 있다는 뜻이에요. ' +
  '세부 조건은 대학 모집요강에서 최종 확인하세요.';

// 두 학년도가 왜 같이 나오는지 설명하는 한 줄
export const YEAR_SPLIT_NOTICE =
  `지금 원서를 쓰는 건 ${TARGET_ADMISSION_YEAR}학년도예요. ` +
  `지원 가능 여부는 ${ADMISSION_DATA_YEAR}학년도 자료로, ` +
  `전형 방법·수능최저 같은 구조는 ${PLAN_YEAR}학년도 시행계획으로 안내해요.`;

// 2027 자료가 없는 대학에 붙이는 문구
export const NO_2027_DATA_LABEL = `${ADMISSION_DATA_YEAR}학년도 자료 없음`;
export const NO_2027_DATA_NOTICE =
  `${GED_2027_SOURCE_LABEL}에 이 대학은 실려 있지 않아요(${ADMISSION_DATA_UNIV_COUNT}개 대학만 수록). ` +
  `아래 내용은 ${PLAN_YEAR}학년도 시행계획 기준이에요.`;

// 수시/정시 구분이 원문이 아니라 전형유형에서 추정된 경우
export const PHASE_ESTIMATED_NOTICE = '수시/정시 구분은 전형유형으로 추정한 값이에요.';

// 정원외 특별전형(농어촌·기초생활수급자 등) — 일반 학생 대상이 아니다
export const QUOTA_OUTSIDE_TITLE = '정원외 특별전형';
export const QUOTA_OUTSIDE_NOTICE =
  '농어촌·기초생활수급자·특성화고 등 자격 요건이 따로 있는 전형이에요. ' +
  '해당되지 않으면 지원할 수 없어서 기본 목록에서는 빼 두었어요.';

// ── 원서 접수 마감 D-day ──────────────────────────────────
// applyCloseDate('2026-09-11') + applyCloseTime('18:00') → 남은 일수.
// 반환: null(자료 없음) | { days, past, label, dateLabel }
//   days  : 오늘부터 마감일까지 남은 날 수 (음수면 지났음)
//   label : 'D-8' | 'D-DAY' | '마감'
const CLOSE_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function applyDeadline(closeDate, closeTime = null, today = new Date()) {
  if (!closeDate) return null;
  const m = String(closeDate).match(CLOSE_DATE_RE);
  if (!m) return null;
  const close = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((close - base) / 86400000);
  const dateLabel =
    `${close.getMonth() + 1}월 ${close.getDate()}일` + (closeTime ? ` ${closeTime}` : '');
  return {
    days,
    past: days < 0,
    label: days < 0 ? '마감' : days === 0 ? 'D-DAY' : `D-${days}`,
    dateLabel,
  };
}

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
