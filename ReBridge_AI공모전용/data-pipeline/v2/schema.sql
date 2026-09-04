-- ReBridge 데이터 스키마 v2 — L1 "작업대"
--
-- 왜 SQLite인가
--   파일 하나라 옮기고 백업하기 쉽고, 수만 행에 SQL을 바로 돌릴 수 있다.
--   "환산표 없는 대학 목록" 같은 질문에 스크립트를 새로 짜지 않고 답한다.
--   이 DB는 앱에 들어가지 않는다. 앱이 읽는 건 export_app.py가 뽑아낸 JSON이다.
--
-- 지켜야 할 규칙 3개 (v1이 무너진 지점)
--   1. 모든 사실에는 출처가 붙는다  → 사실 테이블의 source_id는 NOT NULL이다.
--   2. 원본은 고치지 않는다        → source_file은 append만. 재추출은 새 행.
--   3. 없는 건 추정하지 않는다      → 값이 없으면 NULL. 0이나 빈 문자열로 채우지 않는다.
--
-- 학년도 주의
--   2028학년도부터 고교 내신이 5등급 상대평가다(그 이전은 9등급).
--   grade_scale 컬럼으로 구분하며, 다른 체계끼리 합격선을 비교하면 안 된다.

PRAGMA journal_mode = WAL;


-- ════════════════════════════════════════════════════════════════
-- L0 원본 대장 — 모든 사실이 여기를 가리킨다
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS source_file (
  source_id     INTEGER PRIMARY KEY,
  kind          TEXT NOT NULL,      -- plan(시행계획) | result(전형결과) | guideline(모집요강)
                                    -- | standard(공공데이터) | doctrine(법령·기본사항) | manual(수기)
  year          INTEGER,            -- 학년도 (2027, 2028 …)
  title         TEXT NOT NULL,
  path          TEXT,               -- 로컬 원본 경로 (레포 밖일 수 있음)
  sha256        TEXT,               -- 같은 파일 중복 적재 방지
  source_url    TEXT,               -- 1차 출처 URL. 제3자 CDN을 여기 적지 말 것
  publisher     TEXT,               -- 한국대학교육협의회 / 개별 대학 / 교육부 …
  retrieved_at  TEXT,               -- YYYY-MM-DD
  note          TEXT,
  UNIQUE (kind, sha256)
  -- ⚠️ 2026-09-04 추가 (전문대 자료 적재 — ingest_college_results.py).
  --    4년제 자료 대부분은 공공누리(대교협·교육부)라 재배포에 제약이 없었다.
  --    전문대교협/프로칼리지(procollege.kr)는 공공누리 표시가 없고
  --    저작권법상 무단 복제·배포 금지·상업적 이용 시 사전 협의가 필요하다(조사보고.md 참고).
  --    이 차이를 소스 단위로 남겨야 나중에 "이 데이터 재배포해도 되나"를 매번 사람이
  --    새로 조사하지 않는다. 값이 없으면(NULL) "아직 조사 안 함"이지 "공공누리"가 아니다.
  --    이미 있는 DB에는 IF NOT EXISTS가 반영되지 않으므로 ensure_columns()가 ALTER TABLE로 붙인다.
, license TEXT);


-- ════════════════════════════════════════════════════════════════
-- 마스터
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS university (
  univ_id       TEXT PRIMARY KEY,   -- 현행 uA…/슬러그 유지. std_code로 표준화해 나간다
  name          TEXT NOT NULL,
  std_code      TEXT,               -- 공공데이터 표준 학교코드 (붙이면 채운다)
  region        TEXT,
  establishment TEXT,               -- 국립/공립/사립/특별법법인
  kind          TEXT,               -- 대학교/전문대학
  campus        TEXT,               -- 본교/제2캠퍼스 …
  office_url    TEXT,
  lat           REAL,
  lng           REAL
);

-- 모집단위(학과) — v1에 아예 없던 축.
-- 합격선은 학과 단위인데 전형 정보가 대학 단위라 조인이 안 됐다.
CREATE TABLE IF NOT EXISTS program (
  program_id    INTEGER PRIMARY KEY,
  univ_id       TEXT NOT NULL REFERENCES university(univ_id),
  name          TEXT NOT NULL,      -- 원문 그대로 (예: 'CG디자인전공')
  name_key      TEXT NOT NULL,      -- 매칭용 정규화 키
  faculty       TEXT,               -- 계열 (표준데이터로 채운다)
  std_code      TEXT,
  UNIQUE (univ_id, name_key)
);

CREATE INDEX IF NOT EXISTS ix_program_univ ON program(univ_id);


