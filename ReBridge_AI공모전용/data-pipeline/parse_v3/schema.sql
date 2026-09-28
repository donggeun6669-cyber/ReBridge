-- 검고담임 RAW 파싱 v3 작업대 스키마 (2026-09-20)
-- 기준: DEAN/03_PROJECTS/Gumgomentor/ReBridge/2026-09-19_RAW_추출필드와_입시판정_제안.md 의 14개 논리 테이블
-- 원칙
--   * 원천은 RAW 파일뿐. 기존 앱 JSON·pdf_sources 값으로 빈칸을 채우지 않는다.
--   * 모든 사실 행은 evidence 로 원문에 연결한다(field 수준). 근거 없는 confirmed 금지.
--   * 쪽 번호: page_index 는 0부터(PDF 내부 순서), printed_page_label 은 인쇄 쪽수 문자열(모르면 NULL).
--   * 상태 축을 섞지 않는다:
--       value_status      값 자체의 상태  confirmed|not_published|not_applicable|not_found|unreadable|conflict|pending
--       review_status     검수 이력        unreviewed|auto_validated|agent_extracted|main_crosschecked|human_confirmed|ocr(OCR 복원, 사람 확인 전 계산 금지)|rejected|held
--       calc_approval     계산 사용 승인   approved|blocked|pending   (환산·최저 등 계산 규칙에만)
--     추출 정확도와 합격 예측 신뢰도는 어디에도 하나의 confidence 로 합치지 않는다.
--   * ID 는 내용에서 결정적으로 만든다(ID_POLICY.md). 같은 입력을 다시 돌려도 중복 행이 생기지 않는다.

PRAGMA foreign_keys = ON;

-- ───────────── 01 문서 ─────────────
-- 한 행 = 문서의 한 버전(내용 해시가 같으면 같은 문서). 물리 파일은 document_file 에.
CREATE TABLE IF NOT EXISTS document (
  document_id            TEXT PRIMARY KEY,          -- 'doc:' + sha256 앞 16자
  sha256                 TEXT NOT NULL UNIQUE,
  format                 TEXT NOT NULL,             -- PDF|XLSX|HTML|HWP|HWPX|XLS|IMAGE|JSON|OTHER
  page_count             INTEGER,
  title                  TEXT,                      -- 본문 첫 쪽에서 읽은 제목(없으면 NULL)
  publisher              TEXT,                      -- 발행기관(대학명·한국대학교육협의회 등). 모르면 NULL
  issuing_authority      TEXT,                      -- 대학 원문|어디가(대교협) 대체|전문대학포털 대체|기타
  original_or_substitute TEXT,                      -- manifest 원문여부: 원문|대체|가공
  document_type          TEXT,                      -- 모집요강|시행계획|입시결과|정정공지|서식|변환표|기타
  document_status        TEXT,                      -- 확정요강|시행계획|초안|정정본|결과공개|미확인
  academic_years_claimed TEXT,                      -- manifest 폴더 연도(JSON 배열) — 참고값
  academic_years_detected TEXT,                     -- 본문에서 읽은 'NNNN학년도'(JSON 배열)
  year_check             TEXT,                      -- match|mismatch|multi|undetected
  admission_scope        TEXT,                      -- 수시|정시|통합|결과 등(본문/manifest)
  publication_date       TEXT,
  revision_date          TEXT,
  effective_date         TEXT,
  source_url             TEXT,
  retrieved_at           TEXT,
  converted_from         TEXT REFERENCES document(document_id),   -- 변환본이면 원본 문서
  supersedes_document_id TEXT REFERENCES document(document_id),
  text_layer             TEXT,                      -- text|partial|image_only|none|unsupported
  text_pages             INTEGER,
  image_only_pages       INTEGER,
  ocr_needed             INTEGER,                   -- 0/1
  use_rights_status      TEXT DEFAULT '미확인',
  parser_version         TEXT,
  note                   TEXT
);

-- 물리 파일 한 개(RAW 경로). 같은 해시 파일이 여러 대학·연도 폴더에 있을 수 있다.
CREATE TABLE IF NOT EXISTS document_file (
  file_id          TEXT PRIMARY KEY,                -- 'file:' + sha1(raw_path)
  document_id      TEXT NOT NULL REFERENCES document(document_id),
  raw_path         TEXT NOT NULL UNIQUE,            -- RAW 기준 상대경로
  university_id    TEXT,                            -- manifest univId
  folder_year      TEXT,
  manifest_doc_type TEXT,                           -- 입시결과_수시 등 manifest 문서종류
  manifest_worker  TEXT,
  manifest_file    TEXT,                            -- 어느 manifest csv 인지
  manifest_note    TEXT,
  is_original_format_archive INTEGER DEFAULT 0,     -- _원본형식/ 보관본
  sha_matches_manifest INTEGER,                     -- manifest sha256 과 실제 해시 일치 여부
  exists_on_disk   INTEGER
);

