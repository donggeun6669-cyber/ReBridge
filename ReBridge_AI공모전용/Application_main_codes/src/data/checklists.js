// 서류 체크리스트 — 트랙(상황)별로 챙길 것이 달라진다.
//  - univ : 대입 원서·합격증명서·성적증명서 등
//  - job  : 이력서·자기소개서·자격증 사본·신분증 등
//  - study: 검정고시 응시 준비물·합격증명서 발급 등
//
// 정직성: 없는 정보를 단정하지 않는다. 대학·회사·전형마다 다른 건 warn으로 "확인" 안내.

const CURRENT_YEAR = 2026;

// 입시(대입) — 기존 ChecklistScreen 로직을 그대로 옮겨 트랙 분기에 흡수.
function univChecklist(profile) {
  const round = profile?.examRound || '';
  const year = profile?.examYear || '';
  const highSchool = profile?.highSchool || '';
  const overseas = profile?.overseasSchool || '';

  const is2nd = round === '2회차';
  const isCritical2nd = is2nd && year === String(CURRENT_YEAR);

  const items = [];

  items.push({
    id: 'admit-cert',
    category: '기본 필수',
    title: '고졸 검정고시 합격증명서',
    badge: '대입전형용',
    badgeColor: 'danger',
    issuer: '나이스(kged.go.kr) 또는 시도교육청',
    url: 'https://kged.go.kr',
    days: '즉시 발급',
    warn: '반드시 "대입전형용"으로 발급하세요. 일반용 제출 시 불합격 처리될 수 있어요. 2026학년도부터 학교폭력 조치사항 포함본으로 변경됐어요.',
    warnLevel: 'caution',
  });

  items.push({
    id: 'score-cert',
    category: '기본 필수',
    title: '검정고시 성적증명서',
    issuer: '나이스(kged.go.kr)',
    url: 'https://kged.go.kr',
    days: '즉시 발급',
    warn: isCritical2nd
      ? `${CURRENT_YEAR}년 2회차 합격자는 수시 나이스 온라인 연동 불가! 실물 원본을 등기우편으로 직접 제출해야 해요.`
      : is2nd
        ? '2회차 합격자는 수시 나이스 온라인 연동이 차단될 수 있어요. 지원 대학에 확인 후 필요 시 실물 우편 제출하세요.'
        : '나이스에서 대학에 온라인으로 직접 전송 신청이 가능해요.',
    warnLevel: isCritical2nd ? 'critical' : is2nd ? 'caution' : 'info',
  });

  items.push({
    id: 'application-form',
    category: '기본 필수',
    title: '대입 원서 (입학지원서)',
    issuer: '유웨이·진학사 또는 각 대학 입학처',
    url: '',
    days: '접수 기간 내 작성',
    warn: '수시는 보통 9월, 정시는 12월 말~1월 초에 접수해요. 원서비(보통 5~8만 원)가 들어요.',
    warnLevel: 'info',
  });

  if (highSchool === '있어요 (자퇴·제적)') {
    items.push({
      id: 'withdraw-cert',
      category: '추가 서류',
      title: '제적증명서',
      badge: '원본',
      badgeColor: 'brand',
      issuer: '다녔던 고등학교',
      url: '',
      days: '1~3일',
      warn: '합격증명서 학력란에 제적 학교명·일자가 명시된 경우 제출 면제 가능. 대학별로 다르므로 반드시 확인하세요.',
      warnLevel: 'info',
      condition: '고교 재학 후 자퇴·제적한 경우',
    });
    items.push({
      id: 'school-record',
      category: '추가 서류',
      title: '학교생활기록부',
      issuer: '다녔던 고등학교 / 나이스(neis.go.kr)',
      url: 'https://www.neis.go.kr',
      days: '3~7일 (학교 방문 필요)',
      warn: '해당 연도 9월 1일 이후 발급분만 인정해요. 학교장 직인 필수.',
      warnLevel: 'info',
      condition: '전형에 따라 요구되는 경우',
    });
  }

  items.push({
    id: 'hs-alt-form',
    category: '학종 지원',
    title: '학생부 대체 서식',
    issuer: '지원 대학 입학처 홈페이지',
    url: '',
    days: '직접 작성',
    warn: '대학마다 규격(항목 수·글자 수)이 달라요. 반드시 해당 대학 서식을 확인해서 작성하세요.',
    warnLevel: 'info',
    condition: '학생부종합 전형 지원 시',
    guideKey: 'forms',
  });

  if (overseas === '있어요') {
    items.push(
      { id: 'overseas-gpa', category: '해외고 추가 서류', title: 'GPA 성적증명서 (원본, 학기별)', issuer: '다녔던 해외 학교', url: '', days: '1~4주 (학교에 따라 다름)', warn: '번역 공증이 필요한 경우가 있어요. 대학별 요구사항을 확인하세요.', warnLevel: 'info', condition: '해외고 이력 있는 경우' },
      { id: 'overseas-grad', category: '해외고 추가 서류', title: '졸업(예정)증명서 (학교장 직인)', issuer: '다녔던 해외 학교', url: '', days: '1~4주', condition: '해외고 이력 있는 경우' },
      { id: 'school-profile', category: '해외고 추가 서류', title: 'School Profile', issuer: '다녔던 해외 학교', url: '', days: '1~2주', condition: '해외고 이력 있는 경우' },
      { id: 'immigration', category: '해외고 추가 서류', title: '출입국사실증명서', issuer: '법무부 (hikorea.go.kr)', url: 'https://www.hikorea.go.kr', days: '즉시 발급', condition: '해외고 이력 있는 경우' },
    );
  }

  return items;
}

