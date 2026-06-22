// 꿈드림센터 혜택 카테고리 체계
// ─────────────────────────────────────────────────────────────
// 현장 실무자 피드백: "센터마다 주는 지원(교통비/식사비/교재비/심리상담 연계 등)이
// 다 다른데 어디서도 정리가 안 돼 있다. 카테고리만 잘 분류해도 학생들이 혜택을 알게 된다."
//
// 데이터 전수수집은 불가(센터 개별 문의)라, "구조를 먼저 만들고 채워가는" 방식.
// 각 센터 객체의 `benefits` 필드에는 아래 id 배열을 넣는다. (kkumdrim.json)
//
// icon 값은 lucide-react 아이콘 컴포넌트 이름. (DreamdriveScreen에서 매핑)

export const BENEFIT_CATEGORIES = [
  {
    id: 'counseling',
    label: '심리·진로 상담',
    icon: 'HeartHandshake',
    desc: '심리검사·개인상담·진로상담·전문기관 연계 (전국 공통)',
  },
  {
    id: 'learning',
    label: '학습 지원',
    icon: 'GraduationCap',
    desc: '검정고시 대비·기초학습·교과 프로그램 (전국 공통)',
  },
  {
    id: 'career',
    label: '진로·직업체험',
    icon: 'Compass',
    desc: '직업탐색·직업체험·취업훈련 연계 (전국 공통)',
  },
  {
    id: 'community',
    label: '급식·관계형성',
    icon: 'Users',
    desc: '무상급식·동아리·캠프 등 또래 관계와 일상 지원 (전국 공통)',
  },
  {
    id: 'health',
    label: '건강검진',
    icon: 'Activity',
    desc: '학교 밖 청소년 건강검진 무료 지원 9세~18세 (전국 공통)',
  },
  {
    id: 'economic',
    label: '경제적 지원',
    icon: 'Wallet',
    desc: '교통비·식사비·교재비 등 현물/현금성 지원 (센터별 상이)',
  },
];

// id → 카테고리 객체 빠른 조회용 맵
export const BENEFIT_CATEGORY_MAP = BENEFIT_CATEGORIES.reduce((acc, cat) => {
  acc[cat.id] = cat;
  return acc;
}, {});
