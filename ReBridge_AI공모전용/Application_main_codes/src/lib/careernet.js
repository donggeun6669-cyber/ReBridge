// 커리어넷(career.go.kr) 직업정보 API 클라이언트.
// 프로덕션: 서버리스 프록시(api/careernet.js)를 통해 호출 — API 키는 서버에만 있음.
// 개발(dev): VITE_CAREERNET_API_KEY 환경변수로 career.go.kr 직접 호출.
const DEV_KEY = import.meta.env.VITE_CAREERNET_API_KEY;
const CAREER_BASE = 'https://www.career.go.kr/cnet/openapi';

async function careerFetch(params) {
  if (import.meta.env.DEV && DEV_KEY) {
    const apiPath = params.get('path') || 'openApi.json';
    params.delete('path');
    params.set('apiKey', DEV_KEY);
    return fetch(`${CAREER_BASE}/${apiPath}?${params}`);
  }
  return fetch(`/api/careernet?${params}`);
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
    seq: item.jobdicSeq ?? item.seq ?? item.job_seq ?? null,
    name: item.job ?? item.job_nm ?? item.jobNm ?? item.title ?? item.name ?? '직업',
    summary: item.summary ?? item.work ?? item.job_work ?? '',
  };
}

// 직업 목록 검색. { jobs, live, total } 반환.
export async function fetchJobs({ keyword = '', perPage = 20, pageIndex = 1 } = {}) {
  const params = new URLSearchParams({
    path: 'getOpenApi.do',
    svcType: 'api',
    svcCode: 'JOB',
    contentType: 'json',
    gubun: 'job_dic_list',
    perPage: String(perPage),
    pageIndex: String(pageIndex),
  });
  if (keyword) params.set('searchJobNm', keyword);

  try {
    const res = await careerFetch(params);
    if (res.status === 404) return { jobs: [], live: false, total: 0 };
    if (!res.ok) throw new Error(`careernet ${res.status}`);
    const data = await res.json();
    const list = pickList(data);
    const jobs = list.map(normJob).filter((j) => j.name);
    const total = Number(
      data?.dataSearch?.totalCount ??
      list?.[0]?.totalCount ??
      data?.totalCount ??
      jobs.length
    );
    return { jobs, live: true, total };
  } catch {
    return { jobs: [], live: false, total: 0 };
  }
}

// 여러 키워드로 검색해 합치고 중복(seq/name)을 제거한다. 분야 칩에서 사용.
export async function fetchJobsMulti(keywords = [], perPerKeyword = 50) {
  try {
    const results = await Promise.all(
      keywords.map((kw) => fetchJobs({ keyword: kw, perPage: perPerKeyword, pageIndex: 1 }))
    );
    const seen = new Set();
    const merged = [];
    for (const r of results) {
      for (const job of r.jobs) {
        const key = job.seq != null ? `seq:${job.seq}` : `name:${job.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(job);
      }
    }
    merged.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return { jobs: merged, live: true, total: merged.length };
  } catch {
    return { jobs: [], live: false, total: 0 };
  }
}

// enrichJob을 상태와 함께 돌려준다.
//   { status: 'ok', data }   요약을 가져옴
//   { status: 'empty' }      호출은 됐지만 요약 없음
//   { status: 'error' }      네트워크/서버 실패 → '다시 시도' 노출
export async function enrichJobResult(q) {
  if (!q) return { status: 'empty' };
  const params = new URLSearchParams({
    path: 'getOpenApi.do',
    svcType: 'api',
    svcCode: 'JOB',
    contentType: 'json',
    gubun: 'job_dic_list',
    perPage: '1',
    searchJobNm: q,
  });
  try {
    const res = await careerFetch(params);
    if (res.status === 404) return { status: 'empty' };
    if (!res.ok) throw new Error(`careernet ${res.status}`);
    const data = await res.json();
    const first = pickList(data).map(normJob).find((j) => j.name);
    if (!first) return { status: 'empty' };
    let summary = first.summary;
    if (!summary && first.seq) {
      const d = await fetchJobDetail(first.seq);
      summary = d?.work || '';
    }
    if (!summary) return { status: 'empty', data: { seq: first.seq } };
    return { status: 'ok', data: { summary, seq: first.seq } };
  } catch {
    return { status: 'error' };
  }
}

// 직업 상세(되는 법/하는 일). seq 없으면 null.
export async function fetchJobDetail(seq) {
  if (!seq) return null;
  const params = new URLSearchParams({
    path: 'getOpenApi.do',
    svcType: 'api',
    svcCode: 'JOB',
    contentType: 'json',
    gubun: 'job_dic_view',
    seq: String(seq),
  });
  try {
    const res = await careerFetch(params);
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
