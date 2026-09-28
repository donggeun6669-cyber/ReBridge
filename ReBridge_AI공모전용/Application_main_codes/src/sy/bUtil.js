// 묶음 B 전용 헬퍼 — 꿈드림센터 홈 · 위치 동의 · 지원 상세 · 쪽지 작성 (2026-09-28 서연 시안)
// 기존 lib(centers.js·persona.js·dreamServices.js·commonSupport.js)의 데이터만 읽어서 화면에 맞게 정리한다.
// 새 저장소를 만들지 않는다 — 위치 동의·쪽지 저장은 전부 lib/centers.js·lib/messages.js 그대로 쓴다.
import { REGIONS, filterCenters, suggestedCenter } from '../lib/centers.js';
import { getHomeRegion, DREAMDRIM_MIN_AGE, DREAMDRIM_MAX_AGE } from '../lib/persona.js';
import { DREAM_SERVICES, DREAM_ASKS } from '../data/dreamServices.js';
import { COMMON_SUPPORT } from '../data/commonSupport.js';

// 사는 지역을 몰라도 뭔가는 보여줘야 해서(옛 CentersScreen과 동일 규칙) 서울로 fallback.
export function homeFallbackCenter() {
  const r = getHomeRegion();
  return suggestedCenter(REGIONS.includes(r) ? r : '서울');
}

// 위치가 있으면 실제 거리순 1등을 '가장 가까운 센터'로 쓴다(가짜 거리를 만들지 않는다).
export function nearestCenter(pos) {
  if (!pos) return null;
  const list = filterCenters({ pos });
  return list[0] || null;
}

// 카카오맵 앱을 새 탭으로 여는 링크(지도 SDK 없이도 되는 방식 — MAP_ENABLED 스위치와 무관).
export function mapLink(center) {
  if (!center?.lat || !center?.lng) return null;
  return `https://map.kakao.com/link/map/${encodeURIComponent(center.name)},${center.lat},${center.lng}`;
}

const AGE_TEXT = `${DREAMDRIM_MIN_AGE}세~${DREAMDRIM_MAX_AGE}세`;

// 시안(꿈드림센터 · 지원 상세 펼침.png)에 나온 문구 그대로 — 기본값이자 유일하게 시안이 있는 항목.
const STUDY_DETAIL = {
  id: 'study',
  tag: '학습 지원',
  title: '검정고시 학습 지원',
  desc: '시험 준비에 필요한 수업과 교재를 지원해요.',
  target: `${AGE_TEXT} 학교 밖 청소년`,
  applyAt: '가까운 꿈드림센터',
  cost: '무료',
  whatBody: '기초 학습 상담 뒤 교재와 온라인 강의를 연결해요. 센터마다 운영 방식이 다를 수 있어요.',
  bullets: ['1:1 학습 상담', '검정고시 교재', '과목별 온라인 강의'],
  draft: DREAM_ASKS.find((a) => a.id === 'ged')?.draft || '검정고시 대비반이나 교재 지원을 받을 수 있을까요?',
};

// 시안은 '검정고시 학습 지원' 한 장뿐이지만, 같은 얼개로 다른 지원 항목도 열어 볼 수 있게
// dreamServices.js · commonSupport.js 데이터를 같은 모양으로 정리한다(지어낸 값 없음).
export function getSupportDetail(id) {
  if (!id || id === 'study') return STUDY_DETAIL;
  const svc = DREAM_SERVICES.find((s) => s.id === id);
  if (svc) {
    return {
      id: svc.id,
      tag: '꿈드림 지원',
      title: svc.title,
      desc: svc.short,
      target: `${AGE_TEXT} 학교 밖 청소년`,
      applyAt: '가까운 꿈드림센터',
      cost: '무료',
      whatBody: svc.items?.[0]?.d || '',
      bullets: (svc.items || []).map((it) => it.t),
      draft: DREAM_ASKS.find((a) => a.id === svc.id)?.draft || `${svc.title} 관련해서 문의드리고 싶어요.`,
    };
  }
  const common = COMMON_SUPPORT.find((c) => c.id === id);
  if (common) {
    return {
      id: common.id,
      tag: common.status === 'check' ? '확인 필요' : '공통 지원',
      title: common.title,
      desc: common.short,
      target: `${AGE_TEXT} 학교 밖 청소년`,
      applyAt: '가까운 꿈드림센터',
      cost: common.status === 'check' ? '지역마다 달라요' : '무료',
      whatBody: common.detail,
      bullets: [],
      draft: `${common.title}에 대해 문의드리고 싶어요.`,
    };
  }
  return STUDY_DETAIL;
}
