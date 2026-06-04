// 검정고시 점수 → 비교내신 환산(대학별 5케이스) → 합격선 비교(점수 우선, 등급 폴백)
// 규칙 기반(AI 없음). 대학별 conversion 데이터가 없으면 표준 추정표로 폴백.
// 입결(results)은 2025학년도(9등급제) 기준, 입시제도는 2028(5등급제)이므로 직접비교는 '참고용'.
import cutlines from '../data/cutlines_2025.json';
import comparative from '../data/comparative_2028.json';

// 검정고시(고졸) 핵심 과목
export const GED_SUBJECTS = ['국어', '수학', '영어', '사회', '과학', '한국사'];

// 검정고시 채점: 과목당 25문항, 1문항 = 4점 (100점 만점)
export const POINTS_PER_QUESTION = 4;

// 표준 추정 환산표: 검정고시 평균 → 9등급제 추정등급 (대학별 상이, 참고용)
// 각 등급을 받기 위한 '최소 평균점수'
const GRADE_MIN_AVG = [
  [1, 98], [2, 94], [3, 90], [4, 86], [5, 82], [6, 78], [7, 74], [8, 70],
];

// 평균점수 → 추정 등급(1~9, 낮을수록 우수)
export function estimateGrade(avg) {
  if (avg == null || Number.isNaN(avg)) return null;
  for (const [g, min] of GRADE_MIN_AVG) {
    if (avg >= min) return g;
  }
  return 9;
}

// 목표 등급을 받기 위한 최소 평균점수
export function gradeToMinAvg(grade) {
  if (grade == null) return null;
  const g = Math.ceil(grade); // cutGrade가 7.43이면 7등급 경계 필요
  const found = GRADE_MIN_AVG.find(([gg]) => gg === g);
  if (found) return found[1];
  if (g <= 1) return 98;
  return 0; // 9등급 이하면 사실상 제한 없음
}

