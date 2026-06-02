// Vercel serverless function — CareerNet API proxy
// 클라이언트에서 직접 CAREERNET_API_KEY를 쓰지 말 것. 이 함수를 통해서만 호출.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.CAREERNET_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { path = '', ...queryParams } = req.query ?? {};
  const params = new URLSearchParams({ apiKey, ...queryParams });
  const url = `https://www.career.go.kr/cnet/openapi/${path}?${params}`;

  try {
    const upstream = await fetch(url);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
