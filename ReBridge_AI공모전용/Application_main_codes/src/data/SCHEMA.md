# ReBridge 데이터 스키마 v1

> 기획서_v1.md 7번 기준. 코딩/디자인 창은 **이 문서의 필드명**에 맞춰 컴포넌트를 만들면 됩니다.
> 데이터는 JSON 2개 파일로 제공: `universities.json`(대학 기본정보) + `admissions.json`(전형별 상세).
> 두 파일은 `univId`로 조인합니다. (1 대학 : N 전형)

---

## 1. universities.json — 대학 기본정보 (표 A)

JSON 배열. 대학 1곳당 1개 객체.

```jsonc
{
  "univId": "snu",                          // string ✅ 고유 ID (admissions와 연결 키). 소문자 영문
  "name": "서울대학교",                       // string ✅ 표시명
  "region": "서울",                          // string ✅ 지역 필터용(서울/경기/인천/부산/대구/광주/대전/...)
  "establishment": "국립",                    // string ✅ 국립 / 공립 / 사립
  "admissionOfficeUrl": "https://...",       // string ✅ 입학처/모집요강 원문 링크(신뢰성)
  "guidelineYear": "2028학년도",              // string ✅ 전형 규칙 기준 연도
  "lat": 37.459,                             // number ✅ 위도(지도 핀)
  "lng": 126.952,                            // number ✅ 경도(지도 핀)
  "kind": "대학교"                            // string ⬜ 대학교 / 전문대학 (공공데이터로 추가된 학교에만 존재; 필터·표시용)
}
```

---

## 2. admissions.json — 전형별 상세 (표 B) ★핵심

JSON 배열. 한 대학에 여러 행. `univId`로 표 A와 연결.

```jsonc
{
  "univId": "snu",                           // string ✅ 대학 연결 키
  "phase": "수시",                            // string ✅ 수시 / 정시
  "admissionType": "학생부종합",               // string ✅ 학생부종합 / 학생부교과 / 논술 / 실기 / 수능위주
  "admissionName": "일반전형",                 // string ✅ 실제 전형명
  "gedEligible": "가능",                      // string ✅ 가능 / 불가 / 조건부  ← 앱 핵심 분기
  "gedIneligibleReason": "",                  // string ⬜ 불가/조건부 시 사유(차갑지 않게)
  "gedReflection": "서류평가",                 // string ✅ 검정고시 성적을 어떻게 보는지(비교내신 환산 / 서류평가 등)
  "comparativeGrade": "",                     // string ⬜ 비교내신 환산식(있으면)
  "evalMethod": "1단계 서류100%, 2단계 면접30%",// string ✅ 전형 방법·반영 비율
  "interview": true,                          // boolean ✅ 면접 유무
  "csatMinimum": "없음",                      // string ✅ 수능 최저(예: "2개합5" / "없음")  ← 수능 응시계획과 연결
  "recruitCount": 30,                         // number ⬜ 모집인원 (2028 시행계획)
  "unit": "자유전공학부",                       // string ⬜ 모집단위/학과
  "note": "",                                 // string ⬜ 비고
  "source": "2028 서울대 시행계획 p.12"          // string ✅ 출처(신뢰성·검증)
}
```

### 기준 연도 — 2028학년도 시행계획만
- 이 데이터셋은 **2028학년도 입학전형 시행계획** 기준입니다(미래 입시).
- `competition`(경쟁률)·`referenceScore`(합격선)는 *지난* 입시결과라 2028엔 존재하지 않으므로 **필드에서 제외**했습니다.
  나중에 과거 결과를 붙이려면 별도 연도 필드와 함께 다시 추가하세요.

### 코딩 시 주의
- `gedEligible`이 `"불가"`/`"조건부"`면 `gedIneligibleReason`을 반드시 함께 표시(기획서: 차갑지 않게 + 대안 제시).
- `csatMinimum`은 사용자 프로필의 '수능 응시 계획'과 매칭되는 핵심 필드.
- 모든 행에 `gedEligible`과 `gedReflection`은 비어 있으면 안 됨(필수).

---

## 3. 결과 카드가 답해야 할 3질문 ↔ 필드 매핑 (기획서 5번)

| 카드 질문 | 사용하는 필드 |
| --- | --- |
| ① 나, 여기 지원할 수 있어? | `gedEligible` (+ `gedIneligibleReason`) |
| ② 어떤 전형으로? | `admissionType` + `admissionName` + `gedReflection` |
| ③ 지금 뭘 해야 해? | `csatMinimum` + `evalMethod` 기반으로 규칙 엔진이 "다음 할 일" 문구 생성 |
