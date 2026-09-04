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

#### ③-A 어디가 대학별 CSV (2026-09-03 도입 · **이쪽이 정본**)

`results_2026/adiga/` 에 캠퍼스별 CSV 197개 + `manifest.csv` 가 있다.
PDF가 아니라 **HTML 표를 그대로 뽑은 CSV**라 아래 PDF 파서(③-B)를 쓸 수 없다.
전용 파서는 `v2/parse_adiga_csv.py` 다.

```bash
python3 v2/parse_adiga_csv.py                          # 파싱 + 통계만 (아무것도 안 씀)
python3 v2/parse_adiga_csv.py --to-db --export --jsonl # L1 적재 + 앱 JSON + 학과 JSONL
```

| 산출물 | 내용 |
|---|---|
| L1 `cutline` (year=2026) | 64,233행 · 대학 183개 · 전 행 `source_id` 있음 |
| `src/data/cutlines_2026.json` | 앱용 집계 452블록 / 대학 176개 (+ 최상위 `meta`) |
| `v2/out/cutlines_2026_programs.jsonl` | 학과 단위 42,785행 (앱 번들에 넣지 않음) |
| `v2/out/cutlines_2026_report.md` | 커버리지 + 학년도 검증 근거 |

⚠️ **학년도** — manifest URL의 `searchSyr=2027`은 **2027학년도 안내 페이지** 주소이고,
그 안의 `tsrdCmphSlcnArtclUpCd=30` 탭이 **"2026학년도 전형 결과"**다. 담긴 값은 2026학년도다.
검증 근거는 `parse_adiga_csv.py` 상단 주석과 리포트에 적어 뒀다.

⚠️ 어디가 전형결과 공개는 **학생부교과·학생부종합·수능위주 세 갈래뿐**이다.
논술·실기 전형 결과는 이 자료에 없다.

⚠️ 어디가에서 **못 구한 대학 30개**가 있다(포항공대·KAIST·한서대·배재대 등).
목록은 `manifest.csv` 의 '못 구함' 행과 리포트에 그대로 있다.

#### ③-B 지역별 전형결과 PDF (기존 경로)

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

**2026-09-03 완료.** 전용 파서는 `v2/ingest_ged_2027.py` 입니다.
시행계획과 달리 이 5권역 PDF는 대교협이 만든 하나의 표라 6열이 전부 고정입니다.
그래서 시행계획에서는 포기했던 **전형 축을 그대로 읽을 수 있습니다.**

```
지역 | 대학 | 전형명 | 공통 지원자격 | 세부 지원자격 | 기타(추가사항)
```

```bash
python3 v2/ingest_ged_2027.py --extract                  # PDF 755쪽 → 3,783행 (약 35초)
python3 v2/ingest_ged_2027.py --build --to-db            # 정규화 + L1 적재
python3 v2/ingest_ged_2027.py --export --write           # 앱용 JSON 설치
```

**기대 산출물**

| 파일 | 내용 |
|---|---|
| `v2/out/ged_2027/rows.jsonl` | 표 원본 6열 (3,783행) |
| `v2/out/ged_2027/deadlines.json` | 수시 접수마감 표 원본 |
| `v2/out/ged_2027/report.md` | 커버리지 리포트 |
| `src/data/admissions_2027.json` | 앱 번들용 **요약본** (전형 목록·가부·마감일) |
| `src/data/ged_eligible_2027_text.json` | **원문본**. 앱이 "원문 보기"로 지연 로드 |

L1에는 `admission`(year=2027) · `admission_requirement`(자격 원문) ·
`ged_eligibility`(전형별 가부) · `admission_deadline`(대학별 마감) 으로 들어갑니다.

**이 자료를 읽을 때 알아야 할 것 세 가지**

1. **수록 = 지원 가능.** 제목이 「검정고시 출신자 **지원 가능** 전형」이라 표에 실린 것
   자체가 가부 판정입니다. 세부 지원자격에 검정고시를 제한하는 문구가 있을 때만
   `조건부`로 낮추고 **그 문구를 인용으로 남깁니다**(2027 실측 23건).
2. **`기타(추가사항)` 칸은 3,783행 전부 비어 있습니다.** 원본이 그렇습니다. 파싱 실패가 아닙니다.
3. **수시/정시는 원문에 없습니다.** 전형유형으로 추정한 값이며(대교협 표준분류:
   학생부교과·학생부종합·논술=수시, 수능위주=정시), 실기/실적과 정원외 특별전형은
   양쪽에 다 있어 `미상`으로 둡니다. 판정률 67.7%. `phaseBasis` 로 근거를 구분하십시오.

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

---

## 🆕 2027학년도 **모집요강** 파이프라인 (2026-09-03 추가)

### 왜 따로 만들었나 — 한 줄로

> **검정고시 비교내신 산출식은 모집요강에만 있다. 시행계획·기본사항에는 없다.**

