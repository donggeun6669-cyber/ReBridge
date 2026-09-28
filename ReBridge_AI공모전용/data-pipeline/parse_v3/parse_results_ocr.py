"""이미지로만 된 입시결과 표 → OCR 좌표로 표 복원 → outcome.

    python3 parse_results_ocr.py [--univ id,id] [--doc doc:…] [--force]

- 대상: 입시결과 문서 중 텍스트층이 없는 쪽(page_ocr 에 줄 좌표가 있는 쪽).
- Vision OCR 이 남긴 줄 단위 (y, x, 신뢰도, 글자) 로 행·열을 다시 만든 뒤 parse_results 의 분류 규칙을 그대로 쓴다.
- **OCR 값은 글자 인식 오류가 있을 수 있으므로 value_status='pending'** 으로 저장하고, 근거의 extraction_method='ocr',
  평균 신뢰도를 evidence.footnote_text 에 적는다. 사람이 확인하기 전에는 계산·비교에 쓰지 않는다.
"""

import argparse
import json
import re
from collections import Counter

from common import PARSER_VERSION, connect, text_db, log, h
import parse_results as PR

EXTRACTOR = "parse_results_ocr " + PARSER_VERSION


def lines_of(tsv):
    out = []
    for ln in (tsv or "").splitlines():
        p = ln.split("\t", 3)
        if len(p) == 4:
            try:
                out.append((float(p[0]), float(p[1]), float(p[2]), p[3]))
            except ValueError:
                pass
    return out


def rows_cols(lines, y_tol=0.008, x_gap=0.015):
    """줄들을 행(y 묶음)과 열(x 경계)로 나눈다. 좌표는 0~1 비율."""
    lines = sorted(lines, key=lambda t: (t[0], t[1]))
    rows, cur, y0 = [], [], None
    for y, x, c, s in lines:
        if y0 is None or abs(y - y0) <= y_tol:
            cur.append((x, c, s))
            y0 = y if y0 is None else y0
        else:
            rows.append((y0, sorted(cur)))
            cur, y0 = [(x, c, s)], y
    if cur:
        rows.append((y0, sorted(cur)))
    xs = sorted(x for _, x, _, _ in lines)
    bounds = []
    for a, b in zip(xs, xs[1:]):
        if b - a > x_gap:
            bounds.append((a + b) / 2)
    return rows, bounds


def to_grid(rows, bounds):
    ncol = len(bounds) + 1
    grid = []
    for _, cells in rows:
        r = [""] * ncol
        for x, c, s in cells:
            j = sum(1 for b in bounds if x > b)
            r[j] = (r[j] + " " + s).strip() if r[j] else s
        grid.append(r)
    return grid


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--univ")
    ap.add_argument("--doc")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    con, tdb = connect(), text_db()
    q = """SELECT DISTINCT f.document_id, f.university_id, d.admission_scope, d.academic_years_detected, d.academic_years_claimed
           FROM document_file f JOIN document d USING(document_id) JOIN university_campus u ON u.university_id=f.university_id
           WHERE d.document_type='입시결과' AND u.in_target=1 AND d.ocr_needed=1"""
    rows = list(con.execute(q))
    if a.univ:
        rows = [r for r in rows if r["university_id"] in a.univ.split(",")]
    if a.doc:
        rows = [r for r in rows if r["document_id"] == a.doc]
    st = Counter()
    for r in rows:
        did, uid = r["document_id"], r["university_id"]
        if not a.force and con.execute("SELECT 1 FROM processing_log WHERE document_id=? AND stage='results_ocr' AND parser_version=? AND detail LIKE ?",
                                       (did, PARSER_VERSION, f"{uid}:%")).fetchone():
            continue
        dy = json.loads(r["academic_years_detected"] or "[]") or json.loads(r["academic_years_claimed"] or "[]")
        phase = {"수시": "수시", "정시": "정시"}.get(r["admission_scope"])
        n = 0
        con.execute("""DELETE FROM evidence WHERE target_table='outcome' AND target_record_id IN
                       (SELECT outcome_id FROM outcome WHERE document_id=? AND university_id=? AND review_status='ocr')""", (did, uid))
        con.execute("DELETE FROM outcome WHERE document_id=? AND university_id=? AND review_status='ocr'", (did, uid))
        for pi, tsv, conf in tdb.execute("SELECT page_index, lines_tsv, mean_conf FROM page_ocr WHERE document_id=? ORDER BY page_index", (did,)):
            lines = lines_of(tsv)
            if len(lines) < 12:
                continue
            rws, bounds = rows_cols(lines)
            if len(bounds) < 2 or len(rws) < 3:
                continue
            grid = to_grid(rws, bounds)
            # 값 칸이 거의 없는 쪽(표 아님)은 건너뛴다
            vals = sum(1 for row in grid for c in row if PR.is_value(c))
            if vals < 6:
                continue
            nh, headers = PR.split_headers(grid)
            data = grid[nh:]
            if not data:
                continue
            # 열 제목이 제대로 복원된 쪽만 값으로 만든다. 아니면 값 대신 '사람이 볼 후보'로만 남긴다.
            classified = sum(1 for hp in headers if PR.classify(hp or "")[1])
            if classified < 2:
                con.execute("INSERT OR REPLACE INTO candidate VALUES (?,?,?,?,?,?,?,?,?,?)",
                            ("cand:" + h(did, uid, "results_table_ocr", pi), did, uid, "results_table_ocr", pi,
                             json.dumps({"ocr_mean_conf": conf, "cols": len(bounds) + 1, "rows": len(grid)}, ensure_ascii=False),
                             None, "\n".join(" | ".join(c for c in row) for row in grid)[:6000], "pending", EXTRACTOR))
                st["pages_to_human"] += 1
                continue
            page_text = "\n".join(" ".join(c for c in row if c) for row in grid[:nh] or grid[:2])
            ctx = dict(PR.page_context(page_text), doc=did, univ=uid, phase=phase,
                       year=PR.year_for(dy, PR.detect_years(page_text)))
            before = con.execute("SELECT count(*) FROM outcome WHERE document_id=?", (did,)).fetchone()[0]
            n += PR.emit_table(con, ctx, headers, data, {"key": f"ocr{pi}", "page_index": pi, "method": "ocr"})
            after = con.execute("SELECT count(*) FROM outcome WHERE document_id=?", (did,)).fetchone()[0]
            # OCR 값은 확정이 아니다
            con.execute("""UPDATE outcome SET value_status='pending', review_status='ocr'
                           WHERE document_id=? AND university_id=? AND review_status='auto_validated'
                             AND outcome_id IN (SELECT target_record_id FROM evidence WHERE document_id=? AND page_index=? AND extraction_method='ocr')""",
                        (did, uid, did, pi))
            con.execute("""UPDATE evidence SET value_status='pending', review_status='unreviewed',
                           footnote_text=COALESCE(footnote_text,'') || ' [OCR 평균신뢰 ' || ? || ' — 사람 확인 전 계산·비교 금지]'
                           WHERE document_id=? AND page_index=? AND extraction_method='ocr'""",
                        (round(conf or 0, 3), did, pi))
        log(con, did, "results_ocr", "done" if n else "partial", f"{uid}: OCR 표 값 {n}개")
        st["docs"] += 1
        st["values"] += n
        con.commit()
    print(dict(st))


if __name__ == "__main__":
    main()
