"""Phase A(모집요강) — 2027 모집요강 PDF를 페이지별 텍스트로 만든다. (LLM 없음, 비용 0)

## 왜 시행계획이 아니라 모집요강인가
**검정고시 비교내신 산출식은 모집요강에만 있다.** 시행계획·기본사항에는 없다.
(2026-09-03 확인) 그래서 대학별 susi.pdf / jeongsi.pdf 를 따로 받아 왔다.

## 입력
  {pdf_sources}/guides_2027/{대학명}/susi.pdf, jeongsi.pdf
  {pdf_sources}/guides_2027/manifest.csv   — 대학명·univId·출처URL·상태

## 산출
  out/text/guides_2027/{대학명}_{susi|jeongsi}.json
    {"univ","univId","phase","file","sha256","pages":[{"page":1,"text":"…"}]}
  out/text/guides_2027/_manifest.json

`pdftotext -layout` 을 쓴다. PyMuPDF보다 표의 가로 정렬을 훨씬 잘 보존한다
(모집요강 환산표는 "환산점수 99점이상 96점이상 … / 등급 1등급 2등급 …" 처럼
 가로로 누워 있어서 열 정렬이 깨지면 표를 못 읽는다).

스캔본(텍스트가 거의 없는 PDF)은 목록만 남기고 넘어간다. OCR은 이번에 하지 않는다.

실행:
  python3 v2/extract_guides_text.py --year 2027
  python3 v2/extract_guides_text.py --year 2027 --force
"""

import argparse
import csv
import json
import os
import subprocess
import sys
import tempfile
import unicodedata
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C

PHASES = {"susi": "수시", "jeongsi": "정시", "tonghap": "수시+정시"}
MIN_CHARS_PER_PAGE = 60          # 이보다 적으면 스캔본으로 본다


def pdf_pages(path):
    """pdftotext -layout → [(page_no, text)]. 1-based."""
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tf:
        tmp = tf.name
    try:
        r = subprocess.run(["pdftotext", "-layout", "-enc", "UTF-8", str(path), tmp],
                           capture_output=True, timeout=600)
        if r.returncode != 0 and not os.path.getsize(tmp):
            raise RuntimeError(r.stderr.decode("utf-8", "replace")[:300])
        raw = Path(tmp).read_text(encoding="utf-8", errors="replace")
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass
    parts = raw.split("\f")
    if parts and parts[-1].strip() == "":
        parts = parts[:-1]
    return [(i, C.nfc(t)) for i, t in enumerate(parts, start=1)]


def _one(job):
    univ, phase, campus, pdf_path, out_path = job
    try:
        pages = pdf_pages(pdf_path)
    except Exception as e:
        return {"univ": univ, "phase": phase, "campus": campus,
                "error": str(e)[:200]}
    chars = sum(len(t.strip()) for _, t in pages)
    scanned = len(pages) > 0 and chars < MIN_CHARS_PER_PAGE * len(pages)
    doc = {
        "univ": univ, "phase": phase, "phaseKo": PHASES[phase], "campus": campus,
        "file": str(pdf_path), "sha256": C.sha256(pdf_path),
        "pages": [{"page": n, "text": t} for n, t in pages],
    }
    if not scanned:
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False)
    return {"univ": univ, "phase": phase, "campus": campus,
            "pages": len(pages), "chars": chars,
            "scanned": scanned, "sha256": doc["sha256"],
            "file": str(pdf_path), "out": str(out_path) if not scanned else None}


