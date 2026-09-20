"""10개 대학 시험 추출 — 통합 프롬프트 §7-B 의 8개 사례를 '원문 → 추출 레코드 → 적용범위'로 대조.

    python3 trial_check.py   → reports/trial_report.md

각 사례: PASS / FAIL / NOT_RUN(추출 레코드가 없어 확인 불가) + 근거(레코드 ID·문서·쪽).
숫자만 맞추는 하드코딩 테스트가 아니다: 원문 쪽의 표제·각주를 기준으로 레코드의 종류·범위·단계가 맞는지 본다.
메인이 쪽 이미지까지 직접 본 사례는 MAIN_VISUAL 에 적고, 해당 레코드 review_status 를 main_crosschecked 로 올린다.
"""

import json
import re

from common import REPORT_DIR, connect, now

TRIAL = ["uA0000109", "gachon", "skku", "sogang", "cnu", "kyonggi", "uA0002660", "uA0000463", "uA0000473", "uA0000547"]
NAMES = {"uA0000109": "명지대", "gachon": "가천대", "skku": "성균관대", "sogang": "서강대", "cnu": "충남대", "kyonggi": "경기대",
         "uA0002660": "인천대", "uA0000463": "동양미래대", "uA0000473": "명지전문대", "uA0000547": "충청대"}
# 메인이 쪽 이미지를 직접 보고 확인한 레코드: {record_id: 메모} — trial 실행 뒤 채운다(review_status 를 올리는 근거)
MAIN_VISUAL = {
    "conv:e58d136a500d76e1": "명지대 2027 수시 인쇄81/page_index82 render 확인: 검정고시 100→3등급/98점, 9구간·대상전형·계열별 반영과목 일치 (2026-09-20 메인)",
    "conv:ea1ba57e40e77c6a": "가천대 2027 수시 인쇄87/page_index86 render 확인: '비교내신 성적 반영 방법' 표의 입력은 실기고사 100점 환산 성적(각주 명시). 대상자는 실기우수자 중 검정고시 등 석차등급 반영 불가자 — 검정고시 점수 입력 아님 (2026-09-20 메인)",
    "conv:0118c39fb6900bcb": "동양미래대 2027 수시 인쇄17/page_index16 render 확인: 이수단위 국수영4·사과3·한국사2·기술가정3·체육2·도덕음악미술1, 평균환산점수 소수 첫째자리 반올림 → [표2] 등급 → 1,055−(55×등급), 출석성적 미산출 시 교과 100% (2026-09-20 메인)",
}


def ev_pages(con, tbl, rid):
    return [(r[0], r[1], r[2]) for r in con.execute(
        "SELECT document_id, page_index, value_status FROM evidence WHERE target_table=? AND target_record_id=?", (tbl, rid))]


