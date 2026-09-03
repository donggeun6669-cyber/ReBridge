import {
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  HelpCircle,
  Layers,
  MessageCircle,
  PenLine,
  Scale,
  Sparkles,
  Target,
} from 'lucide-react';
import { currentYear } from '../data/meta.js';

const GUIDES = {
  types: {
    icon: HelpCircle,
    title: '전형이 뭐예요?',
    subtitle: '대학이 학생을 뽑는 여러 가지 방법을 말해요.',
    easy: '대학 입시는 크게 수시와 정시가 있어요. 학생부교과, 학생부종합, 논술은 보통 수시에 들어가는 길이고, 정시는 주로 수능 점수로 가는 길이에요.',
    key: '전형은 “대학에 들어가는 방법 이름”이에요. 내가 수시로 갈지, 정시로 갈지부터 알면 준비할 것도 훨씬 선명해져요.',
    cards: [
      {
        icon: ClipboardList,
        title: '학생부교과',
        body: '수시 전형이에요. 학교 성적표(내신)를 많이 보는 길이고, 검정고시생은 점수를 내신처럼 바꿔서 봐요.',
      },
      {
        icon: Sparkles,
        title: '학생부종합',
        body: '수시 전형이에요. 성적만 보지 않고, 내가 어떤 사람인지 서류와 면접으로 함께 보는 길이에요.',
      },
      {
        icon: PenLine,
        title: '논술',
        body: '수시 전형이에요. 글로 생각을 풀어 쓰는 시험을 보는 길이고, 내신 영향이 작아서 검정고시생에게 괜찮을 수 있어요.',
      },
      {
        icon: Target,
        title: '정시',
        body: '수능 점수로 지원하는 길이에요. 검정고시생도 재학생과 같은 기준으로 봐요.',
      },
    ],
    next: '먼저 “나는 수시를 볼지, 정시를 볼지”부터 가볍게 정해보면 좋아요.',
  },
  susi: {
    icon: Sparkles,
    title: '검정고시도 수시 돼요?',
    subtitle: '네, 할 수 있어요. 막힌 길보다 열린 길이 더 많아요.',
    easy: '검정고시생도 수시에 지원할 수 있어요. 다만 “재학 중인 학교의 추천”이 꼭 필요한 전형은 어려울 수 있어요.',
    key: '학교장 추천 전형, 졸업예정자만 가능한 전형은 조심해서 확인해야 해요.',
    cards: [
      {
        icon: CheckCircle2,
        title: '가능한 길',
        body: '학생부종합, 논술, 실기, 일부 학생부교과는 검정고시생도 지원 가능한 경우가 많아요.',
      },
      {
        icon: HelpCircle,
        title: '확인할 것',
        body: '대학마다 규칙이 달라서 “검정고시 출신자 지원 가능”이라고 적혀 있는지 봐야 해요.',
      },
      {
        icon: GraduationCap,
        title: '막힐 수 있는 길',
        body: '학교장 추천처럼 학교 선생님의 추천서가 꼭 필요한 전형은 지원이 어려운 편이에요.',
      },
    ],
    next: '지원하려는 대학의 모집요강에서 “검정고시”라는 단어를 먼저 찾아보면 좋아요.',
  },
  compare: {
    icon: Scale,
    title: '비교내신이 뭐예요?',
    subtitle: '검정고시 점수를 내신처럼 바꿔서 보는 방식이에요.',
    easy: '검정고시생은 고등학교 내신 성적표가 없어요. 그래서 대학이 검정고시 점수를 “내신 등급처럼” 바꿔서 비교해요. 그게 비교내신이에요.',
    key: '같은 검정고시 점수라도 대학마다 바꾸는 방법이 달라서, 유리한 대학과 불리한 대학이 생길 수 있어요.',
    cards: [
      {
        icon: BookOpen,
        title: '왜 필요해요?',
        body: '대학은 재학생의 내신과 검정고시 점수를 함께 비교해야 해서 기준을 하나로 맞춰요.',
      },
      {
        icon: Scale,
        title: '어떻게 바뀌어요?',
        body: '예를 들어 평균 90점 이상은 몇 등급처럼 본다는 식이에요. 정확한 표는 대학마다 달라요.',
      },
      {
        icon: Target,
        title: '무엇을 보면 돼요?',
        body: '모집요강에서 “비교내신”, “검정고시 성적 환산”, “동등학력자”라는 말을 찾아보면 돼요.',
      },
    ],
    next: '교과 전형을 볼 때는 비교내신 표를 꼭 확인해요. 학종이나 논술은 내신 영향이 더 작을 수 있어요.',
  },
  csat: {
    icon: Target,
    title: '수능 최저가 뭐예요?',
    subtitle: '수시에 붙어도 수능에서 넘겨야 하는 약속 점수예요.',
    easy: '수시에서 대학이 “좋아요, 뽑고 싶어요”라고 해도, 수능에서 정해진 등급을 못 넘으면 최종 합격이 어려울 수 있어요. 이 조건이 수능 최저예요.',
    key: '“2개 합 5”는 두 과목 등급을 더해서 5 이하가 되면 된다는 뜻이에요.',
    cards: [
      {
        icon: Target,
        title: '예시로 보면',
        body: '국어 2등급, 영어 3등급이면 2 + 3 = 5라서 “2개 합 5”를 맞춘 거예요.',
      },
      {
        icon: HelpCircle,
        title: '없을 수도 있어요',
        body: '모든 수시에 수능 최저가 있는 건 아니에요. 어떤 전형은 수능을 안 보거나 최저가 없어요.',
      },
      {
        icon: CheckCircle2,
        title: '검정고시생에게',
        body: '수능 최저가 있으면 수시 준비와 수능 준비를 같이 해야 해요.',
      },
    ],
    next: '수능을 볼 계획이 없다면, “수능 최저 없음” 전형부터 찾는 게 편해요.',
  },

  // ── 아래는 질문만 먼저 추가 (답변은 준비 중) ──
  susiJeongsi: {
    icon: ArrowLeftRight,
    title: '수시랑 정시,\n뭐가 달라요?',
    subtitle: '두 가지 길의 차이를 쉽게 정리했어요.',
    easy: '수시는 수능 전에 여러 대학에 먼저 지원하는 길이에요. 정시는 수능을 본 뒤, 그 수능 점수로 지원하는 길이에요.',
    key: '검정고시생도 수시와 정시 둘 다 지원할 수 있어요. 다만 수시는 전형마다 지원 가능 여부와 수능 최저를 꼭 확인해야 해요.',
    cards: [
      {
        icon: CalendarDays,
        title: '수시는 먼저 지원해요',
        body: '보통 수능 전에 원서를 넣어요. 학생부종합, 학생부교과, 논술 같은 전형이 수시에 많이 있어요.',
      },
      {
        icon: Target,
        title: '정시는 수능 점수로 봐요',
        body: '수능을 본 뒤에 지원해요. 검정고시생도 재학생과 같은 수능 점수 기준으로 비교돼요.',
      },
      {
        icon: CheckCircle2,
        title: '둘 다 준비할 수도 있어요',
        body: '수시를 넣고, 수능도 같이 준비할 수 있어요. 수시에 수능 최저가 있으면 수능 준비가 꼭 필요해요.',
      },
      {
        icon: HelpCircle,
        title: '검정고시생은 여기 확인',
        body: '수시는 “검정고시 지원 가능”, “비교내신”, “수능 최저”를 보고, 정시는 수능 반영 과목을 보면 돼요.',
      },
    ],
    next: '아직 잘 모르겠다면 “수능을 볼 계획이 있는지”부터 정해봐요. 수능을 안 볼 거라면 수능 최저 없는 수시부터 찾는 게 좋아요.',
  },
  count: {
    icon: Layers,
    title: '수시는 몇 개까지\n쓸 수 있어요?',
    subtitle: '수시는 6장, 정시는 3번이에요.',
    easy: '4년제 일반대학은 수시 최대 6장이에요. 정시는 가·나·다 군으로 나뉘는데, 각 군에서 1개씩 총 3번 지원해요. 단, 전문대학(2년제·3년제)과 KAIST·UNIST 같은 과학기술원은 이 6장 제한에 포함되지 않아요.',
    key: '수시에서 한 곳이라도 합격하면, 등록 여부와 상관없이 정시에 지원할 수 없어요. 6곳 전부 불합격해야만 정시에 갈 수 있어요.',
    cards: [
      {
        icon: Layers,
        title: '4년제 일반대학 — 수시 최대 6장',
        body: '한양대, 국민대, 부산대 같은 일반 4년제 대학은 합해서 6개까지 원서를 낼 수 있어요. 같은 대학에 전형을 2개 쓸 수 있는 경우도 있어요(대학마다 달라요).',
      },
      {
        icon: HelpCircle,
        title: '전문대학(2·3년제)은 6장에 안 포함돼요',
        body: '인천재능대, 경기과기대 같은 전문대학은 수시 6장 제한과 별개예요. 전문대학은 횟수 제한 없이 따로 지원할 수 있어요.',
      },
      {
        icon: GraduationCap,
        title: 'KAIST·UNIST 등 과학기술원도 별도예요',
        body: 'KAIST, UNIST, GIST, DGIST, POSTECH(포항공대) 같은 특수목적대학은 자체 전형으로 따로 선발해요. 수시 6장 안에 포함되지 않아요.',
      },
      {
        icon: Target,
        title: '정시는 가·나·다 군 각 1번',
        body: '정시는 대학이 군으로 나뉘어요. 같은 군 안에서는 1개만 선택해야 해요. 가·나·다 군 각 1개씩 최대 3번 지원할 수 있어요.',
      },
    ],
    next: '수시 6장을 어디에 쓸지 고민될 때는, 성적보다 조금 높은 "도전", 성적에 맞는 "적정", 안정적인 "안정" 이렇게 나눠 쓰는 방법이 있어요.',
  },
  apply: {
    icon: CalendarDays,
    title: '원서는 언제,\n어떻게 넣어요?',
    subtitle: '보통 수시는 9월, 정시는 12월에 접수해요.',
    easy: '원서는 인터넷으로 넣어요. 각 대학 입학처 홈페이지 또는 유웨이·진학사 같은 원서 접수 전문 사이트를 이용해요. 원서비(보통 5~8만 원)도 이때 내요.',
    key: '검정고시생은 원서를 낼 때 "검정고시 합격증명서"를 제출해야 하는 경우가 많아요. 미리 준비해 두세요.',
    cards: [
      {
        icon: CalendarDays,
        title: '수시 접수 — 보통 9월 초·중순',
        body: '매년 9월 초에 원서 접수가 시작돼요. 대학마다 접수 기간이 조금씩 달라요. 보통 1주일 정도 열려 있어요.',
      },
      {
        icon: Target,
        title: '정시 접수 — 보통 12월 말~1월 초',
        body: '수능이 끝난 뒤 성적표를 받으면, 12월 말부터 정시 원서 접수가 시작돼요.',
      },
      {
        icon: ClipboardList,
        title: '어디서 넣어요?',
        body: '유웨이(uwayapply.com), 진학사(jinhakapply.com), 각 대학 입학처 홈페이지 중 한 곳에서 접수해요. 대학에 따라 자체 접수만 받는 경우도 있어요.',
      },
      {
        icon: CheckCircle2,
        title: '검정고시생 제출 서류',
        body: '보통 검정고시 합격증명서가 필요해요. 전형에 따라 자기소개서나 추가 서류가 필요할 수도 있으니 모집요강을 꼭 확인해요.',
      },
      {
        icon: CheckCircle2,
        title: '수시 합격하면 정시는 못 써요',
        body: '수시에서 한 곳이라도 합격하면 등록 여부와 관계없이 정시에 지원할 수 없어요. 6곳 모두 불합격했을 때만 정시에 지원할 수 있어요.',
      },
      {
        icon: Target,
        title: '수능 이후 논술·면접 전략',
        body: '논술고사나 면접을 수능 이후에 보는 전형이 있어요. 수능을 먼저 보고 점수가 잘 나왔다면, 그 논술·면접에 응시하지 않으면 불합격 처리되어 정시에 지원할 수 있어요. "수능 결과를 보고 선택"하는 전략이에요.',
      },
    ],
    next: '접수 전에 원서비, 제출 서류, 마감 시간을 미리 확인해 두면 마음이 편해요. 마감 당일 몰리면 사이트가 느려질 수 있어요.',
  },
  interview: {
    icon: MessageCircle,
    title: '면접에서는\n뭘 물어봐요?',
    subtitle: '학생부종합 전형에 주로 면접이 있어요.',
    easy: '면접은 주로 학생부종합 전형에서 해요. "이 학교에 왜 오고 싶어요?", "이런 활동을 한 이유가 뭐예요?" 같은 걸 물어봐요. 어렵게 생각하지 않아도 돼요.',
    key: '검정고시생은 학생부 대신 자기소개서나 제출한 서류를 바탕으로 질문이 나올 수 있어요.',
    cards: [
      {
        icon: MessageCircle,
        title: '제출 서류 기반 질문',
        body: '자기소개서나 지원 서류에 쓴 내용을 좀 더 설명해달라고 해요. "이런 활동을 했다고 했는데, 구체적으로 뭘 배웠어요?" 같은 식이에요.',
      },
      {
        icon: GraduationCap,
        title: '전공·지원 동기 질문',
        body: '"왜 이 학과에 지원했어요?", "이 분야에 관심을 갖게 된 계기가 있어요?" 같은 질문이 자주 나와요.',
      },
      {
        icon: HelpCircle,
        title: '가치관·경험 질문',
        body: '"힘들었던 경험이 있다면요?", "팀 활동에서 갈등이 생겼을 때 어떻게 했어요?" 같은 경험 이야기를 물을 수 있어요.',
      },
      {
        icon: Target,
        title: '시간은 얼마나 걸려요?',
        body: '보통 10~20분 정도예요. 1:1 면접인 곳도 있고, 교수님 여러 분이 함께 보는 경우도 있어요. 대학마다 달라요.',
      },
    ],
    next: '면접 전에 "왜 이 학교·학과에 지원했는지"를 자기 말로 한 번 정리해 두면 많이 도움돼요.',
  },
  grade: {
    icon: BarChart3,
    title: '수능 등급은\n어떻게 매겨요?',
    subtitle: '9등급제로 나눠요. 1등급이 가장 높아요.',
    easy: '수능은 점수를 받으면 9개 등급으로 나눠요. 전체 응시자 중 상위 4%가 1등급, 그다음 7%가 2등급 이런 식이에요. 등급 외에 "백분위"와 "표준점수"도 함께 나와요.',
    key: '수시 수능 최저는 보통 "등급"으로 따져요. "2개 합 5"면 내가 선택한 두 과목 등급을 더해 5 이하면 돼요.',
    cards: [
      {
        icon: BarChart3,
        title: '9등급제란?',
        body: '1등급(상위 4%) → 2등급(상위 4~11%) → 3등급(상위 11~23%) → ... → 9등급까지 나눠요. 1등급에 가까울수록 높은 거예요.',
      },
      {
        icon: Target,
        title: '백분위가 뭐예요?',
        body: '내 점수보다 낮은 사람이 전체의 몇 %인지 보여줘요. 백분위 90이면 100명 중 90명보다 높다는 뜻이에요.',
      },
      {
        icon: Scale,
        title: '표준점수가 뭐예요?',
        body: '과목마다 난이도가 달라서 점수를 그대로 비교하기 어려워요. 그래서 어렵고 쉬운 걸 보정해서 만든 점수가 표준점수예요.',
      },
      {
        icon: CheckCircle2,
        title: '검정고시생도 수능 볼 수 있어요',
        body: '검정고시 합격자는 수능을 응시할 수 있어요. 성적 기준은 재학생과 똑같이 적용돼요.',
      },
    ],
    next: '수능 최저가 있는 전형을 볼 때는 내 목표 등급이 몇 등급인지 먼저 파악해 두면 준비하기 편해요.',
  },
  guideline: {
    icon: FileText,
    title: '모집요강은\n어떻게 봐요?',
    subtitle: '"검정고시" 키워드부터 찾으면 돼요.',
    easy: '모집요강은 대학이 "이렇게 학생을 뽑겠다"고 공식으로 발표한 문서예요. 각 대학 입학처 홈페이지에 있어요. 처음엔 복잡해 보이지만, 볼 것만 골라서 보면 금방 파악할 수 있어요.',
    key: '검정고시생은 먼저 "검정고시", "동등 학력", "검정고시 합격자"라는 단어를 찾아보세요. 거기에 지원 가능 여부가 쓰여 있어요.',
    cards: [
      {
        icon: FileText,
        title: '어디서 찾아요?',
        body: '각 대학 입학처(입학 안내) 홈페이지에서 "수시 모집요강", "정시 모집요강"을 검색하면 돼요. 보통 PDF 파일로 올라와 있어요.',
      },
      {
        icon: CheckCircle2,
        title: '먼저 볼 것 ①  — 지원 자격',
        body: '"지원 자격" 항목에서 "검정고시 합격자" 또는 "동등 학력 인정자"라는 말이 있으면 지원 가능해요. 없거나 "국내 고교 졸업예정자"만 있으면 어려울 수 있어요.',
      },
      {
        icon: Target,
        title: '먼저 볼 것 ②  — 수능 최저, 전형 방법',
        body: '"수능 최저학력기준" 항목에서 조건을 확인해요. "전형 방법" 항목에서 서류·면접·내신 반영 비율도 볼 수 있어요.',
      },
      {
        icon: ClipboardList,
        title: '먼저 볼 것 ③  — 제출 서류',
        body: '"제출 서류" 항목에서 검정고시 합격증명서 외에 뭐가 필요한지 확인해요. 전형마다 요구하는 서류가 달라요.',
      },
    ],
    next: '모집요강이 너무 길면 Ctrl+F(검색)로 "검정고시"를 찾아보세요. 관련 내용이 바로 나와요.',
  },

  // ── 추가 FAQ ──────────────────────────────────────────
  docs: {
    icon: ClipboardList,
    title: '합격증명서와\n성적증명서, 달라요?',
    subtitle: '네, 완전히 다른 서류예요. 둘 다 별도로 발급해야 해요.',
    easy: '합격증명서는 "검정고시를 통과했다"는 증명서이고, 성적증명서는 "각 과목을 몇 점 받았다"는 증명서예요. 대학에 두 가지를 모두 제출해야 하는 경우가 많아요.',
    key: '반드시 "대입전형용"으로 발급해야 해요. 일반용을 내면 불합격 처리될 수 있어요.',
    cards: [
      {
        icon: CheckCircle2,
        title: '합격증명서',
        body: '검정고시 합격 사실을 증명하는 서류예요. "대입전형용"과 "일반용"이 있고, 대입에는 반드시 "대입전형용"을 제출해야 해요.',
      },
      {
        icon: FileText,
        title: '성적증명서',
        body: '과목별 취득 점수가 기재된 서류예요. 나이스(kged.go.kr)에서 대학에 온라인으로 직접 전송 신청이 가능해요.',
      },
      {
        icon: HelpCircle,
        title: '둘 다 필요한 경우가 많아요',
        body: '대학 전형에 따라 두 서류를 모두 제출해야 하는 경우가 대부분이에요. 모집요강의 제출 서류 항목에서 꼭 확인하세요.',
      },
      {
        icon: Target,
        title: '어디서 발급해요?',
        body: '나이스(kged.go.kr) 또는 시도교육청(관할 교육청)에서 발급받을 수 있어요. 나이스는 온라인 발급이 가능해서 편해요.',
      },
    ],
    next: '합격증명서는 "대입전형용"인지 꼭 확인하고, 성적증명서는 나이스 온라인 전송 신청을 미리 해두면 편해요.',
  },

  naice: {
    icon: Scale,
    title: '나이스 온라인 신청\n어떻게 해요?',
    subtitle: '검정고시 성적을 대학에 온라인으로 바로 보낼 수 있어요.',
    easy: '나이스(kged.go.kr)에서 "검정고시 대입전형자료 온라인 제공 신청"을 하면, 성적증명서를 대학에 온라인으로 직접 전송할 수 있어요. 실물 서류를 우편으로 보내지 않아도 돼요.',
    key: '단, 당해 연도 2회차 합격자는 수시 원서접수 기간에 나이스 온라인 연동이 차단돼요. 이 경우엔 실물 원본을 등기우편으로 직접 제출해야 해요.',
    cards: [
      {
        icon: CheckCircle2,
        title: '수시 신청 시기',
        body: '보통 9월 수시 원서접수 기간에 신청해요. 각 대학 입학처에서 안내하는 방법을 따르면 돼요.',
      },
      {
        icon: Target,
        title: '정시 신청 시기',
        body: '정시는 12월 원서접수 시작과 함께 나이스 신청도 가능해요.',
      },
      {
        icon: HelpCircle,
        title: '2회차 합격자 주의!',
        body: `당해 연도 2회차 합격자(예: ${currentYear()}년 2회차)는 수시 시즌에 나이스 온라인 연동이 차단돼요. 실물 우편 제출이 필수예요.`,
      },
      {
        icon: ClipboardList,
        title: '실물 제출 방법',
        body: '성적증명서 원본을 시도교육청 또는 나이스에서 발급받아 등기우편으로 각 대학 입학처에 직접 보내면 돼요.',
      },
    ],
    next: '2회차 합격자라면 수시 원서 넣기 전에 해당 대학 입학처에 전화해서 실물 우편 제출 방법을 정확히 확인해요.',
  },

  gedLimit: {
    icon: Target,
    title: '검정고시 100점이면\n교과 전형 합격 돼요?',
    subtitle: '아쉽지만, 대부분의 서울 상위권 대학은 구조적으로 어려워요.',
    easy: '검정고시 100점 만점을 받아도, 대학의 비교내신 환산 방식 때문에 실제로는 2~3등급에 그치는 경우가 많아요. 서울 상위권 대학 교과 전형의 합격선은 대부분 1등급대여서, 만점자도 합격선에 미치지 못할 수 있어요.',
    key: '이 구조적 한계 때문에 검정고시생에게는 논술 전형이나 정시 전형이 더 효과적인 경우가 많아요.',
    cards: [
      {
        icon: Scale,
        title: '왜 2~3등급이 돼요?',
        body: '대학마다 검정고시 점수를 내신 등급으로 바꾸는 방식이 달라요. 예를 들어 명지대는 100점 만점자도 환산 2등급(99점)이 돼요.',
      },
      {
        icon: CheckCircle2,
        title: '교과 전형 가능한 대학도 있어요',
        body: '삼육대, 명지대(서울), 경기대, 서경대, 성공회대는 100점 만점 기준으로 교과 전형 합격권에 들 수 있어요.',
      },
      {
        icon: Target,
        title: '논술 전형이 우회로예요',
        body: '성균관대, 가천대처럼 논술 100% 전형은 내신을 아예 반영하지 않아요. 논술 실력이 있으면 서울 주요 대학도 충분히 노릴 수 있어요.',
      },
      {
        icon: GraduationCap,
        title: '지방거점국립대는 가능해요',
        body: '충북대, 충남대, 전남대, 경북대, 부산대 등 지방거점국립대는 100점 만점 + 수능 최저 충족 시 합격 가능성이 높아요.',
      },
    ],
    next: '내 점수로 교과 전형이 어렵다면, "논술 전형" 또는 "정시"를 병행하는 전략을 세워보세요.',
  },

  essay: {
    icon: PenLine,
    title: '논술 전형,\n검정고시생에게 왜 좋아요?',
    subtitle: '내신 불이익이 없거나 적어서, 검정고시생의 핵심 우회 전략이에요.',
    easy: '논술 전형은 내신 성적보다 논술 시험 점수를 더 크게 반영해요. 검정고시생은 내신(비교내신) 환산 등급이 낮게 나오는 경우가 많은데, 논술은 그 불이익을 최소화할 수 있어요.',
    key: '논술 100% 전형은 내신을 아예 보지 않아요. 성균관대, 가천대, 한국기술교육대 등이 여기 해당해요.',
    cards: [
      {
        icon: CheckCircle2,
        title: '논술 100% — 가장 유리',
        body: '학생부 반영이 0%예요. 내신 불이익이 전혀 없어요. 성균관대, 가천대, 한국기술교육대 등이 해당해요.',
      },
      {
        icon: Target,
        title: '논술로 내신 역산 — 추천',
        body: '논술 점수가 비교내신 등급을 자동으로 결정해요. 삼육대, 상명대, 수원대 등이 해당해요.',
      },
      {
        icon: HelpCircle,
        title: '내신 혼합 — 격차 확인 필수',
        body: '1~5등급 점수 차가 3점 이하면(예: 서강대) 사실상 불이익이 거의 없어요. 12점 이상이면(예: 서울시립대) 불리하니 신중하게 판단해요.',
      },
      {
        icon: Scale,
        title: '수능 최저가 있으면?',
        body: '수능 최저가 있는 논술 전형은 실질 경쟁률이 낮아지는 경향이 있어요. 수능을 준비한다면 오히려 유리할 수 있어요.',
      },
    ],
    next: '논술 전형을 노린다면, "논술 100%"인지, "수능 최저가 있는지"부터 확인해요. 기출 문제로 미리 준비하면 훨씬 유리해요.',
  },
};