// 프로필의 과목별 점수 → 평균(입력된 과목만)
export function gedAverage(gedScores) {
  if (!gedScores || typeof gedScores !== 'object') return null;
  const vals = GED_SUBJECTS
    .map((s) => gedScores[s])
    .filter((v) => v != null && v !== '' && !Number.isNaN(Number(v)))
    .map(Number);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

// 입력된 과목 수
export function gedSubjectCount(gedScores) {
  if (!gedScores) return 0;
  return GED_SUBJECTS.filter(
    (s) => gedScores[s] != null && gedScores[s] !== '' && !Number.isNaN(Number(gedScores[s]))
  ).length;
}

// (univId, admissionType) 합격선 조회
export function getCutline(univId, admissionType) {
  const u = cutlines[univId];
  if (!u) return null;
  return u[admissionType] || null;
}

// univId 대표 비교내신 환산 정보
export function getComparative(univId) {
  return comparative[univId] || null;
}

// ============================================================
// 대학별 비교내신 환산 — 5케이스 (gumjung.co.kr 방식)
//
// comparative_2028.json에 대학별 "conversion" 객체를 추가하면
// 대학 공식/표대로 정확한 비교내신을 계산함.
// 데이터 없는 대학은 표준 추정표(GRADE_MIN_AVG)로 자동 폴백.
//
// conversion 객체 스키마 (comparative_2028.json에 추가):
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
 * @param {object|null} comp comparative_2028.json 대학 항목
 * @returns {{ grade: number|null, score: number|null, method: string }}
 */
export function applyComparativeConversion(avg, gedScores, comp) {
  if (avg == null) return { grade: null, score: null, method: 'no_score' };

  const conv = comp?.conversion;
  if (!conv?.type) {
    // 데이터 없음 → 표준 추정표
    return { grade: estimateGrade(avg), score: null, method: 'standard' };
  }

  switch (conv.type) {

    // Case 1, 2: 대학 발표 등급표 (등급 ± 환산점수)
    case CONV_TYPES.GRADE_TABLE: {
      if (!Array.isArray(conv.gradeTable)) break;
      const row = conv.gradeTable.find(
        (r) => avg >= (r.minAvg ?? -Infinity) && avg <= (r.maxAvg ?? Infinity)
      );
      if (row) return { grade: row.grade ?? null, score: row.score ?? null, method: 'grade_table' };
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
        return { grade, score: row.score, method: 'score_table' };
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
      return { grade, score: Math.round(score * 10) / 10, method: 'score_formula' };
    }

    // Case 4: 복잡 산출식 — grade = Min(1+((max-score)/(max-base))×8, 9) 역산
    case CONV_TYPES.FORMULA_COMPLEX: {
      if (!conv.formulaParams) break;
      const { maxScore, baseScore } = conv.formulaParams;
      if (maxScore != null && baseScore != null) {
        const grade = estimateGrade(avg);
        // 역산: score = max - (grade-1)/8*(max-base)
        const score = maxScore - ((grade - 1) / 8) * (maxScore - baseScore);
        return { grade, score: Math.round(score * 10) / 10, method: 'formula_complex' };
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
          score: Math.round(score * 10) / 10,
          method: 'subject_weighted',
        };
      }
      break;
    }

    default: break;
  }

  // 모든 케이스 실패 → 표준 추정
  return { grade: estimateGrade(avg), score: null, method: 'standard' };
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
function verdictFromGap(gap) {
  if (gap <= -1.0) return { key: 'safe',  label: '안정', tone: 'good' };
  if (gap <=  0.3) return { key: 'fit',   label: '적정', tone: 'ok'   };
  if (gap <=  1.0) return { key: 'reach', label: '소신', tone: 'warn' };
  return             { key: 'hard',  label: '도전', tone: 'hard'  };
}

// 검정고시 친화도 (전형 성격 기준): A(매우 유리) ~ E / X(불가)
export function gedAffinity(row) {
  const elig = row?.gedEligible;
  const type = row?.admissionType;
  if (elig === '불가') return { grade: 'X', label: '지원 불가', tone: 'hard' };
  if (elig === '조건부') return { grade: 'C', label: '조건부 가능', tone: 'warn' };
  // 가능
  if (type === '학생부종합') return { grade: 'A', label: '검정고시에 유리', tone: 'good' };
  if (type === '논술') return { grade: 'B', label: '비교적 유리', tone: 'good' };
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
    level = 'good';
    reasons.push('학생부종합이에요. 내신 등급 대신 검정고시 성적·서류·면접으로 평가해서, 학교를 안 다닌 점이 불리하게 작용하지 않아요.');
  } else if (type === '논술') {
    level = 'ok';
    reasons.push('논술 위주 전형이라 내신 비중이 작아요. 논술 실력으로 승부해볼 수 있어요.');
  } else if (type === '학생부교과') {
    reasons.push('학생부교과는 검정고시 점수를 내신 등급으로 "환산"해서 반영해요.');
    level = hasTable ? 'good' : 'ok';
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
      reasons.push('수능최저가 없어, 수능을 안 봐도 지원할 수 있어요.');
      if (level === 'ok') level = 'good';
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
  const myGrade = conversion.grade;   // 등급 (1~9, 소수점 가능)
  const myScore = conversion.score;   // 환산점수 (대학별 공식 있을 때만)
  const conversionMethod = conversion.method; // 'grade_table'|'score_table'|...|'standard'

  const base = {
    avg,
    myGrade,
    myScore,
    conversionMethod,
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

  const cut = getCutline(adm.univId, adm.admissionType);
  const hasAnyCutline =
    cut && (
      cut.cutGradeAvg != null || cut.cutGrade70 != null ||
      cut.cutScoreAvg != null || cut.cutScore70 != null
    );
  if (!hasAnyCutline) {
    return {
      ...base,
      applicable: false,
      dataGap: 'cutline',
      reason: '이 전형의 작년 합격선은 공개된 자료에 없어요. 검정고시 입결을 따로 공개하지 않는 대학이 많아, 지금은 구하기 어려운 정보예요.',
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
      reason: '검정고시 과목 점수를 입력하면 작년 합격선과 비교해드릴게요.',
    };
  }

  // ── 비교 기준 선택 ──
  // 점수 비교: myScore(환산)와 cutScore(입결) 둘 다 있을 때 우선 사용.
  // 정규화: 환산점수 격차를 등급-등가 gap으로 변환해 verdictFromGap에 통일 입력.
  // 정규화 공식: gap = -(myScore - cutScore) / pointsPerGrade
  //   pointsPerGrade = (conv.maxScore - conv.minScore) / 8   (없으면 fallback=20)
  let gap, comparisonBasis, cutScoreUsed, cutGradeUsed;

  if (myScore != null && cutScore != null) {
    const maxS  = comp?.conversion?.maxScore ?? null;
    const minS  = comp?.conversion?.minScore ?? 0;
    const range = maxS != null ? (maxS - minS) : null;
    const ptsPerGrade = range ? range / 8 : 20; // 1등급당 점수차 추정
    gap = Math.round((-(myScore - cutScore) / ptsPerGrade) * 100) / 100;
    comparisonBasis = 'score';
    cutScoreUsed = cutScore;
    cutGradeUsed = cutGrade;
  } else if (myGrade != null && cutGrade != null) {
    gap = Math.round((myGrade - cutGrade) * 100) / 100;
    comparisonBasis = 'grade';
    cutScoreUsed = null;
    cutGradeUsed = cutGrade;
  } else {
    return {
      ...base,
      applicable: false,
      dataGap: 'cutline',
      reason: '합격선 자료와 내 점수를 비교할 수 없어요.',
    };
  }

  const verdict = verdictFromGap(gap);

  // 부족 점수/문항수 (등급 기반, 참고용)
  const neededAvg = gradeToMinAvg(cutGradeUsed ?? cutGrade);
  const shortPoints =
    neededAvg != null && avg < neededAvg
      ? Math.round((neededAvg - avg) * 100) / 100
      : 0;
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
    verdict,
    neededAvg,
    shortPoints,
    perSubjectQuestions,
    totalQuestions,
    nSub,
  };
}

// 짧은 안내 문구(담임 톤) — 환산점수 기반/등급 기반 구분 표시
export function coachLine(ev) {
  if (!ev) return '';
  if (!ev.applicable) return ev.reason || '';
  if (ev.avg == null) return ev.reason || '';

  // 환산점수 기반 비교인 경우
  if (ev.comparisonBasis === 'score' && ev.myScore != null && ev.cutScore != null) {
    const diff = Math.round((ev.myScore - ev.cutScore) * 10) / 10;
    if (diff >= 0) {
      return `내 환산점수(${ev.myScore}점)가 작년 합격선(${ev.cutScore}점)보다 ${diff}점 높아요. ${ev.verdict.label} 지원!`;
    }
    return `작년 합격선(${ev.cutScore}점)까지 환산점수 ${Math.abs(diff)}점 부족해요. 과목당 약 ${ev.perSubjectQuestions}문제 더 맞히면 닿아요.`;
  }

  // 등급 기반 비교
  if (ev.shortPoints <= 0) {
    return `지금 평균이면 작년 합격선(약 ${ev.cutGrade}등급) 안쪽이에요. ${ev.verdict.label} 지원!`;
  }
  return `작년 합격선(약 ${ev.cutGrade}등급)까지 평균 ${ev.shortPoints}점 정도 부족해요. 과목당 약 ${ev.perSubjectQuestions}문제만 더 맞히면 닿아요.`;
}

// 칸수式 합격 가능성 게이지 (5단계). gap = myGrade - cutGrade (+면 부족)
// 진학사 '칸수' 느낌의 시각 단계. 작년 9등급제 입결 기반 '예상'임을 항상 라벨링.
export function admissionChance(ev) {
  if (!ev || !ev.applicable || ev.gap == null) return null;
  const g = ev.gap;
  if (g <= -1.0) return { level: 5, label: '안정', tone: 'good', desc: '작년 합격선보다 여유 있어요' };
  if (g <= 0.3) return { level: 4, label: '적정', tone: 'ok', desc: '작년 합격선과 비슷한 수준이에요' };
  if (g <= 1.0) return { level: 3, label: '소신', tone: 'warn', desc: '조금 부족하지만 노려볼 만해요' };
  if (g <= 2.0) return { level: 2, label: '도전', tone: 'hard', desc: '아직 합격선까지 거리가 있어요' };
  return { level: 1, label: '어려움', tone: 'hard', desc: '지금 점수로는 많이 부족해요' };
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
