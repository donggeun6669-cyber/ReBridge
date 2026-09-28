"""A단계 — 입력 문서 인벤토리 + 쪽별 텍스트 캐시.

    python3 inventory.py            # 전체(재실행해도 같은 해시 문서는 건너뜀)
    python3 inventory.py --force    # 텍스트 캐시까지 다시

하는 일
  1. RAW/{연도}/_manifests/*.csv 를 읽기만 해서 물리 파일(document_file)과 문서 버전(document, 해시 기준)을 만든다.
  2. 못 구한 칸은 coverage_gap 으로(rawlib 표시 그대로).
  3. 변환본(convert.csv)은 원본 문서와 converted_from 으로 잇는다.
  4. PDF·XLSX·HTML·HWP 의 쪽별 텍스트를 text_cache.sqlite 에 넣고, 텍스트층·OCR 필요 여부를 판정한다.
  5. manifest 에 없는 RAW 파일(고아)을 보고서에 적는다.
"""

import argparse
import csv
import hashlib
import json
import re
import subprocess
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from common import (RAW, APP_DATA, REPORT_DIR, PARSER_VERSION, init_db, text_db, log, now, nfc, doc_id,
                    detect_years, jdump, h, rawlib)

PYHWP = Path.home() / ".venvs/pyhwp/bin"


def sha256(p):
    x = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            x.update(c)
    return x.hexdigest()


def fmt_of(p):
    e = p.suffix.lower()
    return {".pdf": "PDF", ".xlsx": "XLSX", ".xlsm": "XLSX", ".xls": "XLS", ".html": "HTML", ".htm": "HTML",
            ".hwp": "HWP", ".hwpx": "HWPX", ".jpg": "IMAGE", ".jpeg": "IMAGE", ".png": "IMAGE",
            ".webp": "IMAGE", ".json": "JSON", ".csv": "CSV"}.get(e, "OTHER")


# ── 쪽별 텍스트 (별도 프로세스에서 실행) ──
def extract_pages(args):
    path, fmt = args
    p = Path(path)
    out = []
    try:
        if fmt == "PDF":
            import fitz
            fitz.TOOLS.mupdf_display_errors(False)
            with fitz.open(p) as d:
                for i, pg in enumerate(d):
                    t = pg.get_text("text", sort=True)
                    out.append((i, t, len(re.sub(r"\s", "", t)), len(pg.get_images()), "pymupdf_sort"))
        elif fmt == "XLSX":
            import openpyxl
            wb = openpyxl.load_workbook(p, data_only=True, read_only=True)
            for i, ws in enumerate(wb.worksheets):
                lines = [f"#시트 {ws.title}"]
                for r in ws.iter_rows():
                    cells = [f"{c.coordinate}={c.value}" for c in r if c.value is not None and hasattr(c, "coordinate")]
                    if cells:
                        lines.append("\t".join(cells))
                t = "\n".join(lines)
                out.append((i, t, len(re.sub(r"\s", "", t)), 0, "openpyxl_cells"))
        elif fmt == "HTML":
            from bs4 import BeautifulSoup
            raw = p.read_bytes()
            m = re.search(rb'charset=["\']?([\w-]+)', raw[:3000], re.I)
            try:
                html = raw.decode(m.group(1).decode() if m else "utf-8", errors="ignore")
            except LookupError:
                html = raw.decode("utf-8", errors="ignore")
            s = BeautifulSoup(html, "html.parser")
            for t in s(["script", "style", "noscript"]):
                t.decompose()
            t = s.get_text("\n")
            t = re.sub(r"\n\s*\n+", "\n", t)
            out.append((0, t, len(re.sub(r"\s", "", t)), 0, "bs4_text"))
        elif fmt == "HWP":
            r = subprocess.run([str(PYHWP / "hwp5txt"), str(p)], capture_output=True, text=True, timeout=300)
            t = r.stdout
            out.append((0, t, len(re.sub(r"\s", "", t)), 0, "hwp5txt(표 일부 누락 가능)"))
        elif fmt == "HWPX":
            import zipfile
            z = zipfile.ZipFile(p)
            xml = " ".join(z.read(n).decode("utf-8", "ignore") for n in z.namelist()
                           if re.match(r"Contents/section\d+\.xml$", n))
            xml = re.sub(r"<hp:shapeComment>.*?</hp:shapeComment>", " ", xml, flags=re.S)
            t = "\n".join(re.findall(r"<hp:t(?:\s[^>]*)?>(.*?)</hp:t>", xml, re.S))
            t = re.sub(r"<[^>]+>", " ", t)
            out.append((0, t, len(re.sub(r"\s", "", t)), 0, "hwpx_xml"))
        return path, out, None
    except Exception as e:  # noqa: BLE001
        return path, out, f"{type(e).__name__}: {e}"[:300]