-- 수집 단계에서 못 구한 칸(추가 확보 필요 목록의 원천)
CREATE TABLE IF NOT EXISTS coverage_gap (
  university_id TEXT NOT NULL,
  folder_year   TEXT NOT NULL,
  label         TEXT NOT NULL,                      -- 비공개|2026만 있음|수작업 필요|해당 없음 …(rawlib 표시)
  reasons       TEXT,
  PRIMARY KEY (university_id, folder_year)
);

-- 파일마다 처리 이력(재개·중복 방지)
CREATE TABLE IF NOT EXISTS processing_log (
  document_id   TEXT NOT NULL,
  stage         TEXT NOT NULL,                      -- inventory|textcache|cand_eligibility|…|agent_trial
  parser_version TEXT NOT NULL,
  status        TEXT NOT NULL,                      -- done|partial|failed|held|skipped
  detail        TEXT,
  processed_at  TEXT NOT NULL,
  PRIMARY KEY (document_id, stage, parser_version)
);

-- ───────────── 02 근거 ─────────────
CREATE TABLE IF NOT EXISTS evidence (
  evidence_id        TEXT PRIMARY KEY,
  document_id        TEXT NOT NULL REFERENCES document(document_id),
  target_table       TEXT,                          -- offering|eligibility_condition|conversion_item|outcome|…
  target_record_id   TEXT,
  target_field       TEXT,                          -- 여러 필드면 ','로
  page_index         INTEGER,                       -- 0부터
  printed_page_label TEXT,
  section_title      TEXT,
  table_title        TEXT,
  header_path        TEXT,                          -- 다중 헤더 'A > B > C'
  row_label          TEXT,
  column_label       TEXT,
  bbox               TEXT,                          -- PDF 좌표 JSON [x0,y0,x1,y1] 또는 NULL
  sheet_cell         TEXT,                          -- 엑셀 '시트!A1:C3'
  raw_text           TEXT NOT NULL,
  footnote_text      TEXT,
  footnote_scope     TEXT,
  normalized_value   TEXT,
  unit               TEXT,
  value_status       TEXT NOT NULL DEFAULT 'pending',
  extraction_method  TEXT NOT NULL,                 -- text_rule|table_rule|xlsx_cell|html_table|agent_read|render_read|ocr
  extractor_version  TEXT NOT NULL,
  review_status      TEXT NOT NULL DEFAULT 'unreviewed',
  reviewer           TEXT,                          -- 'main(Claude)'·'agent:T1(Sonnet)'… 사람이면 이름
  reviewed_at        TEXT
);
CREATE INDEX IF NOT EXISTS ix_evidence_target ON evidence(target_table, target_record_id);
CREATE INDEX IF NOT EXISTS ix_evidence_doc ON evidence(document_id, page_index);

-- ───────────── 03 대학·캠퍼스 ─────────────
CREATE TABLE IF NOT EXISTS university_campus (
  campus_id                 TEXT PRIMARY KEY,       -- '{univId}' 또는 '{univId}#{캠퍼스}'
  university_id             TEXT NOT NULL,          -- 앱 univId 재사용(출처: universities.json)
  official_school_code      TEXT,
  university_name_raw       TEXT,                   -- 마스터 원래 이름
  university_name_normalized TEXT,                  -- 지금 이름(NAME_OVERRIDES 반영)
  campus_name               TEXT,
  school_kind               TEXT,                   -- 대학교|전문대학
  establishment             TEXT,
  region                    TEXT,
  address                   TEXT,
  admission_office_url      TEXT,
  admission_contact         TEXT,
  active_from               TEXT,
  active_to                 TEXT,
  predecessor_id            TEXT,                   -- 통합 전 학교 univId
  in_target                 INTEGER NOT NULL,       -- 현재 대상(335) 여부
  source_note               TEXT
);

