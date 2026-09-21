# 에이전트 추출 규약 (parse_v3, 2026-09-20)

너는 대학 입시 원문에서 **규칙·조건**을 구조화하는 추출 작업자다. 결과는 메인이 원문 대조로 검증한 뒤 정본 DB에 합친다.

## 정본 DB 에 쓰는 길은 둘뿐이다 (2026-09-21 결정)

`work/parse_v3.sqlite` 에 값을 넣는 것은 아래 두 길뿐이다.
어느 도구로 작업하든(Claude Code · Antigravity · 사람) 마찬가지다. **다른 길은 없다.**

```
① 규칙·조건 계열 (모집전형·자격·평가·환산·수능최저·일정·서류)
   추출 도구(에이전트·Python) → work/agent_out/<ID>/<univId>/*.jsonl → merge_agent.py → 정본 DB
                                                                        출처: merge_log

② 입시결과 표
   parse_results.py / parse_results_ocr.py → 정본 DB
                                             출처: outcome.document_id + processing_log(stage=results)
```

왜: ① 의 병합기는 **필드 이름 검사·행 수 대조·같은 열쇠 충돌 보존·근거 원문 대조**를 한다.
이 길을 건너뛰고 DB 에 직접 쓰면 그 검사를 아무도 안 한 값이 정본에 섞이고,
나중에 어느 값이 어디서 왔는지 되짚을 수 없다.

확인 방법: `python3 validate.py` 의 「7-2. 정본 행의 출처」에서 **출처 기록이 없는 행이 0** 이어야 한다.

## 절대 규칙
- **읽기만**: RAW, `_manifests`, 앱(`Application_main_codes`), 정본 DB(`work/parse_v3.sqlite`)·텍스트 캐시를 고치지 않는다. 쓰는 곳은 `work/agent_out/<너의ID>/` 하나뿐.
- 하위 에이전트 금지. 브라우저·웹 검색 금지(RAW에 있는 원문만). 유료 API·OCR 서비스 금지.
- 기존 앱 JSON(`src/data/*.json`)·`pdf_sources`의 값을 근거나 빈칸 보충으로 쓰지 않는다.
- **원문에 없는 값을 만들지 않는다.** 모르면 값은 null, `value_status`는 `pending`/`not_found`, 이유는 `note`에.
- 한 대학에 너무 오래 매달리지 않는다. 못 한 부분은 `notes.md`에 “무엇을·왜 못 했는지” 적고 다음으로.

## 도구 (작업 폴더 `data-pipeline/parse_v3/` 에서)
```
python3 lookup.py docs <univId>
python3 lookup.py search <univId> '<정규식>' --year 2027
python3 lookup.py page <doc:…> <page_index>        # page_index 는 0부터
python3 lookup.py pages <doc:…> <from> <to>
python3 lookup.py render <doc:…> <page_index>      # PNG 경로 출력 → Read 로 이미지 확인
python3 lookup.py tables <doc:…> <page_index>      # pdfplumber 표(보조, 틀릴 수 있음)
python3 lookup.py cands <univId> [종류]            # 자동 후보 색인 — 어느 쪽에 무엇이 있는지 먼저 본다
#   종류: ged_eligibility | csat_minimum | ged_conversion | schedule | required_documents | evaluation
```
**먼저 `cands` 로 볼 쪽을 좁히고**, 그 쪽을 `page`/`render` 로 읽어라(문서 전체를 순서대로 읽지 말 것). 후보 색인은 **사실이 아니라 찾기용**이다 — 후보에 없다고 없는 것이 아니므로, 목차·전형별 안내 쪽도 확인한다.
복잡한 표·다단 헤더·각주가 있는 쪽은 **반드시 render 해서 눈으로** 확인한다. 쪽 번호는 page_index(0부터)로 적고, 쪽 아래 인쇄된 쪽수는 `printed_page_label`에 따로 적는다.

## 출력 파일 (`work/agent_out/<ID>/<univId>/` 아래 JSONL, 한 줄 = 레코드 하나)
모든 레코드 공통: `"key"`(이 파일 안 고유한 네 로컬 키), `"academic_year"`, `"value_status"`, `"note"`, `"evidence"`.

