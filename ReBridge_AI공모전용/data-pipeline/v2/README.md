# 데이터 파이프라인 v2

> 2026-09-02 작성. v1이 무너진 지점을 고치고 27·28·29학년도를 받을 준비를 해 둔 것.

## 왜 v2를 만들었나

v1은 앱이 읽는 큰 JSON을 직접 손으로 만들어 왔다. 그 결과 세 가지가 무너졌다.

| 무너진 것 | 실제로 벌어진 일 |
|---|---|
| **출처가 사라졌다** | 합격선 264블록에 `source`가 0개. "이 숫자 어디서 나왔냐"에 답할 수 없었다 |
| **학과 축이 사라졌다** | 원천 14,274행에 학과가 100% 있는데 264블록으로 뭉개면서 버렸다 |
| **라벨이 틀렸다** | 80%컷·50%컷을 `평균`이라고 표시하고 있었다 (앱이 사용자에게 그대로 보여줬다) |

v2는 층을 나눠서 이 셋이 다시 무너지지 않게 한다.

```
L0  원본 창고     PDF·XLSX 원본 + sha256 + 출처 URL      절대 수정하지 않는다
      ↓ 파싱
L1  작업대        SQLite 파일 하나 (out/rebridge.db)     여기서 검증한다
      ↓ 추출
L2  배포용        앱이 읽는 JSON                          작게 쪼갠다
```

**지켜야 할 규칙 3개**
1. 모든 사실에는 출처가 붙는다 — `source_id`는 `NOT NULL`이다.
2. 원본은 고치지 않는다 — 잘못 뽑았으면 규칙을 고치고 다시 돌린다.
3. 없는 건 추정하지 않는다 — 값이 없으면 `NULL`. 0이나 빈 문자열로 채우지 않는다.

---

## 📥 원본 자료를 어디에 놓으면 되나

**폴더에 넣고 아래 명령만 그대로 복사해서 붙여넣으시면 됩니다.
파일 이름은 바꾸실 필요 없습니다.**

기준 폴더는 여기 하나입니다.

```
ReBridge_AI공모전용/Application_main_codes/src/data/pdf_sources/
```

| 넣을 폴더 | 무엇을 넣나 | 예상 개수 |
|---|---|---|
| `plans_2028_full/` | **2028학년도 시행계획 전문** (지금 있는 213개는 발췌본) | 213± |
| `plans_2027/` | 2027학년도 시행계획 | 200± |
| `results_2026/` | 2026학년도 대입 전형결과 (지역별 PDF) | 30± |
| `ged_eligible_2027/` | 2027 검정고시 지원가능 전형 PDF (5권역) | 5 |
| `guides_2027/{univ}/susi.pdf`<br>`guides_2027/{univ}/jeongsi.pdf` | 2027 모집요강 (대학별 폴더) | 대학당 1~2 |

`{univ}` 는 대학 이름 그대로 쓰시면 됩니다 — `guides_2027/중앙대학교/susi.pdf` 처럼요.
(`univId` 를 외우실 필요 없습니다. 이름으로 매칭합니다.)

이 폴더는 `.gitignore` 대상이라 GitHub에 올라가지 않습니다(현재 234MB).

### 폴더를 미리 만들어 두려면

```bash
cd ReBridge_AI공모전용/Application_main_codes/src/data/pdf_sources
mkdir -p plans_2028_full plans_2027 results_2026 ged_eligible_2027 guides_2027
```

### 파일 이름 규칙

시행계획은 어디가에서 받으면 대개 이 형태입니다. **그대로 두시면 됩니다.**

```
가톨릭관동대학교[강원][본교]_2028_시행계획(1차수).pdf
건국대학교(글로컬)[충북][분교]_2028_시행계획(1차수).pdf
```

