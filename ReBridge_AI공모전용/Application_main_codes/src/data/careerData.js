// 직업 사전 — '학교 밖 청소년이 실제로 닿을 수 있는 직업'만 큐레이션한다.
// 원칙: 커리어넷이 주는 수백 개 직업을 우다다 뿌리지 않는다.
//   - 학력 제한이 낮거나 없는 직업
//   - 기능사·훈련으로 진입 가능한 직업
//   - 너무 당연하거나(예: "공무원"), 학위가 필수인 직업은 뺀다
// 각 항목:
//   name     직업 이름 (사용자에게 보이는 이름)
//   q        커리어넷 검색어(직업사전에서 '하는 일'을 끌어올 키워드)
//   why      학교 밖 청소년에게 '왜 닿을 수 있는지' 한 줄 (가장 중요)
//   connect  { label, programId } 이 직업으로 가려면 앱 안에서 뭘 이어갈지
//            programId는 jobData.js의 JOB_PROGRAMS id를 가리킨다.

export const JOB_CATALOG = {
  'IT·디자인': [
    {
      name: '웹 퍼블리셔',
      q: '웹퍼블리셔',
      why: '학위보다 결과물(포트폴리오)로 평가받아요. 국비 훈련으로 진입 가능해요.',
      connect: { label: '내일배움카드로 배우기', programId: 'tomorrow-card' },
    },
    {
      name: '영상 편집자',
      q: '영상편집',
      why: '독학·훈련으로 시작하는 사람이 많고, 작업물로 바로 일을 받을 수 있어요.',
      connect: { label: '내일배움카드로 배우기', programId: 'tomorrow-card' },
    },
    {
      name: '컴퓨터그래픽(GTQ·디자인)',
      q: '그래픽디자이너',
      why: '컴퓨터그래픽스운용기능사 등 학력 제한 없는 자격으로 시작할 수 있어요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '정보처리(IT 사무·운영)',
      q: '정보처리',
      why: '정보처리기능사는 학력 제한이 없어요. IT 첫발로 많이 골라요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
  ],
  '서비스·요식': [
    {
      name: '제과·제빵사',
      q: '제과제빵사',
      why: '제과기능사·제빵기능사는 학력 제한이 없어 바로 도전할 수 있어요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '조리사',
      q: '조리사',
      why: '한식·양식 조리기능사로 시작해요. 학력보다 실기 자격이 중요해요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '바리스타',
      q: '바리스타',
      why: '단기 훈련·민간자격으로 빠르게 진입해 카페에서 일할 수 있어요.',
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
    {
      name: '미용사',
      q: '미용사',
      why: '미용사 기능사는 학력 제한이 없고, 자격이 곧 취업으로 이어져요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
  ],
  '제조·기술': [
    {
      name: '자동차 정비원',
      q: '자동차정비',
      why: '자동차정비기능사로 시작해요. 손기술 중심이라 학력 영향이 적어요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '전기 기능원',
      q: '전기공',
      why: '전기기능사는 학력 제한이 없고, 자격이 있으면 취업·임금에서 유리해요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '용접원',
      q: '용접원',
      why: '용접기능사로 진입해요. 기술이 곧 경쟁력이라 현장 수요가 꾸준해요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '설비·기계 운전',
      q: '설비',
      why: '국비 훈련으로 기술을 배워 현장에 들어가는 길이 열려 있어요.',
      connect: { label: '내일배움카드로 배우기', programId: 'tomorrow-card' },
    },
  ],
  '사무·행정': [
    {
      name: '사무원(일반 사무)',
      q: '사무원',
      why: '컴퓨터활용능력 등 자격과 훈련으로 충분히 시작할 수 있어요.',
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
    {
      name: '전산 회계·경리',
      q: '경리사무원',
      why: '전산회계 자격으로 진입해요. 학위보다 실무 자격을 더 봐요.',
      connect: { label: '기능사·자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '고객 상담·응대',
      q: '텔레마케터',
      why: '학력 요건이 낮고, 단기 교육 후 바로 일하는 경우가 많아요.',
      connect: { label: '취업 지원 알아보기', programId: 'national-employment' },
    },
  ],
};

// 분야 목록 (직업 사전 칩 순서)
export const CATALOG_FIELDS = ['IT·디자인', '서비스·요식', '제조·기술', '사무·행정'];

// 해당 분야의 큐레이션 직업 목록
export function catalogFor(field) {
  return JOB_CATALOG[field] || JOB_CATALOG['IT·디자인'];
}