-- ════════════════════════════════════════════════════════════════
-- 전형
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS admission (
  admission_id  INTEGER PRIMARY KEY,
  univ_id       TEXT NOT NULL REFERENCES university(univ_id),
  year          INTEGER NOT NULL,
  phase         TEXT,               -- 수시 | 정시
  type          TEXT,               -- 학생부교과 | 학생부종합 | 논술 | 실기 | 수능위주
  name          TEXT,               -- 실제 전형명
  name_key      TEXT,
  source_id     INTEGER NOT NULL REFERENCES source_file(source_id),
  page          INTEGER,
  confidence    TEXT NOT NULL DEFAULT 'mid',   -- high | mid | low
  status        TEXT NOT NULL DEFAULT 'confirmed',  -- confirmed | baseline
  UNIQUE (univ_id, year, phase, type, name_key)
);

CREATE INDEX IF NOT EXISTS ix_adm_univ_year ON admission(univ_id, year);

-- ⚠️ 2026-09-03 — 위 UNIQUE는 phase/type이 NULL이면 중복을 못 막는다.
-- SQLite는 NULL끼리 서로 다르다고 보기 때문이다(ged_conversion에서 겪은 것과 같은 함정).
-- 두 가지로 막는다.
--   ① 적재 스크립트는 NULL 대신 '미상'을 쓴다 (ingest_ged_2027.py 의 UNKNOWN).
--   ② 그래도 NULL이 들어오면 아래 인덱스가 잡는다.
-- '미상'은 "값이 없다"가 아니라 "원문으로는 못 가른다"는 뜻이다. 추정한 값이 아니다.
CREATE UNIQUE INDEX IF NOT EXISTS ux_admission
  ON admission (univ_id, year, COALESCE(phase, '~'), COALESCE(type, '~'),
                COALESCE(name_key, '~'));

-- 전형별 지원자격 **원문** (2026-09-03 추가 — ingest_ged_2027.py)
--
-- 왜 원문을 통째로 두나
--   2027 대교협 「검정고시 출신자 지원 가능 전형」은 자격 문구 자체가 상품이다.
--   요약하면 앱에서 "원문 보기"를 못 한다. 자르지 않고 그대로 보관한다.
--   한 전형에 세부 지원자격이 여러 갈래인 경우가 흔하다(3,783행 → 전형 2,496건).
--   그래서 seq로 여러 행을 받는다.
CREATE TABLE IF NOT EXISTS admission_requirement (
  admission_id  INTEGER NOT NULL REFERENCES admission(admission_id),
  seq           INTEGER NOT NULL,
  common_text   TEXT,               -- 공통 지원자격 원문
  detail_text   TEXT,               -- 세부 지원자격 원문
  extra_text    TEXT,               -- 기타(추가사항) 원문
  source_id     INTEGER NOT NULL REFERENCES source_file(source_id),
  page          INTEGER,
  PRIMARY KEY (admission_id, seq)
);

-- 원서접수 마감 (2026-09-03 추가 — ingest_ged_2027.py)
-- 대교협 일정표가 **대학 단위**로 고시한다. 전형 축이 아니다.
CREATE TABLE IF NOT EXISTS admission_deadline (
  univ_id       TEXT NOT NULL REFERENCES university(univ_id),
  year          INTEGER NOT NULL,
  phase         TEXT NOT NULL,      -- 수시 | 정시
  close_date    TEXT,               -- YYYY-MM-DD (학년도 −1년 9월 = 수시 접수)
  close_time    TEXT,               -- HH:MM
  raw_label     TEXT,               -- 원문 표기 (예: '동국대(서울･고양)')
  source_id     INTEGER NOT NULL REFERENCES source_file(source_id),
  PRIMARY KEY (univ_id, year, phase)
);

-- 전형 × 모집단위 (모집인원·수능최저는 학과마다 다르다)
CREATE TABLE IF NOT EXISTS admission_program (
  admission_id  INTEGER NOT NULL REFERENCES admission(admission_id),
  program_id    INTEGER NOT NULL REFERENCES program(program_id),
  recruit_count INTEGER,
  csat_min      TEXT,               -- 원문 문구
  csat_min_rule TEXT,               -- 판정 가능한 형태 (예: '2개합5'). 파싱되면 채운다
  eval_method   TEXT,
  interview     INTEGER,            -- 0/1/NULL
  source_id     INTEGER NOT NULL REFERENCES source_file(source_id),
  page          INTEGER,
  confidence    TEXT NOT NULL DEFAULT 'mid',
  PRIMARY KEY (admission_id, program_id)
);