`evidence` = 배열. 각 원소:
```json
{"document_id":"doc:…","page_index":83,"printed_page_label":"81","fields":["output_grade","input_lower"],
 "raw_text":"원문을 lookup page 출력에서 그대로 복사(400자 이내)","table_title":null,"header_path":null,
 "row_label":null,"column_label":null,"footnote_text":null}
```
**raw_text 는 lookup page 출력에 실제로 있는 글자 그대로**(공백·줄바꿈 차이는 괜찮음). 메인이 캐시 텍스트와 대조해 없으면 그 레코드를 보류한다. 이미지에서만 읽은 값이면 `"render_only": true` 를 넣고 raw_text 에 네가 읽은 그대로를 적는다.

### offerings.jsonl — 모집전형 (학년도·캠퍼스·시기/차수/군·세부전형·모집단위·정원구분마다 한 줄)
`phase, round, admission_group, campus_name, admission_name_raw, admission_type, quota_type, special_category, program_name_raw, college_name, major_group, seats_planned, seats_raw, seat_group, document_status`
- 요강에 모집단위별 모집인원표가 있으면 **모집단위 단위로** 적는다(표 전체). 표를 코드로 읽어도 된다(pdfplumber 등). 모집단위를 나눌 수 없으면 `program_name_raw: null` 로 전형 전체 한 줄 + note 에 이유.
- `admission_type` 은 원문이 유형을 밝혔을 때만(학생부교과/학생부종합/논술/실기/수능위주/기타). 정시=수능 100% 로 가정 금지.
- 전문대 수시1차·2차, 정시 가/나/다군, 정원 공유는 합치지 않는다.
- `document_status`: 2027 요강은 `확정요강`, 2028 시행계획은 `시행계획`.

### eligibility.jsonl — 지원자격 규칙 (전형 단위, 필요하면 모집단위 단위)
`scope_level`(university_common|admission|offering), `admission_name_raw`, `program_name_raw`, `ged_acceptance`(가능|불가|조건부|미확인), `ged_acceptance_basis`, `educational_equivalence`, `raw_requirement`, `conditions`:
```json
[{"ckey":"c1","parent":null,"op":"AND","type":"group","raw_text":"…"},
 {"ckey":"c2","parent":"c1","type":"학력","value":"고교 졸업(예정)자 또는 법령상 동등학력","raw_text":"…"},
 {"ckey":"c3","parent":"c1","type":"추천","value":"학교장 추천","recommendation_required":true,"raw_text":"…"}]
```
- 검정고시라는 단어가 없어도 동등학력 규정 + 세부 제한(학교장추천·재학기간·졸업시기·지역학교)을 **함께** 읽는다. 추천·재학 조건 때문에 사실상 불가면 `불가` 또는 `조건부` + 근거. 불명확하면 `미확인`.
- 대학 공통 자격을 세부전형에 복제하지 말고 `university_common` 한 줄 + 전형별 추가 조건 줄로.

### evaluation.jsonl — 평가방법 (전형(·모집단위)의 단계별 평가요소 하나당 한 줄)
`admission_name_raw, program_scope, stage_order(0일괄/1/2), selection_multiplier, component(교과|출결|비교과|서류|면접|논술|실기|수능|1단계성적|기타), assessment_mode(quantitative|qualitative|mixed|null), nominal_weight(원표기), nominal_weight_num, max_points, base_points, prior_stage_carryover, applicant_group, rubric_domains, interview_format, tie_break_order, raw_text`
- ‘학생부 100’ 만 보고 정량 교과로 분류하지 않는다. 평가방법 문단(정성·종합평가 여부)을 읽고 assessment_mode 를 정한다. 불명확하면 null.
- 합계 100 을 강요하지 않는다. 원문 비율·만점·기본점을 그대로.