-- ───────────── 04 모집단위 ─────────────
CREATE TABLE IF NOT EXISTS program (
  program_id              TEXT PRIMARY KEY,
  academic_year           INTEGER NOT NULL,
  university_id           TEXT NOT NULL,
  campus_id               TEXT,
  program_name_raw        TEXT NOT NULL,
  program_name_normalized TEXT,
  college_name            TEXT,
  department_name         TEXT,
  major_group             TEXT,                     -- 인문|자연|예체능 등(원문 표기)
  degree_years            TEXT,                     -- 수업연한
  day_or_evening          TEXT,
  combined_recruitment    INTEGER,                  -- 광역·통합모집 1/0/NULL
  constituent_program_ids TEXT,                     -- JSON 배열
  major_selection_rules   TEXT,
  value_status            TEXT NOT NULL DEFAULT 'pending',
  review_status           TEXT NOT NULL DEFAULT 'unreviewed'
);

-- ───────────── 05 모집전형 ─────────────
-- 한 행 = 학년도 × 대학 × 캠퍼스 × 모집시기/차수/군 × 세부전형 × 모집단위 × 정원구분
CREATE TABLE IF NOT EXISTS offering (
  offering_id            TEXT PRIMARY KEY,
  academic_year          INTEGER NOT NULL,
  university_id          TEXT NOT NULL,
  campus_id              TEXT,
  program_id             TEXT REFERENCES program(program_id),   -- NULL = 전형 전체(모집단위 미분리)
  phase                  TEXT,                      -- 수시|정시|추가|NULL
  round                  TEXT,                      -- 수시1차|수시2차|…
  admission_group        TEXT,                      -- 가군|나군|다군|군외|해당없음
  admission_id           TEXT,                      -- 세부전형 ID(대학·학년도 안에서)
  admission_name_raw     TEXT NOT NULL,
  admission_name_normalized TEXT,
  admission_type         TEXT,                      -- 학생부교과|학생부종합|논술|실기/실적|수능위주|기타 (원문 근거 있을 때만)
  quota_type             TEXT,                      -- 정원내|정원외
  special_category       TEXT,                      -- 일반|기회균형|농어촌|특성화고 …
  seats_planned          INTEGER,
  seats_initial          INTEGER,
  seats_carryover        INTEGER,
  seats_final            INTEGER,
  seats_basis_date       TEXT,
  seats_raw              TEXT,                      -- '0'·'-'·'00명 내외' 등 원표기
  seat_group_id          TEXT,
  duplicate_application_rule TEXT,
  application_limit_scope TEXT,
  document_id            TEXT REFERENCES document(document_id),
  document_status        TEXT,                      -- 확정요강|시행계획
  result_matching_status TEXT,
  value_status           TEXT NOT NULL DEFAULT 'pending',
  review_status          TEXT NOT NULL DEFAULT 'unreviewed'
);
CREATE INDEX IF NOT EXISTS ix_offering_univ ON offering(university_id, academic_year);

-- ───────────── 06 지원조건 ─────────────
CREATE TABLE IF NOT EXISTS eligibility_rule (
  eligibility_rule_id   TEXT PRIMARY KEY,
  university_id         TEXT NOT NULL,
  academic_year         INTEGER NOT NULL,
  scope_level           TEXT NOT NULL,              -- university_common|admission|offering
  offering_id           TEXT,                       -- scope_level=offering
  admission_name_raw    TEXT,                       -- scope_level=admission
  ged_acceptance        TEXT NOT NULL,              -- 가능|불가|조건부|미확인
  ged_acceptance_basis  TEXT,                       -- 판정 근거 요약(원문 인용은 evidence)
  educational_equivalence TEXT,                     -- '고졸 검정고시' 등
  raw_requirement       TEXT,                       -- 지원자격 원문(공통+세부)
  document_id           TEXT REFERENCES document(document_id),
  value_status          TEXT NOT NULL DEFAULT 'pending',
  review_status         TEXT NOT NULL DEFAULT 'unreviewed'
);
-- 조건 하나 = 한 행. parent_group 과 logical_operator 로 AND/OR/NOT 트리를 만든다.
CREATE TABLE IF NOT EXISTS eligibility_condition (
  condition_id          TEXT PRIMARY KEY,
  eligibility_rule_id   TEXT NOT NULL REFERENCES eligibility_rule(eligibility_rule_id),
  parent_group          TEXT,                       -- 상위 그룹 condition_id(NULL=최상위)
  logical_operator      TEXT,                       -- AND|OR|NOT (그룹 노드에만)
  condition_type        TEXT NOT NULL,              -- 학력|추천|졸업시기|재학이력|거주|지역학교|특별자격|수능응시|연령|제외|예외|group
  comparator            TEXT,
  value                 TEXT,
  qualification_deadline TEXT,
  allowed_exam_sessions TEXT,
  minimum_semesters     TEXT,
  recommendation_required INTEGER,
  raw_text              TEXT NOT NULL,
  value_status          TEXT NOT NULL DEFAULT 'pending'
);

