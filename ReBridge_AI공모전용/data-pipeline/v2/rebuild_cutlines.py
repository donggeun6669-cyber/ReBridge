"""합격선 재집계 — 출처 복구 + 학과 축 살리기.

## 왜 필요했나
v1의 `cutlines_2025.json`은 두 가지를 잃어버린 상태였다.
  1. 출처가 0개다. "이 합격선 어디서 나왔냐"에 답할 수 없었다.
  2. 학과가 뭉개졌다. 원천 14,274행에 학과가 100% 있는데
     '대학 × 전형타입' 264블록으로 줄이면서 버려졌다.
둘 다 원천(results_2025_clean.json)에 살아 있으므로 PDF를 다시 볼 필요가 없다.

## 기존 집계 로직 (2026-09-02 역산으로 재현 확인)
  (univId, admissionType) 별로 cutType(70%컷/평균)마다
  confidence가 high 또는 mid인 행만 모아 **중앙값**을 취한다. low는 버린다.
  → 값 262/264, 표본수 264/264 일치. 이 스크립트는 이 로직을 그대로 유지한다.
  집계 방식은 바꾸지 않는다. 바꾸는 건 "출처를 붙이는 것"뿐이다.

## 산출물
  src/data/cutlines_2025.json          기존과 같은 모양 + `src`(출처) 추가  → 앱이 읽음
  v2/out/cutlines_2025_programs.jsonl  학과 단위 전체                        → 앱에 안 들어감
  v2/out/cutlines_report.md            검증 리포트

실행:
  python3 v2/rebuild_cutlines.py --verify   기존 파일과 비교만 (쓰지 않음)
  python3 v2/rebuild_cutlines.py --write    실제로 덮어씀
"""

import argparse
import json
import statistics as st
from collections import defaultdict
from datetime import date

import common as C

YEAR = 2025
USE_CONFIDENCE = ("high", "mid")     # low는 집계에서 제외 (v1과 동일)
APP_FILE = C.APP_DATA / "cutlines_2025.json"
PROGRAM_FILE = C.OUT / "cutlines_2025_programs.jsonl"
REPORT_FILE = C.OUT / "cutlines_report.md"


def median(vals):
    vals = [v for v in vals if v is not None]
    return st.median(vals) if vals else None


def fetch(con):
    """L1에서 합격선 전부 + 대학/학과/출처 이름까지."""
    q = """
    SELECT c.univ_id, c.program_id, p.name AS program, u.name AS univ,
           c.year, c.grade_scale, c.phase, c.admission_type, c.admission_name,
           c.cut_type, c.cut_grade, c.cut_score, c.recruit_count, c.competition,
           c.confidence, c.page, s.title AS source_title, s.kind AS source_kind
    FROM cutline c
    JOIN university u   ON u.univ_id = c.univ_id
    LEFT JOIN program p ON p.program_id = c.program_id
    JOIN source_file s  ON s.source_id = c.source_id
    WHERE c.year = ?
    """
    return [dict(r) for r in con.execute(q, (YEAR,))]


OTHER_CUT_TYPES = ["80%컷", "50%컷", "최종등록", "최저"]

# ── v1 버그 (2026-09-02 발견) ────────────────────────────────────────
# v1은 원천에 '평균' 행이 하나도 없는데도 cutGradeAvg/cutScoreAvg를 채워 넣었다.
# 실제로 넣은 값은 80%컷 또는 50%컷이었다.
#   uA0000137/학생부교과  원천 = 80%컷 50행뿐  → v1: cutScoreAvg 540.0 ('평균'으로 표시)
#   hanyang/수능위주      원천 = 80%컷 54행뿐  → v1: cutScoreAvg 92.69
#   inha/학생부교과       원천 = 50%컷 37행    → v1: cutGradeAvg 2.39
#   uA0000097/수능위주    원천 = 80%컷 1행     → v1: cutScoreAvg 25.0  (값 자체도 오류)
# scoreEngine.js는 cutScoreAvg가 있으면 화면에 '평균'이라고 적는다(388~389행).
# 즉 앱이 사용자에게 80%컷을 "평균"이라고 잘못 말하고 있었다.
# 80%컷은 70%컷보다 낮은 선이라, 이 혼동은 지원 판단을 실제로 왜곡한다.
#
# v2 처리: cutGradeAvg/cutScoreAvg는 진짜 '평균' 행에서만 만든다.
#          나머지 컷 종류는 버리지 않고 byType에 종류를 밝혀 담는다.
#          기존 4개 필드의 의미는 그대로라 앱은 깨지지 않는다.


