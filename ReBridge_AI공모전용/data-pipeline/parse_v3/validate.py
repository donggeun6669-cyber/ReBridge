"""정본 작업대 검증 → reports/validation_report.md

검사: ID·참조 무결성 / 중복 / 원문 근거 존재 / 열거값·타입·단위 / 환산 구간 경계·중첩 /
     계산 승인 조건 / 입시결과 집단·통계 분리 / 문서별 처리 상태.
자동 검사 통과는 '기계 검사 통과'일 뿐 내용 검수가 아니다(보고서에 그렇게 적는다).
"""

from collections import Counter

from common import REPORT_DIR, connect, now

FACTS = {"offering": "offering_id", "eligibility_rule": "eligibility_rule_id", "evaluation_component": "component_id",
         "conversion_rule": "conversion_rule_id", "csat_minimum": "minimum_rule_id", "schedule_event": "event_id",
         "document_requirement": "requirement_id", "outcome": "outcome_id"}
ENUMS = {
    ("*", "value_status"): {"confirmed", "not_published", "not_applicable", "not_found", "unreadable", "conflict", "pending"},
    ("*", "review_status"): {"unreviewed", "auto_validated", "agent_extracted", "main_crosschecked", "human_confirmed",
                             "rejected", "held", "ocr"},
    ("conversion_rule", "calc_approval"): {"approved", "blocked", "pending"},
    ("csat_minimum", "calc_approval"): {"approved", "blocked", "pending"},
    ("eligibility_rule", "ged_acceptance"): {"가능", "불가", "조건부", "미확인"},
    ("conversion_rule", "input_score_kind"): {"ged_subject", "ged_average", "school_record", "practical", "essay", "csat", "unknown"},
}


