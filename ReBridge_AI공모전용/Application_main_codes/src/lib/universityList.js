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

/** 일반 대입 대상 대학. 추천·검색·지도는 전부 이걸 쓴다. */
const universities = all.filter((u) => !EXCLUDED_UNIV_IDS.has(u.univId));

export default universities;
