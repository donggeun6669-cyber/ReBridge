// 직업 멘토 데이터 — '직업을 고르면 첫 출근까지 단계별로 안내'하기 위한 레이어.
//
// 구조:
//   1) ARCHETYPE_STAGES — 진입 방식(아키타입)별 멘토 로드맵 단계 템플릿.
//        cert      자격증형 (기능사 등 국가자격 중심)
//        portfolio 포트폴리오형 (작업물로 평가받는 일)
//        training  훈련형 (국비 직업훈련 중심)
//        intern    인턴·공채형 (인턴/일경험 + 기업별 서류)
//        service   서비스 도제형 (민간자격·현장 실습)
//   2) JOB_PATHS — 직업별 상세(되는 법/자격/포트폴리오/찾는 곳).
//   3) INTERN_PREP — 인턴/채용 지원 시 기업별 자소서·서류 준비 데이터.
//
// 자격증 명칭은 2026-06 기준 최신 종목명으로 반영(리서치+검증):
//   웹디자인기능사→웹디자인개발기능사(2025), 컴퓨터그래픽스운용기능사→컴퓨터그래픽기능사(2025),
//   정보처리기능사→프로그래밍기능사(2026), 용접기능사→피복아크용접기능사(2023).
// 공식 포털은 2024년 '고용24'(work24.go.kr)로 통합(HRD-Net·워크넷 포함).
// 원칙: 설명은 앱 안에서 끝까지, '진짜 신청'만 공식 사이트로. 불확실하면 단정하지 않는다.

// ── 1) 아키타입별 멘토 단계 ────────────────────────────────────────────────
// 각 단계: { key, title({job} 치환), todo, cta:{ kind, label } | null }
//   cta.kind → 화면 이동(JobRoadmapScreen이 매핑):
//     self  진로심리검사   training 직업교육 가이드(job-training)
//     certs 자격증 안내    find 일자리 찾기(job-explore)   apply 자소서·서류(job-apply)   none 안내만
export const ARCHETYPE_STAGES = {
  cert: [
    { key: 'self', title: '나 알아보기', todo: '무료 검사로 이 일이 나와 맞는지 한 번 더 확인해요.', cta: { kind: 'self', label: '무료 진로검사 해보기' } },
    { key: 'train', title: '{job} 자격·기술 배우기', todo: '{job} 관련 자격증과 배우는 곳을 확인해요. 학력 없이 딸 수 있는 길부터 봐요.', cta: { kind: 'training', label: '{job} 교육 길 보기' } },
    { key: 'practice', title: '필기·실기 준비', todo: '기출문제로 필기를 준비하고, 실기는 학원·국비훈련으로 손에 익혀요.', cta: { kind: 'certs', label: '학력 없이 따는 자격증' } },
    { key: 'find', title: '일자리 찾기', todo: '자격을 따면 고용24·워크넷에서 가까운 일자리를 찾아요.', cta: { kind: 'find', label: '일자리 찾는 곳 보기' } },
    { key: 'apply', title: '지원·서류 준비', todo: '이력서를 쓰고 면접에서 할 말을 연습해요. 가게·회사마다 따로 준비해요.', cta: { kind: 'apply', label: '지원 서류 준비하기' } },
    { key: 'first', title: '첫 출근·적응', todo: '일을 시작하면 근로계약서를 꼭 챙겨요. 힘들면 1388에 전화해요. 24시간 무료예요.', cta: null },
  ],
  portfolio: [
    { key: 'self', title: '나 알아보기', todo: '무료 검사로 이 일이 나와 맞는지 한 번 더 확인해요.', cta: { kind: 'self', label: '무료 진로검사 해보기' } },
    { key: 'train', title: '{job} 도구 배우기', todo: '{job}에 필요한 프로그램·기술을 국비훈련이나 강의로 배워요.', cta: { kind: 'training', label: '{job} 교육 길 보기' } },
    { key: 'make', title: '작업물 만들기', todo: '연습작을 꾸준히 만들어요. 학위보다 “내가 만든 결과물”이 가장 큰 무기예요.', cta: null },
    { key: 'portfolio', title: '포트폴리오 정리', todo: '잘 된 작업물을 모아 보여줄 수 있게 정리해요. 1~2개라도 완성도가 중요해요.', cta: null },
    { key: 'find', title: '일·외주 찾기', todo: '고용24·재능마켓에서 첫 일을 찾아요. 작은 외주부터 경력이 돼요.', cta: { kind: 'find', label: '일자리 찾는 곳 보기' } },
    { key: 'apply', title: '지원·자소서 준비', todo: '포트폴리오와 자기소개서로 지원해요. 회사마다 묻는 게 달라요.', cta: { kind: 'apply', label: '자소서·서류 준비하기' } },
    { key: 'first', title: '첫 일·계약', todo: '일을 맡으면 조건(돈·기간)을 글로 남겨요. 힘들면 1388에 전화해요.', cta: null },
  ],
  training: [
    { key: 'self', title: '나 알아보기', todo: '무료 검사로 이 일이 나와 맞는지 한 번 더 확인해요.', cta: { kind: 'self', label: '무료 진로검사 해보기' } },
    { key: 'train', title: '{job} 훈련과정 찾기', todo: '나라가 학원비를 대주는 국비훈련에서 {job} 기술을 배워요.', cta: { kind: 'training', label: '{job} 교육 길 보기' } },
    { key: 'cert', title: '관련 자격 따기', todo: '배운 기술로 관련 기능사 자격에 도전하면 취업에 더 유리해요.', cta: { kind: 'certs', label: '학력 없이 따는 자격증' } },
    { key: 'find', title: '일자리 찾기', todo: '고용24·워크넷에서 일자리를 찾아요.', cta: { kind: 'find', label: '일자리 찾는 곳 보기' } },
    { key: 'apply', title: '지원·면접 준비', todo: '이력서를 쓰고 면접을 연습해요. 회사마다 따로 준비해요.', cta: { kind: 'apply', label: '지원 서류 준비하기' } },
    { key: 'first', title: '첫 출근·적응', todo: '근로계약서를 꼭 챙겨요. 힘들면 1388에 전화해요. 24시간 무료예요.', cta: null },
  ],
  intern: [
    { key: 'self', title: '나 알아보기', todo: '무료 검사로 이 일이 나와 맞는지 한 번 더 확인해요.', cta: { kind: 'self', label: '무료 진로검사 해보기' } },
    { key: 'train', title: '기초 역량 쌓기', todo: '{job}에 필요한 기초 기술·자격을 익혀 지원할 “힘”을 만들어요.', cta: { kind: 'training', label: '{job} 교육 길 보기' } },
    { key: 'find', title: '인턴·일경험 찾기', todo: '청년 일경험·공공기관 청년인턴 공고를 찾아요. 경력이 없어도 시작할 수 있는 자리가 있어요.', cta: { kind: 'find', label: '일경험 찾는 곳 보기' } },
    { key: 'apply', title: '자소서·서류 준비', todo: '회사마다 자소서 항목과 필요한 서류가 달라요. 지원할 곳을 정하고 하나씩 준비해요.', cta: { kind: 'apply', label: '기업별 자소서 준비하기' } },
    { key: 'interview', title: '지원·면접', todo: '지원하고 면접에서 할 말을 미리 연습해요. 떨려도 솔직함이 통해요.', cta: null },
    { key: 'first', title: '인턴 시작·경력 쌓기', todo: '근로계약서를 챙기고, 인턴 경험을 다음 일로 이어가요. 힘들면 1388.', cta: null },
  ],
  service: [
    { key: 'self', title: '나 알아보기', todo: '무료 검사로 이 일이 나와 맞는지 한 번 더 확인해요.', cta: { kind: 'self', label: '무료 진로검사 해보기' } },
    { key: 'train', title: '{job} 기술 배우기', todo: '{job} 기술을 학원·민간자격·국비훈련으로 배워요.', cta: { kind: 'training', label: '{job} 교육 길 보기' } },
    { key: 'practice', title: '자격·실습', todo: '관련 자격을 따고, 매장 실습·아르바이트로 손에 익혀요.', cta: null },
    { key: 'find', title: '일자리 찾기', todo: '고용24·워크넷에서 가까운 일자리를 찾아요.', cta: { kind: 'find', label: '일자리 찾는 곳 보기' } },
    { key: 'apply', title: '지원·면접 준비', todo: '이력서를 쓰고 면접을 연습해요. 가게마다 따로 준비해요.', cta: { kind: 'apply', label: '지원 서류 준비하기' } },
    { key: 'first', title: '첫 출근·적응', todo: '근로계약서를 꼭 챙겨요. 힘들면 1388에 전화해요. 24시간 무료예요.', cta: null },
  ],
};

