import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REPORT_DIR = ROOT / "reports"

NO_CSAT = re.compile(r"(수능\s*최저\s*학력\s*기준|최저\s*학력\s*기준).{0,40}(없음|미적용|해당\s*없음)", re.S)
HAS_CSAT = re.compile(r"(수능\s*최저\s*학력\s*기준|최저\s*학력\s*기준)", re.S)


def compact(text):
    return " ".join((text or "").split())


def guess_csat(text):
    value = compact(text)
    if NO_CSAT.search(value):
        return "없음"
    if HAS_CSAT.search(value):
        return "시행계획 확인 필요"
    return ""


def main():
    candidates_path = REPORT_DIR / "tier1_detail_candidates.json"
    tier1 = json.loads(candidates_path.read_text(encoding="utf-8"))
    out = []

    for university in tier1:
        field_rows = []
        for row in university.get("detailEvidenceSamples", []):
            categories = set(row.get("categories", []))
            preview = row.get("textPreview", "")
            field_rows.append(
                {
                    "pdf": row.get("pdf", ""),
                    "page": row.get("page"),
                    "fields": {
                        "csatMinimum": guess_csat(preview) if "csat_minimum" in categories else "",
                        "recruitCount": "표 확인 필요" if "recruit_count" in categories else "",
                        "evalMethod": "표 확인 필요" if "eval_method" in categories else "",
                        "comparativeGrade": "문구 확인 필요" if "comparative_grade" in categories else "",
                    },
                    "categories": row.get("categories", []),
                    "textPreview": preview,
                }
            )
        out.append(
            {
                "univId": university["univId"],
                "name": university["name"],
                "region": university["region"],
                "fieldCandidatePages": field_rows,
            }
        )

    out_json = REPORT_DIR / "tier1_field_candidates.json"
    out_json.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    md_lines = [
        "# Tier 1 상세 필드 후보",
        "",
        "> 이 문서는 값을 확정한 결과가 아니라, 수능최저/모집인원/전형방법을 확인할 페이지 후보입니다.",
        "",
    ]
    for university in out:
        md_lines.append(f"## {university['name']} ({university['region']})")
        if not university["fieldCandidatePages"]:
            md_lines.append("- 상세 후보 페이지 없음")
            md_lines.append("")
            continue
        for row in university["fieldCandidatePages"][:5]:
            fields = {k: v for k, v in row["fields"].items() if v}
            md_lines.append(f"- p.{row['page']} · {', '.join(row['categories'])}")
            if fields:
                md_lines.append(f"  - 후보: {json.dumps(fields, ensure_ascii=False)}")
            md_lines.append(f"  - 미리보기: {row['textPreview']}")
        md_lines.append("")
    out_md = REPORT_DIR / "tier1_field_candidates.md"
    out_md.write_text("\n".join(md_lines), encoding="utf-8")
    print(f"Wrote {out_json}")
    print(f"Wrote {out_md}")


if __name__ == "__main__":
    main()
