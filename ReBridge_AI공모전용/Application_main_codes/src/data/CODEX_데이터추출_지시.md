# [CODEX 작업지시] 2028 입시 데이터 추출 — 최종

> 작성: 2026-06-02 · 이 문서 하나로 작업 가능(자기완결).
> 기준 스키마: `SCHEMA.md` · 현황: `HANDOFF.md` · 검증근거: 아래 0번(실측).
> 목표: **학교 밖 청소년(검정고시생)이 갈 수 있는 2028학년도 대학**을 정확·효율적으로 데이터화.

---

## 0. 실측된 사실 (추측 아님 — 실제 PDF 검사 결과)

| 항목 | 값 |
| --- | --- |
| `src/data/pdf_sources/2028/` PDF 총수 | **213개** (4년제 시행계획 1차수, HWP→PDF 변환분 포함) |
| 텍스트 추출 정상 | **210개** → OCR 불필요 |
| 스캔(이미지) PDF — OCR 필요 | **3개**: 경희대학교 · 이화여자대학교 · 국립순천대학교 |
| 파일 구성 | 대학별 1파일 + 이름 정규화됨 (`{대학}[지역][본교/캠퍼스]_2028_시행계획(1차수).pdf`) → **분할 불필요** |
| 검정고시 키워드 | 정상 추출(예: 가천대 "검정고시" 3회, "최저학력" 28회) |
| 전문대 시행계획 PDF | **없음**(현재 4년제만). 전문대는 9번 참고 |
| 도구 | PyMuPDF(fitz) 설치됨. pdfplumber/pymupdf4llm은 필요 시 설치 |

> **핵심 판단: "전 PDF OCR/Docling"은 과잉.** 텍스트 추출이 메인, OCR은 위 3개 예외만.

---

## 1. 입력 / 출력

**입력(로컬, git 제외)**
- `pdf_sources/2028/*.pdf` — 원본 213개

**기존 산출물(이미 존재, 채워나갈 대상)**
- `universities.json` — 대학 기본정보 351곳 (좌표 포함, 정확)
- `admissions.json` — 전형 942행 (대부분 baseline 규칙, 세부 비어 있음)
- `universities_curated.json` — 검증 34곳 baseline 입력소스

**이번에 새로 만들 산출물**
- `text/{univId}.jsonl` — 페이지별 원문 (중간물, git 제외 가능)
- `evidence/{univId}.jsonl` — 근거 페이지만 추린 것 (git 포함, 가벼움)
- `admissions.json` 갱신 — 세부 필드 채움 + `source`/`status`
- 스크립트 5종(아래 8번)

---

## 2. 파이프라인 (Phase A→D)

### Phase A — 텍스트화 (자동, LLM 없음)
- PyMuPDF로 각 PDF를 **페이지별** 추출 → `text/{univId}.jsonl` (한 줄 = `{"page":N,"text":"..."}`)
- 폰트 경고 끄기: `fitz.TOOLS.mupdf_display_errors(False)`
- 파일명 → `univId` 매칭: `universities.json`의 `name`과 대조(대괄호·[본교] 등 제거 후 매칭). 매칭 실패 목록을 따로 출력.

### Phase B — 근거 페이지 좁히기 (자동, LLM 없음)
페이지 텍스트를 키워드로 분류해 관련 페이지만 `evidence/{univId}.jsonl`에 저장(page=출처).

| 목표 | 정규식 키워드 |
| --- | --- |
| 검정고시 지원자격 | `지원자격`, `검정고시`, `동등\s*이상.*학력`, `고등학교\s*졸업`, `학교장\s*추천`, `졸업\s*예정자` |
| 수능 최저 | `수능\s*최저`, `최저\s*학력\s*기준` |
| 모집인원 | `모집\s*인원`, `모집\s*단위`, `모집\s*정원` |
| 전형방법 | `전형\s*방법`, `사정\s*방법`, `반영\s*비율`, `면접`, `서류` |

→ 보통 30쪽이 5~10쪽으로 압축. 이 조각만 Phase C로.

### Phase C — 구조화

**(C1) 검정고시 지원 가능 판정 = 규칙 우선 (가장 중요, LLM 최소화)**
- 한국 시행계획 표준 자격문구 = "고등학교 졸업(예정)자 및 법령에 의하여 동등 이상의 학력이 있다고 인정된 자" → **검정고시 포함 = 기본 `가능`**.
- **`불가`/`조건부`로 뒤집는 예외 패턴만** 정규식으로 탐지:

| 패턴 | 판정 | gedIneligibleReason 예시 |
| --- | --- | --- |
| `학교장\s*추천` 필요 | 불가 | "학교장 추천이 필요한 전형이에요" |
| `졸업\s*예정자(에\s*한|만)` / `재학생` 한정 | 불가 | "재학 중인 졸업예정자만 지원할 수 있어요" |
| `검정고시.*(지원\s*불가\|제외\|불인정)` | 불가 | "검정고시 출신은 지원이 제한돼요" |
| `정규\s*(고등학교\|고교).*(이수\|교육과정)` 요구 | 조건부 | "정규 고교 이수 조건이 있어 확인이 필요해요" |
| 지역균형/지역인재 + 추천 | 조건부 | "지역·추천 요건을 확인해야 해요" |

