"""전형결과(합격선)를 L1에 적재한다. 학과와 출처를 버리지 않는다.

## 입력
대교협 전형결과 PDF는 해마다 형식이 같아서, v1의 추출기를 그대로 재사용한다.

  1) PDF → JSON   `extract_results_2025.py` / `clean_results_2025.py` (v1, 검증됨)
  2) JSON → L1    이 스크립트

즉 2026학년도 결과 PDF를 받으면 v1 추출기를 --year 2026으로 돌려 JSON을 만들고,
그 JSON을 여기로 넘기면 된다. **PDF 파싱 로직을 다시 짜지 않는다.**

기대하는 JSON 한 행의 모양(= results_2025_clean.json과 동일):
  {"univId","univName","phase","admissionType","admissionName","unit","year",
   "cutType","cutGrade","cutScore","recruitCount","competition","region",
   "sourceFile","sourcePage","confidence","note"}
`univId`가 없으면 `univName`으로 매칭한다.

실행:
  python3 v2/ingest_results.py --year 2026 --json ../data-pipeline/results_2026_clean.json --to-db
  python3 v2/ingest_results.py --year 2025 --json ../data-pipeline/results_2025_clean.json --dry-run
"""

import argparse
import json
from collections import Counter
from datetime import date
from pathlib import Path

import common as C

# 대교협 전형결과에서 실제로 나오는 컷 종류
KNOWN_CUT_TYPES = {"70%컷", "80%컷", "50%컷", "평균", "최종등록", "최저"}


def load_rows(path):
    p = Path(path).expanduser()
    if not p.exists():
        raise SystemExit(f"파일이 없습니다: {p}")
    if p.suffix == ".jsonl":
        with open(p, encoding="utf-8") as f:
            return [json.loads(l) for l in f if l.strip()]
    return C.jload(p)


def run(year, json_path, to_db=False, pdf_dir=None, dry_run=False):
    rows = load_rows(json_path)
    con = C.connect()
    matcher = C.UnivMatcher()

    known = {r["univ_id"] for r in con.execute("SELECT univ_id FROM university")}
    prog_cache = {}
    for r in con.execute("SELECT program_id, univ_id, name_key FROM program"):
        prog_cache[(r["univ_id"], r["name_key"])] = r["program_id"]

    src_cache = {}
    stat = Counter()
    pending = []

    for r in rows:
        stat["원천 행"] += 1
        uid = r.get("univId") if r.get("univId") in known else None
        if not uid:
            uid = matcher.match(r.get("univName"), region=r.get("region"))
        if not uid:
            stat["대학 매칭 실패"] += 1
            continue

        ct = C.squash(r.get("cutType")) or "미상"
        if ct not in KNOWN_CUT_TYPES:
            stat[f"낯선 cutType:{ct}"] += 1
        if r.get("cutGrade") is None and r.get("cutScore") is None:
            stat["값 없는 행(건너뜀)"] += 1
            continue

        y = r.get("year") or year
        fname = C.nfc(r.get("sourceFile") or f"{year}학년도 전형결과(출처 미상)")
        pending.append((uid, r, y, fname, ct))

    if dry_run or not to_db:
        print("═" * 62)
        print(f"  적재 예정 {len(pending):,}행 / 원천 {len(rows):,}행")
        for k, v in stat.most_common(10):
            print(f"  {k:24} {v:>7,}")
        if matcher.unmatched:
            print("\n  대학명 매칭 실패 상위:")
            for nm, c in matcher.unmatched.most_common(8):
                print(f"    {c:>5}  {nm}")
        print("═" * 62)
        print("  (적재하려면 --to-db)")
        return

    # 같은 연도를 다시 넣기 전에 이전 적재분을 지운다(중복 방지).
    # 원본은 그대로 있으므로 언제든 다시 만들 수 있다.
    old = con.execute("SELECT COUNT(*) c FROM cutline WHERE year=?", (y,)).fetchone()["c"]
    if old:
        con.execute("DELETE FROM cutline WHERE year=?", (y,))
        print(f"  기존 {y}학년도 {old:,}행 삭제 후 재적재")

    for uid, r, y, fname, ct in pending:
        key = ("result", fname)
        if key not in src_cache:
            row = con.execute(
                "SELECT source_id FROM source_file WHERE kind='result' AND title=?",
                (fname,)).fetchone()
            if row:
                src_cache[key] = row["source_id"]
            else:
                pdf = None
                for cand in ([Path(pdf_dir) / fname] if pdf_dir else []) + [
                        C.PDF_ROOT / f"results_{y}" / fname, C.PDF_ROOT / str(y) / fname]:
                    if cand.exists():
                        pdf = cand
                        break
                src_cache[key] = con.execute(
                    """INSERT INTO source_file
                       (kind,year,title,path,sha256,publisher,retrieved_at)
                       VALUES ('result',?,?,?,?,?,?)""",
                    (y, fname, str(pdf) if pdf else None,
                     C.sha256(pdf) if pdf else None,
                     "한국대학교육협의회(대입정보포털)", date.today().isoformat())).lastrowid
        sid = src_cache[key]

        unit = C.squash(r.get("unit"))
        pid = None
        if unit:
            k = C.key_name(unit)
            pid = prog_cache.get((uid, k))
            if pid is None:
                pid = con.execute(
                    "INSERT INTO program (univ_id,name,name_key) VALUES (?,?,?)",
                    (uid, unit, k)).lastrowid
                prog_cache[(uid, k)] = pid

        con.execute(
            """INSERT INTO cutline
               (univ_id,program_id,year,grade_scale,phase,admission_type,admission_name,
                cut_type,cut_grade,cut_score,recruit_count,competition,
                source_id,page,confidence,note)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (uid, pid, y, C.grade_scale(y),
             C.norm_phase(r.get("phase")),
             C.norm_admission_type(r.get("admissionType")) or C.squash(r.get("admissionType")) or None,
             C.squash(r.get("admissionName")) or None,
             ct, r.get("cutGrade"), r.get("cutScore"),
             r.get("recruitCount"), r.get("competition"),
             sid, r.get("sourcePage"), r.get("confidence") or "mid",
             C.squash(r.get("note")) or None))
        stat["적재"] += 1

    con.execute(
        "INSERT INTO ingest_log (ran_at,script,target,rows_in,rows_out,note) VALUES (?,?,?,?,?,?)",
        (date.today().isoformat(), "ingest_results.py", f"{year}학년도 전형결과",
         len(rows), stat["적재"], str(json_path)))
    con.commit()

    print("═" * 62)
    for k, v in stat.most_common(12):
        print(f"  {k:24} {v:>7,}")
    print(f"  내신 등급 체계: {C.grade_scale(y)}등급  (2028부터 5등급)")
    print("═" * 62)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--json", required=True, help="추출기가 만든 결과 JSON/JSONL")
    ap.add_argument("--pdf-dir", help="원본 PDF 폴더 (sha256 기록용)")
    ap.add_argument("--to-db", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    run(a.year, a.json, a.to_db, a.pdf_dir, a.dry_run)
