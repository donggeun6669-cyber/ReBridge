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
//   edu      학력 칩 라벨을 정직하게 결정하는 키 (JobInfoScreen.metaChips에서 사용)
//              'cert-free'  학력 제한 없는 국가자격(기능사 등)이 있는 길 → "학력 제한 없는 자격"
//              'open'       학력보다 실력·포트폴리오·실무를 보는 길     → "학교 안 나와도 도전 가능"
//              'check'      학력 무관 여부가 자리마다 달라 확인이 필요    → "학력 조건 확인 필요"
//   tags     검색 보조 키워드(선택). name/q 외에 더 잡히게 한다.

export const JOB_CATALOG = {
  'IT·디자인': [
    {
      name: '웹디자이너',
      q: '웹디자이너',
      why: '학위보다 포트폴리오를 중요하게 보고, 단기 웹디자인 훈련으로 시작할 수 있어요.',
      edu: 'open',
      tags: ['웹', '디자인', '퍼블리싱', 'UI'],
      connect: { label: '국비 직업훈련으로 배우기', programId: 'tomorrow-card' },
    },
    {
      name: '웹퍼블리셔(코딩)',
      q: '웹개발자',
      why: '학위보다 만든 화면·코드를 보고 뽑는 경우가 많아, 부트캠프·국비훈련으로 시작할 수 있어요.',
      edu: 'open',
      tags: ['HTML', 'CSS', '코딩', '프론트엔드', '개발'],
      connect: { label: '국비 직업훈련으로 배우기', programId: 'tomorrow-card' },
    },
    {
      name: '컴퓨터그래픽디자이너',
      q: '컴퓨터그래픽디자이너',
      why: '컴퓨터그래픽기능사와 포트폴리오로 학력 부담 없이 실력을 준비할 수 있어요.',
      edu: 'cert-free',
      tags: ['그래픽', '포토샵', '편집디자인'],
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '정보시스템운영자',
      q: '정보시스템운영자',
      why: '프로그래밍기능사 등 자격과 운영 훈련으로 기초 실무를 쌓아 시작할 수 있어요.',
      edu: 'cert-free',
      tags: ['IT', '전산', '서버', '운영'],
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '시각디자이너',
      q: '시각디자이너',
      why: '디자인 도구 훈련 뒤 포스터·로고 같은 포트폴리오로 실력을 평가받을 수 있어요.',
      edu: 'open',
      tags: ['디자인', '그래픽', '브랜딩'],
      connect: { label: '국비 직업훈련으로 배우기', programId: 'tomorrow-card' },
    },
    {
      name: '캐드원',
      q: '캐드원',
      why: 'CAD 단기 훈련과 전산응용 관련 기능사로 설계 도면 실무에 진입할 수 있어요.',
      edu: 'cert-free',
      tags: ['CAD', '도면', '설계'],
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '데이터 입력·전산 보조',
      q: '데이터입력원',
      why: '컴퓨터활용능력 정도면 시작할 수 있어, 학력보다 정확함·꼼꼼함을 봐요.',
      edu: 'open',
      tags: ['전산', '엑셀', '입력', '사무'],
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
  ],
  '콘텐츠·미디어': [
    {
      name: '영상 편집자',
      q: '편집기사',
      why: '영상 편집 훈련과 작업물 포트폴리오로 실력을 보여 주며 진입할 수 있어요.',
      edu: 'open',
      tags: ['영상', '편집', '프리미어', '유튜브', '편집기사'],
      connect: { label: '국비 직업훈련으로 배우기', programId: 'tomorrow-card' },
    },
    {
      name: '유튜브·SNS 콘텐츠 크리에이터',
      q: '미디어콘텐츠창작자',
      why: '학력 조건 없이 누구나 시작할 수 있고, 만든 콘텐츠가 곧 실력의 증거가 돼요.',
      edu: 'open',
      tags: ['유튜브', 'SNS', '인스타', '콘텐츠', '크리에이터', '쇼츠'],
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
    {
      name: '웹툰작가',
      q: '웹툰작가',
      why: '정해진 학력보다 그림·스토리 포트폴리오와 꾸준한 연재 경험을 중요하게 봐요.',
      edu: 'open',
      tags: ['웹툰', '만화', '그림', '일러스트'],
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
    {
      name: '사진작가·사진 보조',
      q: '사진작가',
      why: '학위보다 촬영 실력·포트폴리오를 보고, 스튜디오 보조로 현장부터 시작할 수 있어요.',
      edu: 'open',
      tags: ['사진', '촬영', '스튜디오', '포토그래퍼'],
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
    {
      name: '콘텐츠 에디터·SNS 운영',
      q: '에디터',
      why: '글·이미지로 채널을 꾸리는 일이라, 학력보다 만든 게시물·감각을 봐요.',
      edu: 'open',
      tags: ['에디터', 'SNS', '마케팅', '콘텐츠', '블로그'],
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
  ],
  '서비스·요식': [
    {
      name: '제과·제빵사',
      q: '제과사 및 제빵사',
      why: '제과기능사·제빵기능사는 학력 제한이 없어 바로 도전할 수 있어요.',
      edu: 'cert-free',
      tags: ['제과', '제빵', '베이커리', '빵', '디저트'],
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '조리사',
      q: '조리사 및 주방장',
      why: '한식·양식 조리기능사로 시작해요. 학력보다 실기 자격이 중요해요.',
      edu: 'cert-free',
      tags: ['요리', '조리', '주방', '셰프', '한식', '양식'],
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '바리스타',
      q: '바리스타',
      why: '단기 훈련·민간자격으로 빠르게 진입해 카페에서 일할 수 있어요.',
      edu: 'open',
      tags: ['커피', '카페', '바리스타', '음료'],
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
    {
      name: '미용사',
      q: '미용사',
      why: '미용사 기능사는 학력 제한이 없고, 자격이 곧 취업으로 이어져요.',
      edu: 'cert-free',
      tags: ['미용', '헤어', '머리', '뷰티'],
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '네일아티스트',
      q: '네일아티스트',
      why: '미용사(네일) 국가자격은 학력 제한이 없고 실기 준비로 시작할 수 있어요.',
      edu: 'cert-free',
      tags: ['네일', '뷰티', '미용'],
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '피부관리사',
      q: '피부관리사',
      why: '미용사(피부) 국가자격은 학력 제한이 없어 훈련과 실기 연습으로 도전할 수 있어요.',
      edu: 'cert-free',
      tags: ['피부', '에스테틱', '뷰티', '미용'],
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '메이크업 아티스트',
      q: '메이크업아티스트',
      why: '메이크업 미용 국가자격이 있고, 학력보다 실기·포트폴리오를 중요하게 봐요.',
      edu: 'cert-free',
      tags: ['메이크업', '화장', '뷰티', '미용'],
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
  ],
  '제조·기술': [
    {
      name: '자동차 정비원',
      q: '자동차정비원',
      why: '자동차정비기능사로 시작해요. 손기술 중심이라 학력 영향이 적어요.',
      edu: 'cert-free',
      tags: ['자동차', '정비', '카센터', '엔진'],
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '전기 기능원',
      q: '전공',
      why: '전기기능사는 학력 제한이 없고, 자격이 있으면 취업·임금에서 유리해요.',
      edu: 'cert-free',
      tags: ['전기', '배선', '설비'],
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '용접원',
      q: '용접원',
      why: '용접기능사로 진입해요. 기술이 곧 경쟁력이라 현장 수요가 꾸준해요.',
      edu: 'cert-free',
      tags: ['용접', '금속', '조선', '플랜트'],
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '냉동·공조 설비원',
      q: '냉동기사',
      why: '공조냉동기계기능사는 학력 제한이 없어 설비 훈련과 자격으로 진입할 수 있어요.',
      edu: 'cert-free',
      tags: ['냉동', '공조', '에어컨', '설비'],
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '공작기계조작원',
      q: '공작기계조작원',
      why: 'CNC·선반 실습 중심의 직업훈련으로 장비 조작 기술을 익혀 시작할 수 있어요.',
      edu: 'open',
      tags: ['CNC', '선반', '기계', '가공'],
      connect: { label: '국비 직업훈련으로 배우기', programId: 'tomorrow-card' },
    },
    {
      name: '도배·실내 마감원',
      q: '도배원',
      why: '도배기능사는 학력 제한이 없고 짧은 현장 실습과 실기 준비로 도전할 수 있어요.',
      edu: 'cert-free',
      tags: ['도배', '인테리어', '마감', '시공'],
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
  ],
  '사무·행정': [
    {
      name: '사무원(일반 사무)',
      q: '사무보조원',
      why: '컴퓨터활용능력 등 자격과 훈련으로 충분히 시작할 수 있어요.',
      edu: 'open',
      tags: ['사무', '엑셀', '문서', '행정', '오피스'],
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
    {
      name: '전산 회계·경리',
      q: '회계사무원',
      why: '전산회계 자격으로 진입해요. 학위보다 실무 자격을 더 봐요.',
      edu: 'cert-free',
      tags: ['회계', '경리', '세무', '전산회계'],
      connect: { label: '기능사·자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '고객 상담·응대',
      q: '텔레마케터',
      why: '학력 요건이 낮고, 단기 교육 후 바로 일하는 경우가 많아요.',
      edu: 'open',
      tags: ['상담', '콜센터', '고객', 'CS', '응대'],
      connect: { label: '취업 지원 알아보기', programId: 'national-employment' },
    },
    {
      name: '병원 접수·원무 행정',
      q: '병원코디네이터',
      why: '병원 서비스·원무 단기 훈련으로 접수와 고객 응대 실무를 익혀 시작할 수 있어요.',
      edu: 'open',
      tags: ['병원', '원무', '접수', '코디네이터', '의료'],
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
    {
      name: '공공기관 행정 보조',
      q: '행정사무원',
      why: '학력 무관 청년인턴·일경험으로 들어가 행정 실무를 익히는 자리가 있어요. 자리마다 조건은 확인해요.',
      edu: 'check',
      tags: ['공공', '행정', '관공서', '인턴', '주민센터'],
      connect: { label: '취업 지원 알아보기', programId: 'national-employment' },
    },
  ],
  '이커머스·유통': [
    {
      name: '온라인 쇼핑몰 운영',
      q: '전자상거래전문가',
      why: '쇼핑몰 운영 도구와 상품 등록 실무를 단기 훈련으로 배워 직접 운영하며 시작할 수 있어요.',
      edu: 'open',
      tags: ['쇼핑몰', '이커머스', '스마트스토어', '온라인판매', '전자상거래'],
      connect: { label: '국비 직업훈련으로 배우기', programId: 'tomorrow-card' },
    },
    {
      name: '상품 등록·MD 보조',
      q: '상품기획자',
      why: '상품 사진·설명을 올리고 관리하는 일부터 시작해, 학력보다 꼼꼼함·감각을 봐요.',
      edu: 'open',
      tags: ['MD', '상품등록', '상세페이지', '온라인'],
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
    {
      name: '물류·재고 관리원',
      q: '물류관리사',
      why: '응시 학력 제한이 없는 물류관리사 자격과 물류 사무 훈련으로 준비할 수 있어요.',
      edu: 'cert-free',
      tags: ['물류', '재고', '창고', '입출고', '유통'],
      connect: { label: '기능사·자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '택배·배송 기사',
      q: '택배원',
      why: '운전면허가 있으면 시작할 수 있고, 학력 조건 없이 성실함을 보는 일이에요.',
      edu: 'open',
      tags: ['택배', '배송', '배달', '운송', '물류'],
      connect: { label: '취업 지원 알아보기', programId: 'national-employment' },
    },
    {
      name: '매장 판매·관리원',
      q: '판매원',
      why: '학력 조건 없이 시작해 응대·진열을 익히고, 매니저로 성장할 수 있어요.',
      edu: 'open',
      tags: ['판매', '매장', '리테일', '서비스', '진열'],
      connect: { label: '취업 지원 알아보기', programId: 'national-employment' },
    },
  ],
  '돌봄·복지': [
    {
      name: '보육 보조',
      q: '보육교사',
      why: '어린이집 보조 자리부터 경험을 쌓을 수 있어요. 보육교사 자격은 학력·과정 요건이 있어 확인이 필요해요.',
      edu: 'check',
      tags: ['보육', '어린이집', '아이', '보조', '유아'],
      connect: { label: '취업 지원 알아보기', programId: 'national-employment' },
    },
    {
      name: '요양보호사',
      q: '요양보호사',
      why: '요양보호사 자격은 학력 제한 없이 교육과정 이수·시험으로 딸 수 있어요(만 나이 등 요건 확인).',
      edu: 'check',
      tags: ['요양', '돌봄', '어르신', '복지', '간병'],
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
    {
      name: '사회복지 보조·생활지원',
      q: '사회복지사',
      why: '복지관·기관의 생활지원·보조 자리부터 경험할 수 있어요. 사회복지사 자격은 학력 요건이 있어 확인이 필요해요.',
      edu: 'check',
      tags: ['사회복지', '복지관', '봉사', '지원', '돌봄'],
      connect: { label: '취업 지원 알아보기', programId: 'national-employment' },
    },
    {
      name: '산후·아이 돌봄 도우미',
      q: '산모신생아건강관리사',
      why: '돌봄 서비스 교육을 이수하면 시작할 수 있어요. 정부 지원 사업과 연계되는 자리도 있어요.',
      edu: 'check',
      tags: ['돌봄', '산후', '아이돌봄', '가사', '육아'],
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
  ],
  '반려·생활': [
    {
      name: '반려동물 미용사',
      q: '반려동물미용사',
      why: '학위보다 미용 훈련과 실습 경험을 중요하게 보며 민간 훈련과정으로 시작할 수 있어요.',
      edu: 'open',
      tags: ['반려동물', '애견미용', '강아지', '펫'],
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
    {
      name: '반려동물 훈련·돌봄',
      q: '반려동물행동교정사',
      why: '학력보다 동물을 다루는 경험·태도를 봐요. 펫시터·훈련 보조부터 시작할 수 있어요.',
      edu: 'open',
      tags: ['반려동물', '펫시터', '훈련', '강아지', '돌봄'],
      connect: { label: '직업훈련 알아보기', programId: 'tomorrow-card' },
    },
    {
      name: '플로리스트(꽃)',
      q: '플로리스트',
      why: '화훼장식기능사 등 학력 제한 없는 자격이 있고, 손재주·감각을 중요하게 봐요.',
      edu: 'cert-free',
      tags: ['꽃', '플로리스트', '화훼', '원예'],
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
    },
    {
      name: '제과·카페 창업 준비',
      q: '바리스타',
      why: '기능사·바리스타 자격과 매장 경험을 쌓아 작은 가게 창업으로 이어갈 수 있어요.',
      edu: 'cert-free',
      tags: ['창업', '카페', '디저트', '소자본', '가게'],
      connect: { label: '기능사 자격 알아보기', programId: 'technician-cert' },
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
// 앞 4개는 취업 프로필 질문(jobData.JOB_QUESTIONS)의 관심 분야와 1:1로 맞춰 둔다.
// 뒤 4개는 카탈로그 탐색 전용으로 더한 분야(다양화).
// '전체'가 맨 앞 — 누르면 커리어넷 직업사전 전체(검색어 없이)를 보여준다.
export const CATALOG_FIELDS = [
  '전체',
  'IT·디자인', '서비스·요식', '제조·기술', '사무·행정',
  '콘텐츠·미디어', '이커머스·유통', '돌봄·복지', '반려·생활',
];

// 각 분야 칩이 커리어넷에서 검색할 키워드들(이름 기반 검색이라 여러 개를 묶어 결과를 넓힌다).
// '전체'는 키워드 없이 직업사전 전체를 페이지로 불러온다.
export const FIELD_SEARCH_KEYWORDS = {
  'IT·디자인':     ['개발', '디자인', '프로그래머', '웹', '데이터', '소프트웨어'],
  '서비스·요식':   ['조리', '요리', '제빵', '바리스타', '호텔', '여행', '서비스'],
  '제조·기술':     ['정비', '기계', '용접', '전기', '설비', '제조', '생산'],
  '사무·행정':     ['사무', '행정', '경리', '회계', '비서', '총무'],
  '콘텐츠·미디어': ['영상', '방송', '편집', '촬영', '작가', '기자', '디자이너', '광고'],
  '이커머스·유통': ['판매', '유통', '물류', '상품', '구매', '무역'],
  '돌봄·복지':     ['요양', '복지', '돌봄', '간호', '보육', '상담'],
  '반려·생활':     ['미용', '반려', '애견', '플로리스트', '제과', '메이크업'],
};

// 해당 분야의 큐레이션 직업 목록
export function catalogFor(field) {
  return JOB_CATALOG[field] || JOB_CATALOG['IT·디자인'];
}

// 모든 직업을 분야와 함께 펼친 평면 목록 (검색용)
export function allJobs() {
  return CATALOG_FIELDS.flatMap((field) =>
    (JOB_CATALOG[field] || []).map((job) => ({ ...job, field })));
}

// 키워드로 직업 검색 — name / q / 분야 / tags 를 모두 본다. 공백 무시, 대소문자 무시.
export function searchJobs(query) {
  const k = String(query || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!k) return [];
  return allJobs().filter((job) => {
    const hay = [job.name, job.q, job.field, ...(job.tags || [])]
      .join(' ')
      .toLowerCase()
      .replace(/\s+/g, '');
    return hay.includes(k);
  });
}
