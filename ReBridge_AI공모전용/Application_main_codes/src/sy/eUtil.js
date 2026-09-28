// 묶음 E(커뮤니티) 전용 작은 유틸.
//   기능 로직은 src/lib/community.js·auth.js·youthVerify.js 를 그대로 쓰고,
//   여기는 화면 표시용 자잘한 변환만 모은다.

// 댓글 작성자 아바타에 쓸 첫 글자(닉네임/익명 공통).
export function avatarInitial(nickname) {
  const s = String(nickname || '익명').trim();
  return s.slice(0, 1) || '익';
}

// 글쓰기 화면 — 게시판별 제목/본문 placeholder(시안은 '질문' 게시판 상태만 있어
// 그 문구를 쓰고, 나머지 게시판은 기존 화면 문구를 다듬어 재사용한다).
const TITLE_PLACEHOLDER = {
  qna: '궁금한 점을 한 줄로 적어주세요',
};
const BODY_PLACEHOLDER = {
  qna: '상황을 자세히 적으면 답변하기 쉬워요.',
};
export function titlePlaceholder(board) {
  return TITLE_PLACEHOLDER[board] || '제목을 한 줄로 적어주세요';
}
export function bodyPlaceholder(board) {
  return BODY_PLACEHOLDER[board] || '같은 학교밖 친구들에게 하고 싶은 이야기를 편하게 적어요.';
}

// 목록 화면 정렬 탭(전체·최신·인기) → community.js 의 sort 값.
// '전체'는 시안에만 있는 상태라 기존 정렬 중 가장 가까운 '최신'에 이어 붙인다.
export function sortUiToApi(sortUi) {
  return sortUi === 'popular' ? 'popular' : 'latest';
}
