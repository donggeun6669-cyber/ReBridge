// 커리어넷(career.go.kr) 직업정보 API 클라이언트.
// 서버리스 프록시(api/careernet.js)를 통해서만 호출한다 — API 키는 서버에만 있음.
// 키 미설정/네트워크 실패(로컬 개발 등) 시에는 큐레이션 폴백 데이터를 돌려줘 화면이 비지 않게 한다.

// 관심 분야(질문 답변) → 직업사전 대표 검색어
const FIELD_KEYWORD = {
  'IT·디자인': '개발자',
  '서비스·요식': '조리사',
  '제조·기술': '정비',
  '사무·행정': '사무원',
  '아직 몰라요': '',
};

// API가 막혔을 때 보여줄 분야별 대표 직업(이름+한 줄). 실데이터 연결 전/실패 시 폴백.
const FALLBACK_JOBS = {
  'IT·디자인': [
    { seq: null, name: '응용소프트웨어 개발자', summary: '필요한 프로그램·앱을 설계하고 코드로 만들어요.' },
    { seq: null, name: '웹 디자이너', summary: '웹사이트의 화면과 사용 흐름을 보기 좋게 디자인해요.' },
    { seq: null, name: '그래픽 디자이너', summary: '포스터·로고 등 시각 디자인 작업을 해요.' },
  ],
  '서비스·요식': [
    { seq: null, name: '조리사', summary: '음식점·급식소 등에서 음식을 조리해요.' },
    { seq: null, name: '제과제빵사', summary: '빵·과자·케이크를 만들어요. 기능사 자격과 연결돼요.' },
    { seq: null, name: '바리스타', summary: '커피 음료를 만들고 매장 운영을 도와요.' },
  ],
  '제조·기술': [
    { seq: null, name: '자동차 정비원', summary: '자동차를 점검하고 고장 난 곳을 수리해요.' },
    { seq: null, name: '전기 기능사 직무', summary: '전기 설비를 설치·점검해요. 전기기능사와 연결돼요.' },
    { seq: null, name: '용접원', summary: '금속을 녹여 붙이는 용접 작업을 해요.' },
  ],
  '사무·행정': [
    { seq: null, name: '사무원', summary: '문서 작성·자료 정리 등 사무 업무를 해요.' },
    { seq: null, name: '회계·경리 사무원', summary: '입출금·장부 등 회계 관련 사무를 맡아요.' },
    { seq: null, name: '고객 상담원', summary: '전화·온라인으로 고객 문의에 응대해요.' },
  ],
  '아직 몰라요': [
    { seq: null, name: '조리사', summary: '음식점·급식소에서 음식을 조리해요.' },
    { seq: null, name: '응용소프트웨어 개발자', summary: '프로그램·앱을 만들어요.' },
    { seq: null, name: '사무원', summary: '문서·자료 정리 등 사무 업무를 해요.' },
  ],
};

export function keywordForField(field) {
  return FIELD_KEYWORD[field] ?? '';
}

export function fallbackJobsForField(field) {
  return FALLBACK_JOBS[field] || FALLBACK_JOBS['아직 몰라요'];
}

// 다양한 응답 형태에서 직업 목록을 뽑아낸다(커리어넷 응답 스키마 방어).
function pickList(data) {
  const cand =
    data?.dataSearch?.content ??
    data?.jobdicList ??
    data?.content ??
    data?.list ??
    [];
  return Array.isArray(cand) ? cand : [];
}

function normJob(item) {
  return {
    seq: item.seq ?? item.job_seq ?? item.jobseq ?? null,
    name: item.job_nm ?? item.jobNm ?? item.list_title ?? item.title ?? item.name ?? '직업',
    summary:
      item.summary ?? item.work ?? item.job_work ?? item.aptit_name ?? item.list_content ?? '',
  };
}

// 직업 목록 검색. 성공 시 {jobs, live:true}, 실패/빈응답 시 폴백 {jobs, live:false}.
export async function fetchJobs({ keyword = '', field = '아직 몰라요', perPage = 10 } = {}) {
  const q = keyword || keywordForField(field);
  const params = new URLSearchParams({
    path: 'openApi.json',
    svcType: 'api',
    svcCode: 'JOB',
    contentType: 'json',
    gubun: 'job_dic_list',
    perPage: String(perPage),
  });
  if (q) params.set('searchJobNm', q);

  try {
    const res = await fetch(`/api/careernet?${params}`);
    if (!res.ok) throw new Error(`careernet ${res.status}`);
    const data = await res.json();
    const jobs = pickList(data).map(normJob).filter((j) => j.name);
    if (jobs.length) return { jobs, live: true };
    return { jobs: fallbackJobsForField(field), live: false };
  } catch {
    return { jobs: fallbackJobsForField(field), live: false };
  }
}

// 큐레이션 직업 1건을 커리어넷에서 보강한다.
// 검색어(q)로 첫 매칭 직업의 '하는 일' 요약과 seq를 가져온다.
// 실패/미연결(로컬 등) 시 null — 큐레이션 카드의 'why'만 보여주면 되므로 폴백 안 함.
export async function enrichJob(q) {
  if (!q) return null;
  const params = new URLSearchParams({
    path: 'openApi.json',
    svcType: 'api',
    svcCode: 'JOB',
    contentType: 'json',
    gubun: 'job_dic_list',
    perPage: '1',
    searchJobNm: q,
  });
  try {
    const res = await fetch(`/api/careernet?${params}`);
    if (!res.ok) throw new Error(`careernet ${res.status}`);
    const data = await res.json();
    const first = pickList(data).map(normJob).find((j) => j.name);
    if (!first) return null;
    // 목록 요약이 비면 상세에서 '하는 일'을 한 번 더 시도
    let summary = first.summary;
    if (!summary && first.seq) {
      const d = await fetchJobDetail(first.seq);
      summary = d?.work || '';
    }
    if (!summary) return null;
    return { summary, seq: first.seq };
  } catch {
    return null;
  }
}

// 직업 상세(되는 법/하는 일). seq 없으면 null.
export async function fetchJobDetail(seq) {
  if (!seq) return null;
  const params = new URLSearchParams({
    path: 'openApi.json',
    svcType: 'api',
    svcCode: 'JOB',
    contentType: 'json',
    gubun: 'job_dic_view',
    seq: String(seq),
  });
  try {
    const res = await fetch(`/api/careernet?${params}`);
    if (!res.ok) throw new Error(`careernet ${res.status}`);
    const data = await res.json();
    const v = data?.dataSearch?.content?.[0] ?? data?.jobDicView ?? data?.content ?? data ?? {};
    const work = v.work ?? v.job_work ?? v.do_work ?? '';
    const becoming = v.rdyway ?? v.become ?? v.way ?? v.prep ?? '';
    const wage = v.slry ?? v.wage ?? v.income ?? '';
    if (!work && !becoming && !wage) return null;
    return { work, becoming, wage };
  } catch {
    return null;
  }
}