-- ════════════════════════════════════════════════════════════════
-- 검정고시 — 앱의 존재 이유
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ged_eligibility (
  admission_id  INTEGER PRIMARY KEY REFERENCES admission(admission_id),
  eligible      TEXT NOT NULL,      -- 가능 | 불가 | 조건부
  reason        TEXT,               -- 불가/조건부일 때 사유 (차갑지 않게)
  reflection    TEXT,               -- 검정고시 성적을 어떻게 보는지
  source_id     INTEGER NOT NULL REFERENCES source_file(source_id),
  page          INTEGER,
  quote         TEXT,               -- 근거 원문 발췌. 사람이 검증할 때 이게 전부다
  confidence    TEXT NOT NULL DEFAULT 'mid'
);

-- 대학 단위 검정고시 지원 가부 (2026-09-03 신설)
--
-- 왜 따로 두나
--   ged_eligibility 는 admission_id 가 PK라서 **전형이 파싱된 대학만** 담을 수 있다.
--   그런데 시행계획 규칙 판정(ingest_plans.judge_ged)은 전형 파싱과 무관하게
--   대학 단위로 나온다. 이 결과가 갈 곳이 없어서 131건이 통째로 DB 밖에 있었다.
--   → 전형 축과 분리해 대학 단위로 받는다.
--
-- '판정불가'도 행으로 남긴다. 비워 두면 "안 봤다"와 "봐도 모르겠다"가 구분되지 않는다.
-- verdict='판정불가' 는 사람이 검토해야 할 목록이다(DECISIONS 2026-09-02).
CREATE TABLE IF NOT EXISTS ged_eligibility_univ (
  univ_id       TEXT NOT NULL REFERENCES university(univ_id),
  year          INTEGER NOT NULL,
  verdict       TEXT NOT NULL,      -- 가능 | 불가 | 조건부 | 확인필요 | 판정불가
  quote         TEXT,               -- 근거 원문 발췌. 사람이 검증할 때 이게 전부다
  page          INTEGER,            -- 근거 페이지
  evidence_pages TEXT,              -- 판정불가일 때도 볼 곳은 알려준다 (예: '7,8,12')
  rule          TEXT,               -- 어떤 규칙에 걸렸는지
  hits          INTEGER,            -- 같은 대학에서 잡힌 근거 문구 수
  source_id     INTEGER NOT NULL REFERENCES source_file(source_id),
  confidence    TEXT NOT NULL DEFAULT 'mid',
  judged_by     TEXT NOT NULL DEFAULT 'rule',   -- rule | human
  reviewed_at   TEXT,               -- 사람이 검토한 날. NULL = 아직 아무도 안 봤다
  PRIMARY KEY (univ_id, year)
);

CREATE INDEX IF NOT EXISTS ix_gedu_verdict ON ged_eligibility_univ(year, verdict);