// 취업 — 이력서·자소서·자격증·신분증 등
function jobChecklist() {
  return [
    {
      id: 'job-id',
      category: '기본 준비물',
      title: '신분증 (주민등록증·운전면허증 등)',
      issuer: '주민센터 / 정부24',
      url: 'https://www.gov.kr',
      days: '발급 1~2주',
      warn: '면접·근로계약 때 본인 확인용으로 거의 항상 필요해요.',
      warnLevel: 'info',
    },
    {
      id: 'job-resume',
      category: '기본 준비물',
      title: '이력서',
      issuer: '직접 작성 (고용24 양식 활용 가능)',
      url: 'https://www.work24.go.kr',
      days: '직접 작성',
      warn: '이름·연락처·학력·경험·자격증을 정리해요. 검정고시 학력도 그대로 적으면 돼요.',
      warnLevel: 'info',
      guideKey: 'glossary-job',
    },
    {
      id: 'job-cover',
      category: '기본 준비물',
      title: '자기소개서',
      issuer: '직접 작성',
      url: '',
      days: '직접 작성',
      warn: '"왜 이 일을 하고 싶은지", 나의 강점·경험을 솔직하게 써요. (대입 자소서와는 별개예요.)',
      warnLevel: 'info',
    },
    {
      id: 'job-cert-copy',
      category: '있으면 챙길 것',
      title: '자격증 사본',
      issuer: '큐넷(q-net.or.kr) 등 발급기관',
      url: 'https://www.q-net.or.kr',
      days: '온라인 즉시 출력',
      warn: '기능사·산업기사 등 가진 자격증이 있으면 사본을 준비해요. 없어도 괜찮아요.',
      warnLevel: 'info',
      condition: '자격증을 가진 경우',
    },
    {
      id: 'job-photo',
      category: '있으면 챙길 것',
      title: '증명사진',
      issuer: '사진관 / 무인 사진부스',
      url: '',
      days: '당일',
      warn: '이력서에 붙이거나 온라인 지원에 올릴 때 써요.',
      warnLevel: 'info',
    },
    {
      id: 'job-bankbook',
      category: '합격 후 (입사 시)',
      title: '통장 사본 · 계좌 정보',
      issuer: '본인 은행',
      url: '',
      days: '즉시',
      warn: '월급을 받을 계좌예요. 입사할 때 회사에 내요.',
      warnLevel: 'info',
    },
    {
      id: 'job-contract',
      category: '합격 후 (입사 시)',
      title: '근로계약서 (받아서 보관)',
      issuer: '입사하는 회사',
      url: '',
      days: '일 시작 전',
      warn: '일 시작 전에 꼭 받아야 해요. 근무시간·월급·쉬는 날을 확인하세요. 안 주면 요구할 수 있어요.',
      warnLevel: 'caution',
    },
  ];
}

