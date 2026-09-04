// 2027학년도 지원자격 '원문' 로더 — 필요할 때만 네트워크에서 받아온다.
//
// 왜 import 하지 않는가
//   원본 ged_eligible_2027_text.json 은 2MB다. 번들에 넣으면 앱을 켜는 모든 사람이
//   쓰지도 않을 194개 대학의 원문까지 내려받게 된다.
//   그래서 scripts/prepare2027.mjs 가 대학별로 쪼개 public/data/ged_text/<univId>.json
//   (평균 6KB, 최대 15KB)로 만들어 두고, '원문 보기'를 눌렀을 때만 그 대학 것만 받는다.
//
// 원문은 요약하지 않는다. 지원자격은 한 글자가 자격을 가르기 때문에 그대로 보여준다.

const BASE = import.meta.env?.BASE_URL || '/';
const SHARD_URL = (univId) => `${BASE}data/ged_text/${univId}.json`;
const FULL_URL = `${BASE}data/ged_eligible_2027_text.json`;

// univId -> Promise<entries[]>. 같은 대학을 두 번 열어도 한 번만 받는다.
const cache = new Map();
let fullPromise = null;

// 통짜 파일 폴백 — 쪼갠 파일이 없을 때만(배포 누락 등) 한 번 받는다.
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
 * 그 대학의 2027 지원자격 원문 목록을 받아온다.
 * @returns {Promise<Array<{nameKey, admissionName, phase, admissionType, gedEligible,
 *                          gedQuote, sourceFile, requirements: Array<{common, detail, extra, page}>}>>}
 */
export function loadGedText2027(univId) {
  if (!univId) return Promise.resolve([]);
  if (cache.has(univId)) return cache.get(univId);

  const p = fetch(SHARD_URL(univId))
    .then((res) => {
      if (res.ok) return res.json();
      if (res.status === 404) return loadFull().then((all) => all[univId] || []);
      throw new Error(`원문을 불러오지 못했어요 (${res.status})`);
    })
    .then((v) => (Array.isArray(v) ? v : []))
    .catch((err) => {
      cache.delete(univId); // 실패는 캐시하지 않는다 — 다시 누르면 재시도
      throw err;
    });

  cache.set(univId, p);
  return p;
}

/**
 * 전형 행(row)에 맞는 원문 항목 찾기.
 * 원문 파일의 키는 nameKey라, nameKey → admissionName 순으로 맞춰본다.
 */
export function matchGedTextEntry(entries, row) {
  if (!entries || entries.length === 0 || !row) return null;
  const key = row.nameKey || row.admissionName;
  return (
    entries.find((e) => e.nameKey === key) ||
    entries.find((e) => e.admissionName === row.admissionName) ||
    entries.find((e) => e.nameKey === row.admissionName) ||
    null
  );
}
