// 묶음 D(대학 상세 · 지원 가능 여부 · 제출서류 · 검정고시 안내) 공통 도우미 — 2026-09-28
// 계산은 전부 기존 로직(scoreEngine·analysis·documents)을 부른다. 여기서는 화면 문구로 옮기기만 한다.
import {
  evaluateAdmission, admissionChance, hasSpecialEligibility,
} from '../lib/scoreEngine.js';
import { CUTLINE_NO_DATA_SHORT } from '../data/meta.js';

// 전형 이름 — 시안의 '학생부종합 · 가천바람개비' 꼴. 이름이 유형과 같거나 유형으로 시작하면 이름만.
export function admissionLabel(r) {
  const name = r?.admissionName || '';
  const type = r?.admissionType || '';
  if (!type || !name) return name || type || '전형';
  if (name === type || name.startsWith(type)) return name;
  return `${type} · ${name}`;
}

// 수능최저 한 줄 — 자료에 확인된 값만. '미확인'이면 말하지 않는다.
function csatText(raw) {
  if (!raw) return null;
  const s = String(raw);
  if (s.includes('미확인')) return null;
  if (s.includes('해당없음') || s.includes('없음') || s === '미적용') return '수능 최저 없음';
  return '수능 최저 있음';
}

// 전형 행 아래 설명 한 줄 — 시안: '면접 있음 · 수능 최저 없음' / '학교장 추천 필요' / '논술 100% · 수능 최저 있음'
export function admissionSub(r, dl) {
  if (!r) return '';
  // 불가·조건부 이유는 지원 여부를 가르므로 먼저 보여준다
  if ((r.gedEligible === '불가' || r.gedEligible === '조건부') && r.gedIneligibleReason) {
    return r.gedIneligibleReason;
  }
  const parts = [];
  const method = r.evalMethod && r.evalMethod.length <= 14 && !r.evalMethod.includes('단계') ? r.evalMethod : null;
  if (method) parts.push(method);
  else if (typeof r.interview === 'boolean') parts.push(r.interview ? '면접 있음' : '면접 없음');
  const cs = csatText(r.csatMinimum);
  if (cs) parts.push(cs);
  // 2027 대교협 자료에는 면접·수능최저가 없다 → 수시/정시와 원서 마감을 대신 적는다
  if (parts.length === 0) {
    parts.push(r.phase || '수시/정시 미상');
    if (dl && !dl.past) parts.push(`원서 마감 ${dl.dateLabel}`);
  }
  return parts.join(' · ');
}

// 대학 상단 칩 — '경기 · 사립 · 4년제'
export function univChip(univ) {
  return [univ.region, univ.establishment, univ.kind === '전문대학' ? '전문대' : '4년제']
    .filter(Boolean).join(' · ');
}

// 대학 이름 아래 한 줄 — '학생부종합/교과/논술 · 면접 전형 있음'
// (시안 맨 앞의 '성남시'는 자료에 시·군 정보가 없어 뺀다)
export function univSubline(rows) {
  const ok = rows.filter((r) => r.gedEligible === '가능' || r.gedEligible === '조건부');
  const types = [];
  for (const r of ok) if (r.admissionType && !types.includes(r.admissionType)) types.push(r.admissionType);
  let typeText = '';
  types.forEach((t, i) => {
    const short = i > 0 && t.startsWith('학생부') && types[0].startsWith('학생부') ? t.replace('학생부', '') : t;
    typeText += (i ? '/' : '') + short;
  });
  const parts = [];
  if (typeText) parts.push(typeText);
  if (ok.some((r) => r.interview === true)) parts.push('면접 전형 있음');
  return parts.join(' · ');
}

// 담임 한마디 — 기존 DetailScreen 의 문구 규칙 그대로(점수 있으면 칸수 분포, 없으면 전형 수)
export function coachSummary(profile, okRows, eligibleCount, univId) {
  const hasScore = !!(profile && profile.gedScores && profile.gedAvg != null);
  if (!hasScore) {
    return `검정고시로 지원할 수 있는 전형이 ${eligibleCount}개 있어요. 내 점수를 넣으면 합격 가능성까지 보여드릴게요.`;
  }
  const isTarget = profile.scoreMode === 'target';
  const evs = okRows.map((r) => evaluateAdmission(profile, { ...r, univId }));
  const levels = evs.map((ev) => (ev ? admissionChance(ev)?.level : null)).filter((v) => v != null);
  const safe = levels.filter((l) => l >= 4).length;
  const reach = levels.filter((l) => l === 3).length;
  if (levels.length === 0) {
    const gaps = evs.map((e) => e?.dataGap).filter(Boolean);
    const top = gaps.length
      ? [...gaps].sort((a, b) => gaps.filter((g) => g === b).length - gaps.filter((g) => g === a).length)[0]
      : null;
    const why =
      top === 'conversion' ? '이 대학이 검정고시 점수를 몇 등급으로 볼지 공개하지 않아서 점수 비교는 어려워요'
      : top === 'special' ? '지원자격이 따로 있는 전형이 많아 합격 가능성은 계산하지 않아요'
      : top === 'csat' ? '수능 성적으로 뽑는 전형이라 검정고시 평균으로는 비교가 어려워요'
      : `${CUTLINE_NO_DATA_SHORT}이라 점수 비교는 어려워요`;
    return `검정고시로 지원 가능한 전형이 ${eligibleCount}개 있어요. 다만 ${why}.`;
  }
  if (safe > 0) return `${isTarget ? '목표' : '지금'} 점수(평균 ${profile.gedAvg}점)면 ${safe}개 전형이 적정~안정권이에요. 충분히 노려볼 만해요!`;
  if (reach > 0) return `조금 부족하지만 ${reach}개 전형은 소신 지원이 가능해요. 합격선까지 얼마 안 남았어요.`;
  return '아직 합격선까지 거리가 있어요. 부족한 점수를 같이 채워봐요.';
}

// 지원 가능 여부 라벨(시안 '전형별 지원 가능 여부'의 7종)
//   ok 가능 · no 불가 · cond 조건부 · check 확인 필요 · quota 정원외 · lock 자격 제한 · none 자료 없음
export function matrixKind(r) {
  if (r.quotaOutside) return 'quota';
  if (r.gedEligible === '불가') return 'no';
  if (r.gedEligible !== '가능' && r.gedEligible !== '조건부') return 'check';
  if (hasSpecialEligibility(r)) return 'lock';
  return r.gedEligible === '가능' ? 'ok' : 'cond';
}
