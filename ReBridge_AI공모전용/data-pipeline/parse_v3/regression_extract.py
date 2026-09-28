"""모집인원 추출기 회귀검사 — 한 번 고친 결함이 되살아나지 않게 못 박는다.

    python3 regression_extract.py

정본을 건드리지 않는다. 임시 폴더에 **가짜 요강 PDF** 를 만들고, 그것만 가리키는 빈 작업대에서
진짜 추출기(`extract_offerings.py`)를 그대로 돌려 결과를 확인한다.
(`PARSE_V3_WORK`·`PARSE_V3_RAW` 두 환경변수로 경로를 임시 폴더로 돌린다.)

검사 항목 — 2026-09-21 외부 교차점검이 재현해 보인 결함 다섯 가지
  1. 이어 돌려도 앞 문서의 결과가 살아 있는가 (문서별 저장·원자적 교체)
  2. 자기 검산이 틀린 행은 confirmed 가 아니라 pending 인가
     (표 5행 중 4행이 맞으면 나머지 틀린 행까지 확정되던 문제)
  3. 한 쪽에 **서로 다른 표가 둘** 있으면 둘 다 살아남는가
  4. 원문 줄 대조가 행 **전체**를 보는가 (앞 24글자만 봐서 끝 값이 틀려도 통과하던 문제)
  5. 정답 대조가 시기·차수·군·정원구분까지 보는가
     (정시 '나군 21명' 을 '수시 다군 21명' 으로 뽑아도 통과하던 문제)

왜 필요한가
  이 다섯은 전부 "숫자는 맞는데 사실이 틀린" 종류다. 정답 묶음(check_golden)은 값이 빠진 것은 잡지만
  잘못 들어온 것·범위가 틀린 것은 못 잡는다. 그래서 따로 못 박는다.
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


# ── 가짜 요강 PDF 만들기 ────────────────────────────────────────────
def make_pdf(path, blocks):
    """blocks = [(제목, [[행],[행]...]), ...] → 선이 그려진 표가 든 1쪽짜리 PDF."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors

    font = "Helvetica"
    for cand in ("/System/Library/Fonts/AppleSDGothicNeo.ttc",
                 "/System/Library/Fonts/Supplemental/AppleGothic.ttf"):
        if Path(cand).exists():
            try:
                pdfmetrics.registerFont(TTFont("KR", cand))
                font = "KR"
                break
            except Exception:  # noqa: BLE001
                pass
    if font == "Helvetica":
        raise SystemExit("한글 글꼴을 못 찾았다. 이 검사는 한글 표를 만들어야 한다.")

    styles = getSampleStyleSheet()
    styles["Normal"].fontName = font
    doc = SimpleDocTemplate(str(path), pagesize=A4,
                            leftMargin=15 * mm, rightMargin=15 * mm,
                            topMargin=15 * mm, bottomMargin=15 * mm)
    story = []
    for title, grid in blocks:
        story.append(Paragraph(title, styles["Normal"]))
        story.append(Spacer(1, 4 * mm))
        t = Table(grid, colWidths=[40 * mm] + [25 * mm] * (len(grid[0]) - 1))
        t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.6, colors.black),
                               ("FONTNAME", (0, 0), (-1, -1), font),
                               ("FONTSIZE", (0, 0), (-1, -1), 9),
                               ("ALIGN", (1, 0), (-1, -1), "CENTER")]))
        story.append(t)
        story.append(Spacer(1, 6 * mm))
    doc.build(story)


