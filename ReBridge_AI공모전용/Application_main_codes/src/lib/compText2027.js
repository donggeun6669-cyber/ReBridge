// 2027학년도 비교내신 환산표 '모집요강 발췌' 로더 — 필요할 때만 네트워크에서 받아온다.
//
// gedText2027.js와 같은 구조다. 원본 comparative_2027_text.json(2.7MB)은 번들에 넣지 않고,
// scripts/prepare2027.mjs가 대학별로 쪼갠 public/data/comp_text/<univId>.json을
// '환산 근거 원문 보기'를 눌렀을 때만 받는다.
//
// 발췌는 요약하지 않는다. 다만 이것은 모집요강 '전체'가 아니라 비교내신 산출 관련 쪽만
// 뽑은 것이므로, 화면에는 원본 PDF 링크(sources[].sourceUrl)를 함께 보여준다.

const BASE = import.meta.env?.BASE_URL || '/';
const SHARD_URL = (univId) => `${BASE}data/comp_text/${univId}.json`;
const FULL_URL = `${BASE}data/comparative_2027_text.json`;

const cache = new Map();
let fullPromise = null;

function loadFull() {
  if (!fullPromise) {
    fullPromise = fetch(FULL_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`원문 파일을 불러오지 못했어요 (${res.status})`);
        return res.json();
      })
      .catch((err) => {
        fullPromise = null;
        throw err;
      });
  }
  return fullPromise;
}

/**
 * 그 대학의 환산표 관련 모집요강 발췌를 받아온다.
 * @returns {Promise<{univ, univId, year, sources: Array<{file, phase, pages, sourceUrl}>,
 *                    pages: Array<{cited, page, phase, sourceFile, text}>} | null>}
 */
export function loadCompText2027(univId) {
  if (!univId) return Promise.resolve(null);
  if (cache.has(univId)) return cache.get(univId);

  const p = fetch(SHARD_URL(univId))
    .then((res) => {
      if (res.ok) return res.json();
      if (res.status === 404) return loadFull().then((all) => all[univId] || null);
      throw new Error(`원문을 불러오지 못했어요 (${res.status})`);
    })
    .then((v) => (v && typeof v === 'object' ? v : null))
    .catch((err) => {
      cache.delete(univId);
      throw err;
    });

  cache.set(univId, p);
  return p;
}