-- ───────────── 07 평가방법 ─────────────
CREATE TABLE IF NOT EXISTS evaluation_component (
  component_id          TEXT PRIMARY KEY,
  evaluation_rule_id    TEXT NOT NULL,              -- 같은 전형(범위)의 묶음 ID
  university_id         TEXT NOT NULL,
  academic_year         INTEGER NOT NULL,
  scope_level           TEXT NOT NULL,              -- admission|offering
  offering_id           TEXT,
  admission_name_raw    TEXT,
  stage_order           INTEGER,                    -- 0=일괄, 1=1단계, 2=2단계
  selection_multiplier  TEXT,                       -- '3배수' 원표기
  component             TEXT NOT NULL,              -- 교과|출결|비교과|서류|면접|논술|실기|수능|1단계성적|기타
  assessment_mode       TEXT,                       -- quantitative|qualitative|mixed|NULL(원문 불명)
  nominal_weight        TEXT,                       -- '70%' 원표기 유지
  nominal_weight_num    REAL,
  max_points            REAL,
  base_points           REAL,
  prior_stage_carryover TEXT,
  applicant_group       TEXT,                       -- 전체|검정고시|… 해당 산식 적용 대상
  score_rule_id         TEXT,                       -- conversion_rule 연결
  rubric_domains        TEXT,
  interview_format      TEXT,
  disqualification_rule TEXT,
  tie_break_order       TEXT,
  raw_text              TEXT,
  value_status          TEXT NOT NULL DEFAULT 'pending',
  review_status         TEXT NOT NULL DEFAULT 'unreviewed'
);

-- ───────────── 08 환산규칙 ─────────────
CREATE TABLE IF NOT EXISTS conversion_rule (
  conversion_rule_id    TEXT PRIMARY KEY,
  university_id         TEXT NOT NULL,
  academic_year         INTEGER NOT NULL,
  scope_phase           TEXT,
  scope_admissions      TEXT,                       -- 적용 전형 원문(JSON 배열) / NULL=미확인
  scope_programs        TEXT,                       -- 적용 계열·학과
  scope_applicants      TEXT,                       -- '검정고시 출신자' 등
  scope_stage           TEXT,
  scope_status          TEXT NOT NULL DEFAULT 'pending', -- confirmed|partial|pending
  input_score_kind      TEXT NOT NULL,              -- ged_subject|ged_average|school_record|practical|essay|csat|unknown
  output_score_kind     TEXT,                       -- 비교내신등급|교과환산점수|전형총점|수능환산점수 …
  score_system_id       TEXT,
  conversion_method     TEXT,                       -- band_table|formula|weighted_average_then_band|subject_band_then_average|…
  included_subjects     TEXT,
  excluded_subjects     TEXT,
  elective_policy       TEXT,
  exemption_policy      TEXT,
  retake_policy         TEXT,
  formula_raw           TEXT,
  formula_structured    TEXT,                       -- JSON (원문에 있는 연산만)
  operation_order       TEXT,
  rounding_stage        TEXT,
  rounding_mode         TEXT,
  decimal_places        INTEGER,
  grade_scale           TEXT,                       -- '9'|'5'|NULL
  score_min             REAL,
  score_max             REAL,
  attendance_substitution TEXT,
  nonacademic_substitution TEXT,
  missing_input_policy  TEXT,
  document_id           TEXT REFERENCES document(document_id),
  value_status          TEXT NOT NULL DEFAULT 'pending',
  review_status         TEXT NOT NULL DEFAULT 'unreviewed',
  calc_approval         TEXT NOT NULL DEFAULT 'pending',
  calc_block_reason     TEXT
);

-- ───────────── 09 환산표 항목 ─────────────
CREATE TABLE IF NOT EXISTS conversion_item (
  item_id               TEXT PRIMARY KEY,
  conversion_rule_id    TEXT NOT NULL REFERENCES conversion_rule(conversion_rule_id),
  item_kind             TEXT NOT NULL,              -- band|subject_weight|english_table|history_table|inquiry_table|bonus
  seq                   INTEGER,
  subject               TEXT,
  input_lower           REAL,
  input_upper           REAL,
  lower_inclusive       INTEGER,
  upper_inclusive       INTEGER,
  input_raw             TEXT,
  output_grade          TEXT,
  output_points         REAL,
  output_raw            TEXT,
  weight                REAL,
  value_status          TEXT NOT NULL DEFAULT 'pending'
);

