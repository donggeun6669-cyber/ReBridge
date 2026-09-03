"""L1(SQLite) → 앱이 읽는 JSON. 비교내신 환산표를 comparative_2028.json 에 넣는다.

## 이 스크립트가 지키는 것

**검증을 통과한 표만 내보낸다.** 틀린 환산표는 없는 것보다 나쁘다 —
없으면 앱이 표준 추정표로 폴백해서 "참고용"이라고 말하지만,
틀린 표가 들어가면 앱이 그 숫자를 대학 공식 값처럼 보여준다.

떨어진 표는 지우지 않고 `out/export_report.md` 에 대학·이유를 적는다.
사람이 그 목록을 보고 원문을 확인하면 된다.

## 검증 항목
  1. 단조성        등급이 내려갈수록 점수가 올라가면 안 된다
  2. minScore ≥ 0
  3. maxScore ≤ 1000
  4. 등급 칸 수가 5 또는 9
  5. grade_scale 이 확정돼 있다 (NULL = 5등급표인지 9등급표인지 모름 → 못 내보냄)
  6. 등급이 1..N 로 빠짐없이 이어진다
  7. 등급 칸 수와 grade_scale 이 서로 맞는다
  8. 점수가 전부 같지 않다 (표가 아니다)
  9. 평균점수→등급 구간(minAvg/maxAvg)을 붙일 수 있다  ← 아래 설명

## ⚠️ 9번을 반드시 읽어야 한다 — minAvg/maxAvg 문제

앱(`scoreEngine.js`)의 grade_table 조회는 이렇게 생겼다.

    conv.gradeTable.find(r => avg >= (r.minAvg ?? -Infinity) && avg <= (r.maxAvg ?? Infinity))

즉 **검정고시 평균점수 → 등급** 구간이 행마다 있어야 한다.
minAvg/maxAvg 가 없으면 모든 행이 조건을 통과해서 **첫 행(=1등급)이 무조건 걸린다.**
누구를 넣어도 1등급이 나온다. 표를 그냥 내보내면 이렇게 망가진다.

시행계획에서 뽑아낸 표에는 `등급 → 환산점수` 만 있고 `평균점수 → 등급` 은 없다.
(대학이 '백점만점성적' 행을 같이 싣는 경우는 2028 시행계획 84개 표 중 8개뿐이었다)

그래서 구간은 **앱이 이미 쓰고 있는 표준 추정표**(`GRADE_MIN_AVG`)를 그대로 쓴다.
  - 대학 자료를 지어내는 것이 아니다. 등급 판정은 지금 앱의 폴백 동작과 **완전히 동일**하다.
  - 달라지는 것은 그 등급에 대학의 **공식 환산점수**가 붙는다는 점뿐이다.
  - 모든 행에 `gradeBandSource: "app_standard_estimate"` 를 박아 출처를 남긴다.

**5등급표는 내보내지 않는다.** 앱의 표준 추정표는 9등급용이고,
5등급 체계의 '평균점수 → 등급' 대응표는 앱에도 원문에도 없다. 지어내지 않는다(규칙 3).
5등급표는 리포트에 이유와 함께 남는다.

실행:
  python3 v2/export_app.py --year 2028 --dry-run    # 무엇이 바뀌는지만 본다
  python3 v2/export_app.py --year 2028 --write      # comparative_2028.json 갱신
"""

import argparse
import json
import shutil
from datetime import date

import common as C

# 앱 scoreEngine.js 의 GRADE_MIN_AVG 와 **같은 값이어야 한다.**
# 바뀌면 여기도 바꿔야 한다(앱 코드는 이 파이프라인이 건드리지 않는다).
APP_GRADE_MIN_AVG = [(1, 98), (2, 94), (3, 90), (4, 86), (5, 82),
                     (6, 78), (7, 74), (8, 70), (9, 0)]
MAX_AVG = 100.0


def avg_bands_9():
    """9등급 기준 평균점수 구간. {등급: (minAvg, maxAvg)}"""
    out = {}
    upper = MAX_AVG
    for g, lo in APP_GRADE_MIN_AVG:
        out[g] = (float(lo), round(upper, 2))
        upper = round(lo - 0.01, 2)
    return out


