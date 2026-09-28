// 묶음 A(온보딩·홈·로드맵) 공용 계산 — 서연 UI 시안(2026-09-28)의 '대입까지 네 걸음'
//   정보 준비 → 대학 찾기 → 원서 준비 → 결과 확인
// 기존 로직(lib/roadmap.js의 gradeRoadmap, data/schedule.js 확정 일정, data/checklists.js)을 그대로 읽어서
// 시안의 네 단계 모양으로만 바꿔 준다. 날짜·D-day는 공고로 확정된 학년도에만 붙인다(CLAUDE.md 규칙).
import { gradeRoadmap } from '../lib/roadmap.js';
import { gradeOption, V1_UNIV_ONLY, getActiveTrack } from '../lib/persona.js';
import { getBookmarks } from '../lib/bookmarks.js';
import { isAdmissionYearConfirmed, ADMISSION_CONFIRMED } from '../data/schedule.js';
import { buildChecklist } from '../data/checklists.js';

// 서류 체크 저장소 — ChecklistSection 과 같은 키(체크 상태를 같이 쓴다)
const CHECK_KEY = 'rebridge_checklist';

export function loadChecked() {
  try { return JSON.parse(localStorage.getItem(CHECK_KEY)) || {}; } catch { return {}; }
}
export function saveChecked(map) {
  try { localStorage.setItem(CHECK_KEY, JSON.stringify(map)); } catch { /* 무시 */ }
}

// 대입 서류 목록 — ChecklistSection 과 같은 방식(v1은 대입 트랙 고정)
export function checklistItems(profile) {
  const track = V1_UNIV_ONLY ? 'univ' : getActiveTrack();
  return buildChecklist(track, profile);
}

// '나이스(kged.go.kr) 또는 시도교육청' → '나이스 또는 시도교육청'
export function issuerShort(issuer = '') {
  return issuer.replace(/\s*\([^)]*\)/g, '').trim();
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
function isoDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// 확정 학년도에서 오늘 이후 가장 가까운 일정(keys 중) — 없으면 null
function nextConfirmed(admissionYear, keys, today) {
  if (!isAdmissionYearConfirmed(admissionYear)) return null;
  const base = startOfDay(today);
  const out = [];
  for (const [key, label] of keys) {
    const c = ADMISSION_CONFIRMED[admissionYear]?.[key];
    if (!c) continue;
    const startIso = c.start ?? c.date ?? c.end;
    const endIso = c.end ?? c.date ?? c.start;
    const start = isoDate(startIso);
    if (isoDate(endIso) < base) continue;
    const diff = Math.round((start - base) / 86400000);
    const s = start;
    const text = c.start && c.end
      ? `${s.getMonth() + 1}월 ${s.getDate()}일~${Number(c.end.slice(8))}일`
      : `${s.getMonth() + 1}월 ${s.getDate()}일`;
    out.push({ key, label, date: start, text, dday: diff > 0 ? `D-${diff}` : 'D-DAY' });
  }
  out.sort((a, b) => a.date - b.date);
  return out[0] || null;
}

const APPLY_KEYS = [['susiApply', '수시 원서 접수'], ['jeongsiApply', '정시 원서 접수'], ['extraApply', '추가 모집']];
const RESULT_KEYS = [['susiResult', '수시 합격 발표'], ['jeongsiResult', '정시 합격 발표']];

// 원서·결과 일정 — 확정 일정이 남아 있으면 그 일정, 없으면 '공고 전'(다음 학년도)
function scheduleOf(baseYear, keys, today) {
  const hit = nextConfirmed(baseYear, keys, today);
  if (hit) return { confirmed: true, year: baseYear, ...hit };
  // 확정 학년도인데 일정이 다 지났으면 다음 학년도를 본다
  const year = isAdmissionYearConfirmed(baseYear) ? baseYear + 1 : baseYear;
  const hit2 = nextConfirmed(year, keys, today);
  if (hit2) return { confirmed: true, year, ...hit2 };
  return { confirmed: false, year };
}

/**
 * profile → 시안의 네 단계 로드맵
 * 반환: { infoDone, gradeLabel, region, place('고3 · 경기'), current, steps[], apply, result, bookmarkCount }
 *   step = { id, title, short, sub, status: 'done'|'current'|'next', badge: {text, tone}|null }
 */
export function aRoadmap(profile, today = new Date()) {
  const bookmarkCount = getBookmarks().length;
  const g = gradeOption(profile?.grade);
  const gradeLabel = g ? g.short : null;
  const region = profile?.homeRegion || null;
  const infoDone = !!(gradeLabel && region);
  const hasScore = profile?.gedAvg != null;
  const rm = gradeRoadmap(profile, bookmarkCount, today);
  const apply = scheduleOf(rm.admissionYear, APPLY_KEYS, today);
  const result = scheduleOf(rm.admissionYear, RESULT_KEYS, today);

  const current = infoDone ? 'univ' : 'info';
  const place = [gradeLabel, region].filter(Boolean).join(' · ');

  const schedBadge = (s) => (s.confirmed
    ? { text: s.dday, tone: 'neutral' }
    : { text: '공고 전', tone: 'neutral' });

  const steps = [
    {
      id: 'info',
      title: '내 정보 준비',
      short: '정보 준비',
      sub: infoDone
        ? `학년·지역${hasScore ? '·점수' : ''} 입력 완료`
        : '학년·지역·검정고시 점수를 입력해요',
      status: infoDone ? 'done' : 'current',
      badge: infoDone ? { text: '완료', tone: 'green' } : { text: '지금 여기', tone: 'green' },
    },
    {
      id: 'univ',
      title: '대학 찾아보기',
      short: '대학 찾기',
      sub: infoDone && bookmarkCount > 0
        ? `관심 대학 ${bookmarkCount}곳을 비교하고 있어요`
        : '조건에 맞는 학교와 전형을 비교해요',
      status: infoDone ? 'current' : 'next',
      badge: infoDone ? { text: '지금 여기', tone: 'peach' } : { text: '선택', tone: 'neutral' },
    },
    {
      id: 'apply',
      title: '원서와 서류 준비',
      short: '원서 준비',
      sub: !infoDone
        ? '필요한 서류는 일정과 함께 알려드려요'
        : apply.confirmed
          ? `${apply.label} ${apply.text}`
          : `${apply.year}학년도 일정 공고 전이에요`,
      status: 'next',
      badge: schedBadge(apply),
    },
    {
      id: 'result',
      title: '결과 확인',
      short: '결과 확인',
      sub: result.confirmed && infoDone
        ? `${result.label} ${result.text}`
        : '발표 일정이 나오면 확인해요',
      status: 'next',
      badge: schedBadge(result),
    },
  ];

  return { infoDone, gradeLabel, region, place, current, steps, apply, result, bookmarkCount, hasScore };
}
