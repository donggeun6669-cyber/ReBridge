"""병합기 회귀검사 — 손실·증식이 없는지 실제로 돌려서 확인한다.

    python3 regression_merge.py

정본 DB 를 건드리지 않는다. 임시 폴더에 빈 DB 를 만들고, 가짜 에이전트 산출물을 넣어 병합한 뒤
행 수와 내용을 확인한다. 실패하면 무엇이 어떻게 틀렸는지 출력하고 0이 아닌 코드로 끝난다.

검사 항목 (2026-09-20 교차점검 지적 반영)
  1. 같은 자연키에 내용이 다른 레코드가 **3개 이상** 와도 모두 보존되는가 (순번 재사용 금지)
  2. 완전히 같은 내용이 여러 번 오면 한 행으로 합쳐지는가
  3. 줄 순서를 바꿔도 같은 결과가 나오는가 (순서 무관)
  4. 같은 입력을 다시 병합해도 행이 늘지 않는가 (재실행 안전)
  5. 규약에 없는 필드 이름은 거부되고 사유가 남는가
  6. 필수 필드가 없으면 거부되는가
  7. 자리 없는 칸(EXTRA)이 버려지지 않고 extension_fact 에 남는가
"""

import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
EV = [{"document_id": "doc:TEST0000000000", "page_index": 0, "fields": ["seats_planned"],
       "raw_text": "회귀검사용 원문 조각"}]


def off(key, name, seats, program=None, **kw):
    r = {"key": key, "academic_year": 2027, "value_status": "confirmed", "note": "",
         "phase": "수시", "admission_name_raw": name, "quota_type": "정원내",
         "seats_planned": seats, "program_name_raw": program, "evidence": EV}
    r.update(kw)
    return r


def build(tmp, rows, agent="RG"):
    d = tmp / "work" / "agent_out" / agent / "uTEST"
    d.mkdir(parents=True, exist_ok=True)
    (d / "offerings.jsonl").write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n",
                                       encoding="utf-8")
    return d


def prepare(tmp):
    """정본과 같은 구조의 빈 DB + 검사용 대학·문서 한 건."""
    (tmp / "work").mkdir(parents=True, exist_ok=True)
    db = tmp / "work" / "parse_v3.sqlite"
    con = sqlite3.connect(db)
    con.executescript((HERE / "schema.sql").read_text(encoding="utf-8"))
    con.execute("""INSERT INTO university_campus (campus_id, university_id, university_name_normalized, in_target)
                   VALUES ('uTEST','uTEST','회귀검사대학',1)""")
    # NOT NULL 인 칸은 전부 채워 넣는다(스키마가 바뀌어도 검사가 깨지지 않게 자동으로 찾는다)
    info = list(con.execute("PRAGMA table_info(document)"))
    vals = {"document_id": "doc:TEST0000000000", "document_type": "모집요강", "academic_years_claimed": "[2027]"}
    for _, name, typ, notnull, default, _pk in info:
        if notnull and default is None and name not in vals:
            vals[name] = 0 if typ.upper() in ("INTEGER", "REAL") else "TEST"
    con.execute(f"INSERT INTO document ({','.join(vals)}) VALUES ({','.join('?' * len(vals))})", tuple(vals.values()))
    con.commit(); con.close()
    # 텍스트 캐시(근거 대조용) — 검사에서는 근거 통과 여부가 아니라 행 수가 관심이므로 빈 캐시로 둔다
    tc = sqlite3.connect(tmp / "work" / "text_cache.sqlite")
    tc.execute("CREATE TABLE IF NOT EXISTS page_text (document_id TEXT, page_index INT, text TEXT)")
    tc.execute("INSERT INTO page_text VALUES ('doc:TEST0000000000', 0, '회귀검사용 원문 조각')")
    tc.commit(); tc.close()
    return db


def run_merge(tmp, agent="RG"):
    env = dict(os.environ, PARSE_V3_WORK=str(tmp / "work"))
    r = subprocess.run([sys.executable, str(HERE / "merge_agent.py"), agent],
                       cwd=HERE, env=env, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout, r.stderr)
        raise SystemExit("병합기 실행 실패")
    return r.stdout


def rows_of(db):
    con = sqlite3.connect(db)
    con.row_factory = sqlite3.Row
    out = [dict(x) for x in con.execute(
        "SELECT offering_id, admission_name_raw, seats_planned FROM offering ORDER BY offering_id")]
    ext = [dict(x) for x in con.execute("SELECT key, value FROM extension_fact ORDER BY key")]
    con.close()
    return out, ext


