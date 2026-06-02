# ReBridge 데이터 작업 인계 문서

> 작성: 2026-06-02 · 기준: 기획서_v1.md 7번 / SCHEMA.md
> 이 문서는 **데이터 작업을 다음 작업자(Claude)에게 넘기기 위한 현황 정리**입니다.

---

## 1. 한 줄 요약

전국 4년제+전문대 **351곳**의 기본정보(좌표·지역·설립·홈페이지)와 검정고시 관점 전형 **1004행**을
2028학년도 기준으로 구축했다. **검정고시 가능 여부는 1차 PDF 근거로 보강했고, 핵심 7개 대학은 전형별 모집인원·전형방법까지 상세 반영했다.**

---

## 2. 산출물 (모두 `src/data/`)

| 파일 | 내용 | 상태 |
| --- | --- | --- |
| `SCHEMA.md` | 필드 정의서. 앱/디자인은 이걸 기준으로 작업 | ✅ 확정 |
| `universities.json` | 대학 기본정보 351곳 (자동 생성물) | ✅ |
| `admissions.json` | 전형별 1004행 (자동 생성물 + 2028 PDF 근거 보강) | ✅ |
| `universities_curated.json` | 검증된 34곳 baseline (손으로 작성, **출력물과 분리된 입력 소스**) | ✅ |
| `ingest_universities.py` | 공공데이터 xlsx/csv → universities.json 변환기 | ✅ |
| `_gen_admissions.py` | universities.json → admissions.json 일반규칙 생성기 | ✅ |

### 재생성 방법 (데이터 다시 만들 때)
```
cd src/data
python ingest_universities.py "<교육부 좌표정보 파일>.xlsx"   # → universities.json
python _gen_admissions.py                                     # → admissions.json
```
원본 공공데이터: 교육부_대학교 주소기반 좌표정보 (data.go.kr/data/15138981).
**주의:** `universities.json`은 출력물이라 덮어쓰인다. 검증 baseline은 반드시 `universities_curated.json`에서 수정할 것.

---

## 3. 데이터 구성 (정확도 레벨)

### 3-1. 기본정보 (universities.json) — ✅ 정확
- 출처: 교육부 공공데이터(2025-11-26 기준). 좌표 100% 채워짐(지도 핀 바로 가능).
- 351곳 = 4년제 213곳(검증 34 + 공공데이터 179) + 전문대 138곳.
- 대학원/대학원대학/사이버/방송통신/기능대학/폐교 제외.

### 3-2. 전형 데이터 (admissions.json) — ⚠️ 3단계로 나뉨
**(A) 검증된 34곳** — 논술 교과반영비율 등 일부 실데이터 포함(서울신문 입시기사·KCUE 기본사항 근거).
**(B) 2028 PDF 근거 보강분** — 각 대학 시행계획에서 검정고시 지원 가능/불가/조건부를 1차 판정.
**(C) 핵심 7개 대학 상세 전형** — 가천대, 숭실대, 세종대, 아주대, 성균관대, 서울시립대, 중앙대는 모집인원·전형방법·수능최저·출처 페이지를 상세 반영.
**(D) 나머지 대학** — **검정고시 일반규칙 베이스라인**만 깔림. 즉:
  - 4년제: 학생부종합(가능) + 학생부교과 추천형(불가) + 정시(가능)
  - 전문대: 수시 일반전형(가능) + 정시(가능)
  - 논술은 시행 확인된 34곳에만 존재(나머지엔 지어내지 않음).

이 일반규칙은 **2028학년도 대학입학전형 기본사항(KCUE: 검정고시 출신자 수시 지원 제한 불가)**에 근거하므로
방향은 정확하지만, **상세 수치는 아직 대학별로 순차 보강 중이다.**

---

## 4. 못한 것 / 비어 있는 것 (★ 다음 작업자가 채울 것)

