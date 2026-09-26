// centers — 꿈드림센터 목록 한 곳 (PRD v2 F1~F3, 2026-09-26 시연판)
//   · 기본 정보: data/kkumdrim.json (여성가족부 2025 주소록 기반, 222곳)
//   · 홈페이지: data/kkumdrim_web.json — 한국청소년상담복지개발원 「전국 꿈드림 센터」(2025-09-03)
//     CSV의 '홈페이지' 칸을 전화번호로 맞춰 붙였다(84곳). 2026-09-26 접속 확인에서 죽은 7곳(modoo 종료 포함)은 뺐고
//     영등포는 누리집 첫 화면으로 바꿨다 → 77곳. 빈 칸은 지어내지 않는다.
//     김요셉 님이 손으로 찾은 서울 센터 링크는 2026-09-26에 받았다 — 홈페이지가 아니라 프로그램·공지 게시판 링크라
//     아래 kkumdrim_programs.json 에 따로 둔다.
import centersRaw from '../data/kkumdrim.json';
import webRaw from '../data/kkumdrim_web.json';
// 센터 프로그램·공지 게시판 링크 — 김요셉 님 정리(서울 26곳, 2026-09-26 전달, PRD v2 F2·F8).
//   links 가 비어 있으면 'none'에 이유가 있다(실제로 온라인 게시판이 없는 곳). 서울 밖은 아직 정리 전(null).
import programsRaw from '../data/kkumdrim_programs.json';

export const PROGRAMS_CHECKED = programsRaw._checked;
import { getHomeRegion } from './persona.js';

export const CENTERS = centersRaw.map((c) => ({
  ...c,
  homepage: webRaw[c.id]?.url || null,
  homepageSource: webRaw[c.id]?.source || null,
  programs: programsRaw.centers[c.id] || null,
}));

export const REGIONS = [
  '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

export const REGION_COUNT = CENTERS.reduce((acc, c) => {
  acc[c.region] = (acc[c.region] || 0) + 1;
  return acc;
}, {});

export function getCenter(id) {
  return CENTERS.find((c) => c.id === id) || null;
}

// "○○구 학교밖청소년지원센터" → 목록에서 읽기 쉬운 짧은 이름
export function shortName(c) {
  if (!c) return '';
  // 같은 구·시에 센터가 여럿(청주시·서청주 등)이라 district가 아니라 이름에서 줄인다.
  const head = c.name.replace(/\s*학교밖청소년지원센터\s*/, ' ').trim();
  return `${head || c.district} 꿈드림`;
}

// 쪽지·쪽지함에서 센터를 알아보게 하는 짧은 표식 — '종로구' → '종로', '중구' → '중구', 시·도 센터 → '서울'
export function centerMark(c) {
  if (!c) return '꿈';
  if (c.type === '시도') return c.region;
  const d = String(c.district || '').split(' ').pop();
  return d.length <= 2 ? d : d.replace(/[시군구]$/, '').slice(0, 2);
}

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function distLabel(km) {
  if (km == null || !Number.isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

// 지역·검색어·내 위치로 거른 목록. 위치가 있으면 가까운 순.
export function filterCenters({ region = null, query = '', pos = null } = {}) {
  let out = region ? CENTERS.filter((c) => c.region === region) : [...CENTERS];
  const q = query.trim().toLowerCase();
  if (q) {
    out = out.filter((c) => c.name.toLowerCase().includes(q)
      || c.district.toLowerCase().includes(q)
      || (c.address || '').toLowerCase().includes(q));
  }
  if (pos) {
    out = out
      .map((c) => ({ ...c, _dist: c.lat ? haversine(pos.lat, pos.lng, c.lat, c.lng) : Infinity }))
      .sort((a, b) => a._dist - b._dist);
  }
  return out;
}

// 홈에 보여줄 '내 센터' — 사는 지역의 시·도 센터를 먼저, 없으면 그 지역 첫 센터.
// 사는 지역을 모르면 null(홈은 지역을 고르라고 안내한다).
export function suggestedCenter(region = getHomeRegion()) {
  if (!region) return null;
  const list = CENTERS.filter((c) => c.region === region);
  return list.find((c) => c.type === '시도') || list[0] || null;
}

// 위치 권한은 한 번 받으면 이 기기에서 기억한다(좌표는 저장하지 않는다 — 매번 새로 받는다).
const LOC_KEY = 'rb_loc_ok';
export function locationAllowed() {
  try { return localStorage.getItem(LOC_KEY) === '1'; } catch { return false; }
}
export function requestPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        try { localStorage.setItem(LOC_KEY, '1'); } catch { /* noop */ }
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => resolve(null),
      { timeout: 10000, maximumAge: 300000 },
    );
  });
}
