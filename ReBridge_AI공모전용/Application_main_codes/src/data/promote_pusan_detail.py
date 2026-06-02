"""
부산대학교 상세 전형 반영 스크립트
출처: Data/2028_부산대학교_상세반영후보.md
근거 PDF: 부산대학교[부산][본교]_2028_시행계획(1차수).pdf p.3

기존 4개 confirmed 행을 제거하고 confirmed_detail 행으로 교체.
"""
import json, copy

ADM_PATH = 'admissions.json'

with open(ADM_PATH, encoding='utf-8') as f:
    adm = json.load(f)

SOURCE = '부산대학교 2028 시행계획 p.3 (부산대학교[부산][본교]_2028_시행계획(1차수).pdf)'

# confirmed_detail 행 정의 (핸드오프 문서 표 기준)
PUSAN_DETAIL = [
    # 수시 — 학생부교과
    {
        'univId': 'pusan', 'phase': '수시', 'admissionType': '학생부교과',
        'admissionName': '교과우수전형',
        'gedEligible': '조건부',
        'gedIneligibleReason': '2022년 이후 졸업자 조건 등 세부 지원자격 확인 필요',
        'gedReflection': '학생부 교과 성적 → 비교내신 환산 후 반영',
        'comparativeGrade': '', 'evalMethod': '학생부교과 80% + 학업역량평가 20%',
        'interview': False, 'csatMinimum': '적용(세부 기준 모집요강 확인)',
        'recruitCount': 1062, 'unit': '명',
        'note': '수능최저학력기준 적용',
        'source': SOURCE, 'status': 'confirmed_detail',
    },
    {
        'univId': 'pusan', 'phase': '수시', 'admissionType': '학생부교과',
        'admissionName': '교과지역전형',
        'gedEligible': '조건부',
        'gedIneligibleReason': '부산·울산·경남 지역 고교 출신 조건 → 검정고시 지원자격 모집요강 재확인 필요',
        'gedReflection': '학생부 교과 성적 → 비교내신 환산 후 반영',
        'comparativeGrade': '', 'evalMethod': '학생부교과 80% + 학업역량평가 20%',
        'interview': False, 'csatMinimum': '적용으로 추정(모집요강 확인)',
        'recruitCount': 447, 'unit': '명',
        'note': '지역인재 조건 확인 필요',
        'source': SOURCE, 'status': 'confirmed_detail',
    },
    {
        'univId': 'pusan', 'phase': '수시', 'admissionType': '학생부교과',
        'admissionName': '탐구전형',
        'gedEligible': '조건부',
        'gedIneligibleReason': '세부 지원자격 모집요강 확인 필요',
        'gedReflection': '학생부 교과 성적 → 비교내신 환산 후 반영, 2단계 면접',
        'comparativeGrade': '', 'evalMethod': '1단계: 학생부교과 100%(5배수) / 2단계: 1단계 60% + 교과역량면접 40%',
        'interview': True, 'csatMinimum': '미적용',
        'recruitCount': 308, 'unit': '명',
        'note': '면접 있음',
        'source': SOURCE, 'status': 'confirmed_detail',
    },
    # 수시 — 학생부종합
    {
        'univId': 'pusan', 'phase': '수시', 'admissionType': '학생부종합',
        'admissionName': '서류전형',
        'gedEligible': '가능',
        'gedIneligibleReason': '',
        'gedReflection': '학생부 대체서식 + 검정고시 성적으로 서류 종합평가',
        'comparativeGrade': '', 'evalMethod': '서류평가 100%',
        'interview': False, 'csatMinimum': '일부 적용(모집요강 확인)',
        'recruitCount': 463, 'unit': '명',
        'note': '검정고시생 지원 가능',
        'source': SOURCE, 'status': 'confirmed_detail',
    },
    {
        'univId': 'pusan', 'phase': '수시', 'admissionType': '학생부종합',
        'admissionName': '면접전형',
        'gedEligible': '가능',
        'gedIneligibleReason': '',
        'gedReflection': '학생부 대체서식 + 검정고시 성적으로 서류 종합평가 후 면접',
        'comparativeGrade': '', 'evalMethod': '1단계: 서류평가 100% / 2단계: 1단계 70% + 면접 30%',
        'interview': True, 'csatMinimum': '일부 적용(모집요강 확인)',
        'recruitCount': 569, 'unit': '명',
        'note': '검정고시생 지원 가능',
        'source': SOURCE, 'status': 'confirmed_detail',
    },
    {
        'univId': 'pusan', 'phase': '수시', 'admissionType': '학생부종합',
        'admissionName': '사회배려자전형',
        'gedEligible': '조건부',
        'gedIneligibleReason': '사회배려자 자격 기준 충족 필요 — 모집요강 확인',
        'gedReflection': '서류평가 100%, 해당 자격 갖춘 검정고시생 지원 가능',
        'comparativeGrade': '', 'evalMethod': '서류평가 100%',
        'interview': False, 'csatMinimum': '미적용',
        'recruitCount': 150, 'unit': '명',
        'note': '',
        'source': SOURCE, 'status': 'confirmed_detail',
    },
    # 정시 — 수능
    {
        'univId': 'pusan', 'phase': '정시', 'admissionType': '수능위주',
        'admissionName': '수능우수전형',
        'gedEligible': '가능',
        'gedIneligibleReason': '',
        'gedReflection': '수능 성적만으로 지원 가능',
        'comparativeGrade': '', 'evalMethod': '수능 80% + 학업충실도평가 20% (일부 예체능 실기 반영)',
        'interview': False, 'csatMinimum': '미적용',
        'recruitCount': 1380, 'unit': '명',
        'note': '모집인원은 요약표(p.3) 기준. 세부 페이지와 ±2명 차이 있음',
        'source': SOURCE, 'status': 'confirmed_detail',
    },
]

# 기존 pusan 행 제거 후 새 행 삽입
before = [a for a in adm if a['univId'] != 'pusan']
after  = before + PUSAN_DETAIL

print(f'기존 pusan 행: {len(adm) - len(before)}개 제거')
print(f'새 confirmed_detail 행: {len(PUSAN_DETAIL)}개 추가')
print(f'전체: {len(adm)} → {len(after)}행')

with open(ADM_PATH, 'w', encoding='utf-8') as f:
    json.dump(after, f, ensure_ascii=False, indent=2)
print('완료: admissions.json 저장됨')
