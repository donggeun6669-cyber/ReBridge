"""메인 세션이 원문(쪽 텍스트·쪽 이미지)을 직접 보고 확정·보정한 값.

에이전트 병합(`merge_agent.py`)은 같은 대학을 다시 병합하면 이전 레코드를 지우고 새로 넣는다.
그래서 **메인이 눈으로 확인해 고친 값은 여기 적어 두고, 병합 뒤에 이 스크립트를 다시 돌린다.**

    python3 main_review.py            # 전부 적용
    python3 main_review.py --list     # 무엇이 들어 있는지만 보기

규칙
- 여기 적는 값은 **원문에 있는 글자**여야 한다. 추정·보간·역산 금지.
- 각 항목에 `근거`(문서·쪽·원문 조각)와 `확인방법`(텍스트층 / 쪽 이미지)을 반드시 적는다.
- 적용하면 review_status='main_crosschecked' 가 되고, 근거에도 메인 확인 기록이 남는다.
"""

import argparse

from common import connect, now, PARSER_VERSION

REVIEWER = "main(Opus 5)"

# (테이블, 레코드ID, {칸: 값}, 근거설명, 확인방법)
FIXES = [
    ("csat_minimum", "csat:f662ae4764bb67ac",
     {"inquiry_as_one_domain": "true",
      "averaging_rule": "과학탐구 적용 시 2과목 모두 1등급 — 평균이 아니라 두 과목 각각이 1등급이어야 함",
      "inquiry_category": "과학탐구(2과목)",
      "required_domains": '["국어", "수학(기하, 미적분)", "영어", "과학탐구(2과목)"]'},
     "가천대 2027 수시모집요강 doc:e1141b707380d054 page_index=42(인쇄 43쪽) 수능최저학력기준 표 한의예과 행: "
     "'국어, 수학(기하, 미적분), 영어, 과학탐구(2과목) / 2개 영역 각 1등급 (과학탐구 적용 시 2과목 모두 1등급)'. "
     "같은 표 의예과·약학과는 '2과목 평균, 소수점 절사'로 규칙이 다르다 — 모집단위별로 분리 보존.",
     "텍스트층 전문 대조"),
    ("csat_minimum", "csat:183e84025d896666",
     {"inquiry_as_one_domain": "true", "inquiry_category": "과학탐구(2과목)"},
     "같은 표 의예과 행: '3개 영역 각 1등급 (과학탐구 적용 시 2과목 평균, 소수점 절사)'. "
     "과학탐구 2과목은 두 영역이 아니라 한 영역으로 센다.",
     "텍스트층 전문 대조"),
    ("csat_minimum", "csat:081013dd7cb73b6a",
     {"inquiry_as_one_domain": "true", "inquiry_category": "과학탐구(2과목)"},
     "같은 표 약학과 행: '3개 영역 등급 합 5 이내 (과학탐구 적용 시 2과목 평균, 소수점 절사)'.",
     "텍스트층 전문 대조"),
    ("csat_minimum", "WHERE university_id='cnu' AND scope_admission LIKE '%정시%' AND raw_text LIKE '%모집단위별 반영 영역에 응시한 자%'",
     {"minimum_exists": "unknown", "value_status": "pending", "calc_approval": "blocked",
      "calc_block_reason": "잘못 분류된 레코드 — 근거 원문은 수능최저학력기준이 아니라 지원자격이다(메인 원문 대조). 최저 유무는 이 근거로 알 수 없음",
      "logical_expression": None},
     "충남대 2027 정시모집요강 doc:cbb18c517321ad21 page_index=17 은 'Ⅳ-1. 수능(일반전형)' 의 '2. 지원자격' 항목이고, "
     "근거로 쓰인 '2027학년도 대학수학능력시험 모집단위별 반영 영역에 응시한 자 (탐구영역 2과목 응시)' 는 응시 요건이지 등급 기준이 아니다. "
     "같은 쪽 '모집단위별 반영 영역 중 1개 영역이라도 응시하지 않거나, 탐구영역 2과목 미만 응시자는 불합격 처리함' 도 응시 요건이다. "
     "에이전트가 '정시는 수능 100%라 응시 자체가 최저를 겸한다'고 적었는데 이는 원문에 없는 추론이므로 minimum_exists 를 unknown 으로 되돌린다.",
     "텍스트층 전문 대조"),
    ("csat_minimum", "csat:1683452bcfc276f3",
     {"logical_expression": '{"op": "best_n_sum", "n": 2, "domains": ["국어", "수학", "영어", "탐구(1과목)"], "limit": 7, "exceptions": {"동북아국제통상전공": {"limit": 6}}, "history": {"domain": "한국사", "condition": "응시"}}',
      "domain_count": 2, "grade_sum_limit": 7.0, "inquiry_as_one_domain": "true",
      "averaging_rule": "탐구영역은 상위 1개 과목 반영",
      "history_condition": "한국사는 최저학력기준 충족을 위한 과목에 포함되지 않으나 필수 응시하여야 함",
      "raw_text": "인문계열(동북아국제통상전공 제외), 자연계열, 디자인학부: 2개 영역 등급합 7 이내 / 동북아국제통상전공: 2개 영역 등급합 6 이내 (국어, 수학, 영어, 사회/과학탐구 상위 1과목 반영)",
      "calc_approval": "approved"},
     "인천대 2027 수시모집요강 doc:4195def6443fd92e page_index=11(12쪽) 3. 수능 최저학력기준 표: "
     "인문계열(동북아국제통상전공 제외), 자연계열, 디자인학부 2개 영역 등급합 7 이내 / 동북아국제통상전공 2개 영역 등급합 6 이내 (탐구 1과목).",
     "텍스트층 전문 대조"),
    ("csat_minimum", "csat:7c25c301ba6a5768",
     {"logical_expression": '{"op": "best_n_sum", "n": 3, "domains": ["국어", "수학", "영어", "탐구(2과목평균)"], "limit": 6, "exceptions": {"자유전공/글로벌/SW/약학": {"limit": 5}, "의예과": {"op": "all_sum", "n": 4, "limit": 5}}, "history": {"domain": "한국사", "condition": "응시"}}',
      "domain_count": 3, "grade_sum_limit": 6.0, "inquiry_as_one_domain": "true",
      "averaging_rule": "탐구 2과목 평균 등급 (제2외국어/한문 1과목 대체 가능, 의예 제외)",
      "history_condition": "한국사 필수 응시",
      "raw_text": "국어, 수학, 영어, 탐구(2개 과목 평균) 4개 영역 중 3개 등급합 6등급 이내 (자유전공·글로벌·SW·약학 등 5등급 이내, 의예 4개 합 5 이내)",
      "calc_approval": "approved"},
     "성균관대 2027 수시모집요강 doc:9e18aba3d8d52492 page_index=11(7쪽) 수능 최저학력기준 논술위주(언어형) 표.",
     "텍스트층 전문 대조"),
    ("csat_minimum", "csat:a6e30d83c81822f1",
     {"logical_expression": '{"op": "best_n_sum", "n": 3, "domains": ["국어", "수학", "영어", "탐구(2과목평균)"], "limit": 6, "exceptions": {"자유전공/글로벌/SW/약학": {"limit": 5}, "의예과": {"op": "all_sum", "n": 4, "limit": 5}}, "history": {"domain": "한국사", "condition": "응시"}}',
      "domain_count": 3, "grade_sum_limit": 6.0, "inquiry_as_one_domain": "true",
      "averaging_rule": "탐구 2과목 평균 등급",
      "history_condition": "한국사 필수 응시",
      "raw_text": "국어, 수학, 영어, 탐구(2개 과목 평균) 4개 영역 중 3개 등급합 6등급 이내 (자유전공·글로벌·SW·약학 등 5등급 이내, 의예 4개 합 5 이내)",
      "calc_approval": "approved"},
     "성균관대 2027 수시모집요강 doc:9e18aba3d8d52492 page_index=11(7쪽) 수능 최저학력기준 논술위주(수리형) 표.",
     "텍스트층 전문 대조"),
    ("csat_minimum", "csat:736a172c4c9120bd",
     {"logical_expression": '{"op": "domains_attempted", "n": 3, "domains": ["국어", "수학", "영어", "탐구(1과목)"], "history": "필수 응시"}',
      "inquiry_as_one_domain": "true", "averaging_rule": "탐구 1과목",
      "history_condition": "단, 한국사는 필수 응시",
      "calc_approval": "approved"},
     "서강대 2027 수시모집요강 doc:52fb054178619bc8 page_index=12 수능최저학력기준 응시영역 유의사항.",
     "텍스트층 전문 대조"),
    ("conversion_item",
     "WHERE* conversion_rule_id='conv:225940035afb64ff' AND item_kind='band' AND seq BETWEEN 1 AND 7",
     {"subject": "인문·자연계열"},
     "충남대 2027 수시모집요강 doc:53753c685016a406 page_index=90(인쇄 89쪽) '3. 학교생활기록부 비교평가 대상자 반영 방법 > 가. 검정고시 합격자' 표. "
     "같은 표에 '과목별반영점수(인문·자연계열)' 75/65/55/45/35/25/20 과 '과목별반영점수(예체능계열)' 75/70/65/60/55/50 두 줄이 있는데 "
     "계열 구분 없이 한 규칙에 섞여 들어가 같은 점수 구간이 겹치는 것처럼 보였다. 값은 그대로 두고 계열 이름만 붙인다.",
     "텍스트층 전문 대조"),
    ("conversion_item",
     "WHERE* conversion_rule_id='conv:225940035afb64ff' AND item_kind='band' AND seq BETWEEN 8 AND 13",
     {"subject": "예체능계열"},
     "같은 표의 '과목별반영점수(예체능계열)' 줄. 마지막 칸(50점)이 '70점 미만'으로 두 칸에 걸쳐 있어 보이므로 "
     "계산 승인은 올리지 않고 pending 으로 둔다 — 쪽 이미지 확인이 더 필요하다.",
     "텍스트층 전문 대조"),
    ("conversion_rule", "conv:e58d136a500d76e1",
     {"formula_raw": "[∑(반영교과별 반영과목 등급별 환산점수 × 이수학점(단위)) ÷ ∑(반영교과별 반영과목 이수학점(단위))] "
                     "＋ 가산점[반영교과 내 모든 이수과목 이수학점(단위)의 합 × 0.05]",
      "formula_structured": "{\"steps\": [{\"1\": \"반영과목별 검정고시 원점수 → 석차등급표의 '검정고시 점수' 구간 → 등급별 환산점수\"}, {\"2\": \"Σ(과목별 환산점수 × 과목별 이수학점(단위))\"}, {\"3\": \"위 합계 ÷ Σ(반영과목 이수학점(단위))\"}, {\"4\": \"＋ 가산점 = 반영교과 내 모든 이수과목 이수학점(단위)의 합 × 0.05  ← 나눗셈 바깥\"}, {\"5\": \"소수점 넷째 자리에서 반올림\"}], \"expression\": \"(Σ(환산점수×이수학점) ÷ Σ(이수학점)) + (모든 이수과목 이수학점 합 × 0.05)\", \"ged_unit_per_subject\": 8, \"example_full_marks_humanities\": {\"subjects\": [\"국어\", \"수학\", \"영어\", \"사회\"], \"per_subject_converted\": 98, \"weighted_mean\": 98.0, \"bonus\": 1.6, \"result\": 99.6}}",
      "operation_order": "1) 과목별 원점수→등급→환산점수  2) 환산점수×이수학점 합산  3) 이수학점 합으로 나눔  "
                         "4) 가산점을 **나눗셈 바깥에서** 더함  5) 소수점 넷째 자리에서 반올림"},
     "명지대 2027 수시모집요강 doc:66be3871cd081e40 page_index=83(인쇄 81쪽) '■ 교과 성적 산출식'. "
     "쪽 이미지를 확대해 확인한 결과 **분수선이 '＋가산점' 앞에서 끝나고 가산점이 분수 오른쪽에 위치**한다. "
     "즉 가산점은 나눗셈 바깥에서 더한다. 기존 formula_raw 는 'Σ(...) + 가산점[...] all / Σ(...)' 로 적혀 있어 "
     "가산점이 분자에 들어간 것처럼 읽혔다. 검정고시 만점(인문사회 국·수·영·사, 과목별 이수학점 8)일 때 "
     "바깥: 98+1.6=99.6 / 분자 안: (3136+1.6)/32=98.05 로 1,000점 만점 환산 시 15.5점 차이가 난다. "
     "같은 쪽 각주: '가산점 반영 시 진로선택과목을 포함한 반영교과 내 모든 이수과목 이수학점의 합을 적용함', "
     "'검정고시 합격자 반영과목별 이수학점(단위): 8', '소수점 넷째자리에서 반올림'. "
     "적용 전형 범위는 아직 12개 세부전형 전부를 대조하지 못했으므로 calc_approval 은 pending 그대로 둔다.",
     "쪽 이미지 확대 확인"),
    ("offering", "WHERE* university_id IN ('uA0000109','skku') AND academic_year=2027 "
                 "AND document_id IN ('doc:66be3871cd081e40','doc:9e18aba3d8d52492') "
                 "AND admission_name_raw IN ('학생부교과(교과면접전형)','학생부종합(탐구인재)','학생부종합(융합인재)')",
     {"value_status": "confirmed"},
     "메인이 원문 쪽을 직접 열어 확인한 모집인원 3건(명지대 경영학부 18명 / 성균관대 인문과학계열 탐구인재 25명·융합인재 30명). "
     "2026-09-20 정답 묶음 대조에서 이 값들이 정본에 아예 없던 것이 드러나 직접 넣었다. "
     "근거: 명지대 doc:66be3871cd081e40 page_index 21, 성균관대 doc:9e18aba3d8d52492 page_index 27·28.",
     "텍스트층 전문 대조"),
]