def validate(rec):
    """검증. 통과하면 [] , 아니면 실패 사유 리스트."""
    bad = []
    table = rec["table"]
    grades = [r.get("grade") for r in table]
    scores = [r.get("score") for r in table]

    # v1 수기 표에는 grade 만 있고 score 가 null 인 행이 있다. 계산에 못 쓴다.
    if any(s is None for s in scores) or any(g is None for g in grades):
        n_null = sum(1 for s in scores if s is None) + sum(1 for g in grades if g is None)
        return [f"등급 또는 점수가 비어 있는 칸 {n_null}개 — 계산에 쓸 수 없음"]

    if not all(a >= b for a, b in zip(scores, scores[1:])):
        bad.append("단조성 위반(등급이 내려가는데 점수가 올라감)")
    if min(scores) < 0:
        bad.append(f"minScore<0 ({min(scores)})")
    if max(scores) > 1000:
        bad.append(f"maxScore>1000 ({max(scores)})")
    if len(table) not in (5, 9):
        bad.append(f"등급 칸 수가 {len(table)}개 (5 또는 9여야 함)")
    if not rec["gradeScale"]:
        bad.append("grade_scale 미확정 — 5등급표인지 9등급표인지 원문에 단서 없음")
    if grades != [float(i) for i in range(1, len(grades) + 1)]:
        bad.append(f"등급이 1..N 로 이어지지 않음 {grades}")
    if rec["gradeScale"] and len(table) != int(rec["gradeScale"]):
        bad.append(f"grade_scale={rec['gradeScale']} 인데 칸이 {len(table)}개")
    if len(set(scores)) < 2:
        bad.append("점수가 전부 같음 — 표가 아님")
    if rec["gradeScale"] == "5":
        bad.append("5등급표: 앱에 '평균점수→5등급' 대응표가 없어 구간을 못 붙임 "
                   "(지어내지 않음). 앱이 5등급을 지원하면 그때 내보낸다")
    return bad


def build_conversion(rec):
    """검증을 통과한 표 → 앱이 바로 읽는 conversion 객체."""
    bands = avg_bands_9()
    rows = []
    for r in rec["table"]:
        lo, hi = bands[int(r["grade"])]
        rows.append({"minAvg": lo, "maxAvg": hi,
                     "grade": int(r["grade"]), "score": r["score"]})
    return {
        "type": "grade_table",
        "maxScore": rec["maxScore"],
        "minScore": rec["minScore"],
        "gradeTable": rows,
        # ── 출처·성격을 값 옆에 남긴다. 앱은 모르는 키를 무시한다 ──
        "gradeScale": rec["gradeScale"],
        "appliesTo": rec["appliesTo"],
        "gradeBandSource": "app_standard_estimate",
        "scoreSource": rec["source"],
        "sourcePage": rec["page"],
        "extractedBy": f"data-pipeline/v2/export_app.py {date.today().isoformat()}",
    }


def load_records(con, year):
    q = """
      SELECT v.univ_id, v.table_json, v.grade_scale, v.applies_to, v.phase,
             v.max_score, v.min_score, v.page, v.confidence,
             s.title AS source, u.name AS univ
      FROM ged_conversion v
      JOIN university u  ON u.univ_id = v.univ_id
      JOIN source_file s ON s.source_id = v.source_id
      WHERE v.year = ? AND v.table_json IS NOT NULL
      ORDER BY u.name
    """
    out = []
    for r in con.execute(q, (year,)):
        t = json.loads(r["table_json"])
        table = t.get("gradeTable") or []
        if not table:
            continue
        out.append({
            "univId": r["univ_id"], "univ": r["univ"], "table": table,
            "maxScore": r["max_score"] if r["max_score"] is not None else max(
                x["score"] for x in table),
            "minScore": r["min_score"] if r["min_score"] is not None else min(
                x["score"] for x in table),
            "gradeScale": r["grade_scale"], "appliesTo": r["applies_to"],
            "phase": r["phase"], "page": r["page"], "source": r["source"],
            "confidence": r["confidence"],
        })
    return out