def build_blocks(rows):
    """대학 × 전형타입 집계.

    집계 방식(중앙값, high+mid만)은 v1과 동일하게 유지한다.
    달라지는 건 두 가지뿐이다 — 출처를 붙이고, 컷 종류를 속이지 않는다.
    """
    by = defaultdict(list)
    for r in rows:
        if r["admission_type"]:
            by[(r["univ_id"], r["admission_type"])].append(r)

    out = defaultdict(dict)
    for (uid, atype), rs in by.items():
        used = [r for r in rs if r["confidence"] in USE_CONFIDENCE]
        if not used:
            continue

        def m(cut_type, field):
            return median([r[field] for r in used if r["cut_type"] == cut_type])

        g70, s70 = m("70%컷", "cut_grade"), m("70%컷", "cut_score")
        gav, sav = m("평균", "cut_grade"), m("평균", "cut_score")

        # 70%컷·평균 말고도 쓸 수 있는 선들. 특히 '최종등록'은 추가합격까지 간
        # 실제 등록선이라 검정고시생에게 70%컷보다 현실적인 목표가 된다.
        by_type = {}
        for ct in OTHER_CUT_TYPES:
            sub = [r for r in used if r["cut_type"] == ct]
            if not sub:
                continue
            g, s = median([r["cut_grade"] for r in sub]), median([r["cut_score"] for r in sub])
            if g is None and s is None:
                continue
            by_type[ct] = {"grade": g, "score": s, "n": len(sub)}

        if g70 is None and s70 is None and gav is None and sav is None and not by_type:
            continue

        confs = {r["confidence"] for r in used}
        # 출처 — 사람이 원본을 찾아갈 수 있을 만큼만. 파일이 여럿이면 전부 적는다.
        files = sorted({r["source_title"] for r in used})
        pages = sorted({r["page"] for r in used if r["page"] is not None})
        programs = sorted({r["program"] for r in used if r["program"]})

        out[uid][atype] = {
            # ── 기존 4필드: 의미 그대로. 앱을 고치지 않아도 동작한다 ──
            "cutGradeAvg": gav, "cutGrade70": g70,
            "cutScoreAvg": sav, "cutScore70": s70,
            "n": len(used),
            "confidence": "high" if confs == {"high"} else ("mid" if "mid" in confs else "high"),
            # ── v1에 없던 것 ──
            "byType": by_type,
            "src": {
                "files": files,
                "pages": [pages[0], pages[-1]] if pages else [],
                "programs": len(programs),      # 이 블록이 몇 개 학과를 뭉친 것인지
                "method": "median(high+mid)",
                "year": YEAR,
                "gradeScale": "9",              # 2027 이하는 9등급. 2028부터 5등급이라 비교 금지
            },
        }
    return out


def write_programs(rows):
    """학과 단위 — 한 줄에 한 사실. 앱 번들에 넣지 않는다(용량)."""
    n = 0
    with open(PROGRAM_FILE, "w", encoding="utf-8") as f:
        for r in rows:
            if r["cut_grade"] is None and r["cut_score"] is None:
                continue
            f.write(json.dumps({
                "univId": r["univ_id"], "univ": r["univ"],
                "program": r["program"], "programId": r["program_id"],
                "year": r["year"], "gradeScale": r["grade_scale"],
                "phase": r["phase"], "admissionType": r["admission_type"],
                "admissionName": r["admission_name"],
                "cutType": r["cut_type"],
                "cutGrade": r["cut_grade"], "cutScore": r["cut_score"],
                "recruitCount": r["recruit_count"], "competition": r["competition"],
                "confidence": r["confidence"],
                "src": {"file": r["source_title"], "page": r["page"]},
            }, ensure_ascii=False) + "\n")
            n += 1
    return n