- 대괄호 안 첫 번째가 지역, 두 번째가 캠퍼스 → 같은 이름 대학을 자동으로 가릅니다
- 이름이 다른 형태여도 됩니다. 매칭 실패하면 목록으로 알려줍니다
- ⚠️ **맥에서 만든 파일명은 한글이 자모 분리(NFD)로 저장됩니다.** 정규화 없이 비교하면
  눈에는 같아 보여도 전부 불일치합니다(실측: 213개 중 일치 0건 → 정규화 후 213건).
  `common.nfc()`가 처리하므로 신경 쓰지 않으셔도 됩니다.
- ⚠️ **한 대학의 캠퍼스별 PDF는 지금 한 칸에 덮어쓰기 됩니다.**
  `universities.json` 에 캠퍼스가 따로 없어서, 213개 PDF가 대학 **192개**로 접힙니다
  (가톨릭대 3개, 강원대 4개 …). 캠퍼스를 갈라야 하면 대학 마스터부터 고쳐야 합니다.

---

## 🚀 자료가 도착하면 실행할 순서

아래 명령은 전부 `ReBridge_AI공모전용/data-pipeline` 안에서 돌립니다.

```bash
cd ~/dev/GitHub/ReBridge/ReBridge_AI공모전용/data-pipeline
```

**모든 스크립트는 끝에 처리/미처리 수를 숫자로 찍습니다.
숫자가 안 나오면 실패한 것으로 보십시오.**

---

### ① 2028학년도 시행계획 **전문** → `plans_2028_full/`

```bash
# 1. PDF → 페이지별 텍스트 (213개에 약 6초. LLM 안 씀, 비용 0)
python3 v2/extract_text.py --year 2028 --force \
        --pdf-dir ../Application_main_codes/src/data/pdf_sources/plans_2028_full

# 2. 검정고시 지원자격 + 비교내신 환산표 추출 → L1 적재 (약 70초)
python3 v2/ingest_plans.py --year 2028 --to-db

# 3. 앱 "원문 보기"용 원문 뽑기
python3 v2/extract_ged_text.py --year 2028

# 4. 앱 JSON 갱신 (먼저 --dry-run 으로 무엇이 바뀌는지 보고)
python3 v2/export_app.py --year 2028 --dry-run
python3 v2/export_app.py --year 2028 --write
```

`--force` 는 기존 발췌본 텍스트 캐시를 버리고 전문으로 다시 만들라는 뜻입니다.

**기대 산출물**

| 파일 | 내용 |
|---|---|
| `v2/out/text/2028/{univId}.jsonl` | 페이지별 원문 |
| `v2/out/plans_2028/ged.jsonl` | 검정고시 가부 판정 + 근거 발췌 |
| `v2/out/plans_2028/conversion.jsonl` | 비교내신 환산표 |
| `v2/out/plans_2028/ged_text/{univId}.json` | 원문 보기 재료 |
| `v2/out/export_report.md` | 앱에 못 넣은 표와 그 이유 |
| `src/data/comparative_2028.json` | 앱이 읽는 환산표 (백업 `.json.bak` 자동 생성) |

**보고 형식** — 각 단계가 이런 줄을 찍습니다.

```
PDF 213개 → 텍스트화 213개 / 대학 매칭 실패 0개 / 스캔본(OCR 필요) 1개
대학 213 · ged:가능 87 · ged:불가 34 · ged:조건부 8 · ged:확인필요 2 · ged:판정불가 82
등급체계 분류: 5등급 10 / 9등급 72 / 분류불가(NULL) 2
원문 뽑힘 186/192개 · 검정고시 관련 페이지 0인 대학 6개
검증 통과 51개 / 검증 탈락 20개 / 기존 값과 다름 5개
```

---

### ② 2027학년도 시행계획 → `plans_2027/`

```bash
python3 v2/extract_text.py --year 2027 \
        --pdf-dir ../Application_main_codes/src/data/pdf_sources/plans_2027
python3 v2/ingest_plans.py --year 2027 --to-db
python3 v2/extract_ged_text.py --year 2027
```