# ── 임시 작업대 ────────────────────────────────────────────────────
def prepare(tmp, docs):
    """docs = {document_id: (상대경로, [(제목, 격자)])}. DB·텍스트 캐시·PDF 를 임시 폴더에 만든다."""
    work, raw = tmp / "work", tmp / "raw"
    work.mkdir(parents=True, exist_ok=True)
    (raw / "2027" / "테스트대학").mkdir(parents=True, exist_ok=True)

    con = sqlite3.connect(work / "parse_v3.sqlite")
    con.executescript((HERE / "schema.sql").read_text(encoding="utf-8"))
    con.execute("""INSERT INTO university_campus (campus_id, university_id, university_name_normalized, in_target)
                   VALUES ('uTEST','uTEST','회귀검사대학',1)""")
    info = list(con.execute("PRAGMA table_info(document)"))
    finfo = list(con.execute("PRAGMA table_info(document_file)"))

    import pdfplumber
    tc = sqlite3.connect(work / "text_cache.sqlite")
    tc.execute("""CREATE TABLE IF NOT EXISTS page_text (document_id TEXT, page_index INT, text TEXT,
                  PRIMARY KEY(document_id, page_index))""")

    for did, (rel, blocks) in docs.items():
        make_pdf(raw / rel, blocks)
        vals = {"document_id": did, "document_type": "모집요강", "admission_scope": "수시",
                "academic_years_claimed": "[2027]", "academic_years_detected": "[2027]"}
        for _, name, typ, notnull, default, _pk in info:
            if notnull and default is None and name not in vals:
                # sha256 처럼 유일해야 하는 칸이 있으므로 문서마다 다른 값을 넣는다
                vals[name] = 0 if typ.upper() in ("INTEGER", "REAL") else f"TEST_{did[-8:]}_{name}"
        con.execute(f"INSERT INTO document ({','.join(vals)}) VALUES ({','.join('?' * len(vals))})",
                    tuple(vals.values()))
        fv = {"document_id": did, "university_id": "uTEST", "raw_path": rel,
              "is_original_format_archive": 0}
        for _, name, typ, notnull, default, _pk in finfo:
            if notnull and default is None and name not in fv:
                fv[name] = 0 if typ.upper() in ("INTEGER", "REAL") else f"TEST_{did[-8:]}_{name}"
        con.execute(f"INSERT INTO document_file ({','.join(fv)}) VALUES ({','.join('?' * len(fv))})",
                    tuple(fv.values()))
        # 쪽 원문은 **실제 PDF 에서 뽑아** 넣는다(검사가 현실과 같은 글자를 보게).
        with pdfplumber.open(raw / rel) as pdf:
            for pi, page in enumerate(pdf.pages):
                tc.execute("INSERT OR REPLACE INTO page_text VALUES (?,?,?)",
                           (did, pi, page.extract_text() or ""))
    con.commit(); con.close()
    tc.commit(); tc.close()
    return work, raw


def run_extract(tmp, work, raw, *args):
    env = dict(os.environ, PARSE_V3_WORK=str(work), PARSE_V3_RAW=str(raw))
    r = subprocess.run([sys.executable, str(HERE / "extract_offerings.py"), "--force", *args],
                       cwd=HERE, env=env, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout[-3000:], r.stderr[-3000:])
        raise SystemExit("추출기 실행 실패")
    return r.stdout


def rows_of(work, uid="uTEST"):
    f = work / "auto_out" / "PY-OFF" / uid / "offerings.jsonl"
    if not f.exists():
        return []
    return [json.loads(l) for l in f.read_text(encoding="utf-8").splitlines() if l.strip()]


def check(name, ok, detail=""):
    print(("  PASS  " if ok else "  FAIL  ") + name + (f"  — {detail}" if detail else ""))
    return bool(ok)


# ── 검사 ───────────────────────────────────────────────────────────
TITLE = "1. 모집단위 및 모집인원 (단위: 명)"
HDR = ["모집단위", "일반전형", "지역인재", "계"]


