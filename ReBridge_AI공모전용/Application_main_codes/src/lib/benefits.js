// 센터의 benefits(카테고리 id 배열)를 카테고리 객체로 매핑/그룹핑하는 헬퍼.
import { BENEFIT_CATEGORIES, BENEFIT_CATEGORY_MAP } from '../data/benefitCategories';

export { BENEFIT_CATEGORIES, BENEFIT_CATEGORY_MAP };

// 센터가 혜택 정보를 가지고 있는지 (정직성 원칙: 비어있으면 false → 폴백 표시)
export function hasBenefits(center) {
  return Array.isArray(center?.benefits) && center.benefits.length > 0;
}

// 센터의 benefits id 배열 → 카테고리 객체 배열로 매핑 (정의에 없는 id는 제외)
export function getBenefitCategories(center) {
  if (!hasBenefits(center)) return [];
  return center.benefits
    .map((id) => BENEFIT_CATEGORY_MAP[id])
    .filter(Boolean);
}

// 화면에서 한 번에 쓰기 좋은 형태로 정리
//  - categories: 카테고리 객체 배열
//  - note: 센터별 부연 문구(있으면)
//  - known: 정리된 혜택 정보가 있는지 여부
export function getCenterBenefits(center) {
  const categories = getBenefitCategories(center);
  return {
    categories,
    note: center?.benefitNote || null,
    known: categories.length > 0,
  };
}
