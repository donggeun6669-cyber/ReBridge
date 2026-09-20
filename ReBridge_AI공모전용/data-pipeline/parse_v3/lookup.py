"""원문 조회 도구 (읽기 전용) — 메인·에이전트 공용.

    python3 lookup.py docs <univId>                     # 그 대학 문서 목록(document_id·형식·연도·쪽수·경로)
    python3 lookup.py search <univId|doc:…> <정규식> [--year 2027] [--max 40]
    python3 lookup.py page <doc:…> <page_index>         # 쪽 텍스트(page_index 는 0부터)
    python3 lookup.py pages <doc:…> <from> <to>         # 여러 쪽
    python3 lookup.py render <doc:…> <page_index>       # 쪽 이미지를 work/render/ 에 PNG로 (표·각주 눈으로 확인용)
    python3 lookup.py tables <doc:…> <page_index>       # pdfplumber 표 추출 결과(JSON) — 보조용, 틀릴 수 있음
    python3 lookup.py cands <univId> [종류]             # 자동 후보 색인: 어느 문서·쪽에 무엇이 있는지 (종류: ged_eligibility|
                                                       #   csat_minimum|ged_conversion|schedule|required_documents|evaluation)
"""

import json
import re
import subprocess
import sys

from common import RAW, WORK, connect, text_db


def docs(uid):
    con = connect()
    q = """SELECT d.document_id, d.format, d.document_type, d.admission_scope, d.academic_years_claimed,
                  d.academic_years_detected, d.year_check, d.page_count, d.text_layer, d.original_or_substitute,
                  d.converted_from, f.raw_path, f.is_original_format_archive
           FROM document_file f JOIN document d USING(document_id) WHERE f.university_id=? ORDER BY f.raw_path"""
    for r in con.execute(q, (uid,)):
        print(" | ".join(str(r[k]) for k in r.keys()))


def search(target, pat, year=None, mx=40):
    con, tdb = connect(), text_db()
    if target.startswith("doc:"):
        ids = [target]
    else:
        q = "SELECT DISTINCT f.document_id FROM document_file f WHERE f.university_id=?"
        args = [target]
        if year:
            q += " AND f.folder_year=?"
            args.append(str(year))
        ids = [r[0] for r in con.execute(q, args)]
    rx = re.compile(pat)
    n = 0
    for did in ids:
        path = con.execute("SELECT raw_path FROM document_file WHERE document_id=? LIMIT 1", (did,)).fetchone()[0]
        rows = list(tdb.execute("SELECT page_index, text FROM page_text WHERE document_id=? ORDER BY page_index", (did,)))
        if tdb.execute("SELECT name FROM sqlite_master WHERE name='page_ocr'").fetchone():
            rows += [(pi, "[OCR] " + (t or "")) for pi, t in tdb.execute("SELECT page_index, text FROM page_ocr WHERE document_id=?", (did,))]
        for pi, t in rows:
            for m in rx.finditer(t or ""):
                s = max(0, m.start() - 80)
                print(f"{did} p{pi} [{path.split('/')[-1]}] …{re.sub(chr(10), ' ⏎ ', t[s:m.end()+120])}…")
                n += 1
                if n >= mx:
                    return
                break


def cands(uid, kind=None):
    con = connect()
    q = ("SELECT kind, document_id, page_index, sub_kind, signals, substr(replace(raw_text, char(10), ' '), 1, 110) FROM candidate "
         "WHERE university_id=?" + (" AND kind=?" if kind else "") + " ORDER BY kind, document_id, page_index")
    for r in con.execute(q, (uid, kind) if kind else (uid,)):
        print(" | ".join("" if x is None else str(x) for x in r))


def page(did, pi, pj=None):
    tdb = text_db()
    has_ocr = tdb.execute("SELECT name FROM sqlite_master WHERE name='page_ocr'").fetchone()
    for i, t in tdb.execute("SELECT page_index, text FROM page_text WHERE document_id=? AND page_index BETWEEN ? AND ? ORDER BY page_index",
                            (did, int(pi), int(pj if pj is not None else pi))):
        print(f"===== {did} page_index={i} (텍스트층) =====")
        print(t)
        if has_ocr:
            o = tdb.execute("SELECT text, mean_conf FROM page_ocr WHERE document_id=? AND page_index=?", (did, i)).fetchone()
            if o:
                print(f"===== {did} page_index={i} (OCR, 평균신뢰 {o[1]}) — 값은 render 로 한 번 더 확인 =====")
                print(o[0])


def render(did, pi):
    con = connect()
    path = con.execute("SELECT raw_path FROM document_file WHERE document_id=? AND raw_path LIKE '%.pdf' LIMIT 1", (did,)).fetchone()
    if not path:
        sys.exit("PDF 아님")
    out = WORK / "render"
    out.mkdir(parents=True, exist_ok=True)
    stem = out / f"{did.replace(':', '_')}_p{int(pi)}"
    subprocess.run(["pdftoppm", "-f", str(int(pi) + 1), "-l", str(int(pi) + 1), "-r", "110", "-png", "-singlefile",
                    str(RAW / path[0]), str(stem)], check=True)
    print(f"{stem}.png")


def tables(did, pi):
    import pdfplumber
    con = connect()
    path = con.execute("SELECT raw_path FROM document_file WHERE document_id=? AND raw_path LIKE '%.pdf' LIMIT 1", (did,)).fetchone()[0]
    with pdfplumber.open(RAW / path) as pdf:
        print(json.dumps(pdf.pages[int(pi)].extract_tables(), ensure_ascii=False, indent=0))


if __name__ == "__main__":
    cmd, *rest = sys.argv[1:] or ["help"]
    if cmd == "docs":
        docs(rest[0])
    elif cmd == "search":
        year = rest[rest.index("--year") + 1] if "--year" in rest else None
        mx = int(rest[rest.index("--max") + 1]) if "--max" in rest else 40
        search(rest[0], rest[1], year, mx)
    elif cmd == "page":
        page(rest[0], rest[1])
    elif cmd == "pages":
        page(rest[0], rest[1], rest[2])
    elif cmd == "render":
        render(rest[0], rest[1])
    elif cmd == "cands":
        cands(rest[0], rest[1] if len(rest) > 1 else None)
    elif cmd == "tables":
        tables(rest[0], rest[1])
    else:
        print(__doc__)
