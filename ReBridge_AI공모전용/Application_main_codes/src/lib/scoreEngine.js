// 검정고시 점수 → 비교내신 환산(대학별 5케이스) → 합격선 비교(점수 우선, 등급 폴백)
// 규칙 기반(AI 없음). 대학별 conversion 데이터가 없으면 표준 추정표로 폴백.
// 입결(results)은 2026학년도(9등급제) 기준, 입시제도는 2028(5등급제)이므로 직접비교는 '참고용'.
//
// ⚠️ cutlines_2026.json 주의점 (2025 파일과 다른 3가지)
//   1) 최상위에 meta 키가 있다 — 대학을 순회할 때 반드시 건너뛴다.
//   2) 출처가 src.files/src.pages 가 아니라 src.csv / src.url / src.publisher / src.retrievedAt 다.
//   3) cutGradeAvg·cutScoreAvg 는 항상 null 이다. 어디가 원천에 '평균' 컷이 없어서 일부러 비웠다.
//      → 실제로 쓰이는 값은 cutGrade70 / cutScore70 이고 화면의 컷 종류 라벨은 항상 '70%컷'이다.
//        50%컷은 byType['50%컷'], 정시 백분위는 byType['백분위70%'] 에 있다.
//
// ⚠️ 합격선은 두 학년도를 함께 쓴다 — 다만 '섞지는' 않는다.
//   한 해 값만 보면 그 해의 우연(경쟁률·모집인원 변동)에 판정이 휘둘린다.
//   실제로 2025·2026이 모두 있는 142개(대학×전형) 조합을 비교해보면 차이 중앙값은
//   0.26등급으로 대체로 안정적이지만, 12%(17개)는 1등급 넘게 벌어지고 최대 3.69등급까지
//   차이가 난다. 1등급 차이는 합불을 가르는 크기다.
//   그래서
//     · 판정(칸수·verdict)의 기준은 항상 한 학년도다. 두 해를 평균내지 않는다.
//       평균을 내면 그 값이 어느 해 것도 아닌 숫자가 되어 출처를 댈 수 없다.
//     · 대신 두 해가 얼마나 다른지(volatility)를 함께 실어 보낸다.
//       변동이 크면 화면이 두 해를 나란히 보여주고 해마다 출렁인다고 알린다.
//     · 최신 연도에 값이 없고 이전 연도에만 있으면 그 값을 쓰되, cutlineYear를 그 연도로
//       바꿔 어느 해 자료인지 반드시 드러낸다. 연도를 감춘 폴백은 하지 않는다.
//   cutlines_2025.json은 2026과 달리 meta 키가 없고 출처가 src.files/src.pages 형식이다.
import cutlines4y from '../data/cutlines_2026.json';
import cutlines4yPrev from '../data/cutlines_2025.json';
import cutlinesCollege from '../data/cutlines_college_2026.json';
import cutlinesCollegePrev from '../data/cutlines_college_2025.json';
import gedFreshmen from '../data/ged_freshmen.json';
import { CUTLINE_YEAR, CUTLINE_PREV_YEAR } from '../data/meta.js';

// 4년제(대교협 어디가)와 전문대(전문대교협)는 원천도 컷 종류도 다르지만,
// univId가 겹치지 않아 한 대학은 언제나 한쪽에만 있다. 조회할 때 합쳐서 본다.
//   · 4년제  : cutGrade70 (70%컷). 원천에 평균이 없어 cutGradeAvg는 늘 null이다.
//   · 전문대 : cutGradeAvg (합격자 평균) + cutGradeLowest (합격자 최저).
//              70%컷·환산점수가 원천에 없어 그쪽은 늘 null이다.
// 화면은 cutGradeType('평균'/'70%컷')으로 무엇을 보고 있는지 구분해 말한다.
const cutlines = { ...cutlines4y, ...cutlinesCollege };
const cutlinesPrev = { ...cutlines4yPrev, ...cutlinesCollegePrev };
// meta는 두 파일이 각각 갖고 있어 합치면 뒤엣것으로 덮인다. 조회에서 meta는 늘 건너뛰므로
// 값 자체는 쓰이지 않지만, 출처를 물을 때를 대비해 원본을 따로 남겨 둔다.
export const CUTLINE_META_COLLEGE = cutlinesCollege.meta || null;
import comparative from '../data/comparative_2027.json';
import admissions2027 from '../data/admissions_2027.min.json';