-- ───────────── 10 수능최저 ─────────────
CREATE TABLE IF NOT EXISTS csat_minimum (
  minimum_rule_id       TEXT PRIMARY KEY,
  university_id         TEXT NOT NULL,
  academic_year         INTEGER NOT NULL,
  scope_admission       TEXT,
  scope_programs        TEXT,
  minimum_exists        TEXT NOT NULL,              -- yes|no|unknown
  test_participation_required TEXT,
  required_domains      TEXT,
  candidate_domains     TEXT,
  domain_count          INTEGER,
  grade_sum_limit       REAL,
  per_domain_limit      TEXT,
  inquiry_as_one_domain TEXT,                       -- '1과목'|'2과목 평균'|… 원문 기준, 모르면 NULL
  averaging_rule        TEXT,
  mandatory_math_choice TEXT,
  inquiry_category      TEXT,
  english_condition     TEXT,
  history_condition     TEXT,
  logical_expression    TEXT,                       -- JSON 논리식
  exceptions            TEXT,
  raw_text              TEXT NOT NULL,
  document_id           TEXT REFERENCES document(document_id),
  value_status          TEXT NOT NULL DEFAULT 'pending',
  review_status         TEXT NOT NULL DEFAULT 'unreviewed',
  calc_approval         TEXT NOT NULL DEFAULT 'pending',
  calc_block_reason     TEXT
);

-- ───────────── 11 입시결과 ─────────────
-- 한 행 = 결과 학년도 · 전형 · 모집단위 · 집단 · 측정항목 · 통계 한 개의 값
CREATE TABLE IF NOT EXISTS outcome (
  outcome_id            TEXT PRIMARY KEY,
  result_academic_year  INTEGER,                    -- 본문 기준. 불명확하면 NULL + value_status pending
  university_id         TEXT NOT NULL,
  campus_id             TEXT,
  program_name_raw      TEXT,
  program_id            TEXT,
  phase                 TEXT,
  round                 TEXT,
  admission_group       TEXT,
  admission_name_raw    TEXT,
  quota_type            TEXT,
  aggregation_scope     TEXT NOT NULL DEFAULT 'program', -- program|admission|university|national
  population_stage      TEXT,                       -- 지원자|1단계합격자|최초합격자|최종합격자|최종등록자|미상
  applicant_background  TEXT,                       -- 전체|검정고시만|구분미공개
  metric                TEXT,                       -- 내신등급|교과환산점수|수능환산점수|총점|백분위|표준점수|경쟁률|모집인원|지원인원|충원인원|예비번호|충원율|최저충족인원|…|미분류
  component_scope       TEXT,                       -- 교과만|면접포함|…
  score_system_id       TEXT,
  statistic_type        TEXT,                       -- 평균|중앙값|최고|최저|표준편차|분위값|값|미분류
  percentile_rank       REAL,                       -- 50·70·80 등(분위값일 때)
  statistic_definition  TEXT,
  value_num             REAL,
  value_raw             TEXT NOT NULL,              -- 원표기('▨','-' 등 그대로)
  unit                  TEXT,
  grade_scale           TEXT,
  full_score            REAL,
  better_direction      TEXT,                       -- lower|higher|NULL
  cohort_n              INTEGER,
  fill_denominator      TEXT,
  fill_round            TEXT,                       -- 충원 차수('1차' 등)
  suppression_reason    TEXT,
  header_path           TEXT,                       -- 원표의 열 제목 경로(분류 근거)
  row_label             TEXT,
  document_id           TEXT NOT NULL REFERENCES document(document_id),
  comparability_status  TEXT DEFAULT 'unreviewed',
  classification_status TEXT NOT NULL DEFAULT 'pending',  -- 측정항목·통계·집단 분류가 확정됐는지
  value_status          TEXT NOT NULL DEFAULT 'pending',
  review_status         TEXT NOT NULL DEFAULT 'unreviewed'
);
CREATE INDEX IF NOT EXISTS ix_outcome_univ ON outcome(university_id, result_academic_year);