def t1_resume(results):
    """① 이어 돌려도 앞 문서의 결과가 살아 있는가."""
    tmp = Path(tempfile.mkdtemp(prefix="rg_ext_resume_"))
    try:
        docs = {
            "doc:AAAAAAAAAAAAAAAA": ("2027/테스트대학/요강A.pdf", [(TITLE, [HDR,
                ["가나공학과", "10", "20", "30"], ["다라공학과", "11", "21", "32"],
                ["마바공학과", "12", "22", "34"]])]),
            "doc:BBBBBBBBBBBBBBBB": ("2027/테스트대학/요강B.pdf", [(TITLE, [HDR,
                ["사아공학과", "13", "23", "36"], ["자차공학과", "14", "24", "38"],
                ["카타공학과", "15", "25", "40"]])]),
        }
        work, raw = prepare(tmp, docs)
        run_extract(tmp, work, raw, "--doc", "doc:AAAAAAAAAAAAAAAA")
        after_a = {r["program_name_raw"] for r in rows_of(work)}
        run_extract(tmp, work, raw, "--doc", "doc:BBBBBBBBBBBBBBBB")
        after_b = {r["program_name_raw"] for r in rows_of(work)}
        results.append(check(
            "1. 이어 돌려도 앞 문서 결과가 남는다",
            "가나공학과" in after_b and "사아공학과" in after_b,
            f"A만 돌린 뒤 {sorted(after_a)} → B 를 이어 돌린 뒤 {sorted(after_b)}"))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def t2_row_level(results):
    """② 자기 검산이 틀린 행은 confirmed 가 아니다."""
    tmp = Path(tempfile.mkdtemp(prefix="rg_ext_row_"))
    try:
        grid = [HDR,
                ["가나공학과", "10", "20", "30"], ["다라공학과", "10", "20", "30"],
                ["마바공학과", "10", "20", "30"], ["바사공학과", "10", "20", "30"],
                ["자차공학과", "10", "90", "30"]]          # 10+90 != 30 → 이 행만 틀리다
        work, raw = prepare(tmp, {"doc:CCCCCCCCCCCCCCCC": ("2027/테스트대학/요강C.pdf", [(TITLE, grid)])})
        run_extract(tmp, work, raw)
        rows = rows_of(work)
        good = [r for r in rows if r["program_name_raw"] == "가나공학과"]
        bad = [r for r in rows if r["program_name_raw"] == "자차공학과"]
        results.append(check(
            "2. 검산이 틀린 행은 확정하지 않는다",
            bool(good) and bool(bad)
            and all(r["value_status"] == "confirmed" for r in good)
            and all(r["value_status"] == "pending" for r in bad),
            f"맞는 행 {[r['value_status'] for r in good]} / 틀린 행 {[r['value_status'] for r in bad]}"))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def t3_two_tables(results):
    """③ 한 쪽의 서로 다른 표 둘이 모두 살아남는가."""
    tmp = Path(tempfile.mkdtemp(prefix="rg_ext_two_"))
    try:
        blocks = [
            ("1. 모집단위 및 모집인원 — 인문 (단위: 명)",
             [["모집단위", "일반전형", "계"], ["가나학과", "10", "10"], ["다라학과", "20", "20"],
              ["마바학과", "30", "30"]]),
            ("2. 모집단위 및 모집인원 — 자연 (단위: 명)",
             [["모집단위", "지역인재", "계"], ["사아학과", "40", "40"], ["자차학과", "50", "50"],
              ["카타학과", "60", "60"]]),
        ]
        work, raw = prepare(tmp, {"doc:DDDDDDDDDDDDDDDD": ("2027/테스트대학/요강D.pdf", blocks)})
        run_extract(tmp, work, raw)
        names = {r["program_name_raw"] for r in rows_of(work)}
        want = {"가나학과", "다라학과", "마바학과", "사아학과", "자차학과", "카타학과"}
        results.append(check("3. 한 쪽의 별개 표 둘이 모두 남는다", want <= names,
                             f"나온 모집단위 {sorted(names)}"))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def t4_full_row_match(results):
    """④ 원문 줄 대조가 행 전체를 보는가 (앞부분만 같고 끝이 다르면 통과하면 안 된다)."""
    sys.path.insert(0, str(HERE))
    import extract_offerings as X
    line = "기계공학과12345678901234567890999"
    same = X.row_matches_source([line], "기계공학과",
                                ["12345678901234567890", "999"])
    tail_changed = X.row_matches_source([line], "기계공학과",
                                        ["12345678901234567890", "888"])
    results.append(check("4. 원문 줄 대조가 행 전체를 본다", same and not tail_changed,
                         f"같은 행 {same} / 끝 값만 바꾼 행 {tail_changed} (앞 20글자는 동일)"))


def t5_golden_scope(results):
    """⑤ 정답 대조가 시기·차수·군·정원구분까지 보는가."""
    sys.path.insert(0, str(HERE))
    import check_golden as G
    g = {"univId": "uTEST", "academic_year": 2027, "phase": "정시", "admission_group": "나군",
         "program_name_raw": "사회학과", "admission_contains": "일반", "seats_planned": 21}
    right = {"univId": "uTEST", "academic_year": 2027, "phase": "정시", "admission_group": "나군",
             "program_name_raw": "사회학과", "admission_name_raw": "수능 일반", "seats_planned": 21}
    wrong = dict(right, phase="수시", admission_group="다군")

    def passes(row):
        cand = [r for r in [row]
                if r.get("univId") == g["univId"]
                and (r.get("academic_year") in (None, g["academic_year"]))
                and G.prog_match(r.get("program_name_raw"), g["program_name_raw"])
                and G.norm(g["admission_contains"]) in G.norm(r.get("admission_name_raw"))]
        hit = [c for c in cand if c.get("seats_planned") == g["seats_planned"]]
        if not hit:
            return False
        bad = [k for c in hit for k in G.SCOPE if k in g and G.norm(str(c.get(k))) != G.norm(str(g[k]))]
        return not bad

    results.append(check("5. 정답 대조가 시기·군까지 본다", passes(right) and not passes(wrong),
                         f"맞는 범위 통과 {passes(right)} / 틀린 범위 통과 {passes(wrong)}"))


def main():
    print("모집인원 추출기 회귀검사 — 정본을 건드리지 않는다\n")
    results = []
    t1_resume(results)
    t2_row_level(results)
    t3_two_tables(results)
    t4_full_row_match(results)
    t5_golden_scope(results)
    print(f"\n통과 {sum(results)} / {len(results)}")
    raise SystemExit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