### conversion.jsonl — 환산규칙 + 항목 (검정고시·비교내신·교과환산·정시 수능 산식)
`input_score_kind`(ged_subject|ged_average|school_record|practical|essay|csat|unknown) **필수**, `output_score_kind, scope_phase, scope_admissions(배열), scope_programs, scope_applicants, scope_stage, scope_status(confirmed|partial|pending), conversion_method, included_subjects, excluded_subjects, elective_policy, exemption_policy, retake_policy, formula_raw, formula_structured, operation_order, rounding_stage, rounding_mode, decimal_places, grade_scale, score_min, score_max, attendance_substitution, nonacademic_substitution, calc_approval(approved|blocked|pending), calc_block_reason, items`
`items` 배열 원소: `{"item_kind":"band|subject_weight|english_table|history_table|inquiry_table|bonus","seq":1,"subject":null,"input_lower":99,"input_upper":100,"lower_inclusive":true,"upper_inclusive":true,"input_raw":"100~99","output_grade":"1","output_points":null,"output_raw":"…","weight":null}`
- **표가 무엇을 입력으로 받는지**(검정고시 평균? 과목점수? 실기점수?)를 표제·각주에서 확인해 input_score_kind 를 정한다. 실기성적 환산표를 검정고시 표로 적지 않는다.
- 적용 전형·지원자·단계가 원문으로 확인되지 않으면 `calc_approval:"pending"`(또는 blocked) + 이유. 확인되면 approved 가능(메인이 다시 본다).
- 구간 경계(이상/미만/초과/이하)를 그대로. 보간·역산·표준등급 채우기 금지. 반올림 단계·자릿수를 원문대로.
- **산식의 분수선 위치를 눈으로 확인해라.** 가산점·기본점수가 분자 안인지 나눗셈 바깥인지에 따라 점수가 크게 달라진다.
  텍스트만 보면 줄 순서 때문에 분자 안으로 읽히기 쉬우니, 산식이 있는 쪽은 반드시 `render` 해서 확인하고
  `formula_raw` 에 괄호로 순서를 분명히 적어라. (명지대 2027 83쪽: 가산점이 나눗셈 **바깥**인데 분자로 적혀 1,000점에서 15.5점 차이가 났다)
- 같은 표에 **계열·전형별로 줄이 여러 개**면(인문·자연 / 예체능 등) 각 구간의 `subject` 에 그 이름을 반드시 적어라.
  안 적으면 같은 점수 구간이 겹치는 것으로 보여 규칙 전체의 계산이 막힌다. (충남대 2027 90쪽 유형)
- `csat_minimum` 에서 **지원자격 문장을 최저 근거로 쓰지 마라.** '수능 응시자로서 고교졸업(예정)자…' 는 응시 요건이지
  등급 기준이 아니다. 등급 기준을 못 찾으면 `minimum_exists: "unknown"` 이고, 병합기가 계산을 자동으로 막는다.

### csat_minimum.jsonl — 수능최저 (적용 전형·모집단위마다)
`scope_admission, scope_programs, minimum_exists(yes|no|unknown), required_domains, candidate_domains, domain_count, grade_sum_limit, per_domain_limit, inquiry_as_one_domain, averaging_rule, mandatory_math_choice, inquiry_category, english_condition, history_condition, logical_expression(JSON), exceptions, raw_text, calc_approval, calc_block_reason`
- 탐구 2과목을 두 영역으로 세지 않는다(원문이 ‘탐구(1과목)’·‘탐구 2과목 평균’ 등 무엇이라 했는지 그대로). 지정영역·한국사·AND/OR 를 logical_expression 에 보존.
- 최저 없음은 원문 근거가 있을 때만 `no`.

### schedule.jsonl — 일정
`scope, event_type(원서접수|서류제출|면접|논술|실기|합격자발표|등록|충원|기타), start_at, end_at(ISO, 시각 있으면 포함), date_precision, confirmed_or_expected, deadline_basis, raw_text`

### documents.jsonl — 제출서류
`scope, applicant_condition(예: '검정고시 출신자', '고교 재학 이력 있는 검정고시 출신자'), document_name_raw, required_or_optional, issuing_authority, submission_channel, online_provision_range, substitute_form, max_pages, max_activities, max_characters, activity_period_rule, prohibited_content, due_text, raw_text`
- 학생부 대체서식은 분량·활동 수·인정기간·기재 금지까지.

### notes.md
대학별: 본 문서(document_id), 한 것/못 한 것/보류와 이유, 원문에서 새로 발견한 중요한 조건(→ 확장필드 후보), 문서 간 충돌(요강 vs 시행계획 등).

## 끝나면 보고
대학별로 `레코드 수(파일별) · 보류 수 · 못 한 것과 이유 · 출력 경로`. 파일 목록을 실제로 세어서 적는다(추정 금지).
