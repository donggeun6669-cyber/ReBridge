// 2027학년도 검정고시 지원 가능 전형 데이터 정리 스크립트 (오프라인, 빌드 전 1회)
//
// 왜 필요한가
//   대교협 원본을 파싱한 두 파일은 그대로 쓰면 앱이 무거워진다.
//     · src/data/admissions_2027.json        (1.6MB, 2,496행) — 목록에 필요해서 번들에 들어가야 함
//     · public/data/ged_eligible_2027_text.json (2.0MB) — 지원자격 원문. 대학 하나 볼 때
//       2MB를 통째로 받는 건 모바일에서 말이 안 됨
//
// 무엇을 하는가
//   1) admissions_2027.json → admissions_2027.min.json
//      UI가 안 쓰는 항상-빈 필드(evalMethod·csatMinimum·recruitCount…)와
//      모든 행에서 값이 같은 필드(year=2027, status='confirmed', hasFullText=true)를 뺀다.
//      ⚠️ source(출처)는 화면에 표시하므로 절대 빼지 않는다.
//   2) ged_eligible_2027_text.json → public/data/ged_text/<univId>.json 으로 쪼갠다.
//      대학 하나당 평균 10KB라, '원문 보기'를 눌렀을 때 그 대학 것만 받는다.
//
// 실행:  npm run data:2027
// 원본 두 파일은 지우지 않는다(재생성 근거).

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SRC_ADMISSIONS = join(ROOT, 'src/data/admissions_2027.json');
const OUT_ADMISSIONS = join(ROOT, 'src/data/admissions_2027.min.json');
const SRC_TEXT = join(ROOT, 'public/data/ged_eligible_2027_text.json');
const OUT_TEXT_DIR = join(ROOT, 'public/data/ged_text');
const SRC_COMP_TEXT = join(ROOT, 'public/data/comparative_2027_text.json');
const OUT_COMP_TEXT_DIR = join(ROOT, 'public/data/comp_text');

// 번들에 남길 필드. 여기 없는 필드는 화면에서 쓰지 않는다는 뜻이다.
//   · region/zone  — universities.json에 이미 있어서 뺀다
//   · year/status/hasFullText — 전 행이 같은 값이라 코드 상수로 옮겼다
//   · nameKey      — admissionName과 같으면 빼고, 앱에서 (nameKey || admissionName)으로 읽는다
//   · quotaOutside — true일 때만 넣는다(83%가 false)
//   · source       — 전 행이 공유하는 앞부분을 떼고 'srcRef'(예: '수도권 p.249')만 남긴다.
//                    앱이 SOURCE_PREFIX를 붙여 원문 그대로 복원한다. 출처는 절대 버리지 않는다.
const KEEP = [
  'univId', 'phase', 'admissionType', 'admissionName',
  'gedEligible', 'gedIneligibleReason',
  'phaseBasis',
  'applyCloseDate', 'applyCloseTime',
];

// src/lib/analysis.js 의 SOURCE_PREFIX 와 반드시 같아야 한다.
const SOURCE_PREFIX = '2027학년도 검정고시 출신자 지원 가능 전형(한국대학교육협의회) ';

function slimAdmissions() {
  const rows = JSON.parse(readFileSync(SRC_ADMISSIONS, 'utf8'));
  const out = rows.map((r) => {
    const o = {};
    for (const k of KEEP) {
      const v = r[k];
      if (v === '' || v == null) continue; // 빈 값은 아예 넣지 않는다
      o[k] = v;
    }
    if (r.nameKey && r.nameKey !== r.admissionName) o.nameKey = r.nameKey;
    if (r.quotaOutside === true) o.quotaOutside = true;
    if (typeof r.source === 'string' && r.source.length > 0) {
      if (!r.source.startsWith(SOURCE_PREFIX)) {
        // 앞부분이 다르면 자르지 않고 통째로 남긴다 — 출처를 잘못 복원하느니 크게 간다
        o.source = r.source;
      } else {
        o.srcRef = r.source.slice(SOURCE_PREFIX.length);
      }
    }
    return o;
  });
  writeFileSync(OUT_ADMISSIONS, JSON.stringify(out));
  const before = readFileSync(SRC_ADMISSIONS).length;
  const after = readFileSync(OUT_ADMISSIONS).length;
  const univCount = new Set(out.map((r) => r.univId)).size;
  console.log(
    `admissions_2027.min.json: ${rows.length}행 · ${univCount}개 대학 · ` +
    `${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB`
  );
  console.log(`  ↳ src/data/meta.js 의 ADMISSION_DATA_UNIV_COUNT 가 ${univCount} 인지 확인할 것`);
  return out;
}

function shardText() {
  const byUniv = JSON.parse(readFileSync(SRC_TEXT, 'utf8'));
  if (existsSync(OUT_TEXT_DIR)) rmSync(OUT_TEXT_DIR, { recursive: true });
  mkdirSync(OUT_TEXT_DIR, { recursive: true });

  const ids = Object.keys(byUniv).sort();
  let total = 0;
  let max = 0;
  for (const id of ids) {
    // 파일명이 될 값이라 경로 문자가 섞여 있으면 건너뛴다(안전장치)
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      console.warn(`  건너뜀(파일명으로 쓸 수 없는 univId): ${id}`);
      continue;
    }
    const body = JSON.stringify(byUniv[id]);
    writeFileSync(join(OUT_TEXT_DIR, `${id}.json`), body);
    total += body.length;
    max = Math.max(max, body.length);
  }
  writeFileSync(join(OUT_TEXT_DIR, 'index.json'), JSON.stringify(ids));
  console.log(
    `public/data/ged_text/: ${ids.length}개 대학 · ` +
    `합계 ${(total / 1024 / 1024).toFixed(2)}MB · 가장 큰 대학 ${(max / 1024).toFixed(0)}KB`
  );
}

// 비교내신 환산표 '모집요강 발췌' 원문도 같은 이유로 대학별로 쪼갠다.
// 원본(comparative_2027_text.json, 2.7MB)은 지우지 않는다 — 쪼갠 파일이 없을 때 폴백.
function shardCompText() {
  if (!existsSync(SRC_COMP_TEXT)) {
    console.warn('comp_text 건너뜀: comparative_2027_text.json 이 없다');
    return;
  }
  const byUniv = JSON.parse(readFileSync(SRC_COMP_TEXT, 'utf8'));
  if (existsSync(OUT_COMP_TEXT_DIR)) rmSync(OUT_COMP_TEXT_DIR, { recursive: true });
  mkdirSync(OUT_COMP_TEXT_DIR, { recursive: true });

  const ids = Object.keys(byUniv).filter((k) => k !== 'meta').sort();
  let total = 0;
  let max = 0;
  for (const id of ids) {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      console.warn(`  건너뜀(파일명으로 쓸 수 없는 univId): ${id}`);
      continue;
    }
    const body = JSON.stringify(byUniv[id]);
    writeFileSync(join(OUT_COMP_TEXT_DIR, `${id}.json`), body);
    total += body.length;
    max = Math.max(max, body.length);
  }
  writeFileSync(join(OUT_COMP_TEXT_DIR, 'index.json'), JSON.stringify(ids));
  console.log(
    `public/data/comp_text/: ${ids.length}개 대학 · ` +
    `합계 ${(total / 1024 / 1024).toFixed(2)}MB · 가장 큰 대학 ${(max / 1024).toFixed(0)}KB`
  );
}

slimAdmissions();
shardText();
shardCompText();
