// Vercel serverless function — CareerNet API 프록시.
// 클라이언트에서 직접 CAREERNET_API_KEY를 쓰지 말 것. 이 함수를 통해서만 호출.
//
// 보안 설계(오픈 프록시 방지):
//   1) 업스트림 경로·파라미터를 화이트리스트로 고정 — 임의 경로/키 덮어쓰기 불가.
//   2) 같은 출처(same-origin) 요청만 허용 — curl 등 외부 직접 호출로 키 쿼터 소진 차단.
//   3) 인스턴스 단위 레이트리밋 + CDN 캐시로 업스트림 호출량 자체를 줄임.

const UPSTREAM = 'https://www.career.go.kr/cnet/openapi/getOpenApi.do';

// 클라이언트(src/lib/careernet.js)가 실제로 쓰는 파라미터만 통과시킨다.
const ALLOWED_PARAMS = ['gubun', 'perPage', 'pageIndex', 'searchJobNm', 'seq'];
const ALLOWED_GUBUN = new Set(['job_dic_list', 'job_dic_view']);

// 우리 서비스 도메인에서 온 요청인지(origin/referer 기준) 판단.
function isAllowedHost(value) {
  if (!value) return false;
  try {
    const host = new URL(value).hostname;
    return (
      host === 'localhost' || host === '127.0.0.1' ||
      // gumgomentor.vercel.app(운영) + gumgomentor-* 프리뷰·수상본 배포까지 한 번에 커버.
      (host.endsWith('.vercel.app') && host.startsWith('gumgomentor'))
    );
  } catch {
    return false;
  }
}

function isSameOriginRequest(req) {
  // 최신 브라우저는 same-origin fetch에 sec-fetch-site: same-origin을 붙인다.
  if (req.headers['sec-fetch-site'] === 'same-origin') return true;
  // 구형 브라우저 폴백: origin/referer가 우리 도메인이면 허용.
  return isAllowedHost(req.headers.origin) || isAllowedHost(req.headers.referer);
}

// 인스턴스 메모리 레이트리밋(IP당 분당 30회). 서버리스 특성상 완벽하진 않지만
// 단일 IP의 무한 루프/스크립트 남용을 막는 1차 방어선 역할.
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const hits = new Map(); // ip -> [timestamps]

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_LIMIT) return true;
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear(); // 메모리 상한 방어
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSameOriginRequest(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const apiKey = process.env.CAREERNET_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const q = req.query ?? {};
  const gubun = String(q.gubun || '');
  if (!ALLOWED_GUBUN.has(gubun)) {
    return res.status(400).json({ error: 'Bad request' });
  }

  // 서버가 파라미터를 처음부터 다시 조립 — 클라이언트가 apiKey/svc류를 덮어쓸 수 없다.
  const params = new URLSearchParams({
    apiKey, svcType: 'api', svcCode: 'JOB', contentType: 'json',
  });
  for (const name of ALLOWED_PARAMS) {
    if (q[name] != null && q[name] !== '') params.set(name, String(q[name]).slice(0, 100));
  }

  try {
    const upstream = await fetch(`${UPSTREAM}?${params}`);
    const data = await upstream.json();
    // 직업사전 데이터는 사실상 정적 — CDN에 하루 캐시해 키 쿼터를 아낀다.
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(upstream.status).json(data);
  } catch {
    // 내부 오류 메시지는 노출하지 않는다.
    res.status(502).json({ error: 'Upstream error' });
  }
}