def title_of(text):
    for line in (text or "").splitlines():
        s = line.strip()
        if len(s) >= 4 and re.search(r"[가-힣]", s):
            return s[:200]
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--workers", type=int, default=6)
    a = ap.parse_args()
    con = init_db()
    tdb = text_db()

    # 대학·캠퍼스 (03) — 마스터 전체를 넣고 현재 대상 여부를 표시
    master = json.loads((APP_DATA / "universities.json").read_text(encoding="utf-8"))
    targets = {u["univId"]: u for u in rawlib.targets()}
    predecessors = {"uA0003298": "uA0000403", "uA0003297": "uA0000402", "uA0003312": "uA0000562"}
    for u in master:
        uid = u["univId"]
        t = targets.get(uid)
        con.execute("""INSERT OR REPLACE INTO university_campus
            (campus_id, university_id, university_name_raw, university_name_normalized, school_kind, establishment,
             region, admission_office_url, predecessor_id, in_target, source_note)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                    (uid, uid, nfc(u["name"]), nfc(t["name"]) if t else nfc(u["name"]), u.get("kind"),
                     u.get("establishment"), u.get("region"), u.get("admissionOfficeUrl"), predecessors.get(uid),
                     1 if t else 0, "universities.json(어디가 마스터) + rawlib.targets()(제외·이름 반영)"))

    # manifest 읽기 (읽기 전용)
    rows_by_path = {}
    miss = defaultdict(list)
    for year in rawlib.YEARS:
        for mp in sorted((RAW / year / "_manifests").glob("*.csv")):
            with open(mp, encoding="utf-8-sig") as f:
                for r in csv.DictReader(f):
                    r = {k: nfc(v) for k, v in r.items()}
                    r["_manifest"] = f"{year}/_manifests/{mp.name}"
                    r["_year"] = year
                    if r["상태"] == "확보" and r["파일"]:
                        rows_by_path.setdefault(r["파일"], r)
                    elif r["상태"] != "확보":
                        miss[(r["univId"], year)].append(r)

    # 못 구한 칸 (확보가 하나도 없는 대학·연도만)
    got = {(r["univId"], r["_year"]) for r in rows_by_path.values()}
    for uid in targets:
        for year in rawlib.YEARS:
            if (uid, year) in got:
                continue
            rs = miss.get((uid, year), [])
            label = rawlib.miss_label(rs) if rs else "기록 없음"
            con.execute("INSERT OR REPLACE INTO coverage_gap VALUES (?,?,?,?)",
                        (uid, year, label, " / ".join(sorted({x["비고"][:300] for x in rs}))))

    # 물리 파일 → 문서
    todo_text = []
    conv_links = []
    for rel, r in sorted(rows_by_path.items()):
        p = RAW / rel
        exists = p.exists()
        if not exists:
            continue
        s = sha256(p)
        did = doc_id(s)
        fmt = fmt_of(p)
        is_arch = 1 if "/_원본형식/" in rel else 0
        con.execute("""INSERT OR IGNORE INTO document (document_id, sha256, format, original_or_substitute,
                       issuing_authority, document_type, admission_scope, academic_years_claimed, source_url,
                       retrieved_at, publication_date, parser_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (did, s, fmt, r["원문여부"],
                     "대학 원문" if r["원문여부"] in ("원문", "가공") else
                     ("전문대학포털 대체" if "procollege" in r["출처URL"] or "전문대학포털" in r["비고"] else
                      ("어디가(대교협) 대체" if "adiga" in r["출처URL"] or "어디가" in r["비고"] else "대체(기타)")),
                     {"입시결과": "입시결과", "모집요강": "모집요강", "시행계획": "시행계획"}.get(r["문서종류"].split("_")[0], "기타"),
                     r["문서종류"].split("_")[1] if "_" in r["문서종류"] else r["문서종류"],
                     jdump([int(r["_year"])]), r["출처URL"], r["받은날짜"], r["게시일"] or None, PARSER_VERSION))
        # 같은 문서가 다른 연도·대학 폴더에도 있으면 claimed 연도를 합친다
        cur = json.loads(con.execute("SELECT academic_years_claimed FROM document WHERE document_id=?", (did,)).fetchone()[0])
        if int(r["_year"]) not in cur:
            con.execute("UPDATE document SET academic_years_claimed=? WHERE document_id=?",
                        (jdump(sorted(cur + [int(r["_year"])])), did))
        con.execute("""INSERT OR REPLACE INTO document_file VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                    ("file:" + h(rel), did, rel, r["univId"], r["_year"], r["문서종류"], r["작업자"], r["_manifest"],
                     r["비고"][:1000], is_arch, 1 if r["sha256"] == s else 0, 1))
        if r["작업자"] == "convert":
            m = re.search(r"원본 (\S+?), 작업자", r["비고"])
            if m:
                conv_links.append((did, m.group(1)))
        done = con.execute("SELECT 1 FROM processing_log WHERE document_id=? AND stage='textcache' AND status IN ('done','partial')",
                           (did,)).fetchone()
        if a.force or not done:
            if fmt in ("PDF", "XLSX", "HTML", "HWP", "HWPX"):
                todo_text.append((str(p), fmt, did))
            else:
                log(con, did, "textcache", "skipped", f"형식 {fmt}: 변환본이 따로 있거나 텍스트화 대상 아님")
    con.commit()

    # 변환본 → 원본 연결
    for did, orig_rel in conv_links:
        o = con.execute("SELECT document_id FROM document_file WHERE raw_path=?", (orig_rel,)).fetchone()
        if o:
            con.execute("UPDATE document SET converted_from=? WHERE document_id=?", (o[0], did))
    con.commit()

    # 쪽별 텍스트
    uniq = {}
    for path, fmt, did in todo_text:
        uniq.setdefault(did, (path, fmt))
    print("텍스트화 대상 문서", len(uniq))
    by_path = {v[0]: k for k, v in uniq.items()}
    with ProcessPoolExecutor(a.workers) as ex:
        for n, (path, pages, err) in enumerate(ex.map(extract_pages, [v for v in uniq.values()], chunksize=4), 1):
            did = by_path[path]
            tdb.execute("DELETE FROM page_text WHERE document_id=?", (did,))
            tdb.executemany("INSERT INTO page_text VALUES (?,?,?,?,?,?)", [(did, *pg) for pg in pages])
            npg = len(pages)
            text_pages = sum(1 for pg in pages if pg[2] >= 30)
            img_only = sum(1 for pg in pages if pg[2] < 15 and pg[3] > 0)
            layer = ("none" if npg == 0 else "text" if text_pages == npg else
                     "image_only" if text_pages == 0 else "partial")
            first = "\n".join(pg[1] for pg in pages[:3])
            years = detect_years(first)
            claimed = json.loads(con.execute("SELECT academic_years_claimed FROM document WHERE document_id=?", (did,)).fetchone()[0])
            ycheck = ("undetected" if not years else "match" if years == claimed or set(claimed) <= set(years) and len(years) == 1
                      else "multi" if set(claimed) & set(years) else "mismatch")
            con.execute("""UPDATE document SET page_count=?, title=?, academic_years_detected=?, year_check=?,
                           text_layer=?, text_pages=?, image_only_pages=?, ocr_needed=? WHERE document_id=?""",
                        (npg, title_of(first), jdump(years), ycheck, layer, text_pages, img_only,
                         1 if img_only > 0 else 0, did))
            log(con, did, "textcache", "failed" if err and not pages else "partial" if err else "done", err or "")
            if n % 100 == 0:
                con.commit(); tdb.commit()
                print(" ", n, "/", len(uniq))
    con.commit(); tdb.commit()

    # 고아 파일 (manifest 에 없는 RAW 파일)
    known = set(rows_by_path)
    orphans = []
    for year in rawlib.YEARS:
        for p in (RAW / year).rglob("*"):
            if p.is_file() and "_manifests" not in p.parts and not p.name.startswith("."):
                rel = str(p.relative_to(RAW))
                if nfc(rel) not in known:
                    orphans.append(rel)
    REPORT_DIR.mkdir(exist_ok=True)
    (REPORT_DIR / "inventory_orphans.txt").write_text("\n".join(orphans) + "\n", encoding="utf-8")
    print("고아 파일", len(orphans))
    print("완료", now())


if __name__ == "__main__":
    main()
