// Vercel serverless function — Gemini API proxy
// 클라이언트에서 직접 GEMINI_API_KEY를 쓰지 말 것. 이 함수를 통해서만 호출.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { prompt, model = 'gemini-1.5-flash' } = req.body ?? {};
  if (!prompt) {
    return res.status(400).json({ error: 'prompt required' });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const data = await upstream.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    res.status(upstream.status).json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
