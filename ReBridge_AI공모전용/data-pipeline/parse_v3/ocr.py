"""이미지 쪽 로컬 OCR (macOS Vision, 무료·오프라인).

    python3 ocr.py [--doc doc:…] [--limit N]

- 대상: 텍스트층이 거의 없는 쪽(글자 15자 미만 + 이미지 있음)의 PDF 쪽.
- 결과는 text_cache.sqlite 의 page_ocr 에 따로 둔다(원래 텍스트층과 섞지 않는다).
- 줄 단위 좌표를 보존하고, 같은 높이의 줄을 한 행으로 묶은 텍스트도 만든다(표 읽기용).
- 이미 한 쪽은 건너뛴다(재개 가능).
"""

import argparse
import subprocess
from collections import defaultdict

from common import RAW, WORK, connect, text_db, log, now

BIN = WORK / "bin" / "ocr_vision"


def rows_text(lines, tol=0.006):
    lines.sort(key=lambda x: (x[0], x[1]))
    rows, cur, y0 = [], [], None
    for y, x, c, s in lines:
        if y0 is None or abs(y - y0) <= tol:
            cur.append((x, s)); y0 = y if y0 is None else y0
        else:
            rows.append(cur); cur = [(x, s)]; y0 = y
    if cur:
        rows.append(cur)
    return "\n".join("  ".join(s for _, s in sorted(r)) for r in rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--doc")
    ap.add_argument("--limit", type=int)
    a = ap.parse_args()
    con, tdb = connect(), text_db()
    tdb.execute("""CREATE TABLE IF NOT EXISTS page_ocr (document_id TEXT, page_index INTEGER, text TEXT,
                   lines_tsv TEXT, mean_conf REAL, engine TEXT, PRIMARY KEY(document_id, page_index))""")
    q = "SELECT document_id, page_index FROM page_text WHERE char_count < 15 AND image_count > 0"
    args = []
    if a.doc:
        q += " AND document_id=?"; args.append(a.doc)
    todo = defaultdict(list)
    done = {(r[0], r[1]) for r in tdb.execute("SELECT document_id, page_index FROM page_ocr")}
    for did, pi in tdb.execute(q, args):
        if (did, pi) not in done:
            todo[did].append(pi)
    print("OCR 대상 문서", len(todo), "쪽", sum(map(len, todo.values())))
    n = 0
    done_docs = []
    for did, pages in todo.items():
        path = con.execute("SELECT raw_path FROM document_file WHERE document_id=? AND lower(raw_path) LIKE '%.pdf' LIMIT 1",
                           (did,)).fetchone()
        if not path:
            continue
        for i in range(0, len(pages), 20):
            chunk = pages[i:i + 20]
            r = subprocess.run([str(BIN), str(RAW / path[0]), *map(str, chunk)], capture_output=True, text=True, timeout=900)
            cur, buf = None, defaultdict(list)
            for line in r.stdout.splitlines():
                if line.startswith("=====PAGE "):
                    cur = int(line.split()[1]); continue
                parts = line.split("\t", 3)
                if cur is not None and len(parts) == 4:
                    buf[cur].append((float(parts[0]), float(parts[1]), float(parts[2]), parts[3]))
            for pi in chunk:
                ls = buf.get(pi, [])
                conf = sum(x[2] for x in ls) / len(ls) if ls else None
                tdb.execute("INSERT OR REPLACE INTO page_ocr VALUES (?,?,?,?,?,?)",
                            (did, pi, rows_text(list(ls)), "\n".join(f"{y:.4f}\t{x:.4f}\t{c:.2f}\t{s}" for y, x, c, s in ls),
                             conf, "macOS Vision accurate ko-KR,en-US 300dpi"))
            n += len(chunk)
            tdb.commit()
        done_docs.append((did, len(pages)))
        if a.limit and n >= a.limit:
            break
    # 정본 DB 기록은 끝에 한 번에(다른 파서와 잠금 경쟁을 피한다)
    for did, k in done_docs:
        log(con, did, "ocr", "done", f"{k}쪽")
    con.commit()
    print("OCR 완료 쪽", n, now())


if __name__ == "__main__":
    main()