2027은 **9등급 체계**입니다(2028부터 5등급). `grade_scale` 이 자동으로 갈립니다.
`comparative_2027.json` 은 아직 없으므로 `export_app.py --year 2027` 은
앱 쪽에 그 파일을 만든 뒤에 돌리십시오.

---

### ③ 2026학년도 전형결과 → `results_2026/`

```bash
# 1. PDF → 1차 JSON  (34개 PDF에 약 60초)
python3 extract_results_2025.py --year 2026 \
        --src ../Application_main_codes/src/data/pdf_sources/results_2026

# 2. 2차 정제 (학과명 정리, 등급/점수 분리행 병합, 이상치 플래그)
python3 clean_results_2026.py 2>/dev/null || python3 clean_results_2025.py --year 2026

# 3. L1 적재
python3 v2/ingest_results.py --year 2026 --src results_2026_clean.json --to-db
```

> 스크립트 이름이 `..._2025` 인 것은 v1 시절 이름이 남은 것뿐입니다.
> `--year` 로 연도를 받으므로 **2026 자료에 그대로 쓰시면 됩니다.**

**기대 산출물**: `results_2026.json` → `results_2026_clean.json` →
`reports/results_2026_report.md`, `reports/results_2026_clean_report.md`

**보고 형식**

```
PDFs: 34 / Pages: 1879 / Rows: 38,108
cutType 분포: 70%컷 18,138, 50%컷 17,027, 최종등록 1,506, 평균 888, 80%컷 430, 최저 119
confidence 분포: high 32,399, mid 4,587, low 1,122
OCR 필요 추정 페이지: 637      ← 이미지 페이지. 이 숫자만큼은 못 읽은 것입니다
```

⚠️ **이미지 PDF는 표가 안 읽힙니다.** 2025에서는 중앙대·인하대·한양대·충남대·전북대가
그래서 통째로 비었고, 따로 뽑아 `results_2025_scraped_supplement.json` 에 보관해 뒀습니다.
같은 연도에 `results_{year}_scraped_supplement.json` 이 있으면 정제 단계가 자동으로 합칩니다.
OCR이 필요하면 v1 `ocr_recover_b.py` 를 참고하십시오.

---

### ④ 2027 검정고시 지원가능 전형 (5권역) → `ged_eligible_2027/`

이 5개 PDF는 **형식이 시행계획과 다릅니다.** 전용 파서가 아직 없습니다.
파일을 넣으신 뒤 알려 주시면 형식을 보고 파서를 만듭니다.
그 전까지는 텍스트만 떠서 눈으로 확인할 수 있습니다.

```bash
python3 v2/extract_text.py --year 2027 \
        --pdf-dir ../Application_main_codes/src/data/pdf_sources/ged_eligible_2027
```

---

### ⑤ 2027 모집요강 → `guides_2027/{univ}/susi|jeongsi.pdf`

모집요강은 시행계획보다 상세하지만 대학마다 구조가 훨씬 다릅니다.
**전용 파서가 아직 없습니다.** 먼저 텍스트만 떠 두고, 어떤 항목이 필요한지
정한 다음에 뽑는 것이 맞습니다(틀린 전형 정보는 없는 것보다 나쁩니다).

---

### ⑥ 어디까지 찼는지 확인 — 항상 마지막에

```bash
python3 v2/check.py          # 학년도 × 대학 커버리지 (351개 중 몇 개)
python3 v2/check.py --gaps   # 비어 있는 곳 목록
```

`check.py` 는 항목마다 **처리 / 미처리**를 둘 다 찍습니다.
"완료"라는 말 대신 이 숫자를 보십시오.

```
  ── 학년도 × 대학 커버리지 (전체 351개 대학 기준) ──
    학년도               전형        검정고시가부         환산표         합격선
    2028        186/351      120/351       77/351        0/351
                 미처리 165     미처리 231     미처리 274     미처리 351
    ※ 2028학년도 검정고시 가부 '판정불가'(사람 검토 대기): 72개 대학
```

---

## 📚 어떤 자료를 어디서 구하나

### ❌ API가 없는 것 — PDF 말고 방법이 없다