-- 비교내신 환산표 — 앱의 심장.
-- v1은 188개 대학의 원문 텍스트(평균 1,170자)만 갖고 있고
-- 실제로 계산에 쓸 수 있는 구조화된 표는 10개뿐이었다.
CREATE TABLE IF NOT EXISTS ged_conversion (
  conversion_id INTEGER PRIMARY KEY,
  univ_id       TEXT NOT NULL REFERENCES university(univ_id),
  year          INTEGER NOT NULL,
  admission_id  INTEGER REFERENCES admission(admission_id),  -- 전형별로 다르면 채운다
  raw_text      TEXT,               -- 원문 그대로 (구조화 전 단계)
  raw_type      TEXT,               -- numeric_table | comparative_prose | eligibility_prose
                                    -- | ged_block | deferred
  table_json    TEXT,               -- 구조화된 표. 이게 있어야 계산이 된다
  table_type    TEXT,               -- grade_table | score_table | score_formula
                                    -- | formula_complex | subject_weighted
  -- ⚠️ 2026-09-03 추가. 한 대학 시행계획 안에 5등급표와 9등급표가 나란히 실려 있다.
  --    (2028학년도부터 5등급. '2027년 이전 졸업자'용 9등급 표를 따로 싣는다)
  --    구분하지 않고 섞으면 검정고시생에게 완전히 틀린 환산점수가 나간다.
  --    원문에 단서가 없으면 NULL로 둔다 — 추정하지 않는다(규칙 3).
  grade_scale   TEXT,               -- '5' | '9' | NULL(원문에 단서 없음)
  applies_to    TEXT,               -- 검정고시 | 재학생 | 불명
  phase         TEXT,               -- 수시 | 정시 | NULL(구분 없음 또는 둘 다)
  max_score     REAL,
  min_score     REAL,
  source_id     INTEGER NOT NULL REFERENCES source_file(source_id),
  page          INTEGER,
  confidence    TEXT NOT NULL DEFAULT 'mid',
  -- ⚠️ 2026-09-03 추가 (2027 모집요강 적재).
  --    검정고시 비교내신 산출식은 **모집요강에만** 있다. 시행계획에는 없다.
  --    모집요강에서 새로 나온 것들을 담기 위해 컬럼만 덧붙였다(기존 컬럼은 그대로).
  grade_bands_json      TEXT,   -- ★ 평균점수 구간 → 등급. 앱에서 가장 중요하다.
                                --   [{"grade":1,"raw":"100~97","lo":97,"hi":100,"kind":"range"} …]
                                --   검정고시생이 가진 건 '평균점수'다. 이게 있어야 등급이 나온다.
  score_bands_json      TEXT,   -- 등급 없이 '점수 구간 → 환산점수'만 있는 표
  percentile_bands_json TEXT,   -- 석차백분율 구간(재학생용). 검정고시 계산에 쓰면 안 된다.
  formula_text          TEXT,   -- 산식이 문장이면 그 원문(JSON 배열: page+text)
  quote                 TEXT,   -- 표 원문 그대로. 사람이 검증할 때 이게 전부다
  source_file           TEXT,   -- '{대학명}/susi.pdf'
  table_label           TEXT,
  validation            TEXT,   -- pass | fail
  validation_note       TEXT,   -- 실패 사유(단조성·범위·등급 수·정렬)
  kind                  TEXT    -- 구간표 | 환산표 | 구간표+환산표 | 구간→점수표 | 산문만
);

-- ⚠️ UNIQUE(univ_id, year, admission_id)로는 중복이 막히지 않는다.
-- SQLite는 NULL끼리 서로 다르다고 보기 때문에, 대학 단위 환산표(admission_id IS NULL)가
-- 얼마든지 중복 삽입된다(2026-09-02 실측: 188 + 84 = 272행으로 불어남).
-- COALESCE로 NULL을 -1로 바꿔서 잡는다.
-- ⚠️ 2026-09-03 축 변경. 2027 모집요강은 **수시·정시가 따로** 온다
-- (한 대학이 수시용 비교내신표와 정시용 비교내신표를 다르게 쓴다).
-- 기존 ux_conversion 은 phase 를 안 봐서 둘째 행이 통째로 막혔다.
-- 컬럼은 하나도 바꾸지 않고 유니크 축에 phase 만 더한다.
DROP INDEX IF EXISTS ux_conversion;
CREATE UNIQUE INDEX IF NOT EXISTS ux_conversion_v2
  ON ged_conversion (univ_id, year, COALESCE(admission_id, -1), COALESCE(phase, ''));


-- ════════════════════════════════════════════════════════════════
-- 입시결과 — 학과 단위가 원본이다. 뭉개지 말 것.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cutline (
  cutline_id    INTEGER PRIMARY KEY,
  univ_id       TEXT NOT NULL REFERENCES university(univ_id),
  program_id    INTEGER REFERENCES program(program_id),   -- NULL = 대학 전체 집계
  year          INTEGER NOT NULL,           -- 결과 학년도 (2025, 2026 …)
  grade_scale   TEXT,                       -- '9' | '5' — 다른 체계끼리 비교 금지
  phase         TEXT,
  admission_type TEXT,
  admission_name TEXT,
  cut_type      TEXT NOT NULL,              -- 70%컷 | 80%컷 | 50%컷 | 평균 | 최종등록 | 최저
                                            -- | 미제출 (값 없음. 경쟁률·모집인원만 있는 행)
  cut_grade     REAL,
  cut_score     REAL,
  recruit_count INTEGER,
  competition   REAL,                       -- 경쟁률
  fill_rate     REAL,                       -- 충원율(추가합격). 검정고시생에게 특히 중요
  source_id     INTEGER NOT NULL REFERENCES source_file(source_id),
  page          INTEGER,
  confidence    TEXT NOT NULL DEFAULT 'mid',
  note          TEXT,
  -- ⚠️ 2026-09-03 추가 (어디가 CSV 적재분). 기존 컬럼은 하나도 손대지 않았다.
  --    이미 만들어진 DB에는 CREATE TABLE IF NOT EXISTS가 반영되지 않으므로
  --    parse_adiga_csv.ensure_columns()가 ALTER TABLE로 없는 것만 붙인다.
  campus            TEXT,     -- 본교 | 제2캠퍼스 … (univ_id 하나에 캠퍼스가 여럿 접힌다)
  recruit_initial   INTEGER,  -- 모집인원 최초(A)
  recruit_carryover INTEGER,  -- 모집인원 이월(B)   ※ recruit_count = 최종(A+B)
  fill_count        INTEGER,  -- 충원인원(명). fill_rate(율)와 다르다 — 원문 그대로 둔다
  max_score         REAL,     -- 총점(만점). 환산점수가 몇 점 만점인지
  pct_avg           REAL,     -- 정시 평균 백분위 (그 행의 cut_type이 가리키는 컷의 값)
  csat_detail       TEXT,     -- 정시 영역별 백분위·등급 JSON (국어/수학/탐구/한국사/영어)
  admission_subtype TEXT      -- 전형명에 논술·실기·면접이 보일 때만. 대분류는 바꾸지 않는다
);