// 홈 카드와 동일한 주제별 색
const TOPIC_COLOR = {
  types: 'brand', susi: 'green', compare: 'coral', csat: 'brand',
  susiJeongsi: 'gold', count: 'brand', apply: 'coral',
  interview: 'green', grade: 'brand', guideline: 'green',
  docs: 'coral', naice: 'brand', gedLimit: 'gold', essay: 'green',
};

// 카드 아이콘이 전부 파란색으로 나오던 문제 → 카드마다 색을 번갈아 입힘
const CARD_ICON_COLORS = ['green', 'gold', 'brand', 'red'];

export default function GuideScreen({ topic = 'types', goTo = () => {}, goBack = () => {} }) {
  const guide = GUIDES[topic] ?? GUIDES.types;
  const HeroIcon = guide.icon;
  const color = TOPIC_COLOR[topic] || 'brand';

  return (
    <div className={`screen guide-screen guide-theme-${color}`}>
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">자주 하는 질문</span>
      </header>

      <section className="guide-hero">
        <span className={`guide-hero-icon ico-${color}`}>
          <HeroIcon size={28} />
        </span>
        <h1>{guide.title}</h1>
        <p>{guide.subtitle}</p>
      </section>

      <section className="explain-box">
        <span className="mini-label">쉽게 말하면</span>
        <p>{guide.easy}</p>
      </section>

      <section className="guide-key">
        <CheckCircle2 size={18} />
        <p>{guide.key}</p>
      </section>

      <div className="guide-card-list">
        {guide.cards.map(({ icon: Icon, title, body }, i) => (
          <article className="guide-card" key={title}>
            <span className={`guide-card-icon ico-${CARD_ICON_COLORS[i % CARD_ICON_COLORS.length]}`}>
              <Icon size={20} />
            </span>
            <div>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          </article>
        ))}
      </div>

      <section className="next-action">
        <span className="mini-label">지금은 이렇게 해봐요</span>
        <p>{guide.next}</p>
      </section>
    </div>
  );
}
