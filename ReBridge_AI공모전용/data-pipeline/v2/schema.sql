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
);


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
  max_score     REAL,
  min_score     REAL,
  source_id     INTEGER NOT NULL REFERENCES source_file(source_id),
  page          INTEGER,
  confidence    TEXT NOT NULL DEFAULT 'mid'
);

-- ⚠️ UNIQUE(univ_id, year, admission_id)로는 중복이 막히지 않는다.
-- SQLite는 NULL끼리 서로 다르다고 보기 때문에, 대학 단위 환산표(admission_id IS NULL)가
-- 얼마든지 중복 삽입된다(2026-09-02 실측: 188 + 84 = 272행으로 불어남).
-- COALESCE로 NULL을 -1로 바꿔서 잡는다.
CREATE UNIQUE INDEX IF NOT EXISTS ux_conversion
  ON ged_conversion (univ_id, year, COALESCE(admission_id, -1));


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
  cut_grade     REAL,
  cut_score     REAL,
  recruit_count INTEGER,
  competition   REAL,                       -- 경쟁률
  fill_rate     REAL,                       -- 충원율(추가합격). 검정고시생에게 특히 중요
  source_id     INTEGER NOT NULL REFERENCES source_file(source_id),
  page          INTEGER,
  confidence    TEXT NOT NULL DEFAULT 'mid',
  note          TEXT
);

CREATE INDEX IF NOT EXISTS ix_cut_univ_year ON cutline(univ_id, year);
CREATE INDEX IF NOT EXISTS ix_cut_program   ON cutline(program_id);
CREATE INDEX IF NOT EXISTS ix_cut_type      ON cutline(year, admission_type);


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
