"""정본(SQLite) → 검토용 내보내기 + 데이터 사전.

    python3 export.py

- exports/<테이블>.csv  (utf-8-sig, 엑셀에서 바로 열림). outcome·evidence·candidate 는 크기 때문에 jsonl.gz 도 함께.
- exports/review_<목록>.csv  미공개·미확인·추출 실패·충돌·추가 확보 필요 목록
- DATA_DICTIONARY.md  schema.sql 주석에서 생성(스키마와 설명이 어긋나지 않게)
정본은 work/parse_v3.sqlite 하나다. 여기 파일은 언제든 다시 만든다.
"""

import csv
import gzip
import json
import re

from common import HERE, EXPORT_DIR, connect, now

TABLES = ["document", "document_file", "coverage_gap", "university_campus", "program", "offering", "eligibility_rule",
          "eligibility_condition", "evaluation_component", "conversion_rule", "conversion_item", "csat_minimum", "outcome",
          "schedule_event", "document_requirement", "year_mapping", "extension_fact", "evidence", "candidate", "processing_log"]
BIG = {"outcome", "evidence", "candidate"}


def dump(con, name, q, args=()):
    cur = con.execute(q, args)
    cols = [d[0] for d in cur.description]
    rows = cur.fetchall()
    with open(EXPORT_DIR / f"{name}.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(cols)
        w.writerows(rows)
    return len(rows), cols, rows


def dictionary():
    sql = (HERE / "schema.sql").read_text(encoding="utf-8")
    out = ["# 데이터 사전 (parse_v3) — schema.sql 에서 자동 생성", "",
           "상태값·ID 규칙은 `README.md`·`ID_POLICY.md`. 각 테이블 위 주석이 ‘한 행의 의미’다.", ""]
    head = re.search(r"^(-- .*\n)+", sql)
    if head:
        out += ["```", head.group(0).strip(), "```", ""]
    for m in re.finditer(r"((?:--[^\n]*\n)*)CREATE TABLE IF NOT EXISTS (\w+) \((.*?)\n\);", sql, re.S):
        comments, name, body = m.groups()
        out += [f"## {name}", ""]
        c = [l[2:].strip() for l in comments.splitlines() if l.strip().startswith("--") and not set(l.strip("- ─")) <= set()]
        c = [x for x in c if not re.fullmatch(r"─+.*─+", x)]
        if c:
            out += ["> " + " ".join(c), ""]
        out += ["| 필드 | 타입·제약 | 설명 |", "|---|---|---|"]
        for line in body.splitlines():
            line = line.rstrip(",")
            mm = re.match(r"\s*(\w+)\s+([A-Z][^-]*?)\s*,?\s*(--\s*(.*))?$", line)
            if mm and mm.group(1).upper() not in ("PRIMARY", "UNIQUE", "FOREIGN"):
                out.append(f"| `{mm.group(1)}` | {mm.group(2).strip().rstrip(',')} | {(mm.group(4) or '').replace('|', '/')} |")
            elif line.strip().startswith("--") and out[-1].startswith("|"):
                out[-1] = out[-1][:-2] + " " + line.strip()[2:].strip().replace("|", "/") + " |"
        out.append("")
    (HERE / "DATA_DICTIONARY.md").write_text("\n".join(out) + "\n", encoding="utf-8")


def main():
    EXPORT_DIR.mkdir(exist_ok=True)
    con = connect()
    summary = []
    for t in TABLES:
        try:
            n, cols, rows = dump(con, t, f"SELECT * FROM {t}")
        except Exception as e:  # noqa: BLE001
            summary.append((t, f"오류 {e}"))
            continue
        if t in BIG:
            with gzip.open(EXPORT_DIR / f"{t}.jsonl.gz", "wt", encoding="utf-8") as f:
                for r in rows:
                    f.write(json.dumps(dict(zip(cols, r)), ensure_ascii=False) + "\n")
        summary.append((t, n))
    # 검토 목록
    lists = {
        "review_추가확보필요": """SELECT u.university_name_normalized 대학, g.folder_year 연도, g.label 상태, g.reasons 사유
                               FROM coverage_gap g JOIN university_campus u ON u.university_id=g.university_id ORDER BY 1,2""",
        "review_문서처리_실패보류": """SELECT p.document_id, f.raw_path, p.stage, p.status, p.detail FROM processing_log p
                               LEFT JOIN (SELECT document_id, min(raw_path) raw_path FROM document_file GROUP BY 1) f USING(document_id)
                               WHERE p.status IN ('failed','held','partial') ORDER BY p.stage, f.raw_path""",
        "review_OCR필요문서": """SELECT d.document_id, min(f.raw_path) 경로, d.page_count, d.image_only_pages, d.text_layer FROM document d
                               JOIN document_file f USING(document_id) WHERE d.ocr_needed=1 GROUP BY d.document_id ORDER BY 2""",
        "review_학년도불일치문서": """SELECT d.document_id, min(f.raw_path) 경로, d.academic_years_claimed, d.academic_years_detected, d.year_check
                               FROM document d JOIN document_file f USING(document_id) WHERE d.year_check IN ('mismatch','undetected')
                               AND f.is_original_format_archive=0 GROUP BY d.document_id ORDER BY 2""",
        "review_보류레코드": """SELECT 'offering' t, offering_id id, university_id, academic_year, admission_name_raw 내용 FROM offering WHERE review_status='held'
                               UNION ALL SELECT 'eligibility_rule', eligibility_rule_id, university_id, academic_year, admission_name_raw FROM eligibility_rule WHERE review_status='held'
                               UNION ALL SELECT 'evaluation_component', component_id, university_id, academic_year, admission_name_raw FROM evaluation_component WHERE review_status='held'
                               UNION ALL SELECT 'conversion_rule', conversion_rule_id, university_id, academic_year, formula_raw FROM conversion_rule WHERE review_status='held'
                               UNION ALL SELECT 'csat_minimum', minimum_rule_id, university_id, academic_year, raw_text FROM csat_minimum WHERE review_status='held'
                               UNION ALL SELECT 'schedule_event', event_id, university_id, academic_year, raw_text FROM schedule_event WHERE review_status='held'
                               UNION ALL SELECT 'document_requirement', requirement_id, university_id, academic_year, document_name_raw FROM document_requirement WHERE review_status='held'""",
        "review_환산규칙_계산승인상태": """SELECT u.university_name_normalized 대학, r.academic_year, r.input_score_kind, r.output_score_kind, r.scope_admissions,
                               r.scope_status, r.calc_approval, r.calc_block_reason, r.review_status, r.conversion_rule_id FROM conversion_rule r
                               JOIN university_campus u USING(university_id) ORDER BY 1""",
        "review_입시결과_미분류표본": """SELECT university_id, result_academic_year, admission_name_raw, program_name_raw, header_path, value_raw, document_id
                               FROM outcome WHERE classification_status='pending' ORDER BY random() LIMIT 3000""",
    }
    for name, q in lists.items():
        n, _, _ = dump(con, name, q)
        summary.append((name, n))
    dictionary()
    (EXPORT_DIR / "_README.txt").write_text(
        f"만든 시각 {now()}\n정본: work/parse_v3.sqlite. 이 폴더는 검토용 사본이며 언제든 export.py 로 다시 만든다.\n" +
        "\n".join(f"{t}\t{n}" for t, n in summary) + "\n", encoding="utf-8")
    for t, n in summary:
        print(t, n)


if __name__ == "__main__":
    main()