-- ───────────── 12 일정 ─────────────
CREATE TABLE IF NOT EXISTS schedule_event (
  event_id              TEXT PRIMARY KEY,
  university_id         TEXT NOT NULL,
  academic_year         INTEGER NOT NULL,
  scope                 TEXT,                       -- 공통|전형명 원문
  offering_id           TEXT,
  event_type            TEXT NOT NULL,              -- 원서접수|서류제출|면접|논술|실기|합격자발표|등록|충원|기타
  start_at              TEXT,
  end_at                TEXT,
  timezone              TEXT DEFAULT 'Asia/Seoul',
  date_precision        TEXT,                       -- datetime|date|month|range_text
  confirmed_or_expected TEXT,                       -- 확정|예정|미확인
  deadline_basis        TEXT,
  raw_text              TEXT NOT NULL,
  document_id           TEXT REFERENCES document(document_id),
  value_status          TEXT NOT NULL DEFAULT 'pending',
  review_status         TEXT NOT NULL DEFAULT 'unreviewed'
);

-- ───────────── 13 제출서류 ─────────────
CREATE TABLE IF NOT EXISTS document_requirement (
  requirement_id        TEXT PRIMARY KEY,
  university_id         TEXT NOT NULL,
  academic_year         INTEGER NOT NULL,
  scope                 TEXT,
  applicant_condition   TEXT,                       -- '검정고시 출신자'·'고교 재학 이력 있는 검정고시생' 등
  document_name_raw     TEXT NOT NULL,
  required_or_optional  TEXT,
  issuing_authority     TEXT,
  submission_channel    TEXT,
  online_provision_range TEXT,
  substitute_form       TEXT,                       -- 학생부 대체서식 이름
  max_pages             TEXT,
  max_activities        TEXT,
  max_characters        TEXT,
  activity_period_rule  TEXT,
  prohibited_content    TEXT,
  due_text              TEXT,
  raw_text              TEXT NOT NULL,
  document_id           TEXT REFERENCES document(document_id),
  value_status          TEXT NOT NULL DEFAULT 'pending',
  review_status         TEXT NOT NULL DEFAULT 'unreviewed'
);

-- ───────────── 14 연도대응 ─────────────
CREATE TABLE IF NOT EXISTS year_mapping (
  mapping_id            TEXT PRIMARY KEY,
  university_id         TEXT NOT NULL,
  from_year             INTEGER NOT NULL,
  to_year               INTEGER NOT NULL,
  old_ref               TEXT,                       -- 옛 전형/모집단위 원문 이름 또는 ID
  new_ref               TEXT,
  relation_type         TEXT NOT NULL,              -- 동일|명칭변경|분할|통합|신설|폐지|미확인
  eligibility_changed   TEXT,
  evaluation_changed    TEXT,
  seats_changed         TEXT,
  score_formula_changed TEXT,
  csat_min_changed      TEXT,
  comparable            TEXT NOT NULL DEFAULT '미확인',  -- 전체|일부|불가|미확인
  reason                TEXT,
  value_status          TEXT NOT NULL DEFAULT 'pending',
  review_status         TEXT NOT NULL DEFAULT 'unreviewed'
);

-- ───────────── 확장: 원문에서 새로 발견한 중요 조건 ─────────────
CREATE TABLE IF NOT EXISTS extension_fact (
  fact_id        TEXT PRIMARY KEY,
  target_table   TEXT NOT NULL,
  target_record_id TEXT,
  key            TEXT NOT NULL,
  value          TEXT,
  raw_text       TEXT NOT NULL,
  value_status   TEXT NOT NULL DEFAULT 'pending'
);

-- ───────────── 자동 후보(규칙 기반으로 찾은 원문 구간, 아직 구조화 전) ─────────────
-- 전체 확대 단계에서 모든 문서에 대해 만든다. 구조화 테이블로 승격되기 전까지는 사실로 쓰지 않는다.
CREATE TABLE IF NOT EXISTS candidate (
  candidate_id   TEXT PRIMARY KEY,
  document_id    TEXT NOT NULL REFERENCES document(document_id),
  university_id  TEXT,
  kind           TEXT NOT NULL,                     -- ged_eligibility|csat_minimum|ged_conversion|schedule|required_documents|evaluation|results_table
  page_index     INTEGER,
  signals        TEXT,                              -- 걸린 키워드·판별 신호(JSON)
  sub_kind       TEXT,                              -- 예: conversion input_score_kind 추정(practical/ged…)
  raw_text       TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',   -- pending|promoted|rejected
  extractor_version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_candidate ON candidate(university_id, kind);