| 항목 | 현재 | 왜 못했나 | 어떻게 채우나 |
| --- | --- | --- | --- |
| `csatMinimum` (수능최저) | 대부분 "모집요강 확인 필요" / "없음" 추정 | 학교·모집단위별로 달라 일괄 데이터 없음 | 각 대학 2028 시행계획 PDF에서 모집단위별 수집 |
| `recruitCount` (모집인원) | 핵심 7개 대학은 상당수 입력, 나머지는 대부분 `null` | 시행계획 PDF 표 구조가 대학마다 다름 | 시행계획에서 전형별 인원 입력 |
| `comparativeGrade` (비교내신 환산식) | 전부 `""` | 대학마다 환산표가 다름(PDF 부록) | 입학처 환산표 수집 |
| `evalMethod` (반영 비율) | 34곳 일부만 정확, 나머지 일반문구 | 시행계획 정독 필요 | 학교별 보강 |
| 317곳 전형 정확화 | 일반규칙 baseline | 학교 수가 많아 수작업 불가했음 | 우선순위대로 시행계획 정독해 갱신 |
| `admissionOfficeUrl` | 8곳 비어 있음, 나머지는 **학교 대표 홈페이지**(입학처 아님) | 공공데이터엔 입학처 URL 없음 | 입학처 정확 URL로 교체 |
| 2027 입시결과(경쟁률/합격선) | **필드 자체를 제외함** | 사용자 결정: 2028만. 과거 결과는 미래 전형에 없음 | 필요 시 별도 연도 필드로 재설계 |
| 학생부교과 일괄 '불가' | 모든 4년제 교과추천형=불가 | 안전한 일반값. 일부 대학은 검정고시 교과전형 운영 | 해당 대학은 '가능'으로 갱신 |

---

## 5. 다음 작업자에게 권장 순서 (기획서 7-4와 동일)

1. **우선순위 대학부터** 2028 시행계획 PDF로 `csatMinimum`/`evalMethod`/`recruitCount` 채우기
   (수도권 + 거점국립 → 검정고시 지원 많은 곳 순).
2. `comparativeGrade`(비교내신 환산식)은 학종/교과 지원자에게 가장 도움 → 가능한 대학부터.
3. `admissionOfficeUrl`을 입학처 정확 URL로 교체(신뢰성).
4. 학생부교과 '불가' 행 중 검정고시 교과전형 운영 대학을 '가능'으로 보정.
5. 채울 때 **행마다 `source`를 반드시 남기고, 모르면 비운다(지어내지 않는다).**

---

## 6. 검증 체크 (변경 후 매번)
```
python -c "import json;from collections import Counter; \
U=json.load(open('universities.json',encoding='utf-8')); \
A=json.load(open('admissions.json',encoding='utf-8')); \
uids={u['univId'] for u in U}; \
print('orphans',{r['univId'] for r in A}-uids); \
print('univ-no-adm',uids-{r['univId'] for r in A}); \
print('missing gedEligible',sum(1 for r in A if not r['gedEligible']))"
```
정상값: orphans=set(), univ-no-adm=set(), missing=0.

마지막 정상 상태: **universities 351 / admissions 1004 / 가능 770·불가 186·조건부 48 / join 무결.**

---

## 7. Codex 2028 PDF 작업 누적 메모

추가 생성 문서:

- `Data/2028_입시데이터_1차추출결과.md`
- `Data/2028_핵심5개대학_상세전형_반영결과.md`
- `Data/2028_핵심추가대학_상세전형_반영결과.md`
- `Data/CODEX_다음작업_인계.md`

추가 생성 스크립트:

- `extract_pdf_text.py`
- `build_evidence.py`
- `classify_ged.py`
- `merge_and_validate.py`
- `promote_gachon_detail.py`
- `promote_manual_core_details.py`
- `promote_manual_more_details.py`

현재 상세 반영 완료 대학은 7개다. 다음 우선 후보는 국민대학교, 인하대학교, 한양대학교, 서울과학기술대학교, 부산대학교, 경북대학교, 충남대학교, 전북대학교다.