def compare(new, old):
    """기존 파일과 값이 달라지지 않았는지 확인. 달라지면 반드시 보고한다."""
    diffs, missing, added = [], [], []
    for uid, ts in old.items():
        for t, ob in ts.items():
            nb = new.get(uid, {}).get(t)
            if nb is None:
                missing.append((uid, t))
                continue
            for k in ("cutGradeAvg", "cutGrade70", "cutScoreAvg", "cutScore70", "n"):
                a, b = nb.get(k), ob.get(k)
                if (a is None) != (b is None) or (
                        a is not None and b is not None and abs(a - b) > 0.02):
                    diffs.append((uid, t, k, b, a))
    for uid, ts in new.items():
        for t in ts:
            if t not in old.get(uid, {}):
                added.append((uid, t))
    return diffs, missing, added


def report(rows, blocks, diffs, missing, added, n_prog):
    univs = {r["univ_id"] for r in rows}
    with_prog = {r["program_id"] for r in rows if r["program_id"]}
    n_blocks = sum(len(v) for v in blocks.values())
    low = sum(1 for r in rows if r["confidence"] == "low")

    lines = [
        "# 합격선 재집계 리포트",
        "",
        f"생성: {date.today().isoformat()} · `v2/rebuild_cutlines.py`",
        "",
        "## 무엇이 달라졌나",
        "",
        "| | v1 | v2 |",
        "|---|---|---|",
        f"| 출처가 붙은 합격선 | **0** | **{n_blocks}블록 전부** |",
        f"| 학과(모집단위) | 뭉개짐 | **{len(with_prog)}개** |",
        f"| 학과 단위 행 | 없음 | **{n_prog:,}행** (`cutlines_2025_programs.jsonl`) |",
        f"| 집계 방식 | 문서화 안 됨 | `median(high+mid)` 명시 |",
        "",
        "## 집계 결과",
        "",
        f"- 원천 {len(rows):,}행 / 대학 {len(univs)}개",
        f"- 집계 블록 {n_blocks}개 (대학 {len(blocks)}개 × 전형타입)",
        f"- 집계에서 제외한 low confidence 행: {low:,}",
        "",
        "## 기존 파일과의 차이",
        "",
    ]
    if not diffs and not missing:
        lines.append("**값 변화 없음.** 기존 264블록의 수치가 전부 그대로 재현됐고, 출처만 추가됐다.")
    else:
        lines.append(f"- 값이 달라진 항목: **{len(diffs)}**")
        lines.append(f"- 새 집계에서 사라진 블록: **{len(missing)}**")
        lines.append(f"- 새로 생긴 블록: **{len(added)}**")
        if diffs:
            lines += ["", "| 대학 | 전형 | 필드 | v1 | v2 |", "|---|---|---|---|---|"]
            for d in diffs[:40]:
                lines.append(f"| {d[0]} | {d[1]} | {d[2]} | {d[3]} | {d[4]} |")
        if missing:
            lines += ["", "사라진 블록: " + ", ".join(f"{a}/{b}" for a, b in missing[:20])]
    # cutType별 실측 — 무엇이 쓰이고 무엇이 버려지는지
    import collections
    ct = collections.Counter()
    ct_hm = collections.Counter()
    for r in rows:
        ct[r["cut_type"]] += 1
        if r["confidence"] in USE_CONFIDENCE:
            ct_hm[r["cut_type"]] += 1
    lines += [
        "",
        "## 발견 ① — v1이 80%컷·50%컷을 '평균'이라고 표시하고 있었다",
        "",
        "원천에 `평균` 행이 하나도 없는데 `cutGradeAvg`/`cutScoreAvg`가 채워진 블록이 있었다.",
        "실제로 들어간 값은 80%컷 또는 50%컷이었다.",
        "",
        "| 대학/전형 | 원천에 있는 것 | v1이 '평균'으로 표시한 값 |",
        "|---|---|---|",
        "| uA0000137 / 학생부교과 | 80%컷 50행뿐 | 등급 5.6 · 점수 540.0 |",
        "| hanyang / 수능위주 | 80%컷 54행뿐 | 점수 92.69 |",
        "| inha / 학생부교과 | 50%컷 37행 | 등급 2.39 |",
        "| uA0000097 / 수능위주 | 80%컷 1행 | 점수 25.0 (값 자체도 오류) |",
        "",
        "`scoreEngine.js` 388~389행이 `cutScoreAvg`가 있으면 화면에 **'평균'**이라고 적는다.",
        "80%컷은 70%컷보다 **낮은** 선이라, 이 혼동은 지원 판단을 실제로 왜곡한다.",
        "v2는 진짜 `평균` 행에서만 Avg를 만들고, 나머지는 `byType`에 종류를 밝혀 담는다.",
        "",
        "**앱 영향**: 4개 블록(한양대 수능위주, uA0000137 3개)에서 숫자가 사라지고",
        "\"합격선 자료가 없어요\"로 바뀐다. 데이터는 `byType`에 그대로 있으므로,",
        "`scoreEngine.js`가 `byType`을 읽도록 3줄만 고치면 정확한 라벨과 함께 되살아난다.",
        "",
        "## 발견 ② — '최종등록' 1,863행이 통째로 버려지고 있다",
        "",
        "| cutType | 총 행 | 등급 있음 | 점수 있음 | high+mid |",
        "|---|---|---|---|---|",
    ]
    for k, n in ct.most_common():
        g = sum(1 for r in rows if r["cut_type"] == k and r["cut_grade"] is not None)
        s = sum(1 for r in rows if r["cut_type"] == k and r["cut_score"] is not None)
        lines.append(f"| {k} | {n:,} | {g:,} | {s:,} | {ct_hm[k]:,} |")
    lines += [
        "",
        "`최종등록` 1,863행이 **전부 confidence=low**로 분류돼 집계에서 빠진다.",
        "최종등록선은 추가합격까지 돌고 난 실제 등록 성적이라 70%컷보다 낮고,",
        "**검정고시생에게는 70%컷보다 현실적인 목표**다. 가장 쓸모 있는 지표가 통째로 버려진 셈이다.",
        "왜 low로 판정됐는지 `clean_results_2025.py`의 규칙을 재검토할 것. → 별도 과제",
        "",
        "## 주의 — 이 데이터를 2028 지원자에게 쓰면 안 된다",
        "",
        "2025학년도 결과는 **9등급 내신** 기준이다.",
        "2028학년도부터 고교 내신이 **5등급 상대평가**로 바뀌므로 직접 비교가 성립하지 않는다.",
        "`src.gradeScale`에 `\"9\"`를 박아둔 이유가 이것이다. 앱은 이 값을 보고 판단해야 한다.",
        "",
    ]
    REPORT_FILE.write_text("\n".join(lines), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="앱 데이터를 실제로 덮어씀")
    ap.add_argument("--verify", action="store_true", help="비교만 하고 쓰지 않음")
    args = ap.parse_args()

    con = C.connect()
    rows = fetch(con)
    blocks = build_blocks(rows)
    old = C.jload(APP_FILE) if APP_FILE.exists() else {}
    diffs, missing, added = compare(blocks, old)

    n_prog = write_programs(rows)
    report(rows, blocks, diffs, missing, added, n_prog)

    n_blocks = sum(len(v) for v in blocks.values())
    print("═" * 62)
    print(f"원천 {len(rows):,}행 → 집계 {n_blocks}블록 / 대학 {len(blocks)}개")
    print(f"학과 단위 산출: {n_prog:,}행 → {PROGRAM_FILE.name}")
    print(f"기존 대비  값차이 {len(diffs)} · 사라짐 {len(missing)} · 새로생김 {len(added)}")
    for d in diffs[:10]:
        print(f"   차이: {d[0]}/{d[1]}.{d[2]}  {d[3]} → {d[4]}")
    for m in missing[:10]:
        print(f"   사라짐: {m[0]}/{m[1]}")

    if args.write:
        size = C.jdump(blocks, APP_FILE)
        print(f"\n✅ 덮어씀: {APP_FILE.relative_to(C.ROOT)}  ({size/1024:.0f}KB)")
    else:
        print("\n(쓰지 않음 — 실제 반영하려면 --write)")
    print(f"리포트: {REPORT_FILE}")
    print("═" * 62)


if __name__ == "__main__":
    main()
