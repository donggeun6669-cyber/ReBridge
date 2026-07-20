// 학습 트랙 공통 유틸 — 플래너/로드맵/검정고시 가이드가 같이 쓴다.
// (예전엔 화면마다 복사돼 있던 코드를 한 곳으로 모음)

export const DAYS_KEY = 'rebridge_planner_days';   // 날짜별 공부 기록
export const MOCK_KEY = 'rebridge_mock_scores';    // 과목별 모의점수

export function loadDays() {
  try { return JSON.parse(localStorage.getItem(DAYS_KEY)) || {}; }
  catch { return {}; }
}

export function loadScores() {
  try { return JSON.parse(localStorage.getItem(MOCK_KEY)) || {}; }
  catch { return {}; }
}

// Date → 'YYYY-MM-DD'
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 분 → '1시간 30분' 표기
export function fmtMin(m) {
  if (!m) return '0분';
  const h = Math.floor(m / 60), mm = m % 60;
  return h > 0 ? `${h}시간 ${mm ? `${mm}분` : ''}`.trim() : `${mm}분`;
}