// ── 합격선 하나가 몇 개 전형에 걸쳐 있나 ────────────────────────────────
//
// 2026-09 점검에서 나온 문제. 어디가 입결은 '대학 × 전형유형' 단위 집계다.
// 그래서 충남대 학생부종합 6개 전형이 전부 같은 합격선 3.39등급을 쓰고,
// 세종대는 성격이 전혀 다른 사이버국방 특별전형까지 같은 값(2.635)을 쓴다.
// 63개 조합이 3개 이상 전형에 걸쳐 있었다.
//
// 이건 자료를 더 잘 구해서 고칠 수 있는 게 아니라 원천의 해상도 문제다.
// 고칠 수 없으면 최소한 말은 해야 한다 — 화면이 "이 합격선은 N개 전형을 합친 값"이라고
// 밝힐 수 있도록, 그 대학·전형유형에 검정고시로 지원 가능한 수시 전형이 몇 개인지 센다.
//
// ⚠️ 이 수는 '합격선을 만든 전형 수'가 아니라 '그 합격선을 같이 쓰게 되는 전형 수'다.
//    문구를 쓸 때 두 가지를 섞지 말 것.
const _typeSpread = (() => {
  const m = new Map();
  for (const r of admissions2027) {
    if (r.gedEligible !== '가능' || r.phase !== '수시' || !r.admissionType) continue;
    const k = `${r.univId}|${r.admissionType}`;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
})();

export function cutlineSpread(univId, admissionType) {
  return _typeSpread.get(`${univId}|${admissionType}`) || 0;
}

// 검정고시(고졸) 핵심 과목
export const GED_SUBJECTS = ['국어', '수학', '영어', '사회', '과학', '한국사'];

// 선택 1과목(도덕·기술가정·체육·음악·미술 중 1)의 저장 키.
// ProfileScreen이 gedScores.elective 로 저장한다. 과목명이 사람마다 달라 키는 고정.
export const GED_ELECTIVE_KEY = 'elective';

// 검정고시 채점: 과목당 25문항, 1문항 = 4점 (100점 만점)
export const POINTS_PER_QUESTION = 4;

// ============================================================
// 표준 추정 환산표: 검정고시 평균 → 9등급제 추정등급
// (대학별 공식 환산표가 없을 때만 쓰는 폴백. 화면에서 '추정'으로 표시된다)
//
// 【산출 근거 — 2026-09-03】
// 옛 표([1,98] [2,94] [3,90] [4,86] …)는 출처 없는 임의값이었고,
// 실제로 공개된 대학 환산표보다 1~2등급 낙관적이었다(만점자에게 1등급).
// 아래 값은 "실제 공개된 표"에서만 계산한 중앙값이다.
//
// 표본: 9등급 스케일로 '검정고시 평균 → 등급'을 확정할 수 있는 대학 6곳
//   ① 직접 표(comparative_2027.json의 conversion.gradeTable, minAvg→grade)
//      - uA0000079 강서대   : 100→2, 95→3, 90→4, 85→5, 80→6, 75→7, 65→8
//      - uA0000209 호남신학대: 96→1, 92→2, 88→3, 84→4, 80→5, 76→6, 72→7, 66→8
//   ② 합성 표(comparative의 '평균→환산점수' × data-pipeline
//      out/plans_2028/conversion.jsonl 의 '등급→환산점수' 9등급 표를 역산)
//      - uA0000153 영남신학대: 96.01→1, 91.51→2, 87.01→3, 82.51→4, 78.01→5,
//                              73.51→6, 69.01→7, 64.51→8
//      - uA0000084 대구대    : 98→3, 88→5, 78→7   (만점도 3등급)
//      - uA0000181 추계예대  : 100→3, 90→5, 80→7.33
//      - uA0000010 금오공대  : 90→5, 75→6.3, 60→7.67
//   제외: uA0000132·uA0002660·uA0000021 등 5등급 스케일 표(2028 제도)는
//         9등급제 입결과 직접 비교할 수 없어 뺐다.
//         강원대는 등급↔점수 대응표가 없어 합성 불가.
//         conversion.jsonl 84개 표는 '등급→환산점수'뿐이라 평균→등급을 못 만든다
//         (오염 필터: minScore<10 · 비단조 제외). 그래서 위 6곳만 남았다.
//
// 계산: 등급 g마다 "g 이하를 받기 위한 최소 평균"을 대학별로 구하고 중앙값.
//   해당 등급을 아예 안 주는 대학은 '도달 불가(∞)'로 포함(빼면 표본이 편향돼
//   1·2등급이 실제보다 쉬워 보인다).
//   → 1등급 [∞ 96 ∞ ∞ ∞ 96.01] → 도달 불가
//     2등급 [100 92 ∞ ∞ ∞ 91.51] → 도달 불가
//     3등급 [95 88 100 ∞ 98 87.01] → 96.5
//     4등급 [90 84 100 ∞ 98 82.51] → 94
//     5등급 [85 80 90 90 88 78.01] → 86.5
//     6등급 [80 76 90 90 88 73.51] → 84
//     7등급 [75 72 90 75 78 69.01] → 75
//     8등급 [65 66 80 60 78 64.51] → 65.5
//
// ⚠ 표본 6곳뿐이다. 공개 표가 늘면 다시 계산할 것.
//    "추정표로는 1·2등급이 안 나온다"는 건 중앙값의 결론이지, 어떤 대학도
//    1등급을 안 준다는 뜻이 아니다(호남신학대·영남신학대는 준다).
// ============================================================
const GRADE_MIN_AVG = [
  [3, 96.5], [4, 94], [5, 86.5], [6, 84], [7, 75], [8, 65.5],
];

// 폴백표에서 가장 좋은(숫자가 작은) 등급 — 이보다 좋은 등급은 추정표로 못 준다
const BEST_FALLBACK_GRADE = GRADE_MIN_AVG[0][0];

// 평균점수 → 추정 등급(정수, 낮을수록 우수). 표시용.
export function estimateGrade(avg) {
  if (avg == null || Number.isNaN(avg)) return null;
  for (const [g, min] of GRADE_MIN_AVG) {
    if (avg >= min) return g;
  }
  return 9;
}

// 평균점수 → 추정 등급(소수). 같은 등급 구간 안에서도 위/아래를 구분하려고
// 구간 안을 선형 보간한다. 정수 myGrade와 소수 cutGrade를 비교할 때 쓴다.
export function estimateGradeExact(avg) {
  return _interpolateGrade(avg, _fallbackBands());
}

// 폴백표 → 보간용 구간 목록 [{lo, hi, grade, gradeAbove}]
function _fallbackBands() {
  const bands = [];
  for (let i = 0; i < GRADE_MIN_AVG.length; i++) {
    const [g, lo] = GRADE_MIN_AVG[i];
    const hi = i === 0 ? 100 : GRADE_MIN_AVG[i - 1][1];
    bands.push({ lo, hi, grade: g, gradeAbove: i === 0 ? null : GRADE_MIN_AVG[i - 1][0] });
  }
  const last = GRADE_MIN_AVG[GRADE_MIN_AVG.length - 1];
  bands.push({ lo: 0, hi: last[1], grade: 9, gradeAbove: last[0] });
  return bands;
}

// 구간표 안에서 소수 등급으로 보간.
// 구간 [lo, hi]의 등급이 g이고 바로 위 구간 등급이 gAbove면,
// avg가 lo→hi로 갈수록 g→gAbove로 선형 이동한다. 맨 위 구간은 g 고정.
function _interpolateGrade(avg, bands) {
  if (avg == null || Number.isNaN(avg) || !bands?.length) return null;
  const b = bands.find((x) => avg >= x.lo && avg <= x.hi) ||
    (avg > bands[0].hi ? bands[0] : bands[bands.length - 1]);
  if (!b || b.grade == null) return null;
  if (b.gradeAbove == null || b.hi <= b.lo) return b.grade;
  const f = Math.min(1, Math.max(0, (avg - b.lo) / (b.hi - b.lo)));
  const g = b.grade - f * (b.grade - b.gradeAbove);
  return Math.round(g * 100) / 100;
}

// 목표 등급을 받기 위한 최소 평균점수.
// cutGrade가 7.43이면 7등급 경계가 필요하다(8등급은 7.43보다 나쁘니 미달).
// → Math.floor. 옛 코드의 Math.ceil은 한 등급 아래 경계를 돌려줘 낙관적이었다.
export function gradeToMinAvg(grade) {
  if (grade == null) return null;
  const g = Math.floor(grade);
  const found = GRADE_MIN_AVG.find(([gg]) => gg === g);
  if (found) return found[1];
  if (g < BEST_FALLBACK_GRADE) return null; // 추정표로는 도달 불가
  return 0; // 표의 최하 등급보다 아래면 사실상 제한 없음
}

// 점수가 실제로 들어온 과목 키 목록 (필수 6과목 + 선택 1과목)
function _filledSubjectKeys(gedScores) {
  if (!gedScores || typeof gedScores !== 'object') return [];
  return [...GED_SUBJECTS, GED_ELECTIVE_KEY].filter((k) => {
    const v = gedScores[k];
    return v != null && v !== '' && !Number.isNaN(Number(v));
  });
}

// 프로필의 과목별 점수 → 평균(입력된 과목만)
// 고졸 검정고시 합격 기준은 '필수 6 + 선택 1 = 7과목 평균'이라, 선택과목 점수가
// 입력돼 있으면 평균에 포함한다. 없으면 필수 6과목 평균 그대로.
export function gedAverage(gedScores) {
  const keys = _filledSubjectKeys(gedScores);
  if (keys.length === 0) return null;
  const vals = keys.map((k) => Number(gedScores[k]));
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

// 입력된 과목 수 (선택과목 포함)
export function gedSubjectCount(gedScores) {
  return _filledSubjectKeys(gedScores).length;
}

// 합격선 파일의 최상위 meta 키 — 대학이 아니므로 조회·순회에서 항상 뺀다.
export const CUTLINE_META = cutlines4y.meta || null;

// (univId, admissionType) 합격선 조회 — 한 학년도만.
// 어디가는 학생부교과·학생부종합·수능위주 3갈래만 공개한다.
// 논술·실기 전형에 값이 없는 건 누락이 아니라 원천에 없는 것이다 → null이 정상.
export function getCutline(univId, admissionType, year = CUTLINE_YEAR) {
  if (!univId || univId === 'meta') return null;
  const src = year === CUTLINE_PREV_YEAR ? cutlinesPrev : cutlines;
  const u = src[univId];
  if (!u) return null;
  return u[admissionType] || null;
}

// 이 합격선 블록에 쓸 수 있는 값이 하나라도 있는가
function hasCutValue(cut) {
  return !!cut && (
    cut.cutGradeAvg != null || cut.cutGrade70 != null ||
    cut.cutScoreAvg != null || cut.cutScore70 != null
  );
}

// 두 해 차이를 어느 정도부터 '알려야 할 변동'으로 볼 것인가 (등급 절대차)
//   1등급은 합불을 가르는 크기라 high, 0.5는 칸수 하나가 흔들리는 크기라 medium.
export const CUTLINE_VOLATILITY_HIGH = 1.0;
export const CUTLINE_VOLATILITY_MEDIUM = 0.5;

// ⚠️ 변동을 말하기 전에 '두 해를 비교해도 되는 자료인가'부터 따진다.
//   두 해의 집계 학과 수(n)가 크게 다르면, 값의 차이는 합격선이 움직인 게 아니라
//   무엇을 집계했는지가 달라서 생긴 것이다. 실제로 걸러보면 이런 사례가 많다.
//     · 동아대 학생부종합 2025는 학과 1개(1.86등급), 2026은 135개(4.6등급)
//     · 건양대 학생부교과 2025는 학과 2개, 2026은 82개
//   이걸 "합격선이 2.7등급 올랐다"고 보여주면 사실이 아닌 말을 하는 것이다.
//   그래서 두 해 모두 학과 5개 이상이고, 적은 쪽이 많은 쪽의 1/3 이상일 때만 비교한다.
//   이 조건으로 148쌍 중 30쌍이 '비교 불가'로 빠지고, 남은 118쌍의 차이 중앙값은
//   0.20등급으로 안정적이며 1등급 이상 벌어지는 건 8쌍이다.
export const CUTLINE_COMPARE_MIN_N = 5;
export const CUTLINE_COMPARE_MIN_RATIO = 1 / 3;

/**
 * 두 학년도 합격선을 함께 조회한다.
 *
 * 판정에 쓸 한 해(primary)를 고르고, 나머지 해는 비교용으로 붙여서 돌려준다.
 * 두 해를 평균내지 않는다 — 어느 해 것도 아닌 숫자가 되어 출처를 댈 수 없기 때문이다.
 *
 * @returns {{
 *   cut: object|null,        판정에 쓸 합격선 (없으면 null)
 *   year: number|null,       그 합격선이 어느 학년도 것인가 — 화면에 반드시 표시할 것
 *   prev: object|null,       비교용 다른 학년도 합격선
 *   prevYear: number|null,
 *   isFallbackYear: boolean, 최신 연도가 없어 이전 연도를 쓴 경우 true
 *   volatility: null | {     두 해 등급 컷이 모두 있을 때만 계산된다
 *     level: 'high'|'medium'|'low',
 *     gradeDiff: number,     |최신 - 이전| (등급)
 *     harder: 'recent'|'prev'|'same',  어느 해가 더 높은 성적을 요구했나
 *     recentGrade: number, prevGrade: number,
 *   }
 * }}
 */
export function getCutlineWithHistory(univId, admissionType) {
  const recent = getCutline(univId, admissionType, CUTLINE_YEAR);
  const prev = getCutline(univId, admissionType, CUTLINE_PREV_YEAR);
  const hasRecent = hasCutValue(recent);
  const hasPrev = hasCutValue(prev);

  if (!hasRecent && !hasPrev) {
    return { cut: null, year: null, prev: null, prevYear: null, isFallbackYear: false, volatility: null };
  }

  // 최신 연도를 기준으로 삼는다. 없을 때만 이전 연도로 내려가되 연도를 바꿔 표시한다.
  const useRecent = hasRecent;
  const cut = useRecent ? recent : prev;
  const year = useRecent ? CUTLINE_YEAR : CUTLINE_PREV_YEAR;
  const other = useRecent ? (hasPrev ? prev : null) : null;
  const otherYear = other ? CUTLINE_PREV_YEAR : null;

  // 변동 판정은 등급 컷으로만 한다.
  // 점수 컷은 대학이 환산식을 바꾸면 스케일 자체가 달라져서 두 해를 빼는 게 무의미하다.
  let volatility = null;
  if (hasRecent && hasPrev) {
    const g1 = recent.cutGradeAvg ?? recent.cutGrade70 ?? null;
    const g0 = prev.cutGradeAvg ?? prev.cutGrade70 ?? null;
    if (g1 != null && g0 != null) {
      const n1 = recent.n ?? 0;
      const n0 = prev.n ?? 0;
      const enough = n1 >= CUTLINE_COMPARE_MIN_N && n0 >= CUTLINE_COMPARE_MIN_N;
      const balanced =
        Math.max(n1, n0) > 0 &&
        Math.min(n1, n0) / Math.max(n1, n0) >= CUTLINE_COMPARE_MIN_RATIO;
      const diff = Math.round(Math.abs(g1 - g0) * 100) / 100;
      const common = {
        gradeDiff: diff,
        // 등급은 숫자가 작을수록 높은 성적이다.
        harder: g1 < g0 ? 'recent' : g1 > g0 ? 'prev' : 'same',
        recentGrade: g1, prevGrade: g0,
        recentN: n1, prevN: n0,
      };
      volatility = (enough && balanced)
        ? {
            ...common,
            level: diff >= CUTLINE_VOLATILITY_HIGH ? 'high'
                 : diff >= CUTLINE_VOLATILITY_MEDIUM ? 'medium' : 'low',
            comparable: true,
          }
        : {
            // 두 해 값이 다 있어도 비교할 수 없는 경우다. 차이를 '변동'이라고 말하지 않는다.
            ...common,
            level: 'incomparable',
            comparable: false,
            reason: !enough ? 'sample_too_small' : 'sample_mismatch',
          };
    }
  }

  return { cut, year, prev: other, prevYear: otherYear, isFallbackYear: !useRecent, volatility };
}

// 합격선 값이 하나라도 있는 대학 목록(진단·커버리지 확인용)
// 두 해 중 한 곳에라도 있으면 포함한다.
export function cutlineUnivIds() {
  const ids = new Set(Object.keys(cutlines).filter((k) => k !== 'meta'));
  for (const k of Object.keys(cutlinesPrev)) if (k !== 'meta') ids.add(k);
  return [...ids];
}

// ── 검정고시 출신 신입생 통계 (대학알리미 공시) ────────────────────────
// "이 대학에 검정고시로 들어간 사람이 실제로 있나?"에 답하는 유일한 공식 자료다.
// 합격선과 달리 추정이 섞이지 않은 실측값이라, 자료가 있으면 그대로 보여준다.

/** univId의 검정고시 신입생 통계. 없으면 null. */
export function getGedFreshmen(univId) {
  if (!univId || univId === 'meta') return null;
  return gedFreshmen[univId] || null;
}

/** 전국 집계 — "전국 평균 대비 이 대학"을 말할 때 쓴다. */
export const GED_FRESHMEN_META = gedFreshmen.meta || null;

/**
 * 이 대학이 전국 평균보다 검정고시생을 많이 받는가.
 * @returns {null | { ratio, nationalRatio, times, level: 'high'|'mid'|'low', year, ged, total }}
 *   times = 전국 평균 대비 배수. level은 화면 강조용 구간.
 */
export function gedFreshmenStanding(univId) {
  const it = getGedFreshmen(univId);
  const latest = it?.latest;
  if (!latest || latest.ratio == null) return null;

  const nat = GED_FRESHMEN_META?.national?.byYear?.[String(latest.year)] ?? null;
  const nationalRatio = nat?.ratio ?? null;
  const times = nationalRatio ? Math.round((latest.ratio / nationalRatio) * 10) / 10 : null;

  return {
    year: latest.year,
    ged: latest.ged,
    total: latest.total,
    ratio: latest.ratio,
    nationalRatio,
    times,
    trend: it.trend || null,
    // 전국 평균의 1.5배 이상이면 검정고시생이 많이 가는 곳, 0.5배 미만이면 드문 곳.
    level: times == null ? null : times >= 1.5 ? 'high' : times < 0.5 ? 'low' : 'mid',
  };
}

// univId 대표 비교내신 환산 정보
export function getComparative(univId) {
  return comparative[univId] || null;
}

// ============================================================
// 대학별 비교내신 환산 — 5케이스 (gumjung.co.kr 방식)
//
// comparative_2027.json에 대학별 "conversion" 객체를 추가하면
// 대학 공식/표대로 정확한 비교내신을 계산함.
// 데이터 없는 대학은 표준 추정표(GRADE_MIN_AVG)로 자동 폴백.
//
// conversion 객체 스키마 (comparative_2027.json에 추가):
// {
//   "conversion": {
//     "type": "grade_table" | "score_table" | "score_formula" | "formula_complex" | "subject_weighted",
//     "maxScore": 900,        // 대학 환산점수 만점 (정규화용)
//     "minScore": 0,          // 대학 환산점수 최저 (정규화용)
//
//     // type=grade_table (Case 1,2: 등급표 직접 공개)
//     "gradeTable": [
//       { "minAvg": 99, "maxAvg": 100, "grade": 1, "score": 900 },
//       { "minAvg": 96, "maxAvg": 98.99, "grade": 2, "score": null }
//     ],
//
//     // type=score_table (Case 3: 환산점수표만 공개)
//     "scoreTable": [
//       { "minAvg": 99.01, "maxAvg": 100, "score": 900 }
//     ],
//     "gradeFromScore": { "maxScore": 900, "baseScore": 0 }, // 역산용 (선택)
//
//     // type=score_formula (Case 3: 산출식)
//     // score = maxScore - (grade-1)*gradeCoeff - offset + bonus
//     "scoreFormula": { "maxScore": 900, "gradeCoeff": 20, "offset": 60, "bonus": 0 },
//
//     // type=formula_complex (Case 4: 복잡 산출식)
//     // grade = Min(1 + ((max-score)/(max-base))×8, 9)  역산
//     "formulaParams": { "maxScore": 1000, "baseScore": 0 },
//
//     // type=subject_weighted (Case 5: 과목별 가중치)
//     "subjectWeights": { "국어": 2, "영어": 3, "수학": 3, "사회": 1, "과학": 1 },
//     "subjectScoreTable": [
//       { "minScore": 95, "maxScore": 100, "convertedScore": 4.0 }
//     ],
//     "subjectFormula": { "type": "linear_offset", "rate": 1, "coeff": 4, "offset": 63 }
//   }
// }
// ============================================================

export const CONV_TYPES = {
  GRADE_TABLE:      'grade_table',
  SCORE_TABLE:      'score_table',
  SCORE_FORMULA:    'score_formula',
  FORMULA_COMPLEX:  'formula_complex',
  SUBJECT_WEIGHTED: 'subject_weighted',
};

/**
 * 검정고시 점수 → 대학별 비교내신 등급 & 환산점수
 * @param {number|null} avg 전과목 평균
 * @param {object} gedScores 과목별 점수 { 국어, 수학, ... }
 * @param {object|null} comp comparative_2027.json 대학 항목
 * @returns {{ grade: number|null, gradeExact: number|null, score: number|null, method: string }}
 *   grade      = 표시용 등급(대학 표의 값 그대로 / 폴백표의 정수 등급)
 *   gradeExact = 구간 안을 선형 보간한 소수 등급(비교 계산용). 없으면 grade와 같다.
 */
export function applyComparativeConversion(avg, gedScores, comp) {
  if (avg == null) return { grade: null, gradeExact: null, score: null, method: 'no_score' };

  const conv = comp?.conversion;
  if (!conv?.type) {
    // 데이터 없음 → 표준 추정표
    return {
      grade: estimateGrade(avg),
      gradeExact: estimateGradeExact(avg),
      score: null,
      method: 'standard',
    };
  }

  switch (conv.type) {

    // Case 1, 2: 대학 발표 등급표 (등급 ± 환산점수)
    case CONV_TYPES.GRADE_TABLE: {
      if (!Array.isArray(conv.gradeTable)) break;

      // perSubject: 대학이 표를 '과목별 취득점수'에 적용하라고 쓴 경우.
      //   대학 계산 = 과목마다 등급을 매기고 그 등급들의 평균.
      //   평균 점수에 표를 한 번 적용하는 것과 결과가 다르다(구간 경계에 걸린 과목 때문).
      //   원문대로 과목별로 매기고 평균낸다. 과목 점수가 없으면 평균으로 폴백한다.
      if (conv.perSubject) {
        const keys = _filledSubjectKeys(gedScores);
        if (keys.length > 0) {
          const grades = [];
          for (const k of keys) {
            const v = Number(gedScores[k]);
            const r = conv.gradeTable.find(
              (t) => v >= (t.minAvg ?? -Infinity) && v <= (t.maxAvg ?? Infinity)
            );
            if (r?.grade != null) grades.push(Number(r.grade));
          }
          if (grades.length > 0) {
            const mean = grades.reduce((a, b) => a + b, 0) / grades.length;
            const g = Math.round(mean * 100) / 100;
            return { grade: g, gradeExact: g, score: null, method: 'grade_table' };
          }
        }
      }

      const row = conv.gradeTable.find(
        (r) => avg >= (r.minAvg ?? -Infinity) && avg <= (r.maxAvg ?? Infinity)
      );
      if (row) {
        return {
          grade: row.grade ?? null,
          // 합격선 cutGrade는 소수(예 5.042)인데 등급표 값은 정수라 그대로 빼면
          // 한 구간 통째로 같은 등급이 된다. 구간 안에서 보간해 gap을 정밀하게.
          gradeExact: _interpolateGrade(avg, _bandsFromGradeTable(conv.gradeTable)) ?? row.grade ?? null,
          score: row.score ?? null,
          method: 'grade_table',
        };
      }
      break;
    }

    // Case 3a: 환산점수표만 공개 → 점수 조회 후 등급 역산
    case CONV_TYPES.SCORE_TABLE: {
      if (!Array.isArray(conv.scoreTable)) break;
      const row = conv.scoreTable.find(
        (r) => avg >= (r.minAvg ?? -Infinity) && avg <= (r.maxAvg ?? Infinity)
      );
      if (row) {
        const grade = conv.gradeFromScore
          ? _gradeFromInverseFormula(row.score, conv.gradeFromScore)
          : estimateGrade(avg);
        return { grade, gradeExact: grade, score: row.score, method: 'score_table' };
      }
      break;
    }

    // Case 3b: 점수 산출식 — score = maxScore - (grade-1)*coeff - offset + bonus
    case CONV_TYPES.SCORE_FORMULA: {
      if (!conv.scoreFormula) break;
      const grade = estimateGrade(avg);
      const f = conv.scoreFormula;
      const score = f.maxScore
        - (grade - 1) * (f.gradeCoeff ?? 0)
        - (f.offset ?? 0)
        + (f.bonus ?? 0);
      return {
        grade,
        gradeExact: estimateGradeExact(avg),
        score: Math.round(score * 10) / 10,
        method: 'score_formula',
      };
    }

    // Case 4: 복잡 산출식 — grade = Min(1+((max-score)/(max-base))×8, 9) 역산
    case CONV_TYPES.FORMULA_COMPLEX: {
      if (!conv.formulaParams) break;
      const { maxScore, baseScore } = conv.formulaParams;
      if (maxScore != null && baseScore != null) {
        const grade = estimateGrade(avg);
        // 역산: score = max - (grade-1)/8*(max-base)
        const score = maxScore - ((grade - 1) / 8) * (maxScore - baseScore);
        return {
          grade,
          gradeExact: estimateGradeExact(avg),
          score: Math.round(score * 10) / 10,
          method: 'formula_complex',
        };
      }
      break;
    }

    // Case 5: 과목별 환산점수 + 가중치
    case CONV_TYPES.SUBJECT_WEIGHTED: {
      if (!conv.subjectWeights || !conv.subjectScoreTable || !gedScores) break;
      let wSum = 0, wTotal = 0;
      for (const [subj, w] of Object.entries(conv.subjectWeights)) {
        const s = Number(gedScores[subj]);
        if (isNaN(s)) continue;
        const entry = conv.subjectScoreTable.find(
          (r) => s >= (r.minScore ?? -Infinity) && s <= (r.maxScore ?? Infinity)
        );
        if (entry) { wSum += entry.convertedScore * w; wTotal += w; }
      }
      if (wTotal > 0) {
        let score;
        const sf = conv.subjectFormula;
        if (sf?.type === 'linear_offset') {
          // 교과성적 = rate × [(wSum / 10) × coeff + offset] × 10
          score = (sf.rate ?? 1) * ((wSum / 10) * (sf.coeff ?? 4) + (sf.offset ?? 63)) * 10;
        } else {
          score = wSum / wTotal;
        }
        return {
          grade: estimateGrade(avg),
          gradeExact: estimateGradeExact(avg),
          score: Math.round(score * 10) / 10,
          method: 'subject_weighted',
        };
      }
      break;
    }

    default: break;
  }

  // 모든 케이스 실패 → 표준 추정
  return {
    grade: estimateGrade(avg),
    gradeExact: estimateGradeExact(avg),
    score: null,
    method: 'standard',
  };
}

// 대학 등급표(minAvg~maxAvg → grade) → 보간용 구간 목록.
// 위 구간(더 좋은 등급)이 무엇인지 알아야 보간 폭을 정할 수 있어 minAvg 내림차순 정렬.
function _bandsFromGradeTable(gradeTable) {
  const rows = gradeTable
    .filter((r) => r.grade != null && r.minAvg != null)
    .map((r) => ({ lo: r.minAvg, hi: r.maxAvg ?? 100, grade: r.grade }))
    .sort((a, b) => b.lo - a.lo);
  return rows.map((r, i) => ({ ...r, gradeAbove: i === 0 ? null : rows[i - 1].grade }));
}

// 점수 → 등급 역산 (score_table 케이스용)
// formula: { maxScore, baseScore }  → grade = 1 + ((max-score)/(max-base))×8
function _gradeFromInverseFormula(score, params) {
  const { maxScore, baseScore } = params;
  const raw = 1 + ((maxScore - score) / (maxScore - baseScore)) * 8;
  return Math.min(Math.max(Math.round(raw * 100) / 100, 1.0), 9.0);
}

// 합격 가능성 라벨 (gap<0 = 내가 더 우수)
// grade 기반: gap 단위 = 등급 (1등급 차이)
// score 기반: gap은 정규화된 등급-환산값 (아래 evaluateAdmission 참조)
// ⚠️ 아래 경계는 admissionChance의 CHANCE_BANDS와 반드시 같아야 한다.
//    한쪽만 고치면 같은 전형이 카드에서는 '적정', 상세에서는 '안정'으로 갈린다.
//    (2026-09 개정 근거는 CHANCE_BANDS 머리말에 적어 뒀다 — 합격선이 70%컷이라는 점,
//     그리고 검정고시생에게만 있는 비교과·서류 손실.)
function verdictFromGap(gap) {
  if (gap <= -1.2) return { key: 'safe',  label: '안정', tone: 'good' };
  if (gap <= -0.4) return { key: 'fit',   label: '적정', tone: 'ok'   };
  if (gap <=  0.2) return { key: 'reach', label: '소신', tone: 'warn' };
  // 예전엔 여기가 끝이라 gap이 아무리 벌어져도 '도전'이었다. 그래서 카드에는
  // 게이지가 '어려움'인데 같은 카드 설명문은 "도전 지원이에요"라고 적히는 모순이 있었다.
  if (gap <=  1.0) return { key: 'hard',  label: '도전', tone: 'hard'  };
  return             { key: 'far',   label: '어려움', tone: 'hard'  };
}

// 검정고시 친화도 (전형 성격 기준): A(매우 유리) ~ E / X(불가)
export function gedAffinity(row) {
  const elig = row?.gedEligible;
  const type = row?.admissionType;
  if (elig === '불가') return { grade: 'X', label: '지원 불가', tone: 'hard' };
  if (elig === '조건부') return { grade: 'C', label: '조건부 가능', tone: 'warn' };
  // 가능
  // ⚠️ 2026-09. 예전에는 학생부종합을 'A 검정고시에 유리'로 표시했다. 근거가 없었다.
  //    학종은 서류·면접 정성평가 비중이 크고, 검정고시생은 학교생활기록부 대신
  //    대체서식으로 평가받는다. 유리하다고 말할 자료가 우리에게 없다.
  //    '유리/불리'를 단정하지 말고 전형의 성격만 적는다.
  if (type === '학생부종합') return { grade: 'C', label: '서류·면접 비중 큼', tone: 'ok' };
  if (type === '논술') return { grade: 'B', label: '내신 비중 작음', tone: 'good' };
  if (type === '학생부교과') return { grade: 'B', label: '비교내신 적용', tone: 'ok' };
  if (type === '수능위주') return { grade: 'C', label: '수능 실력 필요', tone: 'ok' };
  return { grade: 'C', label: '지원 가능', tone: 'ok' };
}

// 검정고시 '적합도' — 합격 가능성(칸수)이 아니라, 검정고시생이 "지원하기 좋은 정도".
// 합격선 자료가 없어 칸수를 못 낼 때도 항상 줄 수 있는 비확률적 힌트(규칙 기반, 추측 없음).
// 근거: ① 전형 성격(학종/논술/교과/수능) ② 비교내신 환산표 공개 여부 ③ 수능최저 유무.
// comparativeType: 'numeric' | 'prose' | 'none'  (없으면 row의 comparativeGradeType로 판단)
export function gedFit(adm, comparativeType) {
  const type = adm?.admissionType;
  const reasons = [];

  // 조건부 자격: 대상 제한이 있으니 '확인'으로.
  if (adm?.gedEligible === '조건부') {
    reasons.push(
      adm?.gedIneligibleReason ||
        '지원 자격에 조건이 있어요(지역·소득·재직 등). 내가 대상인지 모집요강에서 꼭 확인하세요.'
    );
    return { level: 'check', label: '조건 확인', tone: 'warn', reasons };
  }
  if (adm?.gedEligible === '불가') {
    return { level: 'no', label: '지원 불가', tone: 'hard', reasons: ['검정고시로는 지원할 수 없는 전형이에요.'] };
  }

  // 비교내신 환산표 유무
  const ctype = comparativeType || (adm?.comparativeGradeType === 'numeric_table' ? 'numeric' : 'none');
  const hasTable = ctype === 'numeric';

  // 수능최저 해석
  const csat = adm?.csatMinimum || '';
  const noCsat = /없음|미적용|적용하지\s*않|해당\s*없/.test(csat);
  const csatUnknown = !csat || /확인|모집요강/.test(csat);

  let level = 'ok';
  if (type === '학생부종합') {
    // 2026-09 수정. 예전에는 무조건 'good'(지원 수월) + "학교를 안 다닌 점이 불리하게
    // 작용하지 않아요"라고 단정했다. 근거가 없는 안심이었고, 그 탓에 환산 기준조차
    // 공개 안 한 상위권 대학까지 '지원 수월'로 떴다.
    // 사실만 적는다: 학종은 서류·면접 정성평가이고, 검정고시생은 학교생활기록부 대신
    // 대체서식으로 평가받는다. 유불리를 단정하지 않는다.
    level = 'ok';
    reasons.push(
      '학생부종합은 내신 등급만이 아니라 서류·면접으로 함께 평가해요. ' +
      '검정고시생은 학교생활기록부 대신 대체서식을 내고, 평가 방식은 대학마다 달라요.'
    );
    if (!hasTable) {
      reasons.push('이 대학은 검정고시 비교내신 환산 기준을 공개하지 않았어요. 입학처에 문의해 확인하세요.');
    }
  } else if (type === '논술') {
    level = 'ok';
    reasons.push('논술 위주 전형이라 내신 비중이 작아요. 논술 실력으로 승부해볼 수 있어요.');
  } else if (type === '학생부교과') {
    reasons.push('학생부교과는 검정고시 점수를 내신 등급으로 "환산"해서 반영해요.');
    // 환산표가 없으면 내 점수가 몇 등급이 되는지 자체를 알 수 없다 — '수월'이라 할 수 없다.
    level = hasTable ? 'good' : 'check';
    if (!hasTable) {
      reasons.push('그런데 이 대학은 환산 기준을 공개하지 않았어요. 입학처 문의가 필요해요.');
    }
    // 2026-09. 교과 점수만 보면 안 된다. 모집요강 원문을 뒤져 보니 174개 대학 중 82곳이
    // 검정고시 출신자의 출결·봉사(비교과)를 따로 다루고 있었다. 방식은 제각각이다
    // (예: 부산대는 검정고시 평균 97점 이상이어야 출결 만점 10점, 90점이면 8점).
    // 우리는 그 값을 대학별로 갖고 있지 않으므로 계산에 넣지 않는다. 대신 있다고 알린다.
    reasons.push(
      '학생부교과는 교과 성적 말고 출결·봉사 같은 비교과 배점이 따로 있는 대학이 많아요. ' +
      '검정고시생은 학교생활기록부가 없어 대학이 정한 대체 기준으로 받는데 대학마다 달라서, ' +
      '앱의 칸수에는 이 부분이 들어가 있지 않아요. 모집요강에서 꼭 확인하세요.'
    );
  } else if (type === '수능위주') {
    level = 'check';
    reasons.push('수능 성적이 핵심인 전형이에요. 수능을 준비할 계획일 때 적합해요.');
  } else if (type === '실기/실적') {
    level = 'ok';
    reasons.push('실기·실적이 핵심인 전형이에요. 실기 준비가 가장 중요해요.');
  } else {
    reasons.push('검정고시로 지원할 수 있는 전형이에요.');
  }

  // 비교내신 환산표 안내(검정고시생에게 가장 중요한 정보)
  if (hasTable) {
    reasons.push('이 대학은 검정고시 점수 → 내신 환산표를 공개했어요. 내 점수가 어떻게 반영되는지 미리 확인할 수 있어요.');
  } else if (type === '학생부교과' || type === '학생부종합') {
    reasons.push('검정고시 환산 기준은 아직 공개 전이에요 — 모집요강이 나오면 확인해요.');
  }

  // 수능최저(수능위주 제외)
  if (type !== '수능위주') {
    if (noCsat) {
      // 수능최저가 없다는 건 '문턱이 하나 없다'는 뜻이지 '수월하다'는 뜻이 아니다.
      // 예전에는 이걸로 level을 good(지원 수월)까지 올렸다 — 과한 안심이라 걷어냈다.
      reasons.push('수능최저가 없어, 수능을 안 봐도 지원할 수 있어요.');
    } else if (!csatUnknown) {
      reasons.push('수능최저가 있어요 — 수능 일부 과목은 준비가 필요해요.');
    }
  }

  const label = level === 'good' ? '지원 수월' : '지원 가능';
  const tone = level === 'good' ? 'good' : 'ok';
  return { level, label, tone, reasons };
}

/**
 * 검정고시 점수로 특정 전형을 평가.
 * 비교 우선순위: ① 환산점수(대학별 공식) vs 점수 합격선 → ② 등급 vs 등급 합격선
 *
 * @param {object} profile - { gedScores: {국어:..., 수학:...}, gedAvg?, ... }
 * @param {object} adm - admissions 행 (univId, admissionType, admissionName, gedEligible ...)
 * @returns {object} 평가 결과
 */
export function evaluateAdmission(profile, adm) {
  const gedScores = profile?.gedScores;
  const avg = gedAverage(gedScores);
  const nSub = gedSubjectCount(gedScores);
  const affinity = gedAffinity(adm);
  const comp = getComparative(adm.univId);

  // ── 비교내신 환산 (대학별 공식 적용, 없으면 표준 추정) ──
  const conversion = applyComparativeConversion(avg, gedScores, comp);
  const myGrade = conversion.grade;   // 표시용 등급 (기존 필드명 유지)
  const myGradeExact = conversion.gradeExact ?? conversion.grade; // 비교 계산용 소수 등급
  const myScore = conversion.score;   // 환산점수 (대학별 공식 있을 때만)
  const conversionMethod = conversion.method; // 'grade_table'|'score_table'|...|'standard'
  // 파이프라인이 내보낸 표 중 '등급→환산점수'만 공식이고 '평균→등급' 구간은 앱 표준 추정을 붙인 것
  // (gradeBandSource === 'app_standard_estimate'). 등급 판정 자체는 추정이므로 화면에 '추정'으로 표시한다.
  const gradeBandEstimated = comp?.conversion?.gradeBandSource === 'app_standard_estimate';
  const conversionEstimated = conversionMethod === 'standard' || gradeBandEstimated;

  // 학생부종합은 서류·면접 정성평가라 등급만으로 결과가 정해지지 않는다.
  // 게다가 검정고시생은 학교생활기록부가 없어 '학생부 대체서식'으로 평가받는다.
  // 칸수를 내되(B) 화면이 이 한계를 반드시 같이 말하도록 판정에 실어 보낸다.
  const isHolistic = adm.admissionType === '학생부종합';

  const base = {
    avg,
    isHolistic,
    holisticNote: isHolistic
      ? '학생부종합은 서류·면접으로 함께 평가해요. 검정고시생은 학교생활기록부 대신 ' +
        '대체서식을 내기 때문에, 등급이 비슷해도 결과는 달라질 수 있어요.'
      : null,
    myGrade,
    myGradeExact,
    myScore,
    conversionMethod,
    gradeBandEstimated,
    conversionEstimated,
    scaleMismatch: false,
    affinity,
    comparative: comp,
    hasScore: avg != null,
  };

  // 정시 수능위주
  if (adm.admissionType === '수능위주' || adm.phase === '정시') {
    return {
      ...base,
      applicable: false,
      dataGap: 'csat',
      reason: '정시(수능위주)는 수능 성적 기준이라 검정고시 평균으로 직접 비교하긴 어려워요. 수능 모의고사로 위치를 확인해봐요.',
    };
  }

  // ── 환산 근거 등급 ──────────────────────────────────────────────────
  // 2026-09. 서연님·동근님 확인: 성균관대·서강대 같은 상위권이 '적정'으로 뜨던 원인이
  // 여기였다. 그 대학들은 검정고시 비교내신 환산표를 공개하지 않는데(comparative의
  // comparativeGradeType === 'prose'), 앱이 다른 대학 표의 중앙값으로 등급을
  // 지어내서 합격선과 비교하고 있었다. 대학이 안 밝힌 기준을 우리가 만든 셈이다.
  //
  //   A 계산 가능 : 대학 공식 환산표 + 학생부교과(정량) → 칸수를 낸다
  //   B 참고만    : 공식 환산표 + 학생부종합(정성평가) → 칸수는 내되 한계를 밝힌다
  //   C 계산 불가 : 환산표 미공개 → 칸수를 내지 않는다. 입학처 문의로 안내한다
  //
  // ⚠️ C에서 다시 칸수를 내지 말 것. 근거 없는 숫자가 학생의 지원 판단을 바꾼다.
  if (conversionMethod === 'standard') {
    return {
      ...base,
      applicable: false,
      dataGap: 'conversion',
      reason:
        '이 대학은 검정고시 점수를 몇 등급으로 볼지 공개하지 않았어요. ' +
        '기준이 없으면 합격 가능성을 계산할 수 없어서 칸수를 보여주지 않아요. ' +
        '입학처에 비교내신 환산 기준을 문의해 보세요.',
    };
  }

  // ── 자격이 따로 있는 전형 ──────────────────────────────────────────
  // 합격선을 붙일 수 없는 전형이다. 위 SPECIAL_ELIGIBILITY_RE 머리말 참고.
  if (hasSpecialEligibility(adm)) {
    return {
      ...base,
      applicable: false,
      dataGap: 'special',
      specialEligibility: true,
      reason:
        '이 전형은 지원자격이 따로 있어요(농어촌 거주·기초생활수급·재직 경력 등). ' +
        '해당되는지부터 모집요강에서 확인하세요. ' +
        '그리고 이런 전형은 따로 공개된 합격선 자료가 없어서, 일반전형 합격선으로 ' +
        '합격 가능성을 계산하면 틀린 숫자가 나와요. 그래서 칸수를 보여주지 않아요.',
    };
  }

  // 두 학년도를 함께 조회한다. 판정은 한 해 기준이고, 나머지 해는 화면에 같이 실어 보낸다.
  const hist = getCutlineWithHistory(adm.univId, adm.admissionType);
  const cut = hist.cut;
  const hasAnyCutline = hasCutValue(cut);
  // 화면이 "어느 해 자료인지" 항상 말할 수 있도록 판정 결과에 연도를 붙여 나간다.
  base.cutlineYear = hist.year;
  base.cutlineIsFallbackYear = hist.isFallbackYear;
  base.cutlinePrev = hist.prev;
  base.cutlinePrevYear = hist.prevYear;
  base.cutlineVolatility = hist.volatility;
  // 전문대 원천에만 있는 '합격자 최저 등급'. "이 등급까지도 붙었다"는 뜻이라
  // 평균보다 실제 지원 판단에 쓸모가 크다. 4년제에는 없어 null이다.
  base.cutGradeLowest = cut?.cutGradeLowest ?? null;
  // 이 합격선을 같이 쓰게 되는 전형 수 / 집계에 들어간 모집단위 수.
  // 둘 다 "이 숫자를 얼마나 믿어도 되나"를 화면이 말하게 하려고 싣는다.
  base.cutSpread = cutlineSpread(adm.univId, adm.admissionType);
  base.cutNarrow = cut?.n != null && cut.n <= 3;
  if (!hasAnyCutline) {
    return {
      ...base,
      applicable: false,
      dataGap: 'cutline',
      reason: `이 전형은 ${CUTLINE_PREV_YEAR}·${CUTLINE_YEAR}학년도 모두 공개된 합격선 자료가 없어요. 검정고시 입결을 따로 공개하지 않는 대학이 많아, 지금은 구하기 어려운 정보예요.`,
    };
  }

  // 합격선 — 점수 우선, 없으면 등급
  const cutScore = cut.cutScoreAvg ?? cut.cutScore70 ?? null;
  const cutGrade = cut.cutGradeAvg ?? cut.cutGrade70 ?? null;
  const cutScoreType = cut.cutScoreAvg != null ? '평균' : (cut.cutScore70 != null ? '70%컷' : null);
  const cutGradeType = cut.cutGradeAvg != null ? '평균' : (cut.cutGrade70 != null ? '70%컷' : null);

  if (avg == null) {
    return {
      ...base,
      applicable: true,
      cutGrade, cutScore, cutGradeType, cutScoreType,
      cutN: cut.n,
      cutConfidence: cut.confidence,
      reason: `검정고시 과목 점수를 입력하면 ${hist.year}학년도 합격선과 비교해드릴게요.`,
    };
  }

  // ── 비교 기준 선택 ──
  // 점수 비교: myScore(환산)와 cutScore(입결) 둘 다 있고, 두 값의 '자'가 같을 때만.
  //   대학 환산점수는 만점이 92점짜리도 있고 970점짜리도 있는데 입결 cutScore는
  //   대학·전형마다 스케일이 제각각이라, 그냥 빼면 말이 안 되는 숫자가 나온다.
  //   (실제 예: 금오공대 uA0000010 환산 만점 92 vs 학생부교과 cutScore70 870.17,
  //             대구대 uA0000084 환산 만점 92.5 vs cutScore70 899.62)
  //   → cutScore가 conversion의 [minScore, maxScore] 안일 때만 점수 비교를 쓰고,
  //     아니면 등급 비교로 폴백하고 scaleMismatch:true로 알린다. 데이터는 안 고친다.
  // 정규화: gap = -(myScore - cutScore) / pointsPerGrade
  //   pointsPerGrade = (conv.maxScore - conv.minScore) / 8
  let gap, comparisonBasis, ptsPerGrade = null, scaleMismatch = false;

  const maxS = comp?.conversion?.maxScore ?? null;
  const minS = comp?.conversion?.minScore ?? null;
  const scaleOk =
    maxS != null && minS != null && maxS > minS &&
    cutScore != null && cutScore >= minS && cutScore <= maxS;

  if (myScore != null && cutScore != null && scaleOk) {
    ptsPerGrade = (maxS - minS) / 8; // 1등급당 점수차 추정
    gap = Math.round((-(myScore - cutScore) / ptsPerGrade) * 100) / 100;
    comparisonBasis = 'score';
  } else if (myGradeExact != null && cutGrade != null) {
    if (myScore != null && cutScore != null) scaleMismatch = true; // 점수 비교를 포기한 경우
    gap = Math.round((myGradeExact - cutGrade) * 100) / 100;
    comparisonBasis = 'grade';
  } else {
    return {
      ...base,
      applicable: false,
      dataGap: 'cutline',
      scaleMismatch: myScore != null && cutScore != null,
      reason: '합격선 자료와 내 점수를 비교할 수 없어요.',
    };
  }

  const verdict = verdictFromGap(gap);

  // ── 부족 점수 / 문항수 ──
  // verdict와 같은 기준(gap)에서 뽑는다. gap이 0 이하가 되는 최소 평균을 역산하므로
  // "gap ≤ 0" 과 "shortPoints === 0" 이 항상 같은 뜻이 된다.
  // (옛 코드는 gap은 점수 기준인데 부족분은 등급 기준이라, 판정이 '소신'인데
  //  문구는 '충분해요'가 되는 모순이 생겼다. 문항수도 이제 비교 기준을 따라간다.)
  const neededAvg = _minAvgToCloseGap({
    gedScores, avg, comp, comparisonBasis, cutScore, cutGrade, ptsPerGrade,
  });
  const reachable = neededAvg != null;
  const shortPoints = reachable
    ? Math.max(0, Math.round((neededAvg - avg) * 100) / 100)
    : null;
  const perSubjectQuestions = shortPoints > 0 ? Math.ceil(shortPoints / POINTS_PER_QUESTION) : 0;
  const totalQuestions =
    shortPoints > 0 && nSub > 0
      ? Math.ceil((shortPoints * nSub) / POINTS_PER_QUESTION)
      : 0;

  return {
    ...base,
    applicable: true,
    cutGrade, cutScore,
    cutGradeType, cutScoreType,
    cutN: cut.n,
    cutConfidence: cut.confidence,
    gap,
    comparisonBasis,         // 'score' | 'grade' — 어떤 기준으로 비교했는지
    scaleMismatch,           // 점수 스케일이 안 맞아 등급으로 폴백했는지
    verdict,
    neededAvg,               // gap이 0이 되는 최소 검정고시 평균 (도달 불가면 null)
    reachable,               // 만점을 다 맞아도 합격선에 못 닿으면 false
    shortPoints,             // 0 = 합격선 안쪽 / null = 도달 불가
    perSubjectQuestions,
    totalQuestions,
    nSub,
  };
}

// 모든 과목을 똑같이 delta점씩 올렸다고 가정한 가상 점수표 (0~100 클램프)
function _shiftScores(gedScores, delta) {
  if (!gedScores) return gedScores;
  const out = {};
  for (const k of _filledSubjectKeys(gedScores)) {
    out[k] = Math.min(100, Math.max(0, Number(gedScores[k]) + delta));
  }
  return out;
}

// 평균이 candidate였다면 gap이 얼마였을지 (verdict와 완전히 같은 계산식)
function _gapAtAvg(candidate, ctx) {
  const { gedScores, avg, comp, comparisonBasis, cutScore, cutGrade, ptsPerGrade } = ctx;
  const cv = applyComparativeConversion(candidate, _shiftScores(gedScores, candidate - avg), comp);
  if (comparisonBasis === 'score') {
    if (cv.score == null || !ptsPerGrade) return Infinity;
    return -(cv.score - cutScore) / ptsPerGrade;
  }
  const g = cv.gradeExact ?? cv.grade;
  if (g == null) return Infinity;
  return g - cutGrade;
}

// gap ≤ 0 이 되는 최소 평균을 이분탐색으로 역산. 100점 만점으로도 안 되면 null.
// gap은 평균에 대해 단조 비증가라서 이분탐색이 성립한다.
function _minAvgToCloseGap(ctx) {
  if (_gapAtAvg(100, ctx) > 0) return null;   // 만점으로도 합격선 미달
  if (_gapAtAvg(0, ctx) <= 0) return 0;       // 사실상 제한 없음
  let lo = 0, hi = 100;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (_gapAtAvg(mid, ctx) <= 0) hi = mid; else lo = mid;
  }
  return Math.ceil(hi * 100) / 100;
}

// 짧은 안내 문구(담임 톤).
// ⚠ verdict와 문구는 반드시 같은 기준(gap)에서 나와야 한다.
//   shortPoints는 evaluateAdmission에서 gap을 역산해 만들었으므로
//   shortPoints === 0 ⟺ gap ≤ 0 이 보장된다. 판정이 '소신/도전'인데
//   문구가 '충분해요'가 되는 일은 이제 구조적으로 생기지 않는다.
export function coachLine(ev) {
  if (!ev) return '';
  if (!ev.applicable) return ev.reason || '';
  if (ev.avg == null) return ev.reason || '';

  const label = ev.verdict?.label || '';
  // 합격선 표기 — 점수 기준으로 비교했으면 환산점수로, 등급 기준이면 등급으로
  // 연도는 ev.cutlineYear — 최신 자료가 없어 이전 학년도를 쓴 전형이 있어서,
  // 고정 연도로 쓰면 다른 해 값을 다른 해 이름으로 말하게 된다.
  const cy = ev.cutlineYear ?? CUTLINE_YEAR;
  const cutText = ev.comparisonBasis === 'score' && ev.cutScore != null
    ? `${cy}학년도 합격선(환산 ${ev.cutScore}점)`
    : `${cy}학년도 합격선(약 ${ev.cutGrade}등급)`;

  // ① 만점을 받아도 못 닿는 경우
  // '어려움'은 뒤에 '지원이에요'를 붙이면 말이 안 된다('어려움 지원이에요').
  // 라벨을 문장에 넣을 때는 항상 이렇게 갈라 쓴다.
  const labelTail = label === '어려움' ? '지금은 어려운 지원이에요.' : `${label} 지원이에요.`;
  if (ev.reachable === false) {
    return `${cutText}은 검정고시 만점을 받아도 닿기 어려워요. ${labelTail}`;
  }

  // ② 합격선 안쪽 (gap ≤ 0)
  if (ev.shortPoints === 0) {
    if (ev.comparisonBasis === 'score' && ev.myScore != null && ev.cutScore != null) {
      const diff = Math.round((ev.myScore - ev.cutScore) * 10) / 10;
      return `내 환산점수(${ev.myScore}점)가 ${cutText}보다 ${diff}점 높아요. ${label} 지원!`;
    }
    return `지금 평균이면 ${cutText} 안쪽이에요. ${label} 지원!`;
  }

  // ③ 부족 — '적정'이어도 부족한 건 부족하다고 말한다
  const near = ev.verdict?.key === 'fit' ? ' 거의 닿았어요.' : '';
  return `${cutText}까지 평균 ${ev.shortPoints}점 정도 부족해요.` +
    ` 과목당 약 ${ev.perSubjectQuestions}문제 더 맞히면 닿아요.${near} (${label})`;
}

// ── 자격이 따로 있는 전형 판별 ────────────────────────────────────────
//
// 2026-09. 동근님 지적("가천대가 안정으로 뜨면 안 된다")의 실제 원인 중 하나.
// 가천대 2027 수시에서 검정고시로 지원 가능한 전형은 논술 2개와
// 학생부종합 3개(교육기회균형·기회균형·특성화고졸재직자)뿐이다. 학생부교과
// 일반전형은 검정고시 지원 자체가 안 된다. 그런데 앱은 그 기회균형 전형에
// '가천대 학생부종합 전체 합격자 평균 3.79등급'을 합격선으로 붙여 '안정'이라고 했다.
//
// 두 가지가 동시에 틀렸다.
//   ① 이 전형들은 농어촌 거주·기초생활수급·재직 경력 같은 자격이 따로 있다.
//      해당되지 않으면 등급이 아무리 좋아도 지원 자체가 불가능하다.
//   ② 어디가 입결은 대학 × 전형유형 단위 집계라 '기회균형 전형만의 합격선'이 아니다.
//      일반전형이 섞인 평균을 기회균형에 붙이는 건 근거 없는 숫자다.
//
// 그래서 이런 전형은 칸수를 내지 않는다. 목록에서 빼지는 않는다 —
// 자격에 해당하는 학생에게는 오히려 기회이기 때문이다. 자격을 먼저 확인하라고 말한다.
//
// ⚠️ 여기 걸리는 전형에 다시 칸수를 붙이지 말 것. 정원외(quotaOutside)와는 다른 축이다.
//    정원외는 목록에서 아예 분리돼 있고, 이건 정원내인데 자격이 따로 있는 전형이다.
const SPECIAL_ELIGIBILITY_RE =
  /기회균형|기회균등|교육기회|고른기회|사회통합|사회적?배려|기회배려|농어촌|기초생활|차상위|저소득|특성화고|마이스터|재직자|만학도|성인학습자|평생학습자|장애|보훈|국가유공|서해5도|다문화|북한이탈|탈북|새터민|특수교육|위탁|산업체|계약학과|재외국민|외국인|경제배려|배려대상/;

export function hasSpecialEligibility(adm) {
  // 데이터가 직접 "자격 제한 전형"이라고 표시한 경우(전문대 수시 특별전형 등).
  // 이름만 보고 판단하면 전문대 '수시 특별전형'처럼 묶음 이름인 행을 놓친다.
  if (adm?.specialEligibility === true) return true;
  const name = `${adm?.admissionName || ''} ${adm?.nameKey || ''}`;
  return SPECIAL_ELIGIBILITY_RE.test(name);
}

// 칸수式 합격 가능성 게이지 (5단계). gap = myGrade - cutGrade (+면 부족)
//
// ── 기준을 왜 이렇게 잡았나 (2026-09 개정) ──────────────────────────────
//
// 옛 기준은 gap ≤ -1.0 안정 / ≤ 0.3 적정 / ≤ 1.0 소신 / ≤ 2.0 도전이었다.
// 서연님이 "3등급이 나와도 안정, 5등급이 나와도 안정"이라고 한 게 여기서 나왔다.
// 실제로 가천대 학생부종합(합격선 3.79등급)에서 90점(3등급, gap -0.93)과
// 80점(4등급, gap -0.04)이 똑같이 '적정'이었다. 라벨 하나가 1.3등급을 덮은 것이다.
//
// ⚠️ 먼저 우리가 쓰는 합격선이 무엇인지 정확히 알고 있어야 한다.
//    cutlines_2026.json의 298개 블록은 **전부 70%컷**이다(cutGradeAvg는 0개).
//    70%컷 = 합격자를 성적순으로 줄 세웠을 때 상위 70% 지점의 등급.
//    즉 합격자의 70%가 이 등급보다 우수했고, 30%만 이보다 아래였다는 뜻이다.
//    '합격자 평균'이 아니라 **합격자 분포의 아래쪽 경계**에 가깝다.
//    → gap = 0 은 "떨어진다"가 아니라 "합격자 하위 30% 언저리"다. 소신이다.
//    → gap 이 음수로 1등급 이상 벌어져야 비로소 합격자 중상위권이다.
//
// 그 위에 검정고시생에게만 있는 손실을 얹는다. 근거는 두 가지다.
//
//  ① 70%컷은 '일반고 학생'의 교과 등급 분포다. 검정고시생이 비교내신으로 같은
//     등급을 받아도 같은 자가 아니다. 학교생활기록부가 없어서 출결·봉사 같은
//     비교과 배점을 대학이 정한 대체 기준으로 받고(모집요강마다 다르다),
//     서류평가도 대체서식으로 받는다. 그 축의 자료는 우리에게 없다.
//
//  ② 알 수 없는 손실이 한쪽 방향으로만 있으면 여유를 두는 쪽이 맞다.
//     느슨한 쪽이 틀리면 학생이 지원 기회를 날린다. 짠 쪽이 틀리면 한 칸 더
//     안전하게 쓸 뿐이다. 두 실수의 비용이 같지 않다.
//
// ⚠️ 이 기준을 다시 느슨하게 만들지 말 것. 바꾸려면 근거(검정고시생 실제 입결)를
//    먼저 가져올 것. 지금 그 자료는 공개된 곳이 없다.
const CHANCE_BANDS = [
  { max: -1.2, level: 5, label: '안정', tone: 'good' },
  { max: -0.4, level: 4, label: '적정', tone: 'ok' },
  { max: 0.2, level: 3, label: '소신', tone: 'warn' },
  { max: 1.0, level: 2, label: '도전', tone: 'hard' },
  { max: Infinity, level: 1, label: '어려움', tone: 'hard' },
];

const CHANCE_DESC = {
  5: `${CUTLINE_YEAR}학년도 합격자 대부분보다 좋은 등급이에요`,
  4: `${CUTLINE_YEAR}학년도 합격자 안쪽 등급이에요`,
  3: `${CUTLINE_YEAR}학년도 합격선 경계예요. 안전하다는 뜻은 아니에요`,
  2: '아직 합격선까지 거리가 있어요',
  1: '지금 점수로는 많이 부족해요',
};

export function admissionChance(ev) {
  if (!ev || !ev.applicable || ev.gap == null) return null;
  const g = ev.gap;
  let band = CHANCE_BANDS.find((b) => g <= b.max) || CHANCE_BANDS[CHANCE_BANDS.length - 1];

  // 학생부종합은 '안정'을 주지 않는다.
  //   어디가의 학생부종합 70%컷은 '서류평가를 통과한 뒤' 합격한 학생들의 교과 등급이다.
  //   검정고시생은 그 서류평가를 학교생활기록부가 아니라 대체서식으로 받는다.
  //   즉 교과 등급이 좋아도 통과 여부를 우리가 알 수 없다 — '안정'이라고 말할 근거가 없다.
  //   칸수를 아예 없애지는 않는다. 등급이 낮으면 어차피 어렵다는 정보는 여전히 맞기 때문이다.
  if (ev.isHolistic && band.level === 5) band = CHANCE_BANDS[1];

  return { level: band.level, label: band.label, tone: band.tone, desc: CHANCE_DESC[band.level] };
}

// 데이터 가용성 안내 — "없음/구할 수 없음"을 정직하게 표시하기 위한 메타.
// kind: 'none'(언급없음) | 'numeric'(환산표) | 'prose'(산문안내) | 'deferred'(모집요강공지) | 'block'(지원불가)
export function comparativeAvailability(comp) {
  if (!comp) {
    return {
      has: false,
      kind: 'none',
      title: '비교내신 환산 정보 없음',
      desc: '이 대학은 2028 시행계획에 검정고시 비교내신 환산 기준을 아직 공개하지 않았어요. 모집요강 공개 후 확인할 수 있어요.',
    };
  }
  const t = comp.comparativeGradeType;
  if (t === 'numeric_table')
    return { has: true, kind: 'numeric', title: '비교내신 환산표 있음', desc: '검정고시 점수가 내신 등급으로 환산되는 표가 공개돼 있어요.' };
  if (t === 'deferred')
    return { has: false, kind: 'deferred', title: '환산표는 모집요강 공지 예정', desc: '시행계획에 "환산점수표는 모집요강에서 공지"로 안내돼 있어요.' };
  if (t === 'ged_block')
    return { has: true, kind: 'block', title: '검정고시 지원 제한 안내', desc: '검정고시 지원이 제한될 수 있어요. 원문을 확인하세요.' };
  return { has: true, kind: 'prose', title: '비교내신 안내 있음', desc: '비교내신/환산 관련 안내가 글로 공개돼 있어요(표 형태 아님).' };
}
