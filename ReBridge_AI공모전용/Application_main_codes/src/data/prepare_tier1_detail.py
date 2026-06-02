import json
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
EVIDENCE_DIR = ROOT / "evidence"
REPORT_DIR = ROOT / "reports"

METRO_REGIONS = {"서울", "경기", "인천"}
FLAGSHIP_NAMES = {
    "강원대학교",
    "경북대학교",
    "경상국립대학교",
    "국립공주대학교",
    "국립군산대학교",
    "국립금오공과대학교",
    "국립목포대학교",
    "국립부경대학교",
    "국립순천대학교",
    "국립창원대학교",
    "국립한국교통대학교",
    "국립한국해양대학교",
    "국립한밭대학교",
    "부산대학교",
    "전남대학교",
    "전북대학교",
    "제주대학교",
    "충남대학교",
    "충북대학교",
}


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def read_jsonl(path):
    with Path(path).open(encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


def short_text(text, limit=700):
    value = " ".join((text or "").split())
    return value[:limit]


def main():
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    universities = load_json(ROOT / "universities.json")
    admissions = load_json(ROOT / "admissions.json")
    admissions_by_univ = defaultdict(list)
    for row in admissions:
        admissions_by_univ[row["univId"]].append(row)

    tier1 = []
    for university in universities:
        if university.get("kind") != "대학교":
            continue
        if university.get("region") in METRO_REGIONS or university.get("name") in FLAGSHIP_NAMES:
            evidence_path = EVIDENCE_DIR / f"{university['univId']}.jsonl"
            if not evidence_path.exists():
                continue
            evidence_rows = list(read_jsonl(evidence_path))
            category_counts = Counter()
            sample_rows = []
            for row in evidence_rows:
                category_counts.update(row.get("categories", []))
                if any(
                    cat in row.get("categories", [])
                    for cat in ("csat_minimum", "recruit_count", "eval_method", "comparative_grade")
                ):
                    sample_rows.append(
                        {
                            "pdf": row.get("pdf", ""),
                            "page": row.get("page"),
                            "categories": row.get("categories", []),
                            "textPreview": short_text(row.get("text", "")),
                        }
                    )
            tier1.append(
                {
                    "univId": university["univId"],
                    "name": university["name"],
                    "region": university.get("region", ""),
                    "admissionRows": len(admissions_by_univ.get(university["univId"], [])),
                    "evidencePages": len(evidence_rows),
                    "categoryCounts": dict(category_counts),
                    "detailEvidenceSamples": sample_rows[:8],
                }
            )

    tier1.sort(key=lambda row: (row["region"], row["name"]))
    out_json = REPORT_DIR / "tier1_detail_candidates.json"
    out_json.write_text(json.dumps(tier1, ensure_ascii=False, indent=2), encoding="utf-8")

    out_md = REPORT_DIR / "tier1_detail_candidates.md"
    lines = [
        "# Tier 1 상세 추출 후보",
        "",
        "| 대학 | 지역 | 전형 행 | 근거 페이지 | 수능최저 | 모집인원 | 전형방법 | 비교내신 |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for row in tier1:
        counts = row["categoryCounts"]
        lines.append(
            "| {name} | {region} | {admissionRows} | {evidencePages} | {csat} | {recruit} | {eval} | {compare} |".format(
                name=row["name"],
                region=row["region"],
                admissionRows=row["admissionRows"],
                evidencePages=row["evidencePages"],
                csat=counts.get("csat_minimum", 0),
                recruit=counts.get("recruit_count", 0),
                eval=counts.get("eval_method", 0),
                compare=counts.get("comparative_grade", 0),
            )
        )
    out_md.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Tier 1 candidates: {len(tier1)}")
    print(f"Wrote {out_json}")
    print(f"Wrote {out_md}")


if __name__ == "__main__":
    main()
