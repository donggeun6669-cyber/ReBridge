# KNU confidence 보정 리포트

## 요약

- KNU 전체 행: 1076
- 보정 전 low: 954
- mid 승격: 940
- 보정 후 low: 14

## confidence 변화

| confidence | before | after |
| --- | ---: | ---: |
| high | 122 | 122 |
| mid | 0 | 940 |
| low | 954 | 14 |

## low 행 패턴

### note 분포

| note | count |
| --- | ---: |
| 점수(헤더 추정) [A: 병합충돌] | 366 |
| 등급 | 134 |
| 등급(헤더 추정) | 134 |
| 점수/백분위/환산점수 [A: 병합충돌] | 122 |
| 등급 [A: 병합충돌] | 122 |
| 점수(헤더 추정) | 76 |

### cut 값 유형

| valueType | count |
| --- | ---: |
| score | 564 |
| grade | 390 |

### admissionType 분포

| admissionType | count |
| --- | ---: |
| 수능위주 | 610 |
| (blank) | 344 |

### sourceFile/sourcePage 상위

| sourceFile | page | count |
| --- | ---: | ---: |
| 2025학년도 대입 전형결과(경북_1).pdf | 29 | 305 |
| 2025학년도 대입 전형결과(대구).pdf | 11 | 305 |
| 2025학년도 대입 전형결과(경북_1).pdf | 26 | 114 |
| 2025학년도 대입 전형결과(대구).pdf | 8 | 114 |
| 2025학년도 대입 전형결과(경북_1).pdf | 24 | 58 |
| 2025학년도 대입 전형결과(대구).pdf | 6 | 58 |

## 원인 분류 및 처리

| reason | count | action |
| --- | ---: | --- |
| promotable_merge_conflict_normal_value | 610 | mid 승격 |
| promotable_admission_type_blank | 330 | mid 승격 |
| low_score_min_cut | 14 | low 유지 |

## 개선 불가 샘플

- 2025학년도 대입 전형결과(경북_1).pdf p.26 · 건축학부(건축공학전공) · 최저 · grade=None score=15.0 · low_score_min_cut
- 2025학년도 대입 전형결과(대구).pdf p.8 · 건축학부(건축공학전공) · 최저 · grade=None score=15.0 · low_score_min_cut
- 2025학년도 대입 전형결과(경북_1).pdf p.26 · 생물학과 · 최저 · grade=None score=25.0 · low_score_min_cut
- 2025학년도 대입 전형결과(대구).pdf p.8 · 생물학과 · 최저 · grade=None score=25.0 · low_score_min_cut
- 2025학년도 대입 전형결과(경북_1).pdf p.26 · 수학과 · 최저 · grade=None score=18.0 · low_score_min_cut
- 2025학년도 대입 전형결과(대구).pdf p.8 · 수학과 · 최저 · grade=None score=18.0 · low_score_min_cut
- 2025학년도 대입 전형결과(경북_1).pdf p.26 · 신소재공학과 · 최저 · grade=None score=20.0 · low_score_min_cut
- 2025학년도 대입 전형결과(대구).pdf p.8 · 신소재공학과 · 최저 · grade=None score=20.0 · low_score_min_cut
- 2025학년도 대입 전형결과(경북_1).pdf p.26 · 자연과학대학자율학부 · 최저 · grade=None score=27.0 · low_score_min_cut
- 2025학년도 대입 전형결과(대구).pdf p.8 · 자연과학대학자율학부 · 최저 · grade=None score=27.0 · low_score_min_cut
- 2025학년도 대입 전형결과(경북_1).pdf p.26 · 중어중문학과 · 최저 · grade=None score=28.0 · low_score_min_cut
- 2025학년도 대입 전형결과(대구).pdf p.8 · 중어중문학과 · 최저 · grade=None score=28.0 · low_score_min_cut
- 2025학년도 대입 전형결과(경북_1).pdf p.26 · 통계학과 · 최저 · grade=None score=26.0 · low_score_min_cut
- 2025학년도 대입 전형결과(대구).pdf p.8 · 통계학과 · 최저 · grade=None score=26.0 · low_score_min_cut
