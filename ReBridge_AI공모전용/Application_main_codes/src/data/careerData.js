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
      name: '웹디자이너',
      q: '웹디자이너',
      why: '학위보다 포트폴리오를 중요하게 보고, 단기 웹디자인 훈련으로 시작할 수 있어요.',
      connect: { label: '국비 직업훈련으로 배우기', programId: 'tomorrow-card' },
    },
    {
      name: '편집기사(영상 편집)',
      q: '편집기사',
      why: '영상 편집 훈련과 작업물 포트폴리오로 실력을 보여 주며 진입할 수 있어요.',
      connect: { label: '국비 직업훈련으로 배우기', programId: 'tomorrow-card' },
    },
    {
      name: '컴퓨터그래픽디자이너',
      q: '컴퓨터그래픽디자이너',
      why: '컴퓨터그래픽스운용기능사와 포트폴리오로 학력 부담 없이 실력을 준비할 수 있어요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '정보시스템운영자',
      q: '정보시스템운영자',
      why: '정보처리기능사와 시스템 운영 훈련으로 기초 실무를 쌓아 시작할 수 있어요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '시각디자이너',
      q: '시각디자이너',
      why: '디자인 도구 훈련 뒤 포스터·로고 같은 포트폴리오로 실력을 평가받을 수 있어요.',
      connect: { label: '국비 직업훈련으로 배우기', programId: 'tomorrow-card' },
    },
    {
      name: '캐드원',
      q: '캐드원',
      why: 'CAD 단기 훈련과 전산응용 관련 기능사로 설계 도면 실무에 진입할 수 있어요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '웹툰작가',
      q: '웹툰작가',
      why: '정해진 학력보다 그림·스토리 포트폴리오와 꾸준한 연재 경험을 중요하게 봐요.',
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
  ],
  '서비스·요식': [
    {
      name: '제과·제빵사',
      q: '제과사 및 제빵사',
      why: '제과기능사·제빵기능사는 학력 제한이 없어 바로 도전할 수 있어요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '조리사',
      q: '조리사 및 주방장',
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
    {
      name: '네일아티스트',
      q: '네일아티스트',
      why: '미용사(네일) 국가자격은 학력 제한이 없고 실기 준비로 시작할 수 있어요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '피부관리사',
      q: '피부관리사',
      why: '미용사(피부) 국가자격은 학력 제한이 없어 훈련과 실기 연습으로 도전할 수 있어요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '반려동물미용사',
      q: '반려동물미용사',
      why: '학위보다 미용 훈련과 실습 경험을 중요하게 보며 민간 훈련과정으로 시작할 수 있어요.',
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
  ],
  '제조·기술': [
    {
      name: '자동차 정비원',
      q: '자동차정비원',
      why: '자동차정비기능사로 시작해요. 손기술 중심이라 학력 영향이 적어요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '전기 기능원',
      q: '전공',
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
      name: '냉동기사',
      q: '냉동기사',
      why: '공조냉동기계기능사는 학력 제한이 없어 설비 훈련과 자격으로 진입할 수 있어요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '공작기계조작원',
      q: '공작기계조작원',
      why: 'CNC·선반 실습 중심의 직업훈련으로 장비 조작 기술을 익혀 시작할 수 있어요.',
      connect: { label: '국비 직업훈련으로 배우기', programId: 'tomorrow-card' },
    },
    {
      name: '도배원',
      q: '도배원',
      why: '도배기능사는 학력 제한이 없고 짧은 현장 실습과 실기 준비로 도전할 수 있어요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '배관원',
      q: '배관원',
      why: '배관기능사는 학력 제한이 없어 실습 훈련과 자격 취득으로 현장에 들어갈 수 있어요.',
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
  ],
  '사무·행정': [
    {
      name: '사무원(일반 사무)',
      q: '사무보조원',
      why: '컴퓨터활용능력 등 자격과 훈련으로 충분히 시작할 수 있어요.',
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
    {
      name: '전산 회계·경리',
      q: '회계사무원',
      why: '전산회계 자격으로 진입해요. 학위보다 실무 자격을 더 봐요.',
      connect: { label: '기능사·자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '고객 상담·응대',
      q: '텔레마케터',
      why: '학력 요건이 낮고, 단기 교육 후 바로 일하는 경우가 많아요.',
      connect: { label: '취업 지원 알아보기', programId: 'national-employment' },
    },
    {
      name: '병원코디네이터',
      q: '병원코디네이터',
      why: '병원 서비스·원무 단기 훈련으로 접수와 고객 응대 실무를 익혀 시작할 수 있어요.',
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
    {
      name: '전자상거래 운영',
      q: '전자상거래전문가',
      why: '쇼핑몰 운영 도구와 상품 등록 실무를 단기 훈련으로 배워 포트폴리오를 만들 수 있어요.',
      connect: { label: '국비 직업훈련으로 배우기', programId: 'tomorrow-card' },
    },
    {
      name: '설문조사원',
      q: '설문조사원',
      why: '학력보다 정확한 조사·입력 능력을 보며 기본 교육 뒤 현장과 사무 업무를 시작할 수 있어요.',
      connect: { label: '취업 지원 알아보기', programId: 'national-employment' },
    },
    {
      name: '물류관리사',
      q: '물류관리사',
      why: '응시 학력 제한이 없는 물류관리사 자격과 물류 사무 훈련으로 준비할 수 있어요.',
      connect: { label: '기능사·자격 알아보기', programId: 'technician-cert' },
    },
  ],
};

// 커리어넷 진로심리검사 중 학교 밖 청소년의 자기이해와 진로 준비에 유용한 검사
export const PSYCH_TESTS = [
  {
    id: 'youth-interest-h',
    name: '직업흥미검사(H)',
    target: '청소년',
    minutes: '20분',
    desc: '내 흥미 유형과 관심이 가는 직업 분야를 알아봐요.',
    url: 'https://www.career.go.kr/cloud/w/inspect/holland/intro',
  },
  {
    id: 'youth-aptitude',
    name: '직업적성검사',
    target: '청소년',
    minutes: '20~30분',
    desc: '여러 직업 능력 중 내가 강점을 보일 가능성이 있는 영역을 찾아봐요.',
    url: 'https://www.career.go.kr/cloud/w/inspect/vocation/intro',
  },
  {
    id: 'youth-values',
    name: '직업가치관검사',
    target: '청소년',
    minutes: '20분',
    desc: '일을 고를 때 내가 중요하게 생각하는 기준을 알아봐요.',
    url: 'https://www.career.go.kr/cloud/w/inspect/value2/intro',
  },
  {
    id: 'youth-maturity',
    name: '진로성숙도검사',
    target: '청소년',
    minutes: '15~20분',
    desc: '진로를 계획하고 결정할 준비가 어느 정도인지 살펴봐요.',
    url: 'https://www.career.go.kr/cloud/w/inspect/grow3/intro',
  },
  {
    id: 'youth-action',
    name: '진로실행력검사',
    target: '청소년',
    minutes: '15~20분',
    desc: '생각한 진로를 실제 준비와 행동으로 옮기는 힘을 점검해요.',
    url: 'https://www.career.go.kr/cloud/w/inspect/exc/intro',
  },
  {
    id: 'adult-readiness',
    name: '진로개발준비도검사',
    target: '성인',
    minutes: '25~30분',
    desc: '진로 목표를 이루기 위해 지금 무엇이 준비되어 있는지 알아봐요.',
    url: 'https://www.career.go.kr/cloud/w/inspect/ready/intro',
  },
  {
    id: 'adult-ability-confidence',
    name: '주요능력효능감검사',
    target: '성인',
    minutes: '20분',
    desc: '직업에 필요한 여러 능력을 내가 얼마나 자신 있어 하는지 알아봐요.',
    url: 'https://www.career.go.kr/cloud/w/inspect/effect/intro',
  },
  {
    id: 'adult-values',
    name: '직업가치관검사',
    target: '성인',
    minutes: '10분',
    desc: '직업에서 꼭 만족하고 싶은 가치가 무엇인지 알아봐요.',
    url: 'https://www.career.go.kr/cloud/w/inspect/value/intro',
  },
];

// 분야 목록 (직업 사전 칩 순서)
export const CATALOG_FIELDS = ['IT·디자인', '서비스·요식', '제조·기술', '사무·행정'];

// 해당 분야의 큐레이션 직업 목록
export function catalogFor(field) {
  return JOB_CATALOG[field] || JOB_CATALOG['IT·디자인'];
}
