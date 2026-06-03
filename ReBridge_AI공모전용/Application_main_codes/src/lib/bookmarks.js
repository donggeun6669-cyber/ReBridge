// 관심 대학(북마크) — 이 기기(localStorage)에만 저장. 로그인 없음.
// 값: univId 문자열 배열. 최신 추가가 뒤로 쌓임(목록은 최신순으로 뒤집어 보여줌).
const KEY = 'rebridge_bookmarks';

export function getBookmarks() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function isBookmarked(univId) {
  if (!univId) return false;
  return getBookmarks().includes(univId);
}

// 북마크 토글. 반환: 토글 후 북마크 여부(true=추가됨).
export function toggleBookmark(univId) {
  if (!univId) return false;
  const list = getBookmarks();
  const i = list.indexOf(univId);
  let added;
  if (i >= 0) {
    list.splice(i, 1);
    added = false;
  } else {
    list.push(univId);
    added = true;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* 저장 실패는 조용히 무시(시크릿창 등) */
  }
  return added;
}

export function removeBookmark(univId) {
  const list = getBookmarks().filter((id) => id !== univId);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
  return list;
}
