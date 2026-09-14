// 전문대학 전형 데이터 생성 (오프라인, 빌드 전 1회)
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────
// admissions.json의 전문대 138곳은 전부 같은 두 줄짜리 틀이었다.
//   '수시 일반전형' + '정시 수능위주', 전 대학 문구까지 똑같고 status는 baseline.
// 즉 "전문대는 대충 이렇습니다"였지 그 대학 얘기가 아니었다.
// 게다가 출처가 대교협(KCUE)으로 적혀 있었는데, 전문대 기본사항을 내는 곳은
// 전문대교협(KCCE)이다. 기관을 잘못 적으면 확인하러 간 학생이 헤맨다.
//
// data-pipeline/v2/README.md가 이 문제를 이미 알고 있었다(537~546행).
//   "입학전형기본사항의 검정고시 원칙 조항은 대학별이 아니라 협의회 공통 규정이라,
//    대학 단위로 넣으면 실제로 확인 안 된 138개 대학 전부에 '가능'을 지어내는 꼴이 된다."
// 파이프라인은 그래서 안 넣었는데, 앱 데이터에는 들어가 있었다.
//
// ── 무엇을 근거로 채우나 ───────────────────────────────────────────────
// 대학별 전형방법 엑셀(pdf_sources/college/guides_*)은 이 저장소에 없다(.gitignore).
// 대신 이미 들어와 있는 전문대교협 전형결과에서 '그 대학이 실제로 어떤 전형으로
// 뽑았는지'를 읽어낼 수 있다. cutlines_college_{2026,2025}.json의 구조가 그대로 답이다.
//   · '일반(서류)' 블록이 있다  → 그 해 수시 일반전형으로 뽑았다
//   · byType에 '특별전형 …'이 있다 → 그 해 수시 특별전형으로도 뽑았다
//   · '수능위주' 블록이 있다    → 그 해 정시로 뽑았다
// 학과 수(n)와 합격선까지 같이 있으니 규모도 말할 수 있다.
//
// ⚠️ 합격선은 '지난해 결과'다. 그 전형으로 뽑은 기록이 있다는 뜻이지, 올해도 뽑는다는
//    보장이 아니다. 생성되는 모든 행에 그 사실을 note로 박아 넣는다. 빼지 말 것.
// ⚠️ 전문대교협 자료는 공공누리가 아니다. 학과 단위 원본은 싣지 않는다. 여기서 쓰는 건
//    이미 앱에 있는 대학×전형 집계값뿐이고, 새로 복제하는 원본은 없다.
// ⚠️ 자료가 없는 대학에 '가능'을 지어내지 말 것. 근거가 없으면 종전 안내 문구를 쓰되
//    '협의회 공통 규정'이라고 밝힌다(status: baseline 유지).
//
// 실행:  node scripts/buildCollegeAdmissions.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const D = (f) => join(ROOT, 'src/data', f);

const universities = JSON.parse(readFileSync(D('universities.json'), 'utf8'));
const cut26 = JSON.parse(readFileSync(D('cutlines_college_2026.json'), 'utf8'));
const cut25 = JSON.parse(readFileSync(D('cutlines_college_2025.json'), 'utf8'));

const COLLEGE = universities.filter((u) => u.kind === '전문대학');

// 전문대 기본사항을 내는 곳은 전문대교협(KCCE)이다. 대교협(KCUE)이 아니다.
const KCCE = '한국전문대학교육협의회 「2028학년도 전문대학 입학전형 기본사항」';
const RESULT_SRC = (year) =>
  `전문대교협 전문대학포털 ${year}학년도 전형결과(대학×전형 집계값)`;

// 근거 없이 138곳 전부에 붙던 문구. 협의회 공통 규정이라는 걸 문장 안에서 밝힌다.
const BASELINE_SOURCE =
  `${KCCE}: 검정고시 출신자의 수시 지원을 자격에서 제한하지 않도록 정하고 있어요. ` +
  '다만 이건 협의회 공통 규정이라, 이 대학이 실제로 어떻게 뽑는지는 모집요강에서 확인해야 해요.';

function blockOf(cut, uid, type) {
  const v = cut[uid];
  if (!v || typeof v !== 'object') return null;
  const b = v[type];
  return b && typeof b === 'object' ? b : null;
}

// 그 해에 수시 특별전형으로 뽑은 기록이 있나 (byType에만 들어 있다)
function specialOf(cut, uid) {
  const b = blockOf(cut, uid, '일반(서류)');
  const bt = b?.byType || {};
  const avg = bt['특별전형 평균'];
  const low = bt['특별전형 최저'];
  if (!avg && !low) return null;
  return {
    cutAvg: avg?.grade ?? null,
    cutLowest: low?.grade ?? null,
    n: avg?.n ?? low?.n ?? null,
  };
}

function stat(b) {
  return b ? { cutAvg: b.cutGradeAvg ?? null, cutLowest: b.cutGradeLowest ?? null, n: b.n ?? null } : null;
}