- 그 외에는 `가능` + `gedReflection`을 전형유형으로 채움(학종=서류평가, 교과=비교내신 환산, 논술=논술, 정시=수능).

**(C2) 수치 필드(수능최저·모집인원·반영비율) = 좁힌 페이지를 LLM이 JSON화**
- **Tier 1 대학만 전 필드**(7번 참고). Tier 2는 C1(검정고시 판정)만 확정, 수치는 baseline 유지.
- 표가 깨져 안 잡히는 페이지만 `pdfplumber`로 보조.

### Phase D — 병합·검증
- `admissions.json`에 **채우기 병합**(기존 baseline 위에 덮되, 값이 있을 때만 갱신).
- **모든 갱신 행에 `source` 필수**: `"{대학} 2028 시행계획 p.N"`.
- 각 행에 `status` 추가: `confirmed`(PDF근거) / `baseline`(규칙만) / `needs_guideline`(세부요강 필요).
- 검증 스크립트(아래 8-5) 통과 확인.

---

## 3. OCR 예외 3개 (경희대·이화여대·국립순천대)

- 자동 파이프라인에서 **제외**하고 따로 처리.
- 권장: 입학처에서 한글(HWP) 재다운로드 → PDF 변환(텍스트 PDF가 됨). 불가 시 `ocrmypdf`(Tesseract `kor`).
- 처리 전까지 이 3곳은 baseline 유지 + `status: needs_guideline`.

---

## 4. 검정고시 판정 — 정확도 원칙

1. **기본 `가능`, 예외만 `불가`/`조건부`** (위 C1 표).
2. **모르면 비운다. 지어내지 않는다.** (특히 `csatMinimum`, `comparativeGrade`)
3. **`comparativeGrade`(비교내신 환산식)는 시행계획에 거의 없음** → 대부분 `needs_guideline`이 정상. 무리해서 채우지 말 것.
4. **행마다 `source`(page) 필수.** 출처 없으면 baseline로 강등.

---

## 5. Tier 우선순위 (효율: "정확한 핵심" > "전부 어설프게")

| Tier | 범위 | 추출 깊이 |
| --- | --- | --- |
| **Tier 1** | 수도권 4년제 + 거점국립대 + 검정고시 지원 많은 30~50곳 | 전 필드(가능여부·수능최저·인원·반영비율·비교내신) |
| **Tier 2** | 나머지 4년제 전부 | C1(검정고시 가능여부/사유/반영방식)만 확정, 수치는 baseline |
| **Tier 3** | 전문대 138곳 | 현 baseline 유지 |

---

## 6. 산출 스크립트 (deliverables)

`src/data/`에 5개:
1. `extract_pdf_text.py` — Phase A (PDF→text/*.jsonl, univId 매칭, 실패목록 출력)
2. `build_evidence.py` — Phase B (키워드→evidence/*.jsonl)
3. `classify_ged.py` — Phase C1 (규칙 기반 검정고시 판정 patch 생성)
4. `extract_fields_tier1.py` — Phase C2 (Tier1 좁힌 페이지→수치 JSON)
5. `merge_and_validate.py` — Phase D (병합 + source/status + 검증)

---

## 7. 검증 (변경 후 매번)
```
python -c "import json;U=json.load(open('universities.json',encoding='utf-8'));A=json.load(open('admissions.json',encoding='utf-8'));uids={u['univId'] for u in U};print('orphans',{r['univId'] for r in A}-uids);print('missing gedEligible',sum(1 for r in A if not r.get('gedEligible')));print('with source',sum(1 for r in A if r.get('source')))"
```
정상: orphans=set(), missing gedEligible=0.

---

## 8. GitHub 위생
- `.gitignore`에 **`src/data/pdf_sources/`** 와 **`src/data/text/`** 추가(원본 PDF·중간 텍스트는 로컬만).
- git 포함: `universities.json`, `admissions.json`, `evidence/*.jsonl`, 스크립트, 이 문서.

---

## 9. 전문대 (결정)
- 현재 전문대 시행계획 PDF 없음. 전문대는 한국전문대학교육협의회 별도 배포.
- 권장(시간 부족 시): 전문대는 **baseline 유지**(대부분 검정고시 수시 일반전형 가능이라 baseline 정확도 높음).
- PDF를 추가로 모으면 Tier 2 수준으로 동일 파이프라인 적용 가능.

---

## 10. 작업 순서 요약
1. Phase A(전 PDF 텍스트화) → univId 매칭 실패 목록 확인
2. Phase B(evidence 좁히기)
3. Phase C1(규칙 검정고시 판정) — **전 대학 자동**
4. Phase C2(Tier1 수치 추출)
5. Phase D(병합+source+status+검증)
6. OCR 3개·매칭 실패분 수동 보정
7. `.gitignore` 갱신 후 결과물만 커밋