def main():
    con = connect()
    res = []

    def add(no, title, verdict, detail, refs=None):
        res.append((no, title, verdict, detail, refs or []))

    # 1. 가천대 실기성적표
    rows = con.execute("SELECT * FROM conversion_rule WHERE university_id='gachon' AND academic_year=2027").fetchall()
    on_pages = []
    for r in rows:
        pages = {p for _, p, _ in ev_pages(con, "conversion_rule", r["conversion_rule_id"])}
        if pages & {85, 86}:
            on_pages.append((r, pages))
    if not rows:
        add(1, "가천대 2027 수시 86~87쪽 실기성적표 ≠ 검정고시 환산표", "NOT_RUN", "가천대 2027 환산규칙 레코드 없음")
    else:
        bad = [r for r, _ in on_pages if r["input_score_kind"] in ("ged_subject", "ged_average")]
        prac = [r for r, _ in on_pages if r["input_score_kind"] == "practical"]
        ged = [r for r in rows if r["input_score_kind"] in ("ged_subject", "ged_average")]
        if bad:
            add(1, "가천대 실기성적표", "FAIL", f"86~87쪽 근거인데 입력이 검정고시로 적힌 규칙 {len(bad)}개",
                [r["conversion_rule_id"] for r in bad])
        elif prac:
            add(1, "가천대 2027 수시 86~87쪽 실기성적표 ≠ 검정고시 환산표", "PASS",
                f"86~87쪽 표는 input_score_kind=practical {len(prac)}개(승인: {[r['calc_approval'] for r in prac]}). "
                f"검정고시 입력 규칙 {len(ged)}개는 다른 쪽 근거: "
                + "; ".join(f"{r['conversion_rule_id']}({r['input_score_kind']}, 쪽 {sorted({p for _, p, _ in ev_pages(con, 'conversion_rule', r['conversion_rule_id'])})}, {r['calc_approval']})" for r in ged),
                [r["conversion_rule_id"] for r in prac + ged])
        else:
            add(1, "가천대 실기성적표", "NOT_RUN", f"86~87쪽 근거 규칙 없음(가천대 환산 {len(rows)}개는 다른 쪽)",
                [r["conversion_rule_id"] for r in rows])

    # 2. 명지대 83쪽 100점→3등급/98점
    rows = con.execute("""SELECT r.*, i.input_raw, i.output_grade, i.output_points FROM conversion_rule r JOIN conversion_item i USING(conversion_rule_id)
                          WHERE r.university_id='uA0000109' AND r.academic_year=2027 AND r.input_score_kind LIKE 'ged%'
                          AND i.item_kind='band' AND i.input_raw IN ('100','100점')""").fetchall()
    if not rows:
        add(2, "명지대 2027 수시 83쪽 GED 100점→3등급/98점", "NOT_RUN", "명지대 검정고시 환산 구간 레코드 없음")
    else:
        r = rows[0]
        ok = r["output_grade"] == "3" and (r["output_points"] == 98)
        pages = {p for _, p, _ in ev_pages(con, "conversion_rule", r["conversion_rule_id"])}
        scope = r["scope_admissions"]
        add(2, "명지대 2027 수시 83쪽 GED 100점→3등급/98점·적용범위", "PASS" if ok and 82 in pages and scope not in (None, "null") else "FAIL",
            f"100 → {r['output_grade']}등급 / {r['output_points']}점, 근거 쪽 {sorted(pages)}(page_index; 1부터 83쪽=82), "
            f"적용전형 {scope}, 입력 {r['input_score_kind']}, 승인 {r['calc_approval']}({r['calc_block_reason']})",
            [r["conversion_rule_id"]])

    # 3. 동양미래대 17·20쪽
    rows = con.execute("SELECT * FROM conversion_rule WHERE university_id='uA0000463' AND academic_year=2027 AND input_score_kind LIKE 'ged%'").fetchall()
    if not rows:
        add(3, "동양미래대 2027 수시 17·20쪽 가중치·반올림·산식·출결", "NOT_RUN", "동양미래대 검정고시 환산 레코드 없음")
    else:
        best = None
        for r in rows:
            items = con.execute("SELECT subject, weight FROM conversion_item WHERE conversion_rule_id=? AND item_kind='subject_weight'",
                                (r["conversion_rule_id"],)).fetchall()
            w = {re.sub(r"[\s·・/,()]", "", i[0] or ""): i[1] for i in items}   # 가운뎃점 등 제거: 기술·가정 -> 기술가정
            bands = con.execute("SELECT count(*) FROM conversion_item WHERE conversion_rule_id=? AND item_kind='band'", (r["conversion_rule_id"],)).fetchone()[0]
            need = {"국어": 4, "수학": 4, "영어": 4, "사회": 3, "과학": 3, "한국사": 2, "기술가정": 3, "체육": 2}
            got = {k: v for k, v in w.items()}
            match = {k: any(k in s and got[s] == v for s in got) for k, v in need.items()}
            low = [s for s in got if re.search(r"도덕|음악|미술", s)]
            low_ok = low and all(got[s] == 1 for s in low)
            fr = (r["formula_raw"] or "").replace(",", "")   # 원문은 1,055 처럼 쉼표를 쓴다
            f_ok = "1055" in fr and "55" in fr
            round_ok = bool((r["rounding_stage"] or "") and r["decimal_places"] is not None)
            att_ok = bool(r["attendance_substitution"])
            score = sum(match.values()) + low_ok + f_ok + round_ok + att_ok + (bands > 0)
            if best is None or score > best[0]:
                best = (score, r, match, low_ok, f_ok, round_ok, att_ok, bands)
        score, r, match, low_ok, f_ok, round_ok, att_ok, bands = best
        pages = sorted({p for _, p, _ in ev_pages(con, "conversion_rule", r["conversion_rule_id"])})
        verdict = "PASS" if all(match.values()) and low_ok and f_ok and round_ok and att_ok and bands > 0 else "FAIL"
        add(3, "동양미래대 2027 수시 17·20쪽 가중치·반올림·산식·출결·모집시기", verdict,
            f"가중치 일치 {match}, 도덕·음악·미술=1 {low_ok}, 산식 1055−55×등급 {f_ok}({r['formula_raw']}), 반올림 단계·자릿수 {round_ok}"
            f"({r['rounding_stage']}, {r['decimal_places']}자리), 출결대체 {att_ok}, 등급구간 {bands}개, 시기 {r['scope_phase']}, 근거쪽 {pages}",
            [r["conversion_rule_id"]])

    # 4. 성균관대·서강대: 자격·대체서식·정성/정량 분리
    for uid in ("skku", "sogang"):
        el = con.execute("SELECT count(*), sum(ged_acceptance IN ('가능','조건부')), sum(ged_acceptance='미확인') FROM eligibility_rule WHERE university_id=? AND academic_year=2027", (uid,)).fetchone()
        sub = con.execute("""SELECT count(*) FROM document_requirement WHERE university_id=? AND academic_year=2027 AND
                             (substitute_form IS NOT NULL OR document_name_raw LIKE '%대체%') AND (applicant_condition LIKE '%검정%' OR raw_text LIKE '%검정%')""", (uid,)).fetchone()[0]
        qual = con.execute("SELECT count(*) FROM evaluation_component WHERE university_id=? AND academic_year=2027 AND assessment_mode='qualitative'", (uid,)).fetchone()[0]
        quant = con.execute("SELECT count(*) FROM evaluation_component WHERE university_id=? AND academic_year=2027 AND assessment_mode='quantitative'", (uid,)).fetchone()[0]
        # 학종(서류) 요소를 정량으로 적은 행 = 오류 후보
        wrong = con.execute("""SELECT count(*) FROM evaluation_component WHERE university_id=? AND academic_year=2027 AND assessment_mode='quantitative'
                               AND component IN ('서류') """, (uid,)).fetchone()[0]
        if el[0] == 0:
            add(4, f"{NAMES[uid]} 자격·대체서식·정성/정량 분리", "NOT_RUN", "자격 레코드 없음")
        else:
            verdict = "PASS" if el[1] and sub and qual and not wrong else "FAIL"
            add(4, f"{NAMES[uid]} 동등학력 자격·학생부 대체서식·학종 정성/교과 정량 분리", verdict,
                f"자격 규칙 {el[0]}(가능/조건부 {el[1]}, 미확인 {el[2]}), 검정고시 대체서식 요건 {sub}, 정성 요소 {qual}, 정량 요소 {quant}, 서류를 정량으로 적은 행 {wrong}")

    # 5. 충남대 2026 결과
    did = con.execute("SELECT document_id FROM document_file WHERE raw_path='2026/cnu_충남대학교/2026_입시결과_수시.pdf'").fetchone()[0]
    rows = con.execute("SELECT population_stage, metric, statistic_type, percentile_rank, component_scope, value_raw FROM outcome WHERE document_id=? AND program_name_raw='국어국문학과' AND admission_name_raw LIKE '%교과%일반%'", (did,)).fetchall()
    want = {("최초합격자", "내신등급", "평균", None): "2.43", ("최종등록자", "교과환산점수", "평균", None): "80.28",
            ("최종등록자", "교과환산점수", "분위값", 70.0): "79.22", ("최종등록자", "내신등급", "최저", None): "3.22",
            ("최종등록자", "내신등급", "분위값", 70.0): "3.08"}
    got = {(r[0], r[1], r[2], r[3]): r[5] for r in rows}
    comp = {r[4] for r in rows if r[1] in ("내신등급", "교과환산점수")}
    ok = all(got.get(k) == v for k, v in want.items()) and comp == {"면접 제외 교과성적(원문 각주)"}
    add(5, "충남대 2026 수시 결과: 최초합/최종등록, 평균/70%/최저, 교과(면접 제외) 분리", "PASS" if ok else ("NOT_RUN" if not rows else "FAIL"),
        f"국어국문학과(학생부교과[일반], 4쪽) 기대 5칸 vs 추출: " + ", ".join(f"{k}={got.get(k)}" for k in want) + f"; 점수 칸 component_scope={comp}")

    # 6. 수능최저 탐구 처리·논리식
    rows = con.execute(f"SELECT * FROM csat_minimum WHERE university_id IN ({','.join('?'*len(TRIAL))}) AND academic_year=2027", TRIAL).fetchall()
    if not rows:
        add(6, "수능최저: 탐구 과목 수·지정영역·한국사·AND/OR", "NOT_RUN", "시험 대학 2027 수능최저 레코드 없음")
    else:
        yes = [r for r in rows if r["minimum_exists"] == "yes"]
        no_expr = [r["minimum_rule_id"] for r in yes if not r["logical_expression"]]
        tamgu = [r for r in yes if re.search(r"탐구", r["raw_text"] or "")]
        tamgu_unhandled = [r["minimum_rule_id"] for r in tamgu if not (r["inquiry_as_one_domain"] or r["averaging_rule"])]
        suspicious = [r["minimum_rule_id"] for r in tamgu if re.search(r"2\s*과목", r["inquiry_as_one_domain"] or "") and not re.search(r"평균|각각|모두", (r["inquiry_as_one_domain"] or "") + (r["averaging_rule"] or ""))]
        verdict = "PASS" if not no_expr and not tamgu_unhandled and not suspicious else "FAIL"
        add(6, "수능최저: 탐구 두 과목을 두 영역으로 세지 않음·지정영역·한국사·AND/OR 보존", verdict,
            f"2027 최저 규칙 {len(rows)}개(있음 {len(yes)}, 없음 {sum(r['minimum_exists']=='no' for r in rows)}, 미상 {sum(r['minimum_exists']=='unknown' for r in rows)}). "
            f"논리식 없음 {len(no_expr)}, 탐구 처리 방식 빈칸 {len(tamgu_unhandled)}, 의심 {len(suspicious)}",
            no_expr + tamgu_unhandled + suspicious)

    # 7. 전문대 차수·정시군·정원공유·서류 조건
    rounds = {r[0]: r[1] for r in con.execute("""SELECT university_id, group_concat(DISTINCT round) FROM offering WHERE university_id IN
                  ('uA0000463','uA0000473','uA0000547') AND academic_year=2027 GROUP BY 1""")}
    groups = {r[0]: r[1] for r in con.execute("""SELECT university_id, group_concat(DISTINCT admission_group) FROM offering WHERE university_id IN
                  ('cnu','uA0002660') AND academic_year=2027 AND phase='정시' GROUP BY 1""")}
    seat_groups = con.execute(f"SELECT count(DISTINCT seat_group_id) FROM offering WHERE seat_group_id IS NOT NULL AND university_id IN ({','.join('?'*len(TRIAL))})", TRIAL).fetchone()[0]
    docs_cond = con.execute(f"""SELECT count(*) FROM document_requirement WHERE university_id IN ({','.join('?'*len(TRIAL))}) AND applicant_condition LIKE '%검정%'""", TRIAL).fetchone()[0]
    docs_hist = con.execute(f"""SELECT count(*) FROM document_requirement WHERE university_id IN ({','.join('?'*len(TRIAL))}) AND applicant_condition LIKE '%재학%'""", TRIAL).fetchone()[0]
    r_ok = all(v and re.search(r"1차", v) and re.search(r"2차", v) for v in rounds.values()) and len(rounds) == 3
    g_ok = all(v and re.search(r"[가나다]군", v) for v in groups.values()) and len(groups) == 2
    add(7, "전문대 수시1·2차 분리, 정시 군, 정원 공유, 재학 이력별 서류 조건", "PASS" if r_ok and g_ok and docs_cond else "FAIL",
        f"전문대 차수 {rounds}; 정시 군 {groups}; 정원공유 묶음 {seat_groups}개; 검정고시 조건 서류 {docs_cond}개(재학 이력 언급 {docs_hist}개)")

    # 8. 다른 연도·산식·집단 연결 차단
    linked = con.execute("SELECT count(*) FROM year_mapping WHERE comparable IN ('전체','일부')").fetchone()[0]
    comp = con.execute("SELECT count(*) FROM outcome WHERE comparability_status NOT IN ('unreviewed')").fetchone()[0]
    mixed_year = con.execute("SELECT count(*) FROM conversion_rule WHERE academic_year!=2027 AND document_id IN (SELECT document_id FROM document WHERE academic_years_detected LIKE '%2027%' AND academic_years_detected NOT LIKE '%2028%')").fetchone()[0]
    add(8, "연도·산식·지원자·점수 종류가 다른 자료를 같은 비교 대상으로 연결하지 않음", "PASS" if linked == 0 and comp == 0 and mixed_year == 0 else "FAIL",
        f"비교 가능으로 연결한 연도대응 {linked}개, 비교 가능으로 표시한 입시결과 {comp}개, 2027 문서 규칙을 다른 학년도로 적은 것 {mixed_year}개 "
        f"→ 이번 단계는 비교 연결을 만들지 않고 모두 '미검토'로 둔다(후속 규칙 문서 참조)")

    # 메인 눈 확인 반영
    for rid, memo in MAIN_VISUAL.items():
        for tbl in ("conversion_rule", "eligibility_rule", "evaluation_component", "csat_minimum", "document_requirement", "offering"):
            con.execute(f"UPDATE {tbl} SET review_status='main_crosschecked' WHERE rowid IN (SELECT rowid FROM {tbl} WHERE "
                        f"{ {'conversion_rule':'conversion_rule_id','eligibility_rule':'eligibility_rule_id','evaluation_component':'component_id','csat_minimum':'minimum_rule_id','document_requirement':'requirement_id','offering':'offering_id'}[tbl] }=?)", (rid,))
    con.commit()

    # 대학별 추출량
    lines = [f"# 10개 대학 시험 추출 대조 — {now()}", "",
             "> PASS = 원문 쪽의 표제·각주 기준으로 레코드의 종류·범위·단계가 맞음을 **자동 규칙으로** 확인. "
             "‘메인 눈 확인’ 칸이 있는 것만 쪽 이미지를 직접 봤다. 사람 검수는 아직 0건.", "",
             "| # | 사례 | 판정 | 내용 |", "|---|---|---|---|"]
    for no, title, v, d, refs in res:
        lines.append(f"| {no} | {title} | **{v}** | {d.replace('|', '/')} |")
    lines += ["", "## 대학별 추출 레코드 수 (2027·2028 규칙은 에이전트 추출 → 근거 원문 기계 대조, 입시결과는 표 파서)", "",
              "| 대학 | 모집전형 | 자격규칙 | 평가요소 | 환산규칙 | 수능최저 | 일정 | 제출서류 | 보류(held) | 입시결과 값 | 결과 분류 확정 |",
              "|---|---|---|---|---|---|---|---|---|---|---|"]
    for u in TRIAL:
        c = lambda t: con.execute(f"SELECT count(*) FROM {t} WHERE university_id=?", (u,)).fetchone()[0]
        held = sum(con.execute(f"SELECT count(*) FROM {t} WHERE university_id=? AND review_status='held'", (u,)).fetchone()[0]
                   for t in ("offering", "eligibility_rule", "evaluation_component", "conversion_rule", "csat_minimum", "schedule_event", "document_requirement"))
        oc = con.execute("SELECT count(*), sum(classification_status='auto_classified') FROM outcome WHERE university_id=?", (u,)).fetchone()
        lines.append(f"| {NAMES[u]} | {c('offering')} | {c('eligibility_rule')} | {c('evaluation_component')} | {c('conversion_rule')} | "
                     f"{c('csat_minimum')} | {c('schedule_event')} | {c('document_requirement')} | {held} | {oc[0]} | {oc[1] or 0} |")
    REPORT_DIR.mkdir(exist_ok=True)
    (REPORT_DIR / "trial_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    for no, title, v, d, refs in res:
        print(no, v, title)


if __name__ == "__main__":
    main()
