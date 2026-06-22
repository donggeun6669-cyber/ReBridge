// 홈 통합 검색 — 대학 / 직업 / 용어 / 앱 메뉴 / 꿈드림센터 / 지원혜택
import universities from '../data/universities.json';
import kkumdrim from '../data/kkumdrim.json';
import { JOB_CATALOG } from '../data/careerData.js';
import { ADMISSION_TERMS, CAREER_TERMS } from '../data/glossary.js';
import { COMMON_SUPPORT } from '../data/commonSupport.js';

const JOBS = Object.entries(JOB_CATALOG).flatMap(([field, arr]) =>
  (arr || []).map((j) => ({ name: j.name, q: j.q || j.name, field })),
);
const TERMS = [...ADMISSION_TERMS, ...CAREER_TERMS];

// 앱 메뉴 목록 — label + keywords(띄어쓰기로 구분) + 이동할 screen
const MENUS = [
  { label: '꿈드림센터 찾기',   keywords: '꿈드림 센터 지원센터 학교밖 청소년 위치 지도', screen: 'dreamdrive' },
  { label: '공부 플래너',       keywords: '공부 플래너 학습 계획 스터디 오늘 할일',       screen: 'study-planner' },
  { label: '학습 로드맵',       keywords: '로드맵 학습 계획 공부 검정고시 준비',          screen: 'study-roadmap' },
  { label: '검정고시 안내',     keywords: '검정고시 시험 일정 과목 합격 점수 접수',        screen: 'ged-guide' },
  { label: '대학 찾기',         keywords: '대학 찾기 탐색 입시 학교',                    screen: 'univ-explore' },
  { label: '내 점수 입력',      keywords: '점수 입력 검정고시 성적 결과',                 screen: 'results' },
  { label: '지원 혜택',         keywords: '지원 혜택 복지 장학금 청소년 정책',            screen: 'support' },
  { label: '입시 용어 사전',    keywords: '용어 입시 수시 정시 비교내신 수능최저 전형',   screen: 'glossary', params: { track: 'univ' } },
  { label: '커뮤니티',          keywords: '커뮤니티 게시판 친구 소통 이야기',             screen: 'community' },
  { label: '체크리스트',        keywords: '체크리스트 할일 준비 서류 지금',               screen: 'checklist' },
  { label: '직업 탐색',         keywords: '직업 탐색 진로 일자리 취업 커리어',            screen: 'job-info' },
  { label: '진로 검사',         keywords: '진로 검사 적성 심리 유형 mbti',               screen: 'job-psych' },
  { label: '진로 로드맵',       keywords: '진로 로드맵 직업 계획 일 취업',               screen: 'job-roadmap' },
  { label: '직업훈련',          keywords: '직업훈련 국비 취업 기술 교육 훈련',           screen: 'job-training' },
  { label: '내 로드맵',         keywords: '로드맵 내 계획 목표 대학 입시',               screen: 'roadmap' },
  { label: '도움말',            keywords: '도움말 질문 담임 문의 막힘',                  screen: 'help' },
];

// 반환: { empty, univs[], jobs[], terms[], menus[], centers[], supports[] }
export function searchAll(qRaw, limit = 5) {
  const q = (qRaw || '').trim().toLowerCase();
  if (!q) return { empty: true, univs: [], jobs: [], terms: [], menus: [], centers: [], supports: [] };

  const univs = universities
    .filter((u) => (u.name || '').toLowerCase().includes(q))
    .slice(0, limit);

  const jobs = JOBS
    .filter((j) => `${j.name} ${j.q}`.toLowerCase().includes(q))
    .slice(0, limit);

  const terms = TERMS
    .filter((t) => `${t.term} ${t.short || ''}`.toLowerCase().includes(q))
    .slice(0, limit);

  const menus = MENUS
    .filter((m) => `${m.label} ${m.keywords}`.toLowerCase().includes(q))
    .slice(0, limit);

  const centers = kkumdrim
    .filter((c) => `${c.name} ${c.region || ''} ${c.district || ''} ${c.address || ''}`.toLowerCase().includes(q))
    .slice(0, limit);

  const supports = COMMON_SUPPORT
    .filter((s) => `${s.title} ${s.summary} ${s.detail || ''}`.toLowerCase().includes(q))
    .slice(0, limit);

  return { empty: false, univs, jobs, terms, menus, centers, supports };
}
