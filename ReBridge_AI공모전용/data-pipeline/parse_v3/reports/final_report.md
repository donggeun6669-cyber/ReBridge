# RAW 파싱 v3 — 최종 요약 보고 (2026-09-20T16:51:59)

범위: 원문 파싱 · 중간 구조화 · 검수 · 인계 문서. **앱 연결·점수 엔진·화면 변경은 하지 않았다.**
정본: `data-pipeline/parse_v3/work/parse_v3.sqlite` · 필드 뜻 `DATA_DICTIONARY.md` · 상태값 `README.md`

## 1. 대학
| 항목 | 수 |
|---|---|
| 대상 대학(제외 16곳 뺀 마스터) | 335 |
| RAW 문서를 가진 대학 | 335 |
| 입시결과 값이 만들어진 대학 | 320 |
| 요강·시행계획 규칙(모집전형·자격)이 만들어진 대학 | 38 |
| 규칙 미처리 대학 | 297 |

## 2. 문서·파일
| 항목 | 수 |
|---|---|
| 물리 파일(manifest 확보 행) | 2739 |
| 고유 문서(내용 해시) | 2690 |
| 변환본↔원본 연결 | 445 |
| 문서종류 입시결과 | 1764 |
| 문서종류 모집요강 | 539 |
| 문서종류 시행계획 | 387 |
| 텍스트층 None | 101 |
| 텍스트층 image_only | 143 |
| 텍스트층 partial | 443 |
| 텍스트층 text | 2003 |
| OCR 한 쪽(로컬 Vision) | 1878 |

### 처리 상태 (단계별 문서 수)
| 단계 | done | partial | held | failed | skipped |
|---|---|---|---|---|---|
| candidates | 874 | 11 | 0 | 0 | 0 |
| ocr | 339 | 0 | 0 | 0 | 0 |
| results | 1127 | 111 | 200 | 0 | 0 |
| results_ocr | 72 | 40 | 0 | 0 | 0 |
| textcache | 2589 | 0 | 0 | 0 | 101 |

보류(held) 사유별:
- 이미지 표 — OCR 텍스트만 있어 표 구조 추출 안 함(수작업·렌더 판독 필요) — 97건
- 형식 IMAGE 표 추출 대상 아님 — 74건
- 형식 HWP 표 추출 대상 아님 — 23건
- 형식 JSON 표 추출 대상 아님 — 6건

## 3. 구조화 결과 (14개 논리 테이블)
| 테이블 | 행 | 근거 있음 | 검수 상태 |
|---|---|---|---|
| document | 2690 | 0 | - |
| evidence | 688198 | 0 | {'auto_validated': 679799, 'held': 964, 'main_crosschecked': 8, 'unreviewed': 7427} |
| university_campus | 351 | 0 | - |
| program | 672 | 0 | {'agent_extracted': 672} |
| offering | 4467 | 4467 | {'agent_extracted': 4203, 'held': 264} |
| eligibility_rule | 512 | 512 | {'agent_extracted': 496, 'held': 16} |
| eligibility_condition | 392 | 0 | - |
| evaluation_component | 447 | 447 | {'agent_extracted': 383, 'held': 64} |
| conversion_rule | 74 | 74 | {'agent_extracted': 65, 'held': 6, 'main_crosschecked': 3} |
| conversion_item | 579 | 0 | - |
| csat_minimum | 347 | 347 | {'agent_extracted': 308, 'held': 31, 'main_crosschecked': 8} |
| outcome | 681113 | 681113 | {'auto_validated': 673686, 'ocr': 7427} |
| schedule_event | 313 | 313 | {'agent_extracted': 296, 'held': 17} |
| document_requirement | 138 | 138 | {'agent_extracted': 116, 'held': 22} |
| year_mapping | 0 | 0 | - |
| extension_fact | 0 | 0 | - |
| candidate | 60276 | 0 | - |

## 4. 입시결과 값
| 항목 | 수 |
|---|---|
| 값(한 칸 = 한 행) | 681113 |
| 분류 확정(집단·측정항목·통계가 열 제목으로 분명) | 547778 |
| 미분류(대기) | 133335 |
| 결과 학년도 미정 | 137688 |
| OCR 로 복원(사람 확인 전 계산 금지) | 7427 |
| 값이 기호(▨·- 등)라 숫자가 없는 행 | 44704 |

측정항목별(상위 12):
- (미분류): 105351
- 모집인원: 101255
- 내신등급: 99823
- 경쟁률: 84188
- 환산점수: 54617
- 지원인원: 45255
- 충원인원: 39620
- 최종예비순위: 35617
- 백분위: 25224
- 교과환산점수: 21367
- 등록인원: 18609
- 수능등급: 14567

## 5. 지원자격·환산·수능최저
- 자격 규칙 512개 — 가능 273, 미확인 20, 불가 182, 조건부 37
- 자격 조건(AND/OR 노드) 392개
- 환산규칙 74개 — 입력 종류별: csat 7, essay 2, ged_average 23, ged_subject 18, practical 2, school_record 17, unknown 5
  - 계산 승인: approved 42, blocked 1, pending 31
  - 환산표 항목 579개
- 수능최저 347개 — no 176, unknown 13, yes 158 / 승인: approved 252, blocked 1, pending 94

## 6. 근거 누락·충돌·추가 원문 필요
- 근거가 하나도 없는 사실 행: offering 0, eligibility_rule 0, conversion_rule 0, csat_minimum 0, outcome 0
- 보류(held) 레코드: offering 264, eligibility_rule 16, evaluation_component 64, conversion_rule 6, csat_minimum 31, schedule_event 17, document_requirement 22
- 수집 단계에서 못 구한 칸(추가 확보 필요): 35 — 2026만 있음 4, 비공개 10, 수작업 필요 21
- 학년도 확인 필요 문서(본문 연도 미검출·불일치): 601
- 비교 가능 여부 검토: 연도대응 0건, 비교 가능으로 표시한 입시결과 0건 (이번 단계에서는 연도 간 비교 연결을 만들지 않았다)

## 7. 검수 수준 (섞지 않는다)
| 수준 | 뜻 | 수 |
|---|---|---|
| auto_validated | 표 파서가 만든 것(기계 검사만) | 673686 (입시결과) |
| agent_extracted | 에이전트 추출 + 근거 원문 기계 대조 통과 | 5867 |
| main_crosschecked | 메인이 쪽 이미지로 직접 대조 | 11 |
| human_confirmed | **사람 검수** | 0 |
| held | 보류(근거 미확인 등) | 420 |

> 전수 내용 검수는 하지 않았다. 사람이 확인한 레코드는 0건이며, 메인이 직접 본 것은 시험 사례 쪽뿐이다.

## 8. 10개 대학 시험 사례
- PASS 10 / FAIL 0 / NOT_RUN 0
- 자세한 내용: `reports/trial_report.md`
- 합격확률 정확도는 측정하지 않았다(그럴 데이터도 모델도 없다).

## 9. 앱에 바로 쓰면 안 되는 자료
`후속_앱반영_필수규칙.md` 의 마지막 절을 그대로 따른다(승인되지 않은 환산·최저 규칙, 보류 레코드, 미분류 결과값, 후보 테이블, 대체 자료, 시행계획, OCR 값).