export const FIELD_DEFAULT_ARCHETYPE = {
  'IT·디자인': 'portfolio',
  '서비스·요식': 'cert',
  '제조·기술': 'cert',
  '사무·행정': 'intern',
};

// 자주 쓰는 공식 링크 (2024 고용24 통합 반영)
const L = {
  work24: { label: '고용24 채용·훈련', url: 'https://www.work24.go.kr' },
  hrd: { label: '고용24 훈련과정(HRD)', url: 'https://www.hrd.go.kr' },
  qnet: { label: '큐넷(자격 일정·접수)', url: 'https://www.q-net.or.kr' },
  worknet: { label: '워크넷 채용정보', url: 'https://www.work.go.kr' },
  youthExp: { label: '청년일경험(미래내일)', url: 'https://yw.work24.go.kr/main.do' },
  alio: { label: '잡알리오(공공기관 청년인턴)', url: 'https://job.alio.go.kr' },
};

// ── 2) 직업별 상세 — 카탈로그(careerData.js) 직업명과 키를 정확히 일치 ──────────
// 스키마: { archetype, oneLiner, certs:[{name,note}], trainingPath:[{step,detail}],
//          portfolio, whereToFind:[{label,url}], youthTips, programId }
export const JOB_PATHS = {
  // ── IT·디자인 ──
  '웹디자이너': {
    archetype: 'portfolio', oneLiner: '웹사이트 화면과 사용 흐름을 보기 좋게 디자인해요.',
    certs: [{ name: '웹디자인개발기능사', note: '2025년 명칭 변경(구 웹디자인기능사). 학력 제한 없음' }, { name: 'GTQ(그래픽기술자격)', note: '디자인 도구 활용 자격' }],
    trainingPath: [
      { step: '디자인 도구 익히기', detail: '포토샵·피그마를 국비훈련이나 무료 강의로 배워요. KDT 부트캠프는 거의 무료예요.' },
      { step: '웹 화면 만들어보기', detail: '실제 사이트를 따라 만들며 감을 익혀요.' },
      { step: '포트폴리오 모으기', detail: '잘 된 작업 2~3개를 보여줄 수 있게 정리해요.' },
    ],
    portfolio: '학위보다 “내가 만든 화면”을 봐요. 완성작 1~2개가 큰 힘이 돼요.',
    whereToFind: [L.work24, L.hrd], youthTips: '학력보다 결과물을 보는 분야라 학교 밖 청소년에게 문이 넓어요.', programId: 'tomorrow-card',
  },
  '편집기사(영상 편집)': {
    archetype: 'portfolio', oneLiner: '촬영한 영상을 잘라 붙이고 자막·효과를 넣어 완성해요.',
    certs: [],
    trainingPath: [
      { step: '편집 도구 배우기', detail: '프리미어·캡컷 등을 강의·국비훈련으로 배워요. 진입 장벽이 비교적 낮아요.' },
      { step: '짧은 영상 만들어 올리기', detail: '브이로그·쇼츠처럼 짧은 걸 완성해 내 채널·SNS에 올려요.' },
      { step: '릴(showreel) 만들기', detail: '편집한 1~3분 영상 3~5개를 모아 실력을 보여줘요.' },
    ],
    portfolio: '편집은 “완성한 영상”이 곧 이력서예요.',
    whereToFind: [L.work24, L.hrd], youthTips: '독학·훈련으로 시작하는 사람이 많아 진입이 비교적 쉬워요.', programId: 'tomorrow-card',
  },
  '컴퓨터그래픽디자이너': {
    archetype: 'portfolio', oneLiner: '포스터·로고 등 시각 디자인을 만들어요.',
    certs: [{ name: '컴퓨터그래픽기능사', note: '2025년 명칭 변경(구 컴퓨터그래픽스운용기능사). 학력 제한 없음' }, { name: 'GTQ 1급', note: '포토샵·일러스트 실무 인증' }],
    trainingPath: [
      { step: '그래픽 도구 익히기', detail: '포토샵·일러스트레이터를 국비훈련·강의로 배워요.' },
      { step: '자격증 도전', detail: '컴퓨터그래픽기능사로 기본기를 증명해요.' },
      { step: '포트폴리오 정리', detail: '카드뉴스·포스터·로고 작업을 모아 정리해요.' },
    ],
    portfolio: '자격증 + 작업물 둘 다 있으면 더 강해요.',
    whereToFind: [L.qnet, L.work24], youthTips: '학력 제한 없는 기능사로 시작할 수 있어요.', programId: 'technician-cert',
  },
  '정보시스템운영자': {
    archetype: 'cert', oneLiner: '회사의 컴퓨터·프로그램이 잘 돌아가도록 돕고 데이터를 관리해요.',
    certs: [{ name: '프로그래밍기능사', note: '2026년 명칭 변경(구 정보처리기능사). 학력 제한 없는 IT 입문 국가자격' }],
    trainingPath: [
      { step: '기능사로 기본기 다지기', detail: '프로그래밍기능사로 IT 기초 지식을 증명해요. 검정고시생도 응시 가능해요.' },
      { step: '국비 훈련으로 실무 보강', detail: '컴퓨터 활용·프로그래밍 기초 과정을 추가로 들어요.' },
      { step: '인턴·신입으로 진입', detail: '중소 IT기업이나 운영 보조 직무로 시작해 경력을 쌓아요.' },
    ],
    portfolio: '', whereToFind: [L.qnet, L.work24], youthTips: '학력 제한 없는 기능사로 IT의 첫발을 떼기 좋아요.', programId: 'technician-cert',
  },
  '시각디자이너': {
    archetype: 'portfolio', oneLiner: '브랜드·홍보물의 보이는 디자인을 만들어요.',
    certs: [{ name: '컴퓨터그래픽기능사', note: '학력 제한 없음' }, { name: 'GTQ 1급', note: '디자인 도구 활용 자격' }],
    trainingPath: [
      { step: '디자인 도구 배우기', detail: '포토샵·일러스트를 국비훈련·강의로 익혀요.' },
      { step: '작업물 만들기', detail: '포스터·로고를 직접 만들어 봐요.' },
      { step: '포트폴리오 정리', detail: '완성작을 모아 보여줄 수 있게 정리해요.' },
    ],
    portfolio: '포스터·로고 같은 결과물로 실력을 보여줘요.',
    whereToFind: [L.work24, L.qnet], youthTips: '학위보다 작업물을 보는 분야예요.', programId: 'tomorrow-card',
  },
  '캐드원': {
    archetype: 'training', oneLiner: 'CAD 프로그램으로 설계 도면을 그려요.',
    certs: [{ name: '전산응용기계제도기능사', note: '학력 제한 없음' }, { name: '전산응용건축제도기능사', note: '건축 분야 선택' }],
    trainingPath: [
      { step: 'CAD 배우기', detail: '국비훈련에서 오토캐드 등 설계 도구를 배워요.' },
      { step: '제도 기능사 따기', detail: '전산응용제도기능사로 도면 실력을 증명해요.' },
      { step: '현장 경험', detail: '설계 보조로 시작해 실무를 익혀요.' },
    ],
    portfolio: '', whereToFind: [L.hrd, L.qnet], youthTips: '국비훈련 + 제도 기능사로 설계 실무에 진입할 수 있어요.', programId: 'tomorrow-card',
  },
  '웹툰작가': {
    archetype: 'portfolio', oneLiner: '그림과 이야기로 웹툰을 그려요.',
    certs: [],
    trainingPath: [
      { step: '그림·작화 도구 익히기', detail: '클립스튜디오 등 작화 도구를 강의·독학으로 배워요.' },
      { step: '단편·연재 만들어보기', detail: '짧은 웹툰을 완성해 플랫폼·SNS에 올려요.' },
      { step: '포트폴리오·연재 도전', detail: '작품을 모아 공모전·플랫폼에 도전해요.' },
    ],
    portfolio: '정해진 학력보다 그림·스토리 포트폴리오와 꾸준한 연재 경험을 중요하게 봐요.',
    whereToFind: [L.work24], youthTips: '학력보다 작품과 꾸준함이 가장 큰 무기예요.', programId: 'tomorrow-card',
  },

  // ── 서비스·요식 ──
  '제과·제빵사': {
    archetype: 'cert', oneLiner: '빵·과자·케이크를 만들어요.',
    certs: [{ name: '제과기능사', note: '학력·나이 제한 없음. 큐넷 상시시험' }, { name: '제빵기능사', note: '학력·나이 제한 없음' }],
    trainingPath: [
      { step: '기초 배우기', detail: '학원·국비훈련에서 반죽·발효·굽기를 배워요. 학교 밖 청소년은 내일이룸학교(무료·자립장려금)도 알아봐요.' },
      { step: '기능사 자격 따기', detail: '제과·제빵 기능사 필기·실기에 도전해요. 둘 다 따두면 채용 폭이 넓어져요.' },
      { step: '베이커리·카페 취업', detail: '보조로 시작해 경력을 쌓고 정직원 제빵사로 채용돼요.' },
    ],
    portfolio: '', whereToFind: [L.qnet, L.hrd], youthTips: '제과·제빵 기능사는 학력 제한이 없어 바로 도전할 수 있어요.', programId: 'technician-cert',
  },
  '조리사': {
    archetype: 'cert', oneLiner: '식당·급식·호텔 주방에서 음식을 만들어요.',
    certs: [{ name: '한식조리기능사', note: '학력·나이 제한 없음. 큐넷 상시시험' }, { name: '양식·중식·일식 조리기능사', note: '분야별 추가 취득 가능' }],
    trainingPath: [
      { step: '국비 조리 과정 등록', detail: '내일배움카드나 내일이룸학교로 칼질·위생·기본 메뉴를 배워요(무료 또는 거의 무료).' },
      { step: '조리기능사 취득', detail: '한식부터 시작해 필기·실기에 도전해요. 상시시험이라 준비되면 바로 접수해요.' },
      { step: '식당·급식소 취업', detail: '주방보조로 시작해 자격·경력이 붙으면 조리사로 채용돼요.' },
    ],
    portfolio: '', whereToFind: [L.qnet, L.hrd], youthTips: '급식·구내식당·프랜차이즈는 자격증 있는 신입을 꾸준히 뽑아요. 자격증 1개로도 면접에서 차이가 커요.', programId: 'technician-cert',
  },
  '바리스타': {
    archetype: 'service', oneLiner: '커피를 내리고 음료를 만들며 매장을 운영해요.',
    certs: [{ name: '바리스타 2급(민간자격)', note: '국가자격이 아닌 민간자격. 필수는 아니지만 취업에 도움' }],
    trainingPath: [
      { step: '커피 기초 배우기', detail: '국비훈련·학원·문화센터에서 4~6주 추출·라떼아트·위생을 배워요.' },
      { step: '바리스타 자격 따기', detail: '한국커피협회 등 협회 시험(2급)으로 기본기를 갖춰요. 채용처가 인정하는 협회를 골라요.' },
      { step: '카페 취업·성장', detail: '카페에서 시작해 경력이 쌓이면 매니저·점장, 나아가 창업도 가능해요.' },
    ],
    portfolio: '', whereToFind: [{ label: '한국커피협회 자격', url: 'https://www.kca-coffee.org' }, L.hrd],
    youthTips: '카페 알바로 현장 경험을 먼저 쌓고 자격을 나중에 따도 돼요. 자격증은 민간자격이라 협회마다 달라요.', programId: 'tomorrow-card',
  },
  '미용사': {
    archetype: 'cert', oneLiner: '머리 손질·커트·펌 등 미용 서비스를 해요.',
    certs: [{ name: '미용사(일반) 기능사', note: '학력 제한 없음' }],
    trainingPath: [
      { step: '미용 기초 배우기', detail: '미용학원·국비훈련에서 커트·펌 기술을 배워요.' },
      { step: '미용사 자격 따기', detail: '미용사(일반) 기능사에 도전해요.' },
      { step: '현장 실습', detail: '샵 인턴·보조로 손을 익혀요.' },
    ],
    portfolio: '', whereToFind: [L.qnet, L.work24], youthTips: '미용사 기능사는 학력 제한이 없고 자격이 곧 취업으로 이어져요.', programId: 'technician-cert',
  },
  '네일아티스트': {
    archetype: 'cert', oneLiner: '손톱·발톱을 손질하고 네일아트를 해요.',
    certs: [{ name: '미용사(네일) 기능사', note: '학력 제한 없음' }],
    trainingPath: [
      { step: '네일 기초 배우기', detail: '네일 학원·국비훈련에서 케어·아트 기술을 배워요.' },
      { step: '미용사(네일) 자격 따기', detail: '국가자격으로 실력을 증명해요.' },
      { step: '샵 실습·취업', detail: '네일샵 보조로 시작해 손을 익혀요.' },
    ],
    portfolio: '작업한 네일 사진을 모아두면 실력을 보여주기 좋아요.',
    whereToFind: [L.qnet, L.work24], youthTips: '미용사(네일) 국가자격은 학력 제한이 없어요.', programId: 'technician-cert',
  },
  '피부관리사': {
    archetype: 'cert', oneLiner: '피부 관리·마사지 등 피부 미용 서비스를 해요.',
    certs: [{ name: '미용사(피부) 기능사', note: '학력 제한 없음' }],
    trainingPath: [
      { step: '피부 미용 배우기', detail: '학원·국비훈련에서 관리·마사지 기술을 배워요.' },
      { step: '미용사(피부) 자격 따기', detail: '국가자격으로 실력을 증명해요.' },
      { step: '실습·취업', detail: '피부샵 보조로 시작해 현장을 익혀요.' },
    ],
    portfolio: '', whereToFind: [L.qnet, L.work24], youthTips: '미용사(피부) 국가자격은 학력 제한이 없어요.', programId: 'technician-cert',
  },
  '반려동물미용사': {
    archetype: 'service', oneLiner: '강아지·고양이의 털을 다듬고 목욕시켜요.',
    certs: [{ name: '반려동물미용 민간자격', note: '협회 자격(국가자격 아님). 실습 경험이 더 중요' }],
    trainingPath: [
      { step: '미용 기술 배우기', detail: '반려동물 미용 학원·민간 과정에서 기술을 배워요.' },
      { step: '민간자격·실습', detail: '협회 자격을 따고 실습으로 손에 익혀요.' },
      { step: '샵 취업·경험', detail: '애견샵 보조로 시작해 경험을 쌓아요.' },
    ],
    portfolio: '미용한 작업 사진을 모아두면 좋아요.',
    whereToFind: [L.work24], youthTips: '학위보다 미용 훈련과 실습 경험을 중요하게 봐요.', programId: 'tomorrow-card',
  },

  // ── 제조·기술 ──
  '자동차 정비원': {
    archetype: 'cert', oneLiner: '자동차의 엔진·전기·부품을 점검하고 고쳐요.',
    certs: [{ name: '자동차정비기능사', note: '응시 제한 없음. 정비 분야 기본 자격' }],
    trainingPath: [
      { step: '정비 기초 배우기', detail: '폴리텍·국비훈련에서 엔진·전기·섀시 정비를 실차 실습으로 배워요.' },
      { step: '정비기능사 따기', detail: '큐넷에서 학력 제한 없이 응시해요.' },
      { step: '정비소 취업', detail: '카센터·정비공장·완성차 협력사에 취업해요.' },
    ],
    portfolio: '', whereToFind: [L.qnet, L.work24], youthTips: '손기술 중심이라 학력 영향이 적어요. 보조로 일하며 자격을 따는 경우도 많아요.', programId: 'technician-cert',
  },
  '전기 기능원': {
    archetype: 'cert', oneLiner: '건물·공장의 전기 배선과 설비를 설치·점검해요.',
    certs: [{ name: '전기기능사', note: '응시 제한 없음. 전기 분야 기본 자격' }],
    trainingPath: [
      { step: '전기 기초 배우기', detail: '폴리텍·국비훈련에서 전기 이론·실습을 배워요.' },
      { step: '전기기능사 따기', detail: '필기·실기로 전기기능사에 도전해요.' },
      { step: '취업·경력', detail: '전기공사 업체·시설관리·공장 전기팀에 취업해요.' },
    ],
    portfolio: '', whereToFind: [L.qnet, L.work24], youthTips: '전기기능사는 학력 제한이 없고, 자격이 있으면 취업·임금에서 유리해요.', programId: 'technician-cert',
  },
  '용접원': {
    archetype: 'cert', oneLiner: '금속을 녹여 붙이는 기술자. 조선·건설·플랜트 수요가 꾸준해요.',
    certs: [
      { name: '피복아크용접기능사', note: '2023년 명칭 변경(구 용접기능사). 학력·나이 제한 없음' },
      { name: '가스텅스텐아크용접기능사(TIG)', note: '고급 용접 종목. 더 높은 임금 가능' },
      { name: '이산화탄소가스아크용접기능사(CO2)', note: '고급 용접 종목. 응시 제한 없음' },
    ],
    trainingPath: [
      { step: '내일배움카드 발급', detail: '고용24에서 카드를 받아 용접 학원비를 국비로 해결해요.' },
      { step: '용접 훈련(3~6개월)', detail: '국비 학원에서 아크·CO2·TIG 용접을 실습 위주로 배워요.' },
      { step: '자격 따고 현장 취업', detail: '피복아크용접기능사부터 따고 조선소·플랜트·제조업체에 지원해요.' },
    ],
    portfolio: '', whereToFind: [L.work24, L.qnet], youthTips: '자격증 + 실력으로 평가받는 대표 직종이라 학력 영향이 가장 적어요. 경력이 쌓이면 임금이 빠르게 올라요.', programId: 'technician-cert',
  },
  '냉동기사': {
    archetype: 'cert', oneLiner: '냉동·냉방 설비를 설치하고 점검해요.',
    certs: [{ name: '공조냉동기계기능사', note: '학력 제한 없음' }],
    trainingPath: [
      { step: '설비 기초 배우기', detail: '국비훈련에서 공조·냉동 설비 기초를 배워요.' },
      { step: '공조냉동기계기능사 따기', detail: '큐넷에서 학력 제한 없이 응시해요.' },
      { step: '현장 취업', detail: '설비·시설관리 업체에 취업해요.' },
    ],
    portfolio: '', whereToFind: [L.qnet, L.hrd], youthTips: '공조냉동기계기능사는 학력 제한이 없어 설비 훈련과 자격으로 진입할 수 있어요.', programId: 'technician-cert',
  },
  '공작기계조작원': {
    archetype: 'training', oneLiner: '컴퓨터로 제어되는 기계로 금속 부품을 정밀하게 깎아 만들어요.',
    certs: [{ name: '컴퓨터응용선반기능사', note: '응시 제한 없음' }, { name: '컴퓨터응용밀링기능사', note: '응시 제한 없음' }],
    trainingPath: [
      { step: '내일배움카드 발급', detail: 'CNC·기계가공 훈련비를 국비로 지원받아요.' },
      { step: '기계가공 훈련(4~6개월)', detail: '선반·머시닝센터·도면 읽기를 실습으로 배워요.' },
      { step: '공장 취업', detail: '기계·금속 부품 제조 중소기업에 취업해요.' },
    ],
    portfolio: '', whereToFind: [L.hrd, L.qnet], youthTips: '일하며 배우는 일학습병행으로 들어가는 길도 많아요. 학력보다 도면·기계 다루는 실력을 봐요.', programId: 'tomorrow-card',
  },
  '도배원': {
    archetype: 'cert', oneLiner: '벽지를 바르고 실내 마감을 해요.',
    certs: [{ name: '도배기능사', note: '학력 제한 없음' }],
    trainingPath: [
      { step: '도배 기초 배우기', detail: '국비훈련·현장에서 풀칠·재단·시공을 배워요.' },
      { step: '도배기능사 따기', detail: '짧은 실습과 실기 준비로 도전할 수 있어요.' },
      { step: '현장 경험', detail: '시공팀에 들어가 현장 경험을 쌓아요.' },
    ],
    portfolio: '', whereToFind: [L.qnet, L.work24], youthTips: '도배기능사는 학력 제한이 없고 짧은 실습으로도 도전할 수 있어요.', programId: 'technician-cert',
  },
  '배관원': {
    archetype: 'cert', oneLiner: '공장·건물의 배관과 설비를 설치해요.',
    certs: [{ name: '배관기능사', note: '응시 제한 없음' }],
    trainingPath: [
      { step: '내일배움카드 발급', detail: '배관·설비 훈련과정 학원비를 국비로 지원받아요.' },
      { step: '배관·설비 훈련', detail: '배관 시공·용접 기초를 실습으로 배워요.' },
      { step: '현장 취업', detail: '플랜트·건설·설비 시공업체에 취업해요.' },
    ],
    portfolio: '', whereToFind: [L.qnet, L.hrd], youthTips: '용접을 함께 익히면 몸값이 높아져요. 플랜트 현장은 일당이 높은 편이에요.', programId: 'technician-cert',
  },

  // ── 사무·행정 ──
  '사무원(일반 사무)': {
    archetype: 'intern', oneLiner: '문서 정리·자료 입력·전화 응대 등 사무실 기본 업무를 해요.',
    certs: [{ name: '워드프로세서', note: '국가기술자격, 학력 제한 없음' }, { name: '컴퓨터활용능력 2급', note: '엑셀 실무에 도움' }],
    trainingPath: [
      { step: '기본 컴퓨터 자격 따기', detail: '워드프로세서·컴퓨터활용능력을 따요. 사무직에선 “기본”으로 봐요. 둘 다 학력 제한이 없어요.' },
      { step: 'OA 실무 익히기', detail: '한글·엑셀로 표 만들기·문서 정리를 연습해요. 내일배움카드로 OA 학원을 거의 무료로 다녀요.' },
      { step: '청년인턴·기간제 지원', detail: '학력무관 사무지원 자리에 지원해요. 잡알리오·나라일터에 자주 올라와요.' },
    ],
    portfolio: '', whereToFind: [L.alio, { label: '나라일터', url: 'https://www.gojobs.go.kr' }, L.work24],
    youthTips: '꿈드림센터를 통하면 사무보조 직장체험을 연결받기 쉬워요. 자격증 한두 개로 또래보다 앞서요.', programId: 'national-employment',
  },
  '전산 회계·경리': {
    archetype: 'cert', oneLiner: '회사의 돈 흐름을 회계 프로그램에 입력·정리해요.',
    certs: [{ name: '전산회계 2급/1급', note: '한국세무사회 주관, 학력 제한 없음' }, { name: 'ERP 정보관리사(회계)', note: '중소기업 우대' }],
    trainingPath: [
      { step: '전산회계 2급부터', detail: '가장 기초인 전산회계 2급부터 따요. 학력 제한이 없어요.' },
      { step: '1급·실무로 올리기', detail: '전산회계 1급, 더존(SmartA) 실무까지 익히면 채용에서 우대받아요.' },
      { step: '국비 회계과정 + 취업', detail: '내일배움카드 “전산회계 실무”로 자격과 실무를 한 번에 잡아요.' },
    ],
    portfolio: '', whereToFind: [L.work24, L.hrd], youthTips: '자격증이 곧 무기인 직무라 검정고시생에게 유리해요. 엑셀을 잘하면 더 우대받기도 해요.', programId: 'technician-cert',
  },
  '고객 상담·응대': {
    archetype: 'service', oneLiner: '전화·온라인으로 고객 문의에 응대해요.',
    certs: [],
    trainingPath: [
      { step: '응대 기본 익히기', detail: '국비 CS·콜센터 과정이나 매장 교육으로 응대·기본 컴퓨터를 익혀요.' },
      { step: '실전 경험 쌓기', detail: '단기·알바로 시작해 응대 감을 익혀요.' },
      { step: '정규직·전문 상담으로', detail: '경력을 쌓아 정규직·전문 상담원으로 성장해요.' },
    ],
    portfolio: '', whereToFind: [L.work24, L.youthExp], youthTips: '학력보다 친절·또렷한 말씨를 봐요. 진입이 비교적 쉬운 직무예요.', programId: 'national-employment',
  },
  '병원코디네이터': {
    archetype: 'service', oneLiner: '병원에서 예약·안내·고객 응대를 맡아요.',
    certs: [{ name: '병원코디네이터 민간자격', note: '협회 자격(국가자격 아님)' }],
    trainingPath: [
      { step: '기본 익히기', detail: '국비·민간 과정에서 의료 응대·기본 컴퓨터를 배워요.' },
      { step: '민간자격·실습', detail: '관련 자격을 따고 응대 실습으로 익혀요.' },
      { step: '병원 취업', detail: '병·의원 접수·코디로 취업해 경력을 쌓아요.' },
    ],
    portfolio: '', whereToFind: [L.work24], youthTips: '친절·꼼꼼함을 가장 중요하게 봐요. 응대 알바 경험이 도움이 돼요.', programId: 'tomorrow-card',
  },
  '전자상거래 운영': {
    archetype: 'portfolio', oneLiner: '온라인 쇼핑몰을 운영하고 상품을 등록·관리해요.',
    certs: [{ name: '전자상거래운용사', note: '실무 자격(필수는 아님)' }],
    trainingPath: [
      { step: '쇼핑몰 도구 배우기', detail: '상품 등록·상세페이지·SNS 마케팅을 국비훈련·강의로 배워요.' },
      { step: '직접 운영해보기', detail: '작은 쇼핑몰·중고거래·SNS 판매로 경험을 쌓아요.' },
      { step: '포트폴리오·취업', detail: '운영 사례를 정리해 이커머스 회사에 지원해요.' },
    ],
    portfolio: '직접 운영한 쇼핑몰·SNS 사례가 곧 포트폴리오예요.',
    whereToFind: [L.work24, L.hrd], youthTips: '직접 해본 운영 경험이 가장 큰 무기예요.', programId: 'tomorrow-card',
  },
  '설문조사원': {
    archetype: 'intern', oneLiner: '설문·조사 자료를 모으고 정확히 입력해요.',
    certs: [],
    trainingPath: [
      { step: '기본 교육', detail: '조사 방법·정확한 입력을 짧은 교육으로 익혀요.' },
      { step: '현장·사무 경험', detail: '단기 조사 업무로 시작해 경력을 쌓아요.' },
      { step: '정규·전문화', detail: '데이터 입력·조사 사무로 이어가요.' },
    ],
    portfolio: '', whereToFind: [L.work24, L.youthExp], youthTips: '학력보다 정확한 조사·입력 능력을 봐요. 단기 일로 시작하기 좋아요.', programId: 'national-employment',
  },
  '물류관리사': {
    archetype: 'cert', oneLiner: '물건의 입출고·재고·배송을 관리해요.',
    certs: [{ name: '물류관리사', note: '응시 학력 제한 없는 국가자격' }],
    trainingPath: [
      { step: '물류 기초 배우기', detail: '국비훈련·강의로 물류 사무·재고 관리를 배워요.' },
      { step: '물류관리사 따기', detail: '학력 제한 없는 물류관리사 자격에 도전해요.' },
      { step: '취업·경력', detail: '물류센터·유통사 사무로 취업해 경력을 쌓아요.' },
    ],
    portfolio: '', whereToFind: [L.qnet, L.work24], youthTips: '응시 학력 제한이 없는 물류관리사 자격과 물류 사무 훈련으로 준비할 수 있어요.', programId: 'technician-cert',
  },
};