앱의 핵심 데이터는 전부 API가 없습니다. 2026-09-02에 직접 확인했습니다.

| 필요한 것 | 어디서 | 형태 |
|---|---|---|
| **대학입학전형 시행계획** (검정고시 지원자격·**비교내신 환산표**) | [어디가 대입정보자료실](https://www.adiga.kr/uct/ces/archiveView.do?menuId=PCUCTCES1000&prtlBbsId=26997) / 각 대학 입학처 | PDF |
| **대학별 입시결과(합격선)** | [어디가 전형 평가기준 및 전년도 결과공개](https://www.adiga.kr/uct/acd/ade/criteriaAndResultView.do?menuId=PCUCTACD2000) (2018~2027, 201개 대학) + 지역별 전형결과 PDF | 웹조회 / PDF |
| **모집요강** | 각 대학 입학처 | PDF |

어디가 자료실은 **총 2,450건**, 모집학년도 필터가 **2016~2028**입니다.
페이지 이동이 `javascript:void(0)`라 URL로 넘길 수 없어, 크롤러를 만들려면 POST 폼 분석이 필요합니다.

### ✅ API가 있는 것 — 보조 데이터

| 데이터 | 제공 | 최종수정 | 쓸 곳 |
|---|---|---|---|
| [전국대학및전문대학정보 표준데이터](https://www.data.go.kr/data/15107736/standard.do) | 한국대학교육협의회 | 2026-03-19 | 대학 마스터 표준화 |
| [전국대학별학과정보 표준데이터](https://www.data.go.kr/data/15107737/standard.do) | 한국대학교육협의회 | 2026-03-19 | **학과(program) 축의 기준** |
| [전국대학별입학정원정보 표준데이터](https://www.data.go.kr/data/15107731/standard.do) | 한국교육개발원 | 2026-08-21 | 모집인원 |
| [교육부 커리어넷 대학학과정보](https://www.data.go.kr/data/15057878/openapi.do) | 교육부 | 2025-05-27 | 학과 소개 (**키 이미 보유**) |

파일 다운로드는 5만 건 제한이 있어 전체가 필요하면 오픈API를 써야 합니다.

### ⚠️ 확인이 필요한 것

아래 셋은 검색에는 나오는데 접속하면 404였습니다. **로그인한 상태에서 재확인 필요**합니다.
데이터셋 ID가 바뀌었거나 폐지됐을 수 있습니다.

- 한국대학교육협의회 대학알리미 대학 기본 정보 (15037507)
- 한국대학교육협의회 대학별 학과정보 (15116892)
- 대학알리미 OpenAPI (academyinfo.go.kr) — 신입생 충원율·경쟁률이 여기 있을 것

---

## 🗓 학년도 — 무엇이 존재하고 무엇이 아직 없나

| 학년도 | 시행계획 | 입시결과 | 내신 | 지금 상태 |
|---|---|---|---|---|
| 2025 | — | ✅ 있음 | 9등급 | 14,274행 보유 |
| 2026 | — | ✅ 나와 있음 | 9등급 | **원본 확보 예정** |
| **2027** | ✅ 2025-04 발표 | 어디가에 공개됨 | 9등급 | **지금 원서 쓰는 연도. 1순위** |
| 2028 | ✅ 2026-04 발표 | ❌ 존재 불가 | **5등급** | PDF 213개 보유 |
| 2029 | ❌ **아직 없음** | ❌ | 5등급 | 2027-04 발표 예정 |

**2029학년도 시행계획은 아직 세상에 없습니다.**
시행계획은 입학연도 2년 전 4월에 공표됩니다(2027→2025.04, 2028→2026.04).
어디가 자료실의 모집학년도 필터도 **최대 2028**까지만 있습니다. 찾으실 필요 없습니다.

### ⚠️ 2028부터 내신이 5등급이라 과거 합격선과 비교가 안 됩니다

2028학년도부터 고교 내신이 5등급 상대평가입니다(그 전은 9등급).
**2028은 5등급 첫 세대라 참고할 과거 합격선이 원리적으로 존재하지 않습니다.**
2028 결과는 2028년 초에나 나옵니다.

→ 2028·2029 지원자에게 줄 수 있는 것은 합격선이 아니라
**비교내신 환산 결과 + 모집인원 + 경쟁률 추세**입니다.
`cutline.grade_scale` 컬럼과 `cutlines_2025.json`의 `src.gradeScale`이 이 구분을 담고 있습니다.

---

## 파일 설명

| 파일 | 하는 일 |
|---|---|
| `common.py` | NFC 정규화, 대학명↔univId 매칭, 경로, DB 연결 |
| `schema.sql` | L1 스키마. 출처 없는 행을 못 넣게 막는다 |
| `build_db.py` | v1 자산 전부를 L1에 적재 |
| `extract_text.py` | Phase A — PDF → 페이지별 텍스트 (캐시됨) |
| `ingest_plans.py` | Phase B+C — 검정고시 지원자격 + 환산표 추출 |
| `ingest_results.py` | 전형결과(합격선) 적재 |
| `extract_ged_text.py` | 앱 "원문 보기"용 검정고시 관련 페이지 원문 추출 |
| `export_app.py` | 검증 통과한 환산표만 앱 JSON으로 내보냄 |
| `rebuild_cutlines.py` | 합격선 재집계 → 앱용 JSON |
| `check.py` | 어디가 비었는지 한 화면으로 (학년도 × 대학 커버리지) |

v1 쪽에서 계속 쓰는 것:

| 파일 | 하는 일 |
|---|---|
| `../extract_results_2025.py` | 전형결과 PDF → 1차 JSON. `--year --src` 로 연도 지정 |
| `../clean_results_2025.py` | 1차 JSON 2차 정제. `--year --src` 로 연도 지정 |
| `../results_{year}_scraped_supplement.json` | 이미지 PDF라 못 읽은 대학의 보충분. 정제 단계가 자동 병합 |

산출물은 전부 `v2/out/` 아래에 생기고 git에 올라가지 않습니다.

## 사람이 봐야 하는 것

### 1. 검정고시 지원 가부 — 자동으로 확정하지 않습니다

표로 지원 가부가 갈리는 대학(행: 출신고교 유형, 열: 전형)은 `확인필요`로,
규칙에 아무것도 안 걸린 대학은 `판정불가`로 뺍니다.
전부 `ged_eligibility_univ` 테이블과 `out/plans_{year}/ged.jsonl` 에
**근거 페이지·원문 발췌와 함께** 쌓입니다.

```bash
# 사람이 볼 목록
python3 v2/check.py --sql "SELECT univ_id, verdict, page, evidence_pages
                           FROM ged_eligibility_univ
                           WHERE year=2028 AND verdict IN ('판정불가','확인필요')"
```

사람이 판정하면 `verdict` 를 고치고 `judged_by='human'`, `reviewed_at` 에 날짜를 넣습니다.
`reviewed_at IS NULL` 이면 **아직 아무도 안 본 것**입니다.

지원 가부는 틀리면 학생이 헛되이 지원하게 되는 항목이라 **추측하지 않습니다.**

### 2. 환산표 — 검증에 떨어진 것

`export_app.py` 는 검증을 통과한 표만 앱에 넣습니다.
떨어진 표는 지우지 않고 `out/export_report.md` 에 **대학과 이유**가 적힙니다.

### 3. 환산표 — 기존 값과 달라진 것

이미 `conversion` 이 들어 있는 대학은 **기본적으로 덮어쓰지 않습니다.**
기존 항목에는 대학이 직접 실은 '백점만점성적' 구간이 들어 있는데,
자동 추출표에는 그 구간이 없어 앱 표준 추정 구간을 쓰기 때문입니다.
차이는 리포트에 적히고, 원문을 보고 사람이 정하면 됩니다
(덮어쓸 때만 `--overwrite-existing`).