def main():
    con = connect()
    out = [f"# 검증 보고 (parse_v3) — {now()}", "",
           "> 이 보고는 **기계 검사** 결과다. 통과가 곧 원문 내용 검수 완료를 뜻하지 않는다(시험 대조는 `trial_report.md`).", ""]
    issues = Counter()

    def sec(t):
        out.extend(["", f"## {t}", ""])

    # 1. 참조 무결성
    sec("1. 참조 무결성")
    checks = [
        ("근거 → 문서 없음", "SELECT count(*) FROM evidence e LEFT JOIN document d USING(document_id) WHERE d.document_id IS NULL"),
        ("모집전형 → 모집단위 없음", "SELECT count(*) FROM offering o WHERE program_id IS NOT NULL AND program_id NOT IN (SELECT program_id FROM program)"),
        ("조건 → 자격규칙 없음", "SELECT count(*) FROM eligibility_condition c WHERE eligibility_rule_id NOT IN (SELECT eligibility_rule_id FROM eligibility_rule)"),
        ("환산항목 → 환산규칙 없음", "SELECT count(*) FROM conversion_item WHERE conversion_rule_id NOT IN (SELECT conversion_rule_id FROM conversion_rule)"),
        ("입시결과 → 문서 없음", "SELECT count(*) FROM outcome WHERE document_id NOT IN (SELECT document_id FROM document)"),
        ("문서파일 → 문서 없음", "SELECT count(*) FROM document_file WHERE document_id NOT IN (SELECT document_id FROM document)"),
    ]
    for tbl, pkc in FACTS.items():
        checks.append((f"근거 → {tbl} 행 없음(고아 근거)",
                       f"SELECT count(*) FROM evidence WHERE target_table='{tbl if tbl!='outcome' else 'outcome'}' AND target_record_id NOT IN (SELECT {pkc} FROM {tbl})"))
    out.append("| 검사 | 건수 |"); out.append("|---|---|")
    for name, q in checks:
        n = con.execute(q).fetchone()[0]
        out.append(f"| {name} | {n} |")
        issues["참조"] += n

    # 2. 근거 존재
    sec("2. 원문 근거 존재 (사실 행마다)")
    out.append("| 테이블 | 행 | 근거 없음 | confirmed인데 확인된 근거 없음 | 보류(held) |"); out.append("|---|---|---|---|---|")
    for tbl, pkc in FACTS.items():
        total = con.execute(f"SELECT count(*) FROM {tbl}").fetchone()[0]
        noev = con.execute(f"SELECT count(*) FROM {tbl} t WHERE NOT EXISTS (SELECT 1 FROM evidence e WHERE e.target_table='{tbl}' AND e.target_record_id=t.{pkc})").fetchone()[0]
        conf_noev = con.execute(f"""SELECT count(*) FROM {tbl} t WHERE value_status='confirmed' AND NOT EXISTS
            (SELECT 1 FROM evidence e WHERE e.target_table='{tbl}' AND e.target_record_id=t.{pkc} AND e.value_status='confirmed')""").fetchone()[0]
        held = con.execute(f"SELECT count(*) FROM {tbl} WHERE review_status='held'").fetchone()[0]
        out.append(f"| {tbl} | {total} | {noev} | {conf_noev} | {held} |")
        issues["근거"] += noev + conf_noev

    # 3. 열거값
    sec("3. 열거값")
    for (tbl, col), allowed in ENUMS.items():
        tbls = FACTS if tbl == "*" else {tbl: None}
        for t in tbls:
            try:
                bad = con.execute(f"SELECT {col}, count(*) FROM {t} GROUP BY 1").fetchall()
            except Exception:  # noqa: BLE001
                continue
            wrong = [(v, n) for v, n in bad if v not in allowed]
            if wrong:
                out.append(f"- {t}.{col} 이상값: {wrong}")
                issues["열거"] += sum(n for _, n in wrong)
    if not issues["열거"]:
        out.append("- 이상값 없음")

    # 4. 타입·범위 (입시결과)
    sec("4. 입시결과 값 범위(의심 목록 — 틀렸다는 뜻이 아니라 확인 대상. 후속_앱반영_필수규칙 R15)")
    rng = [
        # 표준편차는 값 자체가 아니라 흩어진 정도라 등급 범위(1~9)를 따르지 않는다 → 검사에서 뺀다
        ("내신등급인데 1~9 밖", "metric='내신등급' AND statistic_type!='표준편차' AND value_num IS NOT NULL AND (value_num<1 OR value_num>9)"),
        ("수능등급인데 1~9 밖", "metric='수능등급' AND statistic_type!='표준편차' AND value_num IS NOT NULL AND (value_num<1 OR value_num>9)"),
        ("백분위인데 0~100 밖", "metric='백분위' AND statistic_type!='표준편차' AND value_num IS NOT NULL AND (value_num<0 OR value_num>100)"),
        ("경쟁률 음수", "metric='경쟁률' AND value_num<0"),
        ("최저충족률 0~100 밖", "metric='최저충족률' AND value_num IS NOT NULL AND (value_num<0 OR value_num>100)"),
        ("환산등급인데 1~9 밖(0 = 미공개 표기 의심)", "metric='환산등급' AND statistic_type!='표준편차' AND value_num IS NOT NULL AND (value_num<1 OR value_num>9)"),
        ("점수·등급 지표인데 값이 0 (미공개 표기 의심 — 계산·평균 금지)",
         "metric IN ('내신등급','환산등급','수능등급','환산점수','교과환산점수','수능환산점수','백분위','표준점수','총점') AND value_num=0"),
    ]
    out.append("| 검사 | 건수 |"); out.append("|---|---|")
    for name, cond in rng:
        n = con.execute(f"SELECT count(*) FROM outcome WHERE {cond}").fetchone()[0]
        out.append(f"| {name} | {n} |")

    # 5. 집단·통계 분리
    sec("5. 입시결과 분류 상태 (집단·측정항목·통계를 한 칸에 섞지 않았는지)")
    out.append("| 분류 상태 | 값 수 |"); out.append("|---|---|")
    for s, n in con.execute("SELECT classification_status, count(*) FROM outcome GROUP BY 1"):
        out.append(f"| {s} | {n} |")
    n = con.execute("SELECT count(*) FROM outcome WHERE classification_status='auto_classified' AND metric IN ('내신등급','교과환산점수','환산점수','수능환산점수','백분위','표준점수','수능등급') AND statistic_type IS NULL").fetchone()[0]
    out.append(f"\n- 점수 지표인데 통계 종류 없이 auto_classified: {n}건 (0이어야 함)")
    issues["분리"] += n
    out.append("- 결과 학년도 미정(NULL) 값: " + str(con.execute("SELECT count(*) FROM outcome WHERE result_academic_year IS NULL").fetchone()[0]))
    out.append("- '최종등록' 집단을 최저로 바꾼 행은 규칙상 만들지 않는다(집단=population_stage, 통계=statistic_type 별도 칸).")

    # 6. 중복
    sec("6. 중복")
    d1 = con.execute("""SELECT count(*) FROM (SELECT document_id, university_id, header_path, row_label, value_raw, count(*) c
                        FROM outcome GROUP BY 1,2,3,4,5 HAVING c>1)""").fetchone()[0]
    d2 = con.execute("""SELECT count(*) FROM (SELECT university_id, academic_year, phase, round, admission_group, campus_id,
                        admission_name_raw, program_id, quota_type, count(*) c FROM offering GROUP BY 1,2,3,4,5,6,7,8,9 HAVING c>1)""").fetchone()[0]
    out.append(f"- 입시결과: 같은 문서·대학·열제목·행이름·값 묶음이 여러 번 = {d1}건 (같은 표가 여러 쪽에 반복 인쇄된 경우일 수 있어 확인 대상)")
    out.append(f"- 모집전형: 같은 자연키가 여러 문서에서 = {d2}건 (요강·시행계획 두 문서가 같은 전형을 담으면 정상)")

    # 7. 환산 규칙
    sec("7. 환산규칙·수능최저 계산 승인")
    for r in con.execute("SELECT input_score_kind, calc_approval, count(*) FROM conversion_rule GROUP BY 1,2"):
        out.append(f"- 환산 {r[0]} / {r[1]}: {r[2]}")
    bad = con.execute("""SELECT count(*) FROM conversion_rule WHERE calc_approval='approved' AND (scope_status!='confirmed' OR input_score_kind='unknown'
                         OR review_status='held')""").fetchone()[0]
    out.append(f"- 환산규칙 승인 조건 위반(approved 인데 범위 미확정·입력 불명·보류): {bad} (0이어야 함)")
    issues["승인"] += bad
    # 수능최저도 같은 잣대로 본다(예전에는 환산규칙만 검사해서 'unknown 인데 approved' 3건이 그대로 통과했다)
    badc = con.execute("""SELECT count(*) FROM csat_minimum WHERE calc_approval='approved' AND
                          (minimum_exists='unknown' OR review_status='held'
                           OR (minimum_exists='yes' AND (logical_expression IS NULL OR logical_expression='')))""").fetchone()[0]
    out.append(f"- 수능최저 승인 조건 위반(approved 인데 최저 유무 미상·논리식 없음·보류): {badc} (0이어야 함)")
    issues["승인"] += badc
    ov = 0   # **같은 과목(트랙)끼리만** 비교한다. 전형·계열별로 표가 나뉘면 같은 구간이 여러 번 나오는 것이 정상이다.
    for (rid,) in con.execute("SELECT conversion_rule_id FROM conversion_rule"):
        rows = con.execute("""SELECT subject, input_lower, input_upper, lower_inclusive, upper_inclusive FROM conversion_item
                              WHERE conversion_rule_id=? AND item_kind='band' AND input_lower IS NOT NULL
                              ORDER BY subject, input_lower""", (rid,)).fetchall()
        tracks = {}
        for r in rows:
            tracks.setdefault(r[0], []).append(r[1:])
        for bands in tracks.values():
            for x, y in zip(bands, bands[1:]):
                if x[1] is not None and (x[1] > y[0] or (x[1] == y[0] and x[3] and y[2])):
                    ov += 1
    out.append(f"- 환산 구간 겹침·경계 중복(같은 과목 안에서만 셈): {ov}")
    issues["구간"] += ov
    for r in con.execute("SELECT minimum_exists, calc_approval, count(*) FROM csat_minimum GROUP BY 1,2"):
        out.append(f"- 수능최저 {r[0]} / {r[1]}: {r[2]}")

    # 7-2. 출처(어느 도구가 넣었는가) — 정본에 쓰는 길은 merge_agent.py 하나뿐이어야 한다
    sec("7-2. 정본 행의 출처")
    out.append("정본 DB 에 값을 넣는 길은 **둘뿐**이다(2026-09-21 결정). 다른 경로로 들어온 값은 아무 검사도 받지 않은 값이다.")
    out.append("")
    out.append("| 길 | 무엇을 넣나 | 출처가 남는 곳 |")
    out.append("|---|---|---|")
    out.append("| `merge_agent.py` | 규칙·조건 계열(모집전형·자격·평가·환산·수능최저·일정·서류) | `merge_log` |")
    out.append("| `parse_results.py` · `parse_results_ocr.py` | 입시결과 표(`outcome`) | `outcome.document_id` + `processing_log(stage=results)` |")
    out.append("")
    no_src = 0
    out.append("| 표 | 전체 | 출처 기록 있음 | 출처 없음 |"); out.append("|---|---|---|---|")
    for tbl, idc in FACTS.items():
        try:
            total = con.execute(f"SELECT count(*) FROM {tbl}").fetchone()[0]
        except Exception:  # noqa: BLE001
            continue
        if tbl == "outcome":
            # 입시결과는 병합기가 아니라 표 파서가 직접 넣는다. 출처는 '어느 문서에서 나왔나'로 남는다.
            miss = con.execute("SELECT count(*) FROM outcome o LEFT JOIN document d USING(document_id) "
                               "WHERE d.document_id IS NULL").fetchone()[0]
        else:
            miss = con.execute(
                f"SELECT count(*) FROM {tbl} t WHERE NOT EXISTS "
                f"(SELECT 1 FROM merge_log m WHERE m.record_table=? AND m.record_id=t.{idc})", (tbl,)).fetchone()[0]
        out.append(f"| {tbl} | {total} | {total - miss} | {miss} |")
        no_src += miss
    out.append("")
    out.append(f"- **출처 기록이 없는 행: {no_src}**" + ("" if no_src else " ✔ 모든 값이 병합기를 거쳤다"))
    issues["출처"] += no_src
    out.append("")
    out.append("| 넣은 쪽 | 행 수 |"); out.append("|---|---|")
    for r in con.execute("SELECT agent, count(*) FROM merge_log GROUP BY 1 ORDER BY 2 DESC"):
        out.append(f"| {r[0]} | {r[1]} |")

    # 8. 문서 처리 상태
    sec("8. 문서별 처리 상태")
    out.append("| 단계 | 상태 | 문서 수 |"); out.append("|---|---|---|")
    for r in con.execute("SELECT stage, status, count(*) FROM processing_log GROUP BY 1,2 ORDER BY 1,2"):
        out.append(f"| {r[0]} | {r[1]} | {r[2]} |")

    sec("요약")
    out.append("| 분류 | 문제 수 |"); out.append("|---|---|")
    for k in ("참조", "근거", "열거", "분리", "승인", "구간", "출처"):
        out.append(f"| {k} | {issues[k]} |")
    REPORT_DIR.mkdir(exist_ok=True)
    (REPORT_DIR / "validation_report.md").write_text("\n".join(out) + "\n", encoding="utf-8")
    print(dict(issues))


if __name__ == "__main__":
    main()