그래서 대학별 `susi.pdf` / `jeongsi.pdf` 를 따로 받아
`pdf_sources/guides_2027/{대학명}/` 에 넣고, 전용 스크립트 3개를 새로 두었습니다.
시행계획용 스크립트(`extract_text.py` / `ingest_plans.py`)는 **건드리지 않았습니다.**

### 실행 순서

```bash
cd ~/dev/GitHub/ReBridge/ReBridge_AI공모전용/data-pipeline

# ① PDF 396개 → 페이지별 텍스트 (pdftotext -layout, 약 40초)
python3 v2/extract_guides_text.py --year 2027

# ② 검정고시 관련 페이지 원문 모으기 (앱 '원문 보기' 재료)
python3 v2/extract_guides_ged.py --year 2027

# ③ 비교내신 산출식 구조화 + L1 적재
python3 v2/ingest_guides_conversion.py --year 2027 --to-db

# ④ 모집인원 (확실한 표만)
python3 v2/ingest_guides_recruit.py --year 2027
```

### 왜 `pdftotext -layout` 인가 (PyMuPDF가 아니라)

모집요강 환산표는 **가로로 누워 있습니다.**

```
백점만점성적    100    95이상   90이상  …  65미만
  반영점수     1,000    940     920   …    400
```

열이 세로로 정렬돼 있어야 어느 점수가 어느 등급 칸인지 알 수 있는데,
`-layout` 은 그 **가로 위치를 글자 칸으로 보존**합니다. 이 파이프라인은 셀 개수가 아니라
**칸 위치**로 열을 맞춥니다. 그래야 아래 같은 표를 안 틀립니다.

```
  석차등급      1     2     3     4     5     6     7     8     9
검정고시 점수                100   96이상  90이상  85이상  80이상  75이상  75미만   ← 앞 두 칸이 비어 있다
```
(경기대 수시 p.38 실측. 개수로 맞추면 100이 1등급이 되어 완전히 틀립니다.)

### 산출물 — 앱은 이걸 읽으면 됩니다

| 파일 | 무엇 | 앱에서 쓰는 키 |
|---|---|---|
| `out/guides_2027/ged_text/{univId}.json` | 검정고시 관련 페이지 **원문 그대로** | `pages[].text` `pages[].page` `pages[].source_file` `pages[].phaseKo` `sources[].sourceUrl` |
| `out/guides_2027/ged_text/_index.json` | 위 파일 목록 | `items[].univId` `items[].pages` `items[].hasComparative` |
| `out/guides_2027/conversion_2027.jsonl` | 비교내신 구조화 (한 줄 = 대학 × 수시/정시) | 아래 표 참고 |
| `out/guides_2027/conversion_2027_report.md` | 검증 실패·산문만 목록 | — |
| `out/guides_2027/recruit_2027.jsonl` | 모집단위별 모집인원 | `program` `recruitCount` `confidence` `rawLine` |
| `out/rebridge.db` → `ged_conversion WHERE year=2027` | 위를 적재한 것 | — |

`conversion_2027.jsonl` 한 줄의 주요 키:

| 키 | 뜻 |
|---|---|
| `univId` `univ` `year`(2027) `phase`(수시/정시) `campus` | 식별 |
| **`gradeBands`** | ★ **평균점수 구간 → 등급.** `[{grade,raw,lo,hi,kind}]` — 검정고시생이 가진 건 평균점수다. 앱에서 가장 중요 |
| `scoreBands` | 등급 없이 `구간 → 환산점수`만 있는 표 |
| `gradeTable` | `등급 → 환산점수`. `[{grade,score}]` |
| `percentileBands` | 석차백분율 구간(**재학생용**). 검정고시 계산에 쓰면 안 된다 |
| `grade_scale` | `'9'` \| `'5'` \| `null`(원문에 단서 없음) |
| `appliesTo` | `검정고시전용` \| `재학생준용` \| `불명` |
| `maxScore` `minScore` `scoreLabel` `bandLabel` `tableLabel` | 표 메타 |
| `quote` | 표 **원문 그대로**. 사람이 대조할 때 이게 전부다 |
| `contextQuote` `formulas` | 표 앞뒤 문맥 / 산문 산식 원문 |
| `page` `source_file` `sourceUrl` `sha256` | 출처 |
| `kind` | `구간표+환산표` \| `구간표` \| `구간→점수표` \| `환산표` \| `산문만` \| `근거없음` |
| `validation` `validationFails` | `pass`/`fail` 과 사유. **fail 이어도 값을 고치지 않았다** |

DB 쪽 대응 컬럼: `grade_bands_json` `score_bands_json` `percentile_bands_json`
`formula_text` `quote` `source_file` `table_label` `validation` `validation_note` `kind`.

### 스키마에서 바꾼 것 (컬럼은 하나도 안 바꿨습니다)

