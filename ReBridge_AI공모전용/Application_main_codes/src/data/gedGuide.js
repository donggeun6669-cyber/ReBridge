// 검정고시 도우미 — 콘텐츠 데이터 (직접 작성·통제 가능한 정보만)
// 일정은 schedule.js의 GED_SESSIONS를 재사용한다(읽기 전용).
// ⚠️ 정확한 연도별 공고일은 국가평생교육진흥원/시도교육청 공고로 확인 후 schedule.js에서 교체.

import { GED_SESSIONS } from './schedule.js';

// ── 공식 출처 링크 (지어내지 않고 진짜 출처로 연결) ──────────────────
export const GED_LINKS = {
  examSchedule: {
    label: '응시일정 보기',
    url: 'https://www.gumsi.or.kr/ged/usr/info/examdateList.do',
    host: '국가평생교육진흥원 검정고시지원센터',
  },
  prevExams: {
    label: '기출문제 받기',
    url: 'https://www.gumsi.or.kr/ged/usr/data/prevexamList.do',
    host: '검정고시지원센터 · 연도/과목별',
  },
  apply: {
    label: '원서접수 안내',
    url: 'https://www.gumsi.or.kr/ged/usr/info/applyInfo.do',
    host: '접수는 거주지 시·도교육청',
  },
};

// ── 합격 기준 (검정고시 핵심 규칙) ──────────────────────────────
export const PASS_RULE = {
  perSubjectMax: 100,
  passAverage: 60,
  // 전 과목 평균 60점 이상이면 합격(과목별 과락 없음). 결시 과목은 0점 처리.
  note: '각 과목 100점 만점, 전 과목 평균 60점 이상이면 합격이에요. 과목별 과락(최저점)은 없어요.',
};

// ── 고졸 검정고시 과목별 공부 가이드 (필수 6과목) ────────────────
// 선택 1과목(도덕·기술가정·체육·음악·미술·진로와직업 중 택1)은 마지막에 안내.
export const GED_SUBJECT_GUIDE = [
  {
    key: '국어',
    icon: 'BookOpen',
    color: 'brand',
    summary: '지문 읽고 푸는 문제 중심. 기출 유형이 매년 비슷해요.',
    tips: [
      '문법 용어보다 지문 독해가 더 많이 나와요. 기출 지문으로 감을 잡으세요.',
      '한자 성어·속담은 자주 나오는 것 위주로 외우면 가성비가 좋아요.',
    ],
  },
  {
    key: '수학',
    icon: 'Calculator',
    color: 'green',
    summary: '고1 수준. 계산보다 개념·공식 적용이 핵심이에요.',
    tips: [
      '함수·방정식·도형 기본 공식부터. 어려운 단원은 과감히 버려도 평균은 나와요.',
      '계산 실수만 줄여도 점수가 크게 올라요. 기출을 손으로 풀어보세요.',
    ],
  },
  {
    key: '영어',
    icon: 'Languages',
    color: 'gold',
    summary: '기초 단어 + 짧은 독해. 듣기는 없어요.',
    tips: [
      '중·고 기초 단어 1000개만 잡아도 절반 이상 풀려요.',
      '문법은 시제·대명사·기본 어순 정도만. 독해 기출 반복이 제일 빨라요.',
    ],
  },
  {
    key: '사회',
    icon: 'Globe2',
    color: 'brand',
    summary: '생활 상식과 가까워요. 암기량 대비 점수가 잘 나와요.',
    tips: [
      '정치·경제·지리·일반사회가 골고루. 기출에서 반복되는 개념부터.',
      '도표·그래프 해석 문제는 침착하게 보기만 비교하면 풀려요.',
    ],
  },
  {
    key: '과학',
    icon: 'FlaskConical',
    color: 'green',
    summary: '물·화·생·지 기초 개념. 깊지 않게 넓게 나와요.',
    tips: [
      '공식 암기보다 "왜 그런지" 개념 이해가 점수에 직결돼요.',
      '실험·그래프 해석이 단골. 기출 그림 문제를 눈에 익히세요.',
    ],
  },
  {
    key: '한국사',
    icon: 'Landmark',
    color: 'coral',
    summary: '시대 흐름만 잡으면 안정적으로 점수가 나와요.',
    tips: [
      '연도 암기보다 "사건 순서"가 중요. 큰 흐름(고대→근현대)부터.',
      '근현대사 비중이 커요. 일제강점기·광복 전후를 특히 챙기세요.',
    ],
  },
];

export const GED_ELECTIVE_NOTE =
  '위 6과목은 필수예요. 여기에 선택 과목 1개(도덕·기술가정·체육·음악·미술·진로와직업 중 하나)를 더해 총 7과목을 봐요. 선택은 본인이 편한 1과목으로 고르면 돼요.';

// ── 다음 검정고시 회차 계산 (오늘 기준) ────────────────────────
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function md(year, [m, d]) {
  return new Date(year, m - 1, d);
}

/**
 * 오늘 기준 다음 검정고시 회차 정보.
 * @returns {{ year, round, label, applyDate, examDate, resultDate }}
 */
export function getNextSession(today = new Date()) {
  const base = startOfDay(today);
  for (const yr of [today.getFullYear(), today.getFullYear() + 1]) {
    for (const s of GED_SESSIONS) {
      const examDate = md(yr, s.exam);
      if (examDate >= base) {
        return {
          year: yr,
          round: s.round,
          label: s.label,
          applyDate: md(yr, s.apply),
          examDate,
          resultDate: md(yr, s.result),
        };
      }
    }
  }
  return null;
}

export function daysUntil(date, today = new Date()) {
  return Math.round((startOfDay(date) - startOfDay(today)) / 86400000);
}

export function formatKDate(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}
