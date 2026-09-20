"""최종 요약 보고서 생성 → reports/final_report.md

통합 프롬프트 §9 가 요구한 숫자를 서로 섞지 않고 따로 센다.
숫자는 전부 정본 DB 에서 계산한다(추정·반올림한 진행률을 쓰지 않는다).
"""

import json
import re
from collections import Counter

from common import REPORT_DIR, connect, now, rawlib


def one(con, q, args=()):
    r = con.execute(q, args).fetchone()
    return r[0] if r else 0


def main():
    con = connect()
    L = []
    A = L.append
    A(f"# RAW 파싱 v3 — 최종 요약 보고 ({now()})")
    A("")
    A("범위: 원문 파싱 · 중간 구조화 · 검수 · 인계 문서. **앱 연결·점수 엔진·화면 변경은 하지 않았다.**")
    A("정본: `data-pipeline/parse_v3/work/parse_v3.sqlite` · 필드 뜻 `DATA_DICTIONARY.md` · 상태값 `README.md`")
    A("")

    # 1. 대학
    A("## 1. 대학")
    targets = rawlib.targets()
    with_docs = one(con, """SELECT count(DISTINCT f.university_id) FROM document_file f JOIN university_campus u
                            ON u.university_id=f.university_id WHERE u.in_target=1""")
    res_univ = one(con, "SELECT count(DISTINCT university_id) FROM outcome")
    rule_univ = one(con, """SELECT count(*) FROM (SELECT university_id FROM offering UNION SELECT university_id FROM eligibility_rule)""")
    A("| 항목 | 수 |")
    A("|---|---|")
    A(f"| 대상 대학(제외 16곳 뺀 마스터) | {len(targets)} |")
    A(f"| RAW 문서를 가진 대학 | {with_docs} |")
    A(f"| 입시결과 값이 만들어진 대학 | {res_univ} |")
    A(f"| 요강·시행계획 규칙(모집전형·자격)이 만들어진 대학 | {rule_univ} |")
    A(f"| 규칙 미처리 대학 | {len(targets) - rule_univ} |")
    A("")

    # 2. 문서
    A("## 2. 문서·파일")
    A("| 항목 | 수 |")
    A("|---|---|")
    A(f"| 물리 파일(manifest 확보 행) | {one(con, 'SELECT count(*) FROM document_file')} |")
    A(f"| 고유 문서(내용 해시) | {one(con, 'SELECT count(*) FROM document')} |")
    A(f"| 변환본↔원본 연결 | {one(con, 'SELECT count(*) FROM document WHERE converted_from IS NOT NULL')} |")
    for t, n in con.execute("SELECT document_type, count(*) FROM document GROUP BY 1 ORDER BY 2 DESC"):
        A(f"| 문서종류 {t} | {n} |")
    for t, n in con.execute("SELECT text_layer, count(*) FROM document GROUP BY 1"):
        A(f"| 텍스트층 {t} | {n} |")
    n_ocr_pages = one(con, "SELECT sum(CAST(detail AS INTEGER)) FROM processing_log WHERE stage='ocr'")
    A(f"| OCR 한 쪽(로컬 Vision) | {n_ocr_pages or 0} |")
    A("")
    A("### 처리 상태 (단계별 문서 수)")
    A("| 단계 | done | partial | held | failed | skipped |")
    A("|---|---|---|---|---|---|")
    stages = [r[0] for r in con.execute("SELECT DISTINCT stage FROM processing_log ORDER BY 1")]
    for st in stages:
        c = Counter({r[0]: r[1] for r in con.execute("SELECT status, count(*) FROM processing_log WHERE stage=? GROUP BY 1", (st,))})
        A(f"| {st} | {c['done']} | {c['partial']} | {c['held']} | {c['failed']} | {c['skipped']} |")
    A("")
    A("보류(held) 사유별:")
    for r in con.execute("""SELECT substr(detail, instr(detail,':')+2, 60), count(*) FROM processing_log
                            WHERE status='held' GROUP BY 1 ORDER BY 2 DESC LIMIT 8"""):
        A(f"- {r[0]} — {r[1]}건")
    A("")

    # 3. 구조화 결과
    A("## 3. 구조화 결과 (14개 논리 테이블)")
    A("| 테이블 | 행 | 근거 있음 | 검수 상태 |")
    A("|---|---|---|---|")
    facts = {"document": "document_id", "evidence": "evidence_id", "university_campus": "campus_id", "program": "program_id",
             "offering": "offering_id", "eligibility_rule": "eligibility_rule_id", "eligibility_condition": "condition_id",
             "evaluation_component": "component_id", "conversion_rule": "conversion_rule_id", "conversion_item": "item_id",
             "csat_minimum": "minimum_rule_id", "outcome": "outcome_id", "schedule_event": "event_id",
             "document_requirement": "requirement_id", "year_mapping": "mapping_id", "extension_fact": "fact_id",
             "candidate": "candidate_id"}
    for t, pk in facts.items():
        n = one(con, f"SELECT count(*) FROM {t}")
        try:
            ev = one(con, f"SELECT count(*) FROM {t} x WHERE EXISTS (SELECT 1 FROM evidence e WHERE e.target_table='{t}' AND e.target_record_id=x.{pk})")
        except Exception:  # noqa: BLE001
            ev = "-"
        try:
            rs = dict(con.execute(f"SELECT review_status, count(*) FROM {t} GROUP BY 1").fetchall())
        except Exception:  # noqa: BLE001
            rs = {}
        A(f"| {t} | {n} | {ev} | {rs or '-'} |")
    A("")

    # 4. 입시결과
    A("## 4. 입시결과 값")
    A("| 항목 | 수 |")
    A("|---|---|")
    A(f"| 값(한 칸 = 한 행) | {one(con, 'SELECT count(*) FROM outcome')} |")
    n_cls = one(con, "SELECT count(*) FROM outcome WHERE classification_status='auto_classified'")
    n_pend = one(con, "SELECT count(*) FROM outcome WHERE classification_status='pending'")
    A(f"| 분류 확정(집단·측정항목·통계가 열 제목으로 분명) | {n_cls} |")
    A(f"| 미분류(대기) | {n_pend} |")
    A(f"| 결과 학년도 미정 | {one(con, 'SELECT count(*) FROM outcome WHERE result_academic_year IS NULL')} |")
    n_ocr = one(con, "SELECT count(*) FROM outcome WHERE review_status='ocr'")
    A(f"| OCR 로 복원(사람 확인 전 계산 금지) | {n_ocr} |")
    A(f"| 값이 기호(▨·- 등)라 숫자가 없는 행 | {one(con, 'SELECT count(*) FROM outcome WHERE value_num IS NULL')} |")
    A("")
    A("측정항목별(상위 12):")
    for r in con.execute("SELECT COALESCE(metric,'(미분류)'), count(*) FROM outcome GROUP BY 1 ORDER BY 2 DESC LIMIT 12"):
        A(f"- {r[0]}: {r[1]}")
    A("")

    # 5. 규칙
    A("## 5. 지원자격·환산·수능최저")
    A(f"- 자격 규칙 {one(con, 'SELECT count(*) FROM eligibility_rule')}개 — " +
      ", ".join(f"{r[0]} {r[1]}" for r in con.execute("SELECT ged_acceptance, count(*) FROM eligibility_rule GROUP BY 1")))
    A(f"- 자격 조건(AND/OR 노드) {one(con, 'SELECT count(*) FROM eligibility_condition')}개")
    A(f"- 환산규칙 {one(con, 'SELECT count(*) FROM conversion_rule')}개 — 입력 종류별: " +
      ", ".join(f"{r[0]} {r[1]}" for r in con.execute("SELECT input_score_kind, count(*) FROM conversion_rule GROUP BY 1")))
    A(f"  - 계산 승인: " + ", ".join(f"{r[0]} {r[1]}" for r in con.execute("SELECT calc_approval, count(*) FROM conversion_rule GROUP BY 1")))
    A(f"  - 환산표 항목 {one(con, 'SELECT count(*) FROM conversion_item')}개")
    A(f"- 수능최저 {one(con, 'SELECT count(*) FROM csat_minimum')}개 — " +
      ", ".join(f"{r[0]} {r[1]}" for r in con.execute("SELECT minimum_exists, count(*) FROM csat_minimum GROUP BY 1")) +
      " / 승인: " + ", ".join(f"{r[0]} {r[1]}" for r in con.execute("SELECT calc_approval, count(*) FROM csat_minimum GROUP BY 1")))
    A("")

    # 6. 문제·남은 것
    A("## 6. 근거 누락·충돌·추가 원문 필요")
    A(f"- 근거가 하나도 없는 사실 행: " + ", ".join(
        f"{t} {one(con, f'SELECT count(*) FROM {t} x WHERE NOT EXISTS (SELECT 1 FROM evidence e WHERE e.target_table=? AND e.target_record_id=x.{pk})', (t,))}"
        for t, pk in [("offering", "offering_id"), ("eligibility_rule", "eligibility_rule_id"), ("conversion_rule", "conversion_rule_id"),
                      ("csat_minimum", "minimum_rule_id"), ("outcome", "outcome_id")]))
    held_txt = ", ".join(f"{t} {one(con, 'SELECT count(*) FROM ' + t + ' WHERE review_status=?', ('held',))}"
                         for t in ["offering", "eligibility_rule", "evaluation_component", "conversion_rule", "csat_minimum", "schedule_event", "document_requirement"])
    A(f"- 보류(held) 레코드: {held_txt}")
    A(f"- 수집 단계에서 못 구한 칸(추가 확보 필요): {one(con, 'SELECT count(*) FROM coverage_gap')} — " +
      ", ".join(f"{r[0]} {r[1]}" for r in con.execute("SELECT label, count(*) FROM coverage_gap GROUP BY 1")))
    n_year = one(con, "SELECT count(*) FROM document WHERE year_check IN ('mismatch','undetected')")
    A(f"- 학년도 확인 필요 문서(본문 연도 미검출·불일치): {n_year}")
    n_cmp = one(con, "SELECT count(*) FROM outcome WHERE comparability_status NOT IN ('unreviewed')")
    n_ym = one(con, "SELECT count(*) FROM year_mapping")
    A(f"- 비교 가능 여부 검토: 연도대응 {n_ym}건, 비교 가능으로 표시한 입시결과 {n_cmp}건 (이번 단계에서는 연도 간 비교 연결을 만들지 않았다)")
    A("")

    # 7. 검수 구분
    A("## 7. 검수 수준 (섞지 않는다)")
    A("| 수준 | 뜻 | 수 |")
    A("|---|---|---|")
    tot = lambda st: sum(one(con, f"SELECT count(*) FROM {t} WHERE review_status=?", (st,)) for t in
                         ["offering", "eligibility_rule", "evaluation_component", "conversion_rule", "csat_minimum",
                          "schedule_event", "document_requirement"])
    n_auto = one(con, "SELECT count(*) FROM outcome WHERE review_status='auto_validated'")
    A(f"| auto_validated | 표 파서가 만든 것(기계 검사만) | {n_auto} (입시결과) |")
    A(f"| agent_extracted | 에이전트 추출 + 근거 원문 기계 대조 통과 | {tot('agent_extracted')} |")
    A(f"| main_crosschecked | 메인이 쪽 이미지로 직접 대조 | {tot('main_crosschecked')} |")
    A(f"| human_confirmed | **사람 검수** | {tot('human_confirmed')} |")
    A(f"| held | 보류(근거 미확인 등) | {tot('held')} |")
    A("")
    A("> 전수 내용 검수는 하지 않았다. 사람이 확인한 레코드는 0건이며, 메인이 직접 본 것은 시험 사례 쪽뿐이다.")
    A("")

    # 8. 시험 사례
    tr = REPORT_DIR / "trial_report.md"
    if tr.exists():
        txt = tr.read_text(encoding="utf-8")
        A("## 8. 10개 대학 시험 사례")
        A(f"- PASS {len(re.findall(r'\\*\\*PASS\\*\\*', txt))} / FAIL {len(re.findall(r'\\*\\*FAIL\\*\\*', txt))} / NOT_RUN {len(re.findall(r'\\*\\*NOT_RUN\\*\\*', txt))}")
        A(f"- 자세한 내용: `reports/trial_report.md`")
        A("- 합격확률 정확도는 측정하지 않았다(그럴 데이터도 모델도 없다).")
        A("")

    A("## 9. 앱에 바로 쓰면 안 되는 자료")
    A("`후속_앱반영_필수규칙.md` 의 마지막 절을 그대로 따른다(승인되지 않은 환산·최저 규칙, 보류 레코드, 미분류 결과값, 후보 테이블, 대체 자료, 시행계획, OCR 값).")
    REPORT_DIR.mkdir(exist_ok=True)
    (REPORT_DIR / "final_report.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print("→ reports/final_report.md")


if __name__ == "__main__":
    main()