PK = {"offering": "offering_id", "csat_minimum": "minimum_rule_id", "conversion_rule": "conversion_rule_id", "conversion_item": "item_id", "offering": "offering_id",
      "eligibility_rule": "eligibility_rule_id", "evaluation_component": "component_id",
      "schedule_event": "event_id", "document_requirement": "requirement_id", "outcome": "outcome_id"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    if a.list:
        for t, rid, vals, why, how in FIXES:
            print(f"{t} {rid}\n  칸: {', '.join(vals)}\n  근거: {why}\n  확인: {how}\n")
        return
    con = connect()
    applied = missing = 0
    for t, key, vals, why, how in FIXES:
        # key 가 'WHERE …' 면 조건으로 찾는다. 원문 수정으로 ID 가 바뀌어도 보정이 살아 있게 하기 위함.
        multi = key.startswith("WHERE* ")
        if multi:
            key = "WHERE " + key[len("WHERE* "):]
        if key.startswith("WHERE "):
            found = [r[0] for r in con.execute(f"SELECT {PK[t]} FROM {t} {key}")]
            if not found:
                print(f"[없음] {t} {key[:60]}… — 해당 레코드 없음")
                missing += 1
                continue
            if len(found) > 1 and not multi:
                print(f"[여러 개] {t} {key[:60]}… — {len(found)}개가 걸려 적용하지 않음(조건을 좁혀라)")
                missing += 1
                continue
            if multi:
                sets = ", ".join(f"{k}=?" for k in vals)
                con.execute(f"UPDATE {t} SET {sets} WHERE {PK[t]} IN ({','.join('?' * len(found))})",
                            (*vals.values(), *found))
                print(f"[여러 행] {t} {len(found)}행에 {', '.join(vals)} 적용")
                applied += 1
                continue
            rid = found[0]
        else:
            rid = key
        if not con.execute(f"SELECT 1 FROM {t} WHERE {PK[t]}=?", (rid,)).fetchone():
            print(f"[없음] {t} {rid} — 병합이 아직 안 됐거나 ID가 바뀌었다")
            missing += 1
            continue
        sets = ", ".join(f"{k}=?" for k in vals) + ", review_status='main_crosschecked'"
        con.execute(f"UPDATE {t} SET {sets} WHERE {PK[t]}=?", (*vals.values(), rid))
        con.execute("""INSERT OR REPLACE INTO evidence (evidence_id, document_id, target_table, target_record_id, target_field,
            page_index, raw_text, footnote_text, value_status, extraction_method, extractor_version, review_status, reviewer, reviewed_at)
            SELECT 'ev:main:' || ?, document_id, ?, ?, ?, page_index, raw_text,
                   ? , 'confirmed', 'main_read', ?, 'main_crosschecked', ?, ?
            FROM evidence WHERE target_table=? AND target_record_id=? LIMIT 1""",
                    (rid, t, rid, ",".join(vals), f"[메인 확인 {how}] {why}", f"main_review {PARSER_VERSION}", REVIEWER, now(), t, rid))
        applied += 1
    con.commit()
    print(f"적용 {applied} / 대상 {len(FIXES)} / 레코드 없음 {missing}")


if __name__ == "__main__":
    main()