def same_table(a, b):
    """두 conversion 의 등급→점수가 같은지. 구간·메타는 보지 않는다."""
    if not a or not b:
        return a == b
    ka = [(x.get("grade"), x.get("score")) for x in (a.get("gradeTable") or [])]
    kb = [(x.get("grade"), x.get("score")) for x in (b.get("gradeTable") or [])]
    return ka == kb and a.get("maxScore") == b.get("maxScore") \
        and a.get("minScore") == b.get("minScore")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2028)
    ap.add_argument("--write", action="store_true", help="앱 JSON을 실제로 고친다")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--overwrite-existing", action="store_true",
                    help="이미 conversion 이 있는 대학도 자동 추출표로 덮어쓴다. "
                         "기본값은 덮어쓰지 않고 리포트에만 남긴다")
    a = ap.parse_args()
    year = a.year
    overwrite = a.overwrite_existing

    con = C.connect()
    recs = load_records(con, year)
    app_path = C.APP_DATA / f"comparative_{year}.json"
    app = C.jload(app_path)

    passed, failed, changed, added, unknown_univ = [], [], [], [], []
    for rec in recs:
        bad = validate(rec)
        if bad:
            failed.append((rec, bad))
            continue
        if rec["univId"] not in app:
            # 앱 JSON에 없는 대학은 새로 만들지 않는다.
            # comparative_{year}.json 의 대학 목록은 앱이 관리하는 축이다.
            unknown_univ.append(rec)
            continue
        conv = build_conversion(rec)
        old = app[rec["univId"]].get("conversion")
        if old is None:
            added.append((rec, conv))
            passed.append((rec, conv))
            continue
        if same_table(old, conv):
            passed.append((rec, conv))
            continue
        # ── 기존 값이 있고 내용이 다르면 **기본적으로 덮어쓰지 않는다** ──
        # 기존 10개는 사람이 원문을 보고 만든 것이고, 대학이 직접 실은
        # '백점만점성적' 구간(예: 강서대 100/95/90/85…)이 들어 있다.
        # 우리 자동 추출표는 그 구간이 없어 앱 표준 추정 구간을 쓴다 —
        # 즉 덮어쓰면 **실제 출처가 있는 구간을 추정 구간으로 바꾸는 것**이 된다.
        # 무엇이 맞는지는 사람이 원문을 보고 정해야 한다.
        changed.append((rec, old, conv))
        if overwrite:
            passed.append((rec, conv))

    # ── 리포트 ────────────────────────────────────────────────────
    L = [f"# 환산표 앱 반영 리포트 ({year}학년도)", "",
         f"- 생성: {date.today().isoformat()}",
         f"- L1에 구조화된 표: **{len(recs)}개 대학**",
         f"- 검증 통과(내보냄): **{len(passed)}개**",
         f"- 검증 탈락(안 내보냄): **{len(failed)}개**",
         f"- 앱 JSON에 대학 항목이 없어 건너뜀: **{len(unknown_univ)}개**",
         f"- 기존 값과 달라진 대학: **{len(changed)}개**",
         f"- 새로 채워진 대학: **{len(added)}개**", "",
         "## minAvg/maxAvg 는 어디서 왔나", "",
         "시행계획에는 `등급 → 환산점수` 만 있고 `검정고시 평균점수 → 등급` 은 없다.",
         "앱은 그 구간이 있어야 표를 쓸 수 있으므로, **앱이 이미 쓰던 표준 추정표**",
         "(`scoreEngine.js` 의 `GRADE_MIN_AVG`)를 구간으로 붙였다.",
         "등급 판정 결과는 지금 앱 동작과 같고, 거기에 대학의 공식 환산점수가 더해진 것이다.",
         "각 항목의 `gradeBandSource: \"app_standard_estimate\"` 가 이 사실을 표시한다.", ""]

    if changed:
        L += ["## ⚠️ 기존 값과 달라진 대학",
              "",
              ("**덮어썼다(--overwrite-existing).**" if overwrite else
               "**덮어쓰지 않았다.** 기존 값을 그대로 두고 여기 차이만 적는다."),
              "",
              "기존 10개 항목은 사람이 원문을 보고 만든 것이라 대학이 직접 실은",
              "'백점만점성적' 구간(예: 강서대 100 / 95이상 / 90이상 …)이 들어 있다.",
              "자동 추출표에는 그 구간이 없어 앱 표준 추정 구간을 쓴다.",
              "즉 덮어쓰면 **출처가 있는 구간을 추정 구간으로 바꾸는 것**이 된다.",
              "어느 쪽이 맞는지는 원문을 보고 사람이 정해야 한다.", "",
              "| 대학 | 기존 등급→점수 | 새 등급→점수 | 출처 |", "|---|---|---|---|"]
        for rec, old, new in changed:
            f = lambda c: ", ".join(
                f"{x.get('grade')}:{x.get('score')}" for x in (c.get("gradeTable") or [])[:9])
            L.append(f"| {rec['univ']} | {f(old)} | {f(new)} | {rec['source']} p.{rec['page']} |")
        L.append("")

    if added:
        L += [f"## 새로 채워진 대학 ({len(added)}개)", "",
              "| 대학 | 등급수 | 만점 | 최저 | 적용대상 | 출처 |", "|---|---:|---:|---:|---|---|"]
        for rec, conv in added:
            L.append(f"| {rec['univ']} | {len(rec['table'])} | {rec['maxScore']} | "
                     f"{rec['minScore']} | {rec['appliesTo'] or '-'} | "
                     f"{rec['source']} p.{rec['page']} |")
        L.append("")

    if failed:
        L += [f"## 검증 탈락 — 내보내지 않음 ({len(failed)}개)", "",
              "이 표들은 **지우지 않았다.** L1(`ged_conversion`)에 그대로 있다.",
              "원문을 확인해 규칙을 고치고 다시 돌리면 된다.", "",
              "| 대학 | 사유 | 등급수 | 만점 | 최저 | 출처 |", "|---|---|---:|---:|---:|---|"]
        for rec, bad in failed:
            L.append(f"| {rec['univ']} | {'; '.join(bad)} | {len(rec['table'])} | "
                     f"{rec['maxScore']} | {rec['minScore']} | {rec['source']} p.{rec['page']} |")
        L.append("")

    if unknown_univ:
        L += [f"## 앱 JSON에 항목이 없는 대학 ({len(unknown_univ)}개)", "",
              f"`comparative_{year}.json` 에 이 대학 항목 자체가 없다.",
              "대학 목록은 앱이 관리하는 축이라 여기서 새로 만들지 않았다.", ""]
        for rec in unknown_univ:
            L.append(f"- {rec['univ']} (`{rec['univId']}`)")
        L.append("")

    report = C.OUT / "export_report.md"
    report.write_text("\n".join(L) + "\n", encoding="utf-8")

    print("═" * 62)
    print(f"  L1 구조화 표      {len(recs):>4}개 대학")
    print(f"  검증 통과(내보냄)  {len(passed):>4}개")
    print(f"  검증 탈락         {len(failed):>4}개  ← out/export_report.md 에 대학·사유")
    print(f"  앱 항목 없음      {len(unknown_univ):>4}개")
    print(f"  기존 값과 다름    {len(changed):>4}개  "
          f"({'덮어씀' if overwrite else '덮어쓰지 않음 — 기존 값 유지'})")
    print(f"  새로 채움         {len(added):>4}개")
    for rec, old, new in changed:
        print(f"    ⚠️ {rec['univ']}")
        print(f"       기존 {[ (x.get('grade'), x.get('score')) for x in old.get('gradeTable') or [] ]}")
        print(f"       신규 {[ (x.get('grade'), x.get('score')) for x in new['gradeTable'] ]}")
    print("═" * 62)

    if not a.write or a.dry_run:
        print("  (실제로 고치려면 --write)")
        return

    backup = app_path.with_suffix(".json.bak")
    shutil.copy2(app_path, backup)
    for rec, conv in passed:
        app[rec["univId"]]["conversion"] = conv
    size = C.jdump(app, app_path)
    print(f"  백업 → {backup.name}")
    print(f"  갱신 → {app_path}  ({size:,} bytes)")

    con.execute(
        "INSERT INTO ingest_log (ran_at,script,target,rows_in,rows_out,note) "
        "VALUES (?,?,?,?,?,?)",
        (date.today().isoformat(), "export_app.py", f"comparative_{year}.json",
         len(recs), len(passed),
         f"탈락 {len(failed)} / 변경 {len(changed)} / 신규 {len(added)}"))
    con.commit()


if __name__ == "__main__":
    main()