// 직업명을 받아 아키타입을 정한다 (JOB_PATHS 우선, 없으면 분야 기본값).
export function archetypeForJob(name, field) {
  const path = JOB_PATHS[name];
  if (path?.archetype) return path.archetype;
  return FIELD_DEFAULT_ARCHETYPE[field] || 'cert';
}

// 직업 1건의 멘토 로드맵 단계를 만든다(아키타입 템플릿 + 직업명 치환).
export function stagesForJob(name, field) {
  const arche = archetypeForJob(name, field);
  const tpl = ARCHETYPE_STAGES[arche] || ARCHETYPE_STAGES.cert;
  return tpl.map((s) => ({
    ...s,
    title: s.title.replaceAll('{job}', name),
    todo: s.todo.replaceAll('{job}', name),
    cta: s.cta ? { ...s.cta, label: s.cta.label.replaceAll('{job}', name) } : null,
  }));
}

// 직업 상세 — JOB_PATHS에 있으면 그대로, 없으면 아키타입 기반 기본 골격.
export function pathFor(name, field) {
  const base = JOB_PATHS[name];
  if (base) return { name, field: base.field || field, ...base };
  const arche = archetypeForJob(name, field);
  return {
    name, field, archetype: arche, oneLiner: '',
    certs: [],
    trainingPath: [
      { step: '기초 배우기', detail: '국비훈련(나라가 학원비 지원)이나 강의로 이 일의 기초를 배워요.' },
      { step: '자격·실력 쌓기', detail: '관련 자격에 도전하거나 작업물을 만들어 실력을 보여줘요.' },
      { step: '경험 쌓기', detail: '실습·아르바이트·일경험으로 현장을 익혀요.' },
    ],
    portfolio: '', whereToFind: [L.work24, L.hrd],
    youthTips: '학력보다 기술·경험을 보는 길부터 시작해요.', programId: 'tomorrow-card',
  };
}

