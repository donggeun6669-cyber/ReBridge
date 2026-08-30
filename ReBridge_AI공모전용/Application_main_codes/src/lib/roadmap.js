import { GED_SESSIONS, ADMISSION, isGedYearConfirmed, GED_TYPICAL_HINT } from '../data/schedule.js';

// [월, 일] → 해당 연도의 Date (자정)
function md(year, [m, d]) {
  return new Date(year, m - 1, d);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / 86400000);
}

function dateLabel(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

// 오늘 기준 다음 검정고시 회차 (올해에 남은 게 없으면 내년 1회)
function nextGedSession(today) {
  const y = today.getFullYear();
  for (const yr of [y, y + 1]) {
    for (const s of GED_SESSIONS) {
      const examDate = md(yr, s.exam);
      if (examDate >= startOfDay(today)) {
        // confirmed=false면 날짜는 예년 패턴 추정이다. 단계 문구에서 확정처럼 쓰지 않는다.
        return {
          ...s, year: yr, examDate,
          resultDate: md(yr, s.result), applyDate: md(yr, s.apply),
          confirmed: isGedYearConfirmed(yr),
          hint: GED_TYPICAL_HINT[s.round] || null,
        };
      }
    }
  }
  return null;
}

// 검정고시 준비가 끝나는 시점 이후로, 지원 가능한 첫 수시 사이클 연도
function admissionYear(today, gedReadyDate) {
  const base = startOfDay(today);
  for (const yr of [today.getFullYear(), today.getFullYear() + 1, today.getFullYear() + 2]) {
    const susi = md(yr, ADMISSION.susiApply);
    if (susi >= base && susi >= startOfDay(gedReadyDate)) return yr;
  }
  return today.getFullYear() + 1;
}

/**
 * 프로필 + 오늘 날짜 → 로드맵 단계 목록
 * profile: { gedScore, csatPlan, region, field }
 */
export function buildRoadmap(profile, today = new Date()) {
  const hasScore = profile?.gedAvg != null;
  const takesCsat = profile?.csatPlan === '볼 거예요';

  const session = nextGedSession(today);
  const gedReady = hasScore ? today : session?.resultDate ?? today;
  const aYear = admissionYear(today, gedReady);

  const stages = [];

  // 1~2. 검정고시 (점수 아직 모를 때만 '예정' 단계로, 이미 있으면 완료 처리)
  if (!hasScore && session) {
    stages.push({
      id: 'ged-exam',
      icon: 'ClipboardList',
      title: `검정고시 응시 (${session.label})`,
      when: session.examDate,
      // 공고 전이면 날짜가 추정이라는 걸 할 일 문구에서 밝힌다.
      approx: !session.confirmed,
      todo: session.confirmed
        ? '먼저 시도교육청에서 접수해요. 접수 기간을 놓치지 않는 게 가장 중요해요.'
        : `${session.year}년 일정은 아직 공고 전이에요. 예년엔 ${session.hint?.exam}에 봤어요 — 공고가 뜨면 거주지 시·도교육청에서 접수해요.`,
      guideTopic: null,
    });
    stages.push({
      id: 'ged-cert',
      icon: 'FileText',
      title: '합격증명서 받기',
      when: session.resultDate,
      approx: !session.confirmed,
      todo: '합격하면 합격증명서를 발급받아 둬요. 원서 낼 때 제출해야 해요.',
      guideTopic: 'guideline',
    });
  } else if (hasScore) {
    stages.push({
      id: 'ged-done',
      icon: 'CheckCircle2',
      title: '검정고시 합격',
      when: today,
      forceDone: true,
      todo: '합격증명서를 미리 발급해 두면 원서 접수가 편해요.',
      guideTopic: null,
    });
  }

  // 3. 목표 좁히기 (비교내신) — 점수를 받은 뒤라야 의미가 있어서, 검정고시 합격 이후로 배치
  const readyPlus = new Date(gedReady);
  readyPlus.setDate(readyPlus.getDate() + 3);
  let targetDate = md(aYear, ADMISSION.target);
  if (targetDate < readyPlus) targetDate = readyPlus;
  stages.push({
    id: 'target',
    icon: 'Scale',
    title: '비교내신 확인 & 목표 대학 좁히기',
    when: targetDate,
    todo: '내 점수가 대학마다 몇 등급으로 환산되는지 보고 목표를 정해요.',
    term: '비교내신: 검정고시 점수를 대학이 "내신 등급"으로 바꿔 계산하는 방식이에요.',
    guideTopic: 'compare',
  });

  // 4. 수시 원서
  stages.push({
    id: 'susi',
    icon: 'CalendarDays',
    title: '수시 원서 접수',
    when: md(aYear, ADMISSION.susiApply),
    todo: '수시는 최대 6장. 유웨이·진학사나 대학 입학처에서 접수해요.',
    term: '수시 6장: 수시는 최대 6개 대학까지 원서를 낼 수 있어요. 안정·적정·소신을 섞어 배분하면 좋아요.',
    guideTopic: 'apply',
  });

  // 5. 수능 (볼 때만)
  if (takesCsat) {
    stages.push({
      id: 'csat',
      icon: 'Target',
      title: '수능 응시',
      when: md(aYear, ADMISSION.csat),
      todo: '수능 최저가 있는 전형이면 꼭 챙겨요. 정시 길도 같이 열려요.',
      term: '수능최저: 합격하려면 수능에서 정해진 등급 이상을 받아야 하는 조건이에요. 없는 전형도 많아요.',
      guideTopic: 'csat',
    });
  }

  // 6. 면접·논술
  stages.push({
    id: 'interview',
    icon: 'MessageCircle',
    title: '면접·논술',
    when: md(aYear, ADMISSION.interview),
    todo: '제출 서류와 지원 동기를 내 말로 한 번 정리해 둬요.',
    guideTopic: 'interview',
  });

  // 7. 합격 발표·등록
  stages.push({
    id: 'result',
    icon: 'CheckCircle2',
    title: '합격 발표 & 등록',
    when: md(aYear, ADMISSION.susiResult),
    todo: '합격하면 등록 기간을 지켜요. 수시에 붙으면 정시는 못 써요.',
    term: '수시에 최종 합격하면(=수시 납치) 그 해 정시 지원은 못 해요. 그래서 6장 배분이 중요해요.',
    guideTopic: 'count',
  });

  // 8. 정시 (수능 보는 경우 보조 단계)
  if (takesCsat) {
    stages.push({
      id: 'jeongsi',
      icon: 'Target',
      title: '정시 지원 (수시 모두 불합격 시)',
      when: md(aYear, ADMISSION.jeongsiApply),
      todo: '수시에서 다 떨어졌다면 정시 가·나·다 군에 3번 기회가 있어요.',
      term: '가·나·다군: 정시는 군별로 한 곳씩, 최대 세 곳까지 지원할 수 있어요.',
      guideTopic: 'susiJeongsi',
      optional: true,
    });
  }

  // 상태/디데이 계산 — 시간순 정렬 후 첫 '예정'을 현재로
  stages.sort((a, b) => a.when - b.when);
  let currentMarked = false;
  for (const s of stages) {
    const diff = daysBetween(today, s.when);
    if (s.forceDone || diff < 0) {
      s.status = 'done';
    } else if (!currentMarked) {
      s.status = 'current';
      currentMarked = true;
    } else {
      s.status = 'upcoming';
    }
    // 공고 전인 검정고시 단계는 '예상'을 붙여 확정 일정과 구분한다.
    s.dateLabel = s.approx ? `${dateLabel(s.when)} 예상` : dateLabel(s.when);
    s.dday = diff > 0 ? `D-${diff}` : diff === 0 ? 'D-DAY' : null;
  }

  const nextStage = stages.find((s) => s.status === 'current') || null;
  return { stages, nextStage };
}
