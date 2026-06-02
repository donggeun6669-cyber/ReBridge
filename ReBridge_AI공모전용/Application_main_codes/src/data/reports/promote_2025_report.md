# 2025 입시결과 전형 연결 리포트

## 요약

- 매칭 전형 수 / 전체 전형 수: 282 / 1007
- high 기반 results2025 매칭: 280
- 핵심대학 mid_fallback results2025 매칭: 2
- mid 기반 results2025_mid 매칭: 46
- 미매칭 전형 수: 725

## 핵심 8개 대학

| univId | results2025 non-null | results2025_mid non-null | admissions rows |
| --- | ---: | ---: | ---: |
| cau | 12 | 0 | 22 |
| hanyang | 4 | 0 | 4 |
| inha | 3 | 0 | 4 |
| knu | 3 | 1 | 4 |
| kookmin | 2 | 0 | 3 |
| pusan | 7 | 0 | 7 |
| skku | 8 | 0 | 10 |
| uos | 6 | 2 | 9 |

## 매칭 규칙

- 1차 키: `(univId, admissionType)`.
- 2차 전형명: 정규화 후 포함 관계 및 지역균형/교과지역균형/추천형, 학생부종합 단순 표기 등 동의어를 적용.
- `confidence=high`는 `results2025`에 집계.
- `confidence=mid`는 `results2025_mid`에 별도 집계.
- 핵심 8개 대학 중 high가 없고 mid만 있는 전형은 수용 기준 확인을 위해 `results2025.sourceConfidence=mid_fallback`으로 표시.
- `confidence=low`는 포함하지 않음.

## 미매칭 상위 20개

| univId | admissionType | count |
| --- | --- | ---: |
| gachon | 학생부종합 | 7 |
| cau | 수능위주 | 6 |
| soongsil | 학생부종합 | 4 |
| sejong | 학생부종합 | 4 |
| cau | 실기 | 4 |
| soongsil | 실기 | 2 |
| sejong | 수능위주 | 2 |
| skku | 논술 | 2 |
| uos | 실기 | 2 |
| kangwon | 학생부종합 | 1 |
| knu | 논술 | 1 |
| uA0000008 | 학생부종합 | 1 |
| uA0000008 | 학생부교과 | 1 |
| uA0000008 | 수능위주 | 1 |
| uA0000009 | 학생부종합 | 1 |
| uA0000010 | 학생부종합 | 1 |
| uA0000012 | 학생부종합 | 1 |
| uA0000013 | 학생부종합 | 1 |
| uA0000013 | 수능위주 | 1 |
| snu | 학생부종합 | 1 |