def check(name, ok, detail=""):
    print(("  PASS  " if ok else "  FAIL  ") + name + (f"  — {detail}" if detail else ""))
    return ok


def main():
    results = []
    tmp = Path(tempfile.mkdtemp(prefix="parse_v3_rg_"))
    try:
        db = prepare(tmp)

        # 1·2. 같은 자연키 4개(내용 다름 3 + 완전 중복 1)
        four = [off("a", "일반전형", 818), off("b", "일반전형", 905), off("c", "일반전형", 634),
                off("d", "일반전형", 818)]          # d 는 a 와 완전히 같다
        build(tmp, four)
        run_merge(tmp)
        rows, _ = rows_of(db)
        seats = sorted(r["seats_planned"] for r in rows)
        results.append(check("1. 같은 열쇠 3개 이상도 모두 보존", seats == [634, 818, 905],
                             f"정본 모집인원 {seats} (818·905·634 세 행이어야 함)"))
        results.append(check("2. 완전히 같은 내용은 한 행으로", len(rows) == 3, f"{len(rows)}행"))

        # 3. 순서를 바꿔도 같은 결과
        shutil.rmtree(tmp / "work" / "agent_out")
        build(tmp, [four[2], four[3], four[0], four[1]])
        run_merge(tmp)
        rows2, _ = rows_of(db)
        results.append(check("3. 줄 순서를 바꿔도 같은 결과",
                             sorted(r["seats_planned"] for r in rows2) == [634, 818, 905] and len(rows2) == 3,
                             f"{len(rows2)}행 {sorted(r['seats_planned'] for r in rows2)}"))

        # 4. 같은 입력 재실행
        run_merge(tmp)
        rows3, _ = rows_of(db)
        results.append(check("4. 같은 입력을 다시 병합해도 늘지 않음", len(rows3) == 3, f"{len(rows3)}행"))

        # 5. 모르는 필드 이름 → 거부
        shutil.rmtree(tmp / "work" / "agent_out")
        bad = off("x", "모르는필드전형", 10)
        bad["정체불명칸"] = "값"
        build(tmp, [bad, off("y", "정상전형", 11)])
        run_merge(tmp)
        rows4, _ = rows_of(db)
        names = {r["admission_name_raw"] for r in rows4}
        rep = json.loads((tmp / "work" / "agent_out" / "RG" / "_merge_report.json").read_text(encoding="utf-8"))
        why = [p for p in rep["problems"] if "모르는 필드" in p[3]]
        results.append(check("5. 규약에 없는 필드 이름은 거부 + 사유 기록",
                             "모르는필드전형" not in names and "정상전형" in names and len(why) == 1,
                             f"거부 사유 {len(why)}건"))

        # 6. 필수 필드 없음 → 거부
        shutil.rmtree(tmp / "work" / "agent_out")
        noname = off("z", None, 5, program=None)
        build(tmp, [noname])
        run_merge(tmp)
        rep = json.loads((tmp / "work" / "agent_out" / "RG" / "_merge_report.json").read_text(encoding="utf-8"))
        results.append(check("6. 전형명·모집단위가 둘 다 없으면 거부",
                             any("둘 다 없음" in p[3] for p in rep["problems"])))

        # 7. 자리 없는 칸은 extension_fact 로 보존
        shutil.rmtree(tmp / "work" / "agent_out")
        d = tmp / "work" / "agent_out" / "RG" / "uTEST"
        d.mkdir(parents=True, exist_ok=True)
        doc = {"key": "d1", "academic_year": 2027, "value_status": "confirmed", "note": "",
               "required_document_name": "검정고시 합격증명서", "submission_method": "온라인",
               "is_mandatory": "필수", "applicant_group": "검정고시 출신자",
               "admission_phase": "수시", "admission_name_raw": "일반전형",
               "raw_text": "회귀검사용 원문 조각", "evidence": EV}
        (d / "documents.jsonl").write_text(json.dumps(doc, ensure_ascii=False) + "\n", encoding="utf-8")
        run_merge(tmp)
        _, ext = rows_of(db)
        keys = {e["key"] for e in ext}
        results.append(check("7. 자리 없는 칸이 버려지지 않고 보존됨",
                             {"admission_phase", "admission_name_raw"} <= keys, f"보존된 칸 {sorted(keys)}"))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print()
    ok = sum(results)
    print(f"통과 {ok} / {len(results)}")
    raise SystemExit(0 if ok == len(results) else 1)


if __name__ == "__main__":
    main()
