// 한국어 조사 붙이기.
//
// 대학 이름을 문장에 끼워 넣을 때마다 '강원대학교은', '가천대학교이' 같은 게 나온다.
// 한글 음절 코드 = 0xAC00 + 초성*588 + 중성*28 + 종성. (코드-0xAC00) % 28 == 0 이면 받침이 없다.
// 한글이 아니거나 알 수 없으면 받침 없는 쪽을 쓴다(영문 약칭 등).
function hasBatchim(word) {
  const last = String(word || '').trim().slice(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/** 은/는 */
export const eunNeun = (w) => (hasBatchim(w) ? '은' : '는');
/** 이/가 */
export const iGa = (w) => (hasBatchim(w) ? '이' : '가');
/** 을/를 */
export const eulReul = (w) => (hasBatchim(w) ? '을' : '를');
/** 과/와 */
export const gwaWa = (w) => (hasBatchim(w) ? '과' : '와');
