import {
  GED_SESSIONS, ADMISSION, isGedYearConfirmed, GED_TYPICAL_HINT, admissionEvent,
  isAdmissionYearConfirmed, ADMISSION_CONFIRMED,
} from '../data/schedule.js';

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

// 대입 일정 한 건 → 단계에 붙일 { when, approx, hint }
// 확정 학년도면 approx=false라 D-day가 붙고, 아니면 '예년 9월 초' 식으로만 보여준다.
function evStage(susiYear, key) {
  const e = admissionEvent(susiYear, key);
  return { when: e.date, approx: !e.confirmed, hint: e.confirmed ? null : e.hint };
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
      hint: session.confirmed ? null : (session.hint?.exam ? `예년 ${session.hint.exam}` : null),
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
      hint: session.confirmed ? null : (session.hint?.result ? `예년 ${session.hint.result}` : null),
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
  const targetEv = admissionEvent(aYear, 'target');
  let targetDate = targetEv.date;
  let targetApprox = !targetEv.confirmed;
  if (targetDate < readyPlus) {
    targetDate = readyPlus;      // 검정고시 결과가 늦으면 그 뒤로 밀린다 → 더 이상 예년 패턴이 아님
    targetApprox = false;
  }
  stages.push({
    id: 'target',
    icon: 'Scale',
    title: '비교내신 확인 & 목표 대학 좁히기',
    when: targetDate,
    approx: targetApprox,
    hint: targetApprox ? targetEv.hint : null,
    todo: '내 점수가 대학마다 몇 등급으로 환산되는지 보고 목표를 정해요.',
    term: '비교내신: 검정고시 점수를 대학이 "내신 등급"으로 바꿔 계산하는 방식이에요.',
    guideTopic: 'compare',
  });

  // 4. 수시 원서
  stages.push({
    id: 'susi',
    icon: 'CalendarDays',
    title: '수시 원서 접수',
    ...evStage(aYear, 'susiApply'),
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
      ...evStage(aYear, 'csat'),
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
    ...evStage(aYear, 'interview'),
    todo: '제출 서류와 지원 동기를 내 말로 한 번 정리해 둬요.',
    guideTopic: 'interview',
  });

  // 7. 합격 발표·등록
  stages.push({
    id: 'result',
    icon: 'CheckCircle2',
    title: '합격 발표 & 등록',
    ...evStage(aYear, 'susiResult'),
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
      ...evStage(aYear, 'jeongsiApply'),
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
    // 확정 전(공고 전) 단계는 날짜를 확정처럼 보여주지 않는다.
    // 근사 문구('예년 9월 초')로 바꾸고 D-day도 붙이지 않는다.
    if (s.approx) {
      s.dateLabel = s.hint
        ? `${s.when.getFullYear()}년 · ${s.hint}`
        : `${dateLabel(s.when)} 예상`;
      s.dday = null;
    } else {
      s.dateLabel = dateLabel(s.when);
      s.dday = diff > 0 ? `D-${diff}` : diff === 0 ? 'D-DAY' : null;
    }
  }

  const nextStage = stages.find((s) => s.status === 'current') || null;
  return { stages, nextStage };
}

// ─────────────────────────────────────────────────────────────
// 학년별 나의 대입 로드맵 (2026-09-18 동근님: 로드맵은 사람마다, 학년별로 달라야 한다)
//
// 홈의 로드맵 카드와 로드맵 화면 맨 위가 이 결과 하나를 같이 쓴다.
// 네 단계의 '입구'는 여기 한 곳뿐이다 — 홈·MY 메뉴에 같은 화면으로 가는 버튼을 또 두지 않는다.
//   검정고시 → ged-guide · 내 점수 → results · 대학 찾기 → univ-explore · 원서·서류 → 이 화면 안
//
// 원칙
//   · 날짜가 지났다고 단계를 완료 처리하지 않는다. 사용자가 고른 상황·입력한 것만 본다.
//   · 공부 중인 사람이 넣은 점수는 '목표 점수'라 점수 단계 완료로 보지 않는다.
//   · D-day는 공고로 확정된 일정에만 붙인다(schedule.js의 CONFIRMED 연도). 나머지는 '예년 ○월'.
//   · '또래 대입 학년도'는 또래 친구들 기준 참고값이다. 지원 자격 규칙이 아니다.
// ─────────────────────────────────────────────────────────────

export const JOURNEY_STEPS = [
  { id: 'ged',   title: '검정고시',  sub: '일정·응시 조건',     screen: 'ged-guide' },
  { id: 'score', title: '내 점수',   sub: '대학별 환산 결과',   screen: 'results' },
  { id: 'univ',  title: '대학 찾기', sub: '지역·전형으로 찾기', screen: 'univ-explore' },
  { id: 'apply', title: '원서·서류', sub: '일정과 챙길 서류',   screen: null }, // 로드맵 화면 안
];

const GRADE_OFFSET = { h3: 1, h2: 2, h1: 3, m: 4, a20: 1, a25: 1 };

// 학교 학년은 3월에 바뀐다. 1~2월은 아직 지난 학년도다.
function schoolYearBase(today) {
  return today.getMonth() >= 2 ? today.getFullYear() : today.getFullYear() - 1;
}

function ddayOf(date, today) {
  const diff = daysBetween(today, date);
  return diff > 0 ? `D-${diff}` : diff === 0 ? 'D-DAY' : null;
}

const KEY_EVENT_LABELS = [
  ['susiApply', '수시 원서 접수'],
  ['csat', '수능'],
  ['csatResult', '수능 성적 발표'],
  ['susiResult', '수시 합격 발표'],
  ['susiRegister', '수시 합격자 등록'],
  ['jeongsiApply', '정시 원서 접수'],
  ['jeongsiResult', '정시 합격 발표'],
  ['extraApply', '추가 모집'],
];

// 주요 일정 — 오늘 이후 가까운 것부터 max개.
function keyDates(admissionYear, today, { pinGed = false, max = 4 } = {}) {
  const out = [];
  const susiYear = admissionYear - 1;
  const base = startOfDay(today);

  // 검정고시 다음 회차 (학년·상황과 상관없이 참고용으로 하나)
  const s = nextGedSession(today);
  if (s) {
    out.push({
      id: 'ged', label: `검정고시 ${s.year}년 ${s.label}`,
      date: s.examDate, confirmed: s.confirmed,
      text: s.confirmed ? `${s.examDate.getMonth() + 1}월 ${s.examDate.getDate()}일`
        : `예년 ${s.hint?.exam || '공고 전'}`,
    });
  }

  if (isAdmissionYearConfirmed(admissionYear)) {
    for (const [key, label] of KEY_EVENT_LABELS) {
      const conf = ADMISSION_CONFIRMED[admissionYear]?.[key];
      if (!conf) continue;
      const iso = conf.start ?? conf.date ?? conf.end;
      const [y, m, d] = iso.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      if (date < base) continue;
      out.push({ id: key, label, date, confirmed: true, text: `${m}월 ${d}일${conf.start && conf.end ? `~${Number(conf.end.slice(8))}일` : ''}` });
    }
  } else {
    // 공고 전 학년도는 수시 원서 하나만 '예년 ○월'로 알려준다.
    const e = admissionEvent(susiYear, 'susiApply');
    out.push({ id: 'susiApply', label: '수시 원서 접수', date: e.date, confirmed: false,
      text: `${susiYear}년 · ${e.hint}` });
  }

  // 검정고시 공부 중이면 다음 시험을 맨 앞에 고정한다(날짜가 멀어도 가장 중요한 일정이라서).
  const upcoming = out.filter((e) => e.date >= base).sort((a, b) => a.date - b.date);
  const ged = pinGed ? upcoming.find((e) => e.id === 'ged') : null;
  const list = ged ? [ged, ...upcoming.filter((e) => e !== ged)] : upcoming;
  return list
    .slice(0, max)
    .map((e) => ({ ...e, dday: e.confirmed ? ddayOf(e.date, today) : null }));
}

/**
 * profile + 관심 대학 수 → 나의 로드맵 요약
 * 반환: { grade, gradeLabel, admissionYear, peerNote, steps:[{...JOURNEY_STEPS, status}],
 *         currentId, headline, nextTodo, keyDates, nearest }
 */
export function gradeRoadmap(profile, bookmarkCount = 0, today = new Date()) {
  const grade = profile?.grade || null;
  const stage = profile?.stage || null;           // 'studying' | 'tested'
  const hasRealScore = stage === 'tested' && profile?.gedAvg != null;
  const base = schoolYearBase(today);
  const admissionYear = base + (GRADE_OFFSET[grade] ?? 1);

  // 지금 단계 — 입력한 것만 근거로 한다.
  let currentId = null;
  if (stage === 'studying') currentId = 'ged';
  else if (stage === 'tested') {
    if (!hasRealScore) currentId = 'score';
    else currentId = bookmarkCount > 0 ? 'apply' : 'univ';
  }
  const order = JOURNEY_STEPS.map((s) => s.id);
  const curIdx = currentId ? order.indexOf(currentId) : -1;
  const steps = JOURNEY_STEPS.map((s, i) => ({
    ...s,
    status: curIdx < 0 ? 'open' : i < curIdx ? 'done' : i === curIdx ? 'current' : 'next',
  }));

  const HEAD = {
    ged: '검정고시부터 차근차근',
    score: '이제 내 점수를 넣어 볼 차례',
    univ: '갈 수 있는 대학을 찾아볼 차례',
    apply: '원서와 서류를 챙길 차례',
  };
  const TODO = {
    ged: '응시 조건과 다음 시험 일정을 먼저 확인해요.',
    score: '검정고시 점수를 넣으면 대학마다 몇 등급으로 환산되는지 보여드려요.',
    univ: '지역·전형으로 대학을 찾아 관심 대학으로 담아요.',
    apply: '원서 일정과 챙길 서류를 순서대로 확인해요.',
  };

  let peerNote;
  if (grade === 'a20' || grade === 'a25') {
    peerNote = `가장 가까운 대입은 ${admissionYear}학년도예요`;
  } else if (grade === 'm') {
    peerNote = `또래 친구들은 ${admissionYear}학년도 이후에 대학에 가요`;
  } else if (grade) {
    peerNote = `또래 친구들은 ${admissionYear}학년도 대입을 준비해요`;
  } else {
    peerNote = `이번 대입은 ${admissionYear}학년도예요`;
  }

  const dates = keyDates(admissionYear, today, { pinGed: stage === 'studying' });
  const nearest = dates.find((d) => d.dday) || null;

  return {
    grade,
    admissionYear,
    peerNote,
    steps,
    currentId,
    headline: currentId ? HEAD[currentId] : '필요한 곳부터 시작해요',
    nextTodo: currentId ? TODO[currentId] : '어느 단계든 바로 열어볼 수 있어요.',
    keyDates: dates,
    nearest,
  };
}
