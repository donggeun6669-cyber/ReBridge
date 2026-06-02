import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
TEXT_DIR = ROOT / "text"
EVIDENCE_DIR = ROOT / "evidence"
REPORT_DIR = ROOT / "reports"

KEYWORDS = {
    "eligibility": [
        r"지원\s*자격",
        r"검정\s*고시",
        r"동등\s*이상.*학력",
        r"고등학교\s*졸업",
        r"학교장\s*추천",
        r"졸업\s*예정자",
        r"재학생",
    ],
    "csat_minimum": [r"수능\s*최저", r"최저\s*학력\s*기준"],
    "recruit_count": [r"모집\s*인원", r"모집\s*단위", r"모집\s*정원"],
    "eval_method": [r"전형\s*방법", r"사정\s*방법", r"반영\s*비율", r"면접", r"서류"],
    "comparative_grade": [r"비교\s*내신", r"검정\s*고시.*환산", r"교과\s*성적.*반영"],
}


def read_jsonl(path):
    with path.open(encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


def main():
    parser = argparse.ArgumentParser(description="Build keyword evidence pages from extracted PDF text.")
    parser.add_argument("--text-dir", default=str(TEXT_DIR))
    parser.add_argument("--evidence-dir", default=str(EVIDENCE_DIR))
    args = parser.parse_args()

    text_dir = Path(args.text_dir)
    evidence_dir = Path(args.evidence_dir)
    evidence_dir.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    compiled = {
        label: [re.compile(pattern) for pattern in patterns] for label, patterns in KEYWORDS.items()
    }
    summary = []

    for text_file in sorted(text_dir.glob("*.jsonl")):
        evidence_rows = []
        for row in read_jsonl(text_file):
            text = row.get("text", "")
            hits = {}
            for label, patterns in compiled.items():
                found = sorted({pattern.pattern for pattern in patterns if pattern.search(text)})
                if found:
                    hits[label] = found
            if hits:
                evidence_rows.append(
                    {
                        "pdf": row.get("pdf", ""),
                        "page": row["page"],
                        "categories": sorted(hits),
                        "hits": hits,
                        "text": text,
                    }
                )

        out_path = evidence_dir / text_file.name
        with out_path.open("w", encoding="utf-8", newline="\n") as f:
            for row in evidence_rows:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        summary.append(
            {
                "univId": text_file.stem,
                "evidencePages": len(evidence_rows),
            }
        )

    (REPORT_DIR / "evidence_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Evidence files: {len(summary)}")
    print(f"Total evidence pages: {sum(row['evidencePages'] for row in summary)}")


if __name__ == "__main__":
    main()
