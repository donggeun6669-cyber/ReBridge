// 화면에 쓰는 대학 목록 — 여기 하나만 거쳐서 나간다.
//
// universities.json(어디가 마스터 351개)을 직접 import 하지 말 것.
// 그 안에는 대학이 아닌 항목과 사내대학이 섞여 있어서, 그대로 쓰면 검정고시생에게
// 지원할 수 없는 곳을 "지원 가능"으로 보여주게 된다.
// 무엇을 왜 빼는지는 ../data/excludedUniversities.js 에 사유와 함께 적혀 있다.

import all from '../data/universities.json';
import { EXCLUDED_UNIV_IDS } from '../data/excludedUniversities.js';

/** 마스터 전체 — 데이터 점검·통계용. 화면 목록에는 쓰지 않는다. */
export const ALL_UNIVERSITIES = all;

// 통합 등으로 이름이 바뀐 대학 — 마스터는 그대로 두고 화면 이름만 지금 이름으로 (2026-09-19 동근님)
export const NAME_OVERRIDES = {
  // 2026-03 강원대에 통합. 강릉·원주캠퍼스가 모집요강·시행계획을 따로 낸다.
  uA0000001: '강원대학교(강릉·원주캠퍼스)',
};

/** 일반 대입 대상 대학. 추천·검색·지도는 전부 이걸 쓴다. */
const universities = all
  .filter((u) => !EXCLUDED_UNIV_IDS.has(u.univId))
  .map((u) => (NAME_OVERRIDES[u.univId] ? { ...u, name: NAME_OVERRIDES[u.univId], formerName: u.name } : u));

export default universities;