def run(year=2027, force=False, workers=8, limit=None):
    src = C.PDF_ROOT / f"guides_{year}"
    if not src.is_dir():
        raise SystemExit(f"폴더가 없습니다: {src}")
    out_dir = C.OUT / "text" / f"guides_{year}"
    out_dir.mkdir(parents=True, exist_ok=True)

    # manifest.csv 로 대학명 → univId 를 잡는다 (파일명 NFD 함정은 nfc()가 처리)
    man_csv = src / "manifest.csv"
    uid_by_name, url_by_file = {}, {}
    n_notfound = 0
    if man_csv.exists():
        for r in csv.DictReader(open(man_csv, encoding="utf-8-sig")):
            nm = C.nfc(r.get("대학명"))
            if r.get("univId"):
                uid_by_name.setdefault(nm, r["univId"].strip())
            if r.get("상태(성공/못 구함)") == "못 구함":
                n_notfound += 1
            if r.get("파일명"):
                url_by_file[C.nfc(r["파일명"])] = r.get("출처URL")

    matcher = C.UnivMatcher()

    # ⚠️ 파일명이 susi.pdf / jeongsi.pdf 만 있는 게 아니다.
    #    캠퍼스가 갈리는 대학은 susi_제2캠퍼스.pdf, jeongsi_분교.pdf … 로 온다(실측 44개).
    #    이걸 빼먹으면 396개 중 352개만 처리된다.
    jobs, cached = [], []
    for d in sorted(p for p in src.iterdir() if p.is_dir()):
        univ = C.nfc(d.name)
        for pdf in sorted(d.glob("*.pdf")):
            stem = C.nfc(pdf.stem)
            # 대부분은 susi.pdf / jeongsi.pdf 로 오지만,
            # 나중에 받은 몇 개는 '2027학년도_남해캠퍼스_수시모집요강.pdf' 같은 원래 이름이다.
            if stem.startswith("susi"):
                phase, campus = "susi", stem[4:].lstrip("_") or None
            elif stem.startswith("jeongsi"):
                phase, campus = "jeongsi", stem[7:].lstrip("_") or None
            elif "수시" in stem:
                phase, campus = "susi", None
            elif "정시" in stem:
                phase, campus = "jeongsi", None
            elif "모집요강" in stem:
                phase, campus = "tonghap", None      # 수시·정시 합본
            else:
                continue
            tag = f"_{campus}" if campus else ""
            out_path = out_dir / f"{univ}{tag}_{phase}.json"
            if out_path.exists() and not force:
                cached.append((univ, phase, campus, out_path))
                continue
            jobs.append((univ, phase, campus, pdf, out_path))
    if limit:
        jobs = jobs[:limit]

    results = []
    if jobs:
        with ProcessPoolExecutor(max_workers=workers) as ex:
            for i, res in enumerate(ex.map(_one, jobs), 1):
                results.append(res)
                if i % 25 == 0:
                    print(f"  … {i}/{len(jobs)}", flush=True)

    # 캐시된 것도 manifest 에 넣는다
    for univ, phase, campus, out_path in cached:
        try:
            d = json.load(open(out_path, encoding="utf-8"))
            results.append({"univ": univ, "phase": phase, "campus": campus,
                            "pages": len(d["pages"]),
                            "chars": sum(len(p["text"].strip()) for p in d["pages"]),
                            "scanned": False, "sha256": d.get("sha256"),
                            "file": d.get("file"), "out": str(out_path),
                            "cached": True})
        except Exception as e:
            results.append({"univ": univ, "phase": phase, "campus": campus,
                            "error": f"캐시 읽기 실패 {e}"})

    items, scanned, failed = [], [], []
    for r in results:
        r["univId"] = uid_by_name.get(r["univ"]) or matcher.match(r["univ"])
        rel = (f"{r['univ']}/{r['phase']}"
               + (f"_{r['campus']}" if r.get("campus") else "") + ".pdf")
        r["sourceUrl"] = url_by_file.get(rel)
        if r.get("error"):
            failed.append(r)
        elif r.get("scanned"):
            scanned.append(r)
        else:
            items.append(r)

    n_pdf = len(jobs) + len(cached)
    unmatched = sorted({r["univ"] for r in results if not r.get("univId")})
    C.jdump({"year": year, "srcDir": str(src), "pdfCount": n_pdf,
             "items": items, "scanned": scanned, "failed": failed,
             "unmatchedUnivs": unmatched, "manifestNotFound": n_notfound},
            out_dir / "_manifest.json")

    print("═" * 62)
    print(f"  PDF 대상            {n_pdf:>4}개 "
          f"(manifest '못 구함' {n_notfound}건은 애초에 파일이 없음)")
    print(f"  텍스트화 성공        {len(items):>4}개")
    print(f"  스캔본(OCR 미실시)   {len(scanned):>4}개")
    print(f"  실패                {len(failed):>4}개")
    print(f"  대학 수(텍스트 있음)  {len({r['univ'] for r in items}):>4}개")
    print(f"  univId 매칭 실패     {len(unmatched):>4}개 {unmatched[:8]}")
    if scanned:
        print("  스캔본:", ", ".join(
            f"{r['univ']}/{r['phase']}" + (f"({r['campus']})" if r.get("campus") else "")
            for r in scanned[:20]))
    if failed:
        for r in failed[:10]:
            print(f"    실패 {r['univ']}/{r['phase']}: {r.get('error')}")
    print("═" * 62)
    print(f"  → {out_dir}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2027)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--limit", type=int)
    a = ap.parse_args()
    run(a.year, a.force, a.workers, a.limit)