- `ged_conversion` 에 위 컬럼 9개를 **추가**만 했습니다.
- 유니크 축을 `ux_conversion(univ_id, year, admission_id)` →
  `ux_conversion_v2(univ_id, year, admission_id, phase)` 로 바꿨습니다.
  2027은 한 대학이 **수시용·정시용 비교내신표를 다르게** 쓰기 때문에,
  phase 를 안 보면 둘째 행이 통째로 막힙니다. 2028 행에는 영향이 없습니다
  (phase 가 NULL → `COALESCE(phase,'')` 로 예전과 같은 축).

### 안 한 것 / 사람이 봐야 할 것

- **스캔본 10개는 OCR을 하지 않았습니다.** 목록은 `out/text/guides_2027/_manifest.json`
  의 `scanned` 에 있습니다.
- `validation='fail'` 행은 **값을 그대로 두고 사유만 붙였습니다.** 지어내지 않기 위해서입니다.
- 모집인원은 **'모집단위 | 모집인원' 두 열이 붙어 있는 표만** 읽었습니다.
  전형×모집단위 행렬은 손대지 않았습니다(어긋난 숫자는 없는 것보다 나쁩니다).

## 🎓 전문대학(2~3년제) 「전년도 입시결과」 (2026-09-04 추가)

원본: `Application_main_codes/src/data/pdf_sources/college/results/전년도입시결과_{2016..2026}학년도_전문대학포털.xls`
(전문대교협/프로칼리지 연도 단위 일괄 다운로드. 조사 경위는 같은 폴더 `조사보고.md`).

```bash
python3 v2/ingest_college_results.py            # 파싱 통계만
python3 v2/ingest_college_results.py --to-db    # cutline 적재
```

- 11개 연도 131,830행 원본 → cutline 255,957행 (`university.kind='전문대학'`).
- 4년제 어디가 CSV와 달리 원본에 '50%/70%컷' 구분이 없다. `cut_type`은 **평균·최저**
  두 가지만 쓰고, 학생부(교과내신 등급)·수능·교과외 축을 값이 있는 것만 별도 행으로 만든다
  (`note`의 `축=` 표기로 구분). 수능 값인데 원문에 등급/백분위 표기가 없으면 단위를 추정하지
  않고 `cut_score`에 원문 숫자만 넣은 뒤 `confidence='low'`로 낮춘다.
- 원본 '입학정원'은 학과 전체 정원이지 그 모집시기의 모집인원이 아니라서(수시1차·수시2차·
  정시에 같은 값이 반복된다) `recruit_count`에 넣지 않고 `note`에만 남긴다.
- 2025·2026학년도는 138개 마스터와 이름이 100% 일치했다. 그 이전 연도는 폐교·개명·통합된
  학교(동주대·서라벌대·고구려대·인천재능대→재능대 등)가 섞여 있어 매칭 실패분은 지어내지
  않고 건너뛴 뒤 개수만 `ingest_log`에 남긴다.

### 스키마에서 바꾼 것

- `source_file`에 `license` 컬럼을 **추가**만 했다(기존 컬럼 안 건드림). 전문대교협/
  프로칼리지 자료는 공공누리가 아니라서(무단 복제·배포 금지, 상업적 이용 시 사전 협의
  필요) 소스 단위로 라이선스 문구를 남겨야 나중에 재조사하지 않는다. 값이 없으면(NULL)
  "아직 조사 안 함"이지 "공공누리"라는 뜻이 아니다.

### 안 한 것 — 사유와 함께 남겨 둔 것

- **대학별 전형방법 엑셀**(`guides_2026~2028/대학별전형방법_*.xls`, 학과×전형 모집인원·
  성적반영비율)은 파싱 가능함을 확인했으나 이번 범위에서는 적재하지 않았다. 전문대의
  전형구분 체계(일반전형/특별전형)가 4년제 `admission.type`(학생부교과/종합/논술/실기/
  수능위주)과 달라 그대로 채우면 혼동을 준다 — 설계를 더 봐야 한다.
- **입학전형기본사항 PDF의 검정고시 원칙 조항**("검정고시 출신자를 지원자격에서 제한할
  수 없음")은 대학별이 아니라 협의회 공통 규정이라, `ged_eligibility_univ`(대학 단위 PK)에
  넣으면 실제로 확인 안 된 138개 대학 전부에 "가능"을 지어내는 꼴이 된다. 구조화하지
  않고 `조사보고.md` 원문 인용으로만 남겼다.
- **2018/2019 레거시 파일 3종**(`2018 전년도 전문대학 입시결과(20180622).xlsx`,
  `2018학년도 전문대학 정시 모집 결과.xlsx`, `2019학년도 전문대학 입학전형 자료.xls`)은
  구조가 완전히 다르다(앞 둘은 연도별 통합본과 겹치는 학과×전형 피벗, 마지막은 합격선이
  아니라 학과 소개·취업분야·자격증 카탈로그). 연도별 통합본과 중복이거나 검정고시/합격선과
  무관해 이번 적재에서 제외했다.