// 가장 최근 해 것을 쓰되, 없으면 직전 해로 내려간다. 어느 해인지 항상 같이 돌려준다.
function pick(uid, getter) {
  const a = getter(cut26, uid);
  if (a) return { year: 2026, ...a };
  const b = getter(cut25, uid);
  if (b) return { year: 2025, ...b };
  return null;
}

// ⚠️ n은 '학과 수'가 아니다. 전형결과 집계에 들어간 모집단위 행 수이고, 같은 학과가
//    모집시기마다 반복되므로 학과 수보다 클 수 있다(한양여대 수시 특별전형 165).
//    "165개 학과를 뽑았어요"라고 쓰면 과장이 된다. DetailScreen이 쓰는 표현과 맞춘다.
const scaleNote = (s) =>
  s.n != null
    ? `${s.year}학년도 전형결과에 이 전형이 들어 있어요(집계 모집단위 ${s.n}개).`
    : `${s.year}학년도 전형결과에 이 전형이 들어 있어요.`;

const CAUTION = ' 지난 학년도 결과라 올해도 같은 전형으로 뽑는지는 모집요강에서 확인해야 해요.';

const rows = [];
const seen = new Set();

for (const u of COLLEGE) {
  const uid = u.univId;
  const susi = pick(uid, (c, id) => stat(blockOf(c, id, '일반(서류)')));
  const spec = pick(uid, specialOf);
  const jeongsi = pick(uid, (c, id) => stat(blockOf(c, id, '수능위주')));

  if (!susi && !spec && !jeongsi) continue; // 근거 없는 대학은 건드리지 않는다
  seen.add(uid);

  if (susi) {
    rows.push({
      univId: uid,
      phase: '수시',
      admissionType: '일반(서류)',
      admissionName: '수시 일반전형',
      gedEligible: '가능',
      gedIneligibleReason: '',
      gedReflection: '검정고시 성적과 제출서류로 평가해요(대학마다 달라요).',
      evalMethod: '서류 위주, 일부 면접(모집요강 확인)',
      csatMinimum: '없음(대다수)',
      note: scaleNote(susi) + CAUTION,
      source: `${RESULT_SRC(susi.year)} · 자격 근거: ${KCCE}`,
      status: 'college_result',
      resultYear: susi.year,
      collegeStat: susi,
    });
  }

  if (spec) {
    rows.push({
      univId: uid,
      phase: '수시',
      admissionType: '특별전형',
      admissionName: '수시 특별전형',
      // 만학도·특성화고·기회균형처럼 자격이 따로 붙는 묶음이다. '가능'이라고 하면 안 된다.
      gedEligible: '조건부',
      gedIneligibleReason:
        '만학도·특성화고 졸업자·기회균형처럼 지원자격이 따로 있는 전형들을 묶어 부르는 이름이에요. ' +
        '내가 그 자격에 해당하는지 모집요강에서 먼저 확인하세요.',
      gedReflection: '',
      evalMethod: '전형마다 달라요(모집요강 확인)',
      csatMinimum: '모집요강 확인 필요',
      note: scaleNote(spec) + CAUTION,
      source: `${RESULT_SRC(spec.year)}`,
      status: 'college_result',
      resultYear: spec.year,
      specialEligibility: true,
      collegeStat: spec,
    });
  }

  if (jeongsi) {
    rows.push({
      univId: uid,
      phase: '정시',
      admissionType: '수능위주',
      admissionName: '정시 수능위주',
      gedEligible: '가능',
      gedIneligibleReason: '',
      gedReflection: '수능 성적으로 뽑아요. 검정고시 출신이라고 더 불리하거나 유리하지 않아요.',
      evalMethod: '수능 위주',
      csatMinimum: '수능 응시 필요',
      note: scaleNote(jeongsi) + CAUTION,
      source: `${RESULT_SRC(jeongsi.year)} · 자격 근거: ${KCCE}`,
      status: 'college_result',
      resultYear: jeongsi.year,
      collegeStat: jeongsi,
    });
  }
}

const out = {
  meta: {
    generatedAt: new Date().toISOString().slice(0, 10),
    builtBy: 'scripts/buildCollegeAdmissions.mjs',
    basis:
      '전문대교협 전형결과(cutlines_college_2026/2025.json)에서 그 대학이 실제로 어떤 전형으로 ' +
      '뽑았는지를 읽어 만든 행. 합격선은 지난 학년도 결과이므로 올해 모집 여부는 모집요강 확인이 필요하다.',
    eligibilitySource: KCCE,
    license:
      '전문대교협 자료는 공공누리가 아니다. 학과 단위 원본은 싣지 않고 대학×전형 집계값만 쓴다. ' +
      '출처를 반드시 함께 표시할 것.',
    universities: seen.size,
    rows: rows.length,
  },
  rows,
};

writeFileSync(D('admissions_college.json'), JSON.stringify(out));
const byType = {};
for (const r of rows) byType[r.admissionName] = (byType[r.admissionName] || 0) + 1;
console.log(
  `admissions_college.json: 전문대 ${seen.size}/${COLLEGE.length}곳 · ${rows.length}행`,
  JSON.stringify(byType, null, 0)
);
console.log(`  근거 없어 종전 안내만 남는 전문대: ${COLLEGE.length - seen.size}곳`);
