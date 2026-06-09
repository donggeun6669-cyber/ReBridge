import argparse
import json
import re
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parent
PDF_DIR = ROOT / "pdf_sources" / "2028"
TEXT_DIR = ROOT / "text"
REPORT_DIR = ROOT / "reports"


def norm(value):
    return re.sub(r"[\s\[\]\(\)_\-·ㆍ,./]", "", value or "")


def parse_pdf_name(path):
    stem = path.stem
    name = stem.split("[", 1)[0]
    region_match = re.search(r"\[([^\]]+)\]", stem)
    campus_match = re.findall(r"\[([^\]]+)\]", stem)
    return {
        "file": path.name,
        "name": name,
        "region": region_match.group(1) if region_match else "",
        "campus": campus_match[1] if len(campus_match) > 1 else "",
    }


def load_universities():
    universities = json.loads((ROOT / "universities.json").read_text(encoding="utf-8"))
    by_name_region = {}
    by_name = {}
    for university in universities:
        if university.get("kind") != "대학교":
            continue
        name_key = norm(university["name"])
        region_key = norm(university.get("region", ""))
        by_name_region[(name_key, region_key)] = university
        by_name.setdefault(name_key, []).append(university)
    return by_name_region, by_name


def match_university(info, by_name_region, by_name):
    name_key = norm(info["name"])
    region_key = norm(info["region"])
    direct = by_name_region.get((name_key, region_key))
    if direct:
        return direct, "name+region"
    candidates = by_name.get(name_key, [])
    if len(candidates) == 1:
        return candidates[0], "name"
    return None, "unmatched"


def extract_pdf(path):
    rows = []
    with fitz.open(path) as doc:
        for page_index, page in enumerate(doc, start=1):
            text = page.get_text("text") or ""
            rows.append({"pdf": path.name, "page": page_index, "text": text})
    return rows


def main():
    parser = argparse.ArgumentParser(description="Extract page text from 2028 admissions PDFs.")
    parser.add_argument("--pdf-dir", default=str(PDF_DIR))
    parser.add_argument("--text-dir", default=str(TEXT_DIR))
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    pdf_dir = Path(args.pdf_dir)
    text_dir = Path(args.text_dir)
    text_dir.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    fitz.TOOLS.mupdf_display_errors(False)

    by_name_region, by_name = load_universities()
    manifest = []
    failures = []
    rows_by_univ = {}

    for pdf in sorted(pdf_dir.glob("*.pdf")):
        info = parse_pdf_name(pdf)
        university, match_method = match_university(info, by_name_region, by_name)
        if not university:
            failures.append(info)
            continue

        pages = extract_pdf(pdf)
        rows_by_univ.setdefault(university["univId"], []).extend(pages)
        page_count = len(pages)

        manifest.append(
            {
                "univId": university["univId"],
                "university": university["name"],
                "region": university.get("region", ""),
                "pdf": pdf.name,
                "match": match_method,
                "pages": page_count,
            }
        )

    if args.force:
        for old_file in text_dir.glob("*.jsonl"):
            old_file.unlink()

    for univ_id, rows in rows_by_univ.items():
        out_path = text_dir / f"{univ_id}.jsonl"
        if out_path.exists() and not args.force:
            continue
        with out_path.open("w", encoding="utf-8", newline="\n") as f:
            for row in rows:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")

    (REPORT_DIR / "pdf_text_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (REPORT_DIR / "pdf_match_failures.json").write_text(
        json.dumps(failures, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"PDFs matched: {len(manifest)}")
    print(f"PDFs unmatched: {len(failures)}")
    print(f"text dir: {text_dir}")
    if failures:
        print("See reports/pdf_match_failures.json")


if __name__ == "__main__":
    main()
