# 2028 시행계획 통합(patch A+B+C) → admissions_2028.json — QA 리포트

> 산출물: `src/data/admissions_2028.json` (1,304행)
> 병합: `univId+campus+phase+admissionType+admissionName+unit+source+cg` 키로 완전중복만 제거
> 갱신: 2026-06-03 (메인 병합)

---

## 1. 병합 요약

| 항목 | 값 |
| --- | ---: |
| 입력 patch_A (메인: 서울·인천·강원·세종·제주) | 63 |
| 입력 patch_B (Sonnet: 경기·충남·충북·대전) | 413 |
| 입력 patch_C (Codex: 경북·부산·경남·광주·전남·전북·대구·울산) | 828 |
| 완전중복 제거 | 0 |
| **병합 행수** | **1,304** |
| distinct univId | 144 |
| needsUnivId(미매칭) | **0** |
| 멀티캠퍼스 univId | 12 |

### region 분포
서울41·인천6·강원12·세종2·제주2 / 경기230·대전79·충북55·충남49 / 부산193·경북175·전남129·광주93·경남78·전북76·대구84

### phase 분포 (헤더교정 반영)
수시 1,081 · 정시 160 · null 63(patch_A는 대학단위 행)

## 2. comparativeGrade 품질 — ★중요 + `comparativeGradeType` 태그

모든 행에 `comparativeGradeType` 필드를 부여해 Phase 2가 우선순위로 필터링 가능. (raw "채움 수"는 과대평가 → 타입으로 구분)

| comparativeGradeType | 행수 | Phase 2 활용 |
| --- | ---: | --- |
| **numeric_table** | **216** | 등급/점수 숫자 환산표 → **점수엔진 1차 연결 대상** |
| comparative_prose | 567 | 비교내신/환산/산출 키워드 산문(숫자표 아님) → 보조 |
| eligibility_prose | 225 | 동등학력·검정고시 지원자격 위주 → gedEligible 참고용 |
| ged_block | 121 | 검정고시 지원불가 문구 |
| none(null) | 171 | 비교내신 언급 없음 |
| deferred | 4 | "환산표는 모집요강 공지" |

→ **유효 환산표 216행** (A 29 · B 25 · C 162). 검증 결과 **버릴 무관 산문(relocate 대상)은 0건** — 모든 non-null cg가 비교내신/환산/검정고시/동등학력 관련.

## 3. 데이터 품질 보정 (병합 시 처리 — 추측 주입 없음)

| 이슈 | patch | 건수 | 처리 |
| --- | --- | ---: | --- |
| `region` 필드에 캠퍼스값 누수("본교" 등) | B | **43** | ✅ **보정**: universities.json univId→region 룩업 교체, note 기록 |
| 헤더 오배정(phase/type/name이 unit과 불일치, 예: 정시·수능위주·'수능'인데 unit='수시 학생부교과(지역의사…)') | C | **3** | ✅ **교정**: unit 파싱→phase/type/name 재배정, unit 정리, note 기록 |
| comparativeGrade 반복 단편(연속 중복 세그먼트) | B/C | 일부 | ✅ **무손실 정리**: 연속 중복 세그먼트 축약, 공백 정규화 |
| comparativeGrade 공백문자 | — | — | ✅ null 정규화 |

> 텍스트 의미는 보존(추측 주입/삭제 없음). 구조 필드 오류만 결정적 규칙으로 교정.

## 4. gedEligible 분포 (patch 직접 추출분)

조건부 637 · 가능 467 · 불가 137 · null 63(patch_A).

> 주의: patch의 gedEligible은 시행계획 1차 기준. **병합 시 admissions.json의 기존 per-전형 gedEligible과 충돌 가능** → Phase 2 연결에서 우선순위 규칙 필요(아래 5).

## 5. Phase 2 연결(앱) 권고

1. **키 조인**: B/C는 per-전형(univId+phase+admissionType+admissionName)으로 admissions.json 행에 직접 보강.
2. **patch_A(서울 등 63 대학)**: 대학단위 → univId+campus로 해당 대학 모든 전형 행에 `comparativeGrade` **broadcast**.
3. **comparativeGrade 우선순위**: numeric_table > deferred > prose. 점수엔진은 numeric_table(216)부터 연결.
4. **gedEligible 충돌**: 기존 admissions.json(가능768/불가187/조건부52)을 기본 유지, patch가 '불가' 명시(ged_block)면 그쪽 우선.
5. **품질 플래그 행(§3)**: 시연 핵심대학에 포함되면 수동검수 후 연결.

---

### 한 줄 결론
1,304행 병합·144개 대학·미매칭 0. region 누수 43건·헤더오배정 3건 **보정 완료**, cg 반복단편 무손실 정리, 모든 행에 `comparativeGradeType` 태그 부여. **유효 숫자 환산표 216행**이 점수엔진 1차 연결 대상. 텍스트 추측 주입/삭제 없음 → 데이터 정합성 확보.