// 학습(검정고시 준비) — 응시 준비물·합격 후 발급
function studyChecklist() {
  return [
    {
      id: 'study-apply',
      category: '원서접수 (시험 전)',
      title: '검정고시 응시원서 접수',
      issuer: '거주지 시·도교육청',
      url: 'https://www.gumsi.or.kr/ged/usr/info/applyInfo.do',
      days: '접수 기간 내',
      warn: '접수 기간이 짧아요(보통 1~2주). 시험 회차별 일정을 미리 확인하세요.',
      warnLevel: 'caution',
    },
    {
      id: 'study-photo',
      category: '원서접수 (시험 전)',
      title: '증명사진',
      issuer: '사진관 / 무인 사진부스',
      url: '',
      days: '당일',
      warn: '원서 접수와 수험표에 필요해요.',
      warnLevel: 'info',
    },
    {
      id: 'study-id',
      category: '시험 당일',
      title: '신분증 + 수험표',
      issuer: '본인 / 접수처',
      url: '',
      days: '시험 당일 지참',
      warn: '둘 다 없으면 시험을 못 볼 수 있어요. 전날 미리 챙겨두세요. 신분증이 없으면 접수처에 대체 방법을 문의하세요.',
      warnLevel: 'critical',
    },
    {
      id: 'study-pen',
      category: '시험 당일',
      title: '컴퓨터용 사인펜 · 수정테이프',
      issuer: '본인 준비',
      url: '',
      days: '시험 당일 지참',
      warn: 'OMR 카드에 표기해요. 검은색 컴퓨터용 사인펜을 챙기세요.',
      warnLevel: 'info',
    },
    {
      id: 'study-pass-cert',
      category: '합격 후',
      title: '합격증명서 발급',
      issuer: '나이스(kged.go.kr) 또는 시도교육청',
      url: 'https://kged.go.kr',
      days: '결과 발표 후 즉시',
      warn: '대학에 낼 거면 "대입전형용"으로 발급하세요. 취업·기타 용도는 "일반용"이에요.',
      warnLevel: 'info',
      guideKey: 'glossary-study',
    },
    {
      id: 'study-score-cert',
      category: '합격 후',
      title: '성적증명서 발급',
      issuer: '나이스(kged.go.kr)',
      url: 'https://kged.go.kr',
      days: '결과 발표 후 즉시',
      warn: '대입·진학에 쓸 수 있어요. 합격증명서와는 다른 서류예요.',
      warnLevel: 'info',
    },
  ];
}

export function buildChecklist(track, profile) {
  if (track === 'job') return jobChecklist();
  if (track === 'study') return studyChecklist();
  return univChecklist(profile); // univ + null(기본)
}

export const CHECKLIST_META = {
  univ: { title: '대입 서류 체크리스트', sub: '원서·증명서 빠짐없이 챙겨요.', guideTopic: 'docs' },
  job: { title: '취업 서류 체크리스트', sub: '이력서부터 입사 서류까지 챙겨요.', guideTopic: null },
  study: { title: '검정고시 준비물 체크리스트', sub: '접수·시험 당일·합격 후로 나눠 챙겨요.', guideTopic: null },
  null: { title: '서류 체크리스트', sub: '내 상황에 맞는 서류 목록', guideTopic: 'docs' },
};
