"""Phase A — 시행계획 PDF를 페이지별 텍스트로 만든다. (LLM 없음, 비용 0)

`추출방법_확정.md`에서 검증된 방식을 그대로 쓴다.
  - 2028 PDF 185개 중 182개가 텍스트 기반 → OCR은 예외 3개(경희·이화·순천)만
  - PyMuPDF(fitz)가 가장 빠르고 정확

산출: v2/out/text/{year}/{univId}.jsonl   (한 줄 = {"page":1,"text":"..."})
      한 번 만들면 재사용한다. 다시 만들려면 --force.

실행:
  python3 v2/extract_text.py --year 2028
  python3 v2/extract_text.py --year 2027 --pdf-dir ~/Desktop/2027_시행계획
"""

import argparse
import json
import re
from pathlib import Path

import fitz                      # PyMuPDF

import common as C

fitz.TOOLS.mupdf_display_errors(False)      # 폰트 경고 억제


def pdf_pages(path):
    """PDF → [(page_no, text)]. 1-based 페이지 번호."""
    out = []
    with fitz.open(path) as doc:
        for i, page in enumerate(doc, start=1):
            out.append((i, C.nfc(page.get_text("text"))))
    return out


def looks_scanned(pages, min_chars=200):
    """텍스트가 거의 없으면 스캔본 → OCR 필요 목록으로 뺀다."""
    total = sum(len(t.strip()) for _, t in pages)
    return total < min_chars * max(1, len(pages) // 10)


def run(year, pdf_dir=None, force=False):
    pdf_dir = Path(pdf_dir).expanduser() if pdf_dir else (C.PDF_ROOT / str(year))
    if not pdf_dir.is_dir():
        raise SystemExit(f"PDF 폴더가 없습니다: {pdf_dir}")

    out_dir = C.OUT / "text" / str(year)
    out_dir.mkdir(parents=True, exist_ok=True)

    matcher = C.UnivMatcher()
    pdfs = sorted(p for p in pdf_dir.rglob("*.pdf"))
    manifest, scanned, unmatched = [], [], []

    for p in pdfs:
        meta = C.parse_plan_filename(p.name)         # NFC 정규화 포함 (맥 NFD 함정)
        uid = matcher.match(meta["name"], region=meta["region"])
        if not uid:
            unmatched.append(p.name)
            continue

        # 같은 대학의 캠퍼스별 PDF가 서로를 덮어쓰지 않게 한다
        suffix = ""
        if meta["campus"] and meta["campus"] not in ("본교",):
            suffix = "_" + re.sub(r"\W+", "", meta["campus"])
        dst = out_dir / f"{uid}{suffix}.jsonl"
        if dst.exists() and not force:
            manifest.append({"univId": uid, "file": p.name, "cached": True})
            continue

        try:
            pages = pdf_pages(p)
        except Exception as e:
            unmatched.append(f"{p.name} (열기 실패: {e})")
            continue

        if looks_scanned(pages):
            scanned.append(p.name)

        with open(dst, "w", encoding="utf-8") as f:
            for no, text in pages:
                f.write(json.dumps({"page": no, "text": text}, ensure_ascii=False) + "\n")

        manifest.append({
            "univId": uid, "univ": matcher.name_of(uid), "file": p.name,
            "path": str(p), "pages": len(pages), "sha256": C.sha256(p),
            "scanned": p.name in scanned,
        })

    C.jdump({"year": year, "pdfDir": str(pdf_dir), "items": manifest,
             "scanned": scanned, "unmatched": unmatched},
            out_dir / "_manifest.json")

    print(f"PDF {len(pdfs)}개 → 텍스트화 {len(manifest)}개")
    print(f"  대학 매칭 실패 {len(unmatched)}개")
    for n in unmatched[:10]:
        print(f"    - {n}")
    if scanned:
        print(f"  ⚠️ 스캔본(OCR 필요) {len(scanned)}개: {scanned[:5]}")
    print(f"  → {out_dir}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--pdf-dir", help="기본값: src/data/pdf_sources/{year}")
    ap.add_argument("--force", action="store_true", help="캐시 무시하고 다시 추출")
    a = ap.parse_args()
    run(a.year, a.pdf_dir, a.force)