// ── 3) 인턴/채용 지원 — 기업별 자소서·서류 준비 (리서치 반영) ─────────────────
export const INTERN_PREP = {
  requiredDocs: [
    { name: '이력서', note: '학력(검정고시)·경험·자격·연락처를 한 장에 정리해요. 고용24에서 온라인 이력서를 만들어 그대로 쓸 수 있어요.' },
    { name: '자기소개서', note: '지원동기·강점·경험·포부 등. 경험이 적어도 작은 경험을 구체적으로 쓰는 게 핵심이에요.' },
    { name: '검정고시 합격증명서', note: '학력 증빙. 정부24에서 온라인 발급. 학력 무관 공고도 많으니 없다고 포기하지 마요.' },
    { name: '신분증(또는 청소년증)', note: '본인 확인용. 만 17세 미만은 주민센터에서 청소년증을 발급받아 대체할 수 있어요.' },
    { name: '통장 사본', note: '급여·활동비 입금 계좌. 본인 명의가 원칙이에요(미성년자도 보호자 동반 시 개설 가능).' },
    { name: '자격증 사본', note: '딴 자격증이 있으면 함께 내요. 없어도 지원은 돼요.' },
    { name: '포트폴리오(IT·디자인)', note: '작업물 모음. 학원 과제·개인 프로젝트도 PDF·노션·깃허브 링크로 정리해요.' },
  ],
  selfIntroPrompts: [
    { q: '지원 동기 (왜 이 회사·이 일인가요?)', guide: '“돈을 벌려고”가 아니라 “이 일로 무엇을 배우고 싶은지”로 연결해요. 회사 이름을 직접 쓰고, 관심을 갖게 된 계기를 솔직하게 적어도 돼요.' },
    { q: '성장 과정 / 나를 만든 경험', guide: '거창하지 않아도 돼요. 검정고시 준비·알바·취미를 끝까지 해본 경험에서 “꾸준함·책임감”을 보여준 한 장면을 골라요.' },
    { q: '나의 강점 / 성격의 장단점', guide: '강점은 일과 연결하고 사례 한 줄을 붙여요. 단점은 “고치려고 ○○하고 있다”로 마무리해 개선 의지를 보여줘요.' },
    { q: '직무 관련 경험 / 노력한 점', guide: '학원 수강·인강·독학·자격증 공부·개인 프로젝트도 모두 “경험”이에요. “무엇을 위해 무엇을 했고 무엇을 배웠다”로 작게라도 증명해요.' },
    { q: '입사 후 포부 / 목표', guide: '“1년 안에 ○○ 업무를 혼자 할 수 있게 되겠다”처럼 작고 구체적으로 써요. 인턴·일경험은 “배우려는 자세”를 가장 높게 봐요.' },
    { q: '갈등·어려움 극복 경험', guide: '알바 손님 응대·팀플 같은 작은 갈등도 돼요. “상황 → 내가 한 행동 → 결과” 3단으로, 행동에 초점을 맞춰요.' },
  ],
  byField: {
    'IT·디자인': { tip: '학력보다 결과물(포트폴리오)을 봐요. 학원 과제·클론·개인 프로젝트도 깃허브·노션·PDF로 정리하면 무경력도 어필돼요. 청년일경험으로 실무를 먼저 맛보는 루트가 현실적이에요.', channels: [L.youthExp, L.work24, L.alio] },
    '서비스·요식': { tip: '학력·경력 요건이 가장 낮아 첫 일경험으로 좋아요. 친절·근태·기본 위생이 곧 경쟁력이에요. 짧은 알바 경험도 이력서에 꼭 적어요.', channels: [L.youthExp, L.work24] },
    '제조·기술': { tip: '성실한 근태·안전수칙 준수를 가장 중요하게 봐요. 학력무관·미경력 공고가 많고, 기능 자격이 있으면 급여·채용에서 크게 유리해요.', channels: [L.work24, L.youthExp] },
    '사무·행정': { tip: '공공기관 청년인턴이 진입 1순위예요. 학력보다 컴활·워드 기본기를 봐요. 잡알리오에서 “청년인턴”으로 필터링하면 공공기관 인턴만 모아 볼 수 있어요.', channels: [L.alio, L.youthExp, L.work24] },
  },
};