CREATE INDEX IF NOT EXISTS ix_cut_univ_year ON cutline(univ_id, year);
CREATE INDEX IF NOT EXISTS ix_cut_program   ON cutline(program_id);
CREATE INDEX IF NOT EXISTS ix_cut_type      ON cutline(year, admission_type);


-- ════════════════════════════════════════════════════════════════
-- 대학알리미 '신입생의 출신 고등학교 유형별 현황' — 검정고시 출신 신입생 수
-- ⚠️ 2026-09-03 신규 추가. v2/out/academyinfo/ged_freshmen_by_univ.jsonl(613행,
--    캠퍼스 합산본) 적재용. 캠퍼스별 원본은 ged_freshmen.jsonl(729행)에 별도 있다 —
--    이중계상 방지를 위해 이 테이블은 합산본만 담는다.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ged_freshmen (
  ged_freshmen_id INTEGER PRIMARY KEY,
  univ_id       TEXT NOT NULL REFERENCES university(univ_id),
  year          INTEGER NOT NULL,
  ged_count     INTEGER,            -- 검정고시 출신 신입생 수
  total_count   INTEGER,            -- 총 신입생 수
  ratio         REAL,               -- 검정고시 비율(%)
  source_file   TEXT                -- 'academyinfo/4자_출신고교유형_{year}.xlsx'
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ged_freshmen ON ged_freshmen(univ_id, year);


-- ════════════════════════════════════════════════════════════════
-- 적재 이력 — 언제 무엇을 넣었는지
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ingest_log (
  ingest_id     INTEGER PRIMARY KEY,
  ran_at        TEXT NOT NULL,
  script        TEXT NOT NULL,
  target        TEXT,
  rows_in       INTEGER,
  rows_out      INTEGER,
  note          TEXT
);


-- ════════════════════════════════════════════════════════════════
-- 조회용 뷰
-- ════════════════════════════════════════════════════════════════

-- 합격선 + 대학명 + 학과명 (사람이 눈으로 검증할 때 쓰는 뷰)
CREATE VIEW IF NOT EXISTS v_cutline AS
SELECT c.cutline_id, u.name AS univ, p.name AS program,
       c.year, c.grade_scale, c.phase, c.admission_type, c.admission_name,
       c.cut_type, c.cut_grade, c.cut_score, c.recruit_count, c.competition,
       c.confidence, s.title AS source, c.page
FROM cutline c
JOIN university u  ON u.univ_id = c.univ_id
LEFT JOIN program p ON p.program_id = c.program_id
JOIN source_file s ON s.source_id = c.source_id;

-- 대학별 데이터 충족도 — "어디가 비어 있나"를 한 줄로
CREATE VIEW IF NOT EXISTS v_coverage AS
SELECT u.univ_id, u.name, u.kind, u.region,
       (SELECT COUNT(*) FROM admission a WHERE a.univ_id = u.univ_id
          AND a.status = 'confirmed')                            AS n_admission,
       (SELECT COUNT(*) FROM ged_eligibility g
          JOIN admission a ON a.admission_id = g.admission_id
          WHERE a.univ_id = u.univ_id)                           AS n_ged,
       (SELECT COUNT(*) FROM ged_conversion v
          WHERE v.univ_id = u.univ_id AND v.table_json IS NOT NULL) AS n_conversion,
       (SELECT COUNT(*) FROM cutline c WHERE c.univ_id = u.univ_id) AS n_cutline,
       (SELECT COUNT(DISTINCT c.program_id) FROM cutline c
          WHERE c.univ_id = u.univ_id AND c.program_id IS NOT NULL) AS n_cut_program
FROM university u;
