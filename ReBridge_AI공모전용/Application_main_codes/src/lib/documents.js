// 검정고시생용 전형별 제출서류 엔진 (규칙기반, AI 추론 없음)
//
// 원칙(앱 공통): 없는 정보를 있는 척하지 않는다.
//   학교 고유 서류 목록 데이터가 없으므로, "전형 유형 기반 일반 규칙"만 제공하고
//   대학별로 달라지는 세부는 전부 notes에 "모집요강 확인"으로 정직하게 안내한다.
//
// 입력: adm 행 1개
//   { phase, admissionType, admissionName, gedEligible, interview, csatMinimum, comparativeGrade }
// 출력:
//   {
//     eligible: boolean,            // 검정고시로 지원 가능 여부('불가'면 false)
//     common: [{ id, label, required }],   // 검정고시생 공통 서류
//     byType: [{ id, label, required }],   // 전형 유형별 서류/응시
//     notes: string[],             // 안내 문구(단정 못 하는 것/대학별 상이)
//     confidence: 'general' | 'check',     // 'check'면 대학별 확인 권장
//   }

// 검정고시 합격자 공통 서류(근거 있는 일반 규칙)
function commonDocs() {
  return [
    { id: 'ged-pass', label: '검정고시 합격증명서', required: true },
    { id: 'ged-score', label: '검정고시 성적증명서', required: true },
    { id: 'application', label: '응시원서 / 입학지원서', required: true },
    { id: 'resident', label: '주민등록초본 (요구하는 대학만)', required: false },
  ];
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

export function getDocuments(adm) {
  const a = adm || {};
  const type = a.admissionType || '';
  const phase = a.phase || '';
  const eligible = a.gedEligible !== '불가';

  // 지원 불가 전형: 서류 안내 대신 사유만
  if (!eligible) {
    return {
      eligible: false,
      common: [],
      byType: [],
      notes: ['이 전형은 검정고시 출신이 지원할 수 없어요. 다른 전형을 확인해 보세요.'],
      confidence: 'general',
    };
  }

  const common = commonDocs();
  const byType = [];
  const notes = [];
  let confidence = 'general';

  // ── 전형 유형별 규칙 ──────────────────────────────
  if (type === '학생부종합') {
    // 자기소개서는 2024학년도부터 전면 폐지 → 절대 넣지 않음
    byType.push({
      id: 'ged-substitute',
      label: '학생부 대체서식 (검정고시생용 — 대학 양식)',
      required: true,
    });
    notes.push('자기소개서는 2024학년도부터 폐지되어 제출하지 않아요.');
    notes.push('활동 증빙·추천서 등 추가 서류는 대학마다 달라요 → 모집요강을 꼭 확인하세요.');
    confidence = 'check';
  } else if (type === '학생부교과') {
    notes.push('검정고시 성적이 내신(비교내신)으로 환산돼서, 따로 챙길 내신 서류는 없어요.');
    if (a.comparativeGrade) {
      notes.push('이 대학은 검정고시 점수를 내신 등급으로 바꾸는 환산 기준이 있어요(상세 화면 참고).');
    } else {
      notes.push('검정고시 점수를 어떻게 등급으로 환산하는지는 모집요강에서 확인하세요.');
      confidence = 'check';
    }
  } else if (type === '논술') {
    byType.push({ id: 'essay-exam', label: '논술고사 응시 (서류보다 시험 중심)', required: true });
    notes.push('제출서류보다 논술 시험이 핵심이에요. 기출 문제로 미리 연습해 보세요.');
  } else if (type === '실기') {
    byType.push({ id: 'practical-exam', label: '실기고사 응시', required: true });
    byType.push({ id: 'practical-proof', label: '실기 종목별 증빙 (모집요강 확인)', required: false });
    notes.push('실기 종목·반영 비율은 대학마다 달라요 → 모집요강을 꼭 확인하세요.');
    confidence = 'check';
  } else if (type === '수능위주') {
    notes.push('수능 성적이 핵심이라 제출서류는 최소예요. 수능 응시·성적이 가장 중요해요.');
  } else if (type === '일반(서류)') {
    byType.push({ id: 'doc-eval', label: '서류평가 제출서류 (대학별 상이)', required: true });
    notes.push('이 전형의 제출서류는 대학마다 달라요 → 모집요강을 꼭 확인하세요.');
    confidence = 'check';
  } else {
    // 알 수 없는 유형: 일반 안내만
    notes.push('이 전형의 제출서류는 모집요강에서 확인하세요.');
    confidence = 'check';
  }

  // ── 부가 조건 ────────────────────────────────────
  if (a.interview) {
    notes.push('이 전형은 면접이 있어요. 서류는 아니지만 면접 일정을 미리 확인하세요.');
  }
  if (a.csatMinimum && !String(a.csatMinimum).includes('없음') &&
      !String(a.csatMinimum).includes('해당없음') && phase !== '정시') {
    notes.push('수능 최저학력기준이 있어요 → 수능에 반드시 응시해야 해요.');
  }
  if (a.gedEligible === '조건부') {
    notes.push('지원 자격에 추가 조건이 있을 수 있어요 → 모집요강에서 자격을 먼저 확인하세요.');
    confidence = 'check';
  }

  return {
    eligible: true,
    common,
    byType,
    notes: uniq(notes),
    confidence,
  };
}

export default getDocuments;
