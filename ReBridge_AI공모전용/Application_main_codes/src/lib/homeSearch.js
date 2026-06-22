// 홈 통합 검색 — 대학 / 직업 / 용어를 한 입력으로 찾는다.
// 데이터는 읽기만(각 영역 데이터 파일은 다른 곳에서 관리).
import universities from '../data/universities.json';
import { JOB_CATALOG } from '../data/careerData.js';
import { ADMISSION_TERMS, CAREER_TERMS } from '../data/glossary.js';

const JOBS = Object.entries(JOB_CATALOG).flatMap(([field, arr]) =>
  (arr || []).map((j) => ({ name: j.name, q: j.q || j.name, field })),
);
const TERMS = [...ADMISSION_TERMS, ...CAREER_TERMS];

// 반환: { empty, univs[], jobs[], terms[] } (각 최대 limit개)
export function searchAll(qRaw, limit = 5) {
  const q = (qRaw || '').trim().toLowerCase();
  if (!q) return { empty: true, univs: [], jobs: [], terms: [] };
  const univs = universities
    .filter((u) => (u.name || '').toLowerCase().includes(q))
    .slice(0, limit);
  const jobs = JOBS
    .filter((j) => `${j.name} ${j.q}`.toLowerCase().includes(q))
    .slice(0, limit);
  const terms = TERMS
    .filter((t) => `${t.term} ${t.short || ''}`.toLowerCase().includes(q))
    .slice(0, limit);
  return { empty: false, univs, jobs, terms };
}
