# 검증 보고 (parse_v3) — 2026-09-22T01:08:51

> 이 보고는 **기계 검사** 결과다. 통과가 곧 원문 내용 검수 완료를 뜻하지 않는다(시험 대조는 `trial_report.md`).


## 1. 참조 무결성

| 검사 | 건수 |
|---|---|
| 근거 → 문서 없음 | 0 |
| 모집전형 → 모집단위 없음 | 0 |
| 조건 → 자격규칙 없음 | 0 |
| 환산항목 → 환산규칙 없음 | 0 |
| 입시결과 → 문서 없음 | 0 |
| 문서파일 → 문서 없음 | 0 |
| 근거 → offering 행 없음(고아 근거) | 0 |
| 근거 → eligibility_rule 행 없음(고아 근거) | 0 |
| 근거 → evaluation_component 행 없음(고아 근거) | 0 |
| 근거 → conversion_rule 행 없음(고아 근거) | 0 |
| 근거 → csat_minimum 행 없음(고아 근거) | 0 |
| 근거 → schedule_event 행 없음(고아 근거) | 0 |
| 근거 → document_requirement 행 없음(고아 근거) | 0 |
| 근거 → outcome 행 없음(고아 근거) | 0 |

## 2. 원문 근거 존재 (사실 행마다)

| 테이블 | 행 | 근거 없음 | confirmed인데 확인된 근거 없음 | 보류(held) |
|---|---|---|---|---|
| offering | 80009 | 0 | 2 | 7139 |
| eligibility_rule | 533 | 0 | 0 | 9 |
| evaluation_component | 466 | 0 | 0 | 64 |
| conversion_rule | 74 | 0 | 0 | 4 |
| csat_minimum | 358 | 0 | 0 | 31 |
| schedule_event | 319 | 0 | 0 | 16 |
| document_requirement | 137 | 0 | 0 | 20 |
| outcome | 681113 | 0 | 0 | 0 |

## 3. 열거값

- 이상값 없음

## 4. 입시결과 값 범위(의심 목록 — 틀렸다는 뜻이 아니라 확인 대상. 후속_앱반영_필수규칙 R15)

| 검사 | 건수 |
|---|---|
| 내신등급인데 1~9 밖 | 6277 |
| 수능등급인데 1~9 밖 | 1332 |
| 백분위인데 0~100 밖 | 2105 |
| 경쟁률 음수 | 0 |
| 최저충족률 0~100 밖 | 0 |
| 환산등급인데 1~9 밖(0 = 미공개 표기 의심) | 643 |
| 점수·등급 지표인데 값이 0 (미공개 표기 의심 — 계산·평균 금지) | 5831 |

## 5. 입시결과 분류 상태 (집단·측정항목·통계를 한 칸에 섞지 않았는지)

| 분류 상태 | 값 수 |
|---|---|
| auto_classified | 547778 |
| pending | 133335 |

- 점수 지표인데 통계 종류 없이 auto_classified: 0건 (0이어야 함)
- 결과 학년도 미정(NULL) 값: 137688
- '최종등록' 집단을 최저로 바꾼 행은 규칙상 만들지 않는다(집단=population_stage, 통계=statistic_type 별도 칸).

## 6. 중복

- 입시결과: 같은 문서·대학·열제목·행이름·값 묶음이 여러 번 = 25466건 (같은 표가 여러 쪽에 반복 인쇄된 경우일 수 있어 확인 대상)
- 모집전형: 같은 자연키가 여러 문서에서 = 4693건 (요강·시행계획 두 문서가 같은 전형을 담으면 정상)

## 7. 환산규칙·수능최저 계산 승인

- 환산 csat / approved: 5
- 환산 csat / pending: 2
- 환산 essay / pending: 2
- 환산 ged_average / approved: 16
- 환산 ged_average / pending: 7
- 환산 ged_subject / approved: 9
- 환산 ged_subject / pending: 9
- 환산 practical / pending: 2
- 환산 school_record / approved: 13
- 환산 school_record / pending: 4
- 환산 unknown / blocked: 1
- 환산 unknown / pending: 4
- 환산규칙 승인 조건 위반(approved 인데 범위 미확정·입력 불명·보류): 0 (0이어야 함)
- 수능최저 승인 조건 위반(approved 인데 최저 유무 미상·논리식 없음·보류): 0 (0이어야 함)
- 환산 구간 겹침·경계 중복(같은 과목 안에서만 셈): 2
- 수능최저 no / approved: 137
- 수능최저 no / pending: 42
- 수능최저 unknown / blocked: 13
- 수능최저 yes / approved: 123
- 수능최저 yes / pending: 43

## 7-2. 정본 행의 출처

정본 DB 에 값을 넣는 길은 **둘뿐**이다(2026-09-21 결정). 다른 경로로 들어온 값은 아무 검사도 받지 않은 값이다.

| 길 | 무엇을 넣나 | 출처가 남는 곳 |
|---|---|---|
| `merge_agent.py` | 규칙·조건 계열(모집전형·자격·평가·환산·수능최저·일정·서류) | `merge_log` |
| `parse_results.py` · `parse_results_ocr.py` | 입시결과 표(`outcome`) | `outcome.document_id` + `processing_log(stage=results)` |

| 표 | 전체 | 출처 기록 있음 | 출처 없음 |
|---|---|---|---|
| offering | 80009 | 80009 | 0 |
| eligibility_rule | 533 | 533 | 0 |
| evaluation_component | 466 | 466 | 0 |
| conversion_rule | 74 | 74 | 0 |
| csat_minimum | 358 | 358 | 0 |
| schedule_event | 319 | 319 | 0 |
| document_requirement | 137 | 137 | 0 |
| outcome | 681113 | 681113 | 0 |

- **출처 기록이 없는 행: 0** ✔ 모든 값이 병합기를 거쳤다

| 넣은 쪽 | 행 수 |
|---|---|
| PY-OFF | 88121 |
| T2 | 3873 |
| E2 | 932 |
| E1 | 843 |
| A1 | 679 |
| T1 | 651 |
| E3 | 540 |
| E4 | 468 |
| E5 | 152 |
| MAIN | 5 |

## 8. 문서별 처리 상태

| 단계 | 상태 | 문서 수 |
|---|---|---|
| auto_offerings | done | 623 |
| auto_offerings | partial | 249 |
| candidates | done | 874 |
| candidates | partial | 11 |
| ocr | done | 339 |
| results | done | 1127 |
| results | held | 200 |
| results | partial | 111 |
| results_ocr | done | 72 |
| results_ocr | partial | 40 |
| textcache | done | 2589 |
| textcache | skipped | 101 |

## 요약

| 분류 | 문제 수 |
|---|---|
| 참조 | 0 |
| 근거 | 2 |
| 열거 | 0 |
| 분리 | 0 |
| 승인 | 0 |
| 구간 | 2 |
| 출처 | 0 |
