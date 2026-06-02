# -*- coding: utf-8 -*-
"""
admissions.json 생성기 (ReBridge V1).
근거: 2028학년도 대학입학전형 기본사항(KCUE) — 검정고시 출신자 수시 지원 보장.
      논술 교과(비교내신) 반영비율 — 서울신문 2025-10-10 입시기사 등.
원칙: 핵심 분기 필드(gedEligible/gedReflection)는 일반 규칙으로 정확히.
      대학별 세부 수치(모집인원/경쟁률/정확한 수능최저)는 모집요강 확인 전까지 비움(null/"").
"""
import json

SRC_RULE = "2028학년도 대학입학전형 기본사항(KCUE): 검정고시 출신자 수시 지원 보장. 세부 전형방법은 각 대학 2028 시행계획·모집요강 확인 필요"
SRC_NONSUL = "; 논술 교과(비교내신) 반영비율 출처: 서울신문 2025-10-10 입시 기사"

# 논술 시행 대학과 학생부(교과) 반영 비율(%). 값이 정수면 '학생부 비율', 특수 문자열은 evalMethod 직접 지정.
# None = 논술 시행하나 반영비율 미확인(모집요강 확인). 'NONE_RATIO' = 검정고시 성적 미반영(논술100).
NONSUL = {
    "korea": "논술 100%",
    "cau": "논술 70% + 학생부교과 20% + 출결 10%",
    "catholic": "논술 80% + 학생부교과 20%",
    "hanyang": 10, "hongik": 10, "sookmyung": 10, "smu": 10, "kyonggi": 10,
    "kw": 20, "dankook": 20, "dongguk": 20, "uos": 20, "swu": 20, "soongsil": 20, "ajou": 20,
    "seoultech": 30, "sejong": 30, "inha": 30, "knu": 30, "pusan": 30,
    "yonsei": None, "skku": None, "khu": None, "hufs": None, "sogang": None, "konkuk": None,
}
# 논술 미시행(또는 검정고시 관련 논술 없음)
NO_NONSUL = {"snu", "kookmin", "jnu", "cnu", "jbnu", "kangwon", "jejunu"}

# 학종 수능최저를 폭넓게 적용하는 경향의 상위권(모집단위별 상이 안내)
TOP_CSAT = {"snu", "yonsei", "korea", "skku", "hanyang", "cau", "khu", "sogang"}

# 검증 상세를 가진 큐레이션 34곳(이 집합 밖 = 공공데이터로 추가된 학교)
CURATED = {
    "snu","yonsei","korea","skku","hanyang","cau","khu","hufs","sogang","uos",
    "konkuk","dongguk","hongik","kookmin","soongsil","sejong","kw","smu","sookmyung",
    "swu","seoultech","dankook","gachon","ajou","kyonggi","catholic","inha",
    "pusan","knu","jnu","cnu","jbnu","kangwon","jejunu",
}

# universities.json 로드 (전체 객체)
with open("universities.json", encoding="utf-8") as f:
    univs = json.load(f)

rows = []

def add(univId, phase, atype, aname, eligible, reflection, evalm, interview,
        csat, reason="", source=SRC_RULE, note=""):
    rows.append({
        "univId": univId, "phase": phase, "admissionType": atype, "admissionName": aname,
        "gedEligible": eligible, "gedIneligibleReason": reason, "gedReflection": reflection,
        "comparativeGrade": "", "evalMethod": evalm, "interview": interview,
        "csatMinimum": csat, "recruitCount": None,
        "unit": "", "note": note, "source": source,
    })

for u in univs:
    uid = u["univId"]
    kind = u.get("kind", "대학교")  # 공공데이터 행은 kind 보유, 큐레이션은 대학교 취급
    curated = uid in CURATED

    # ── 전문대학: 학종/논술 개념이 거의 없음. 일반전형(서류·면접) + 정시만 베이스라인 ──
    if kind == "전문대학":
        add(uid, "수시", "일반(서류)", "수시 일반전형", "가능",
            "검정고시 성적 + 제출서류로 평가(대학별 상이)",
            "서류 위주, 일부 면접(모집요강 확인)", True, "없음(대다수)",
            note="전문대 일반전형은 검정고시생 지원 폭넓게 열려 있어요")
        add(uid, "정시", "수능위주", "정시 일반전형", "가능",
            "수능(또는 면접·실기)로 평가(재학생과 동일 조건)",
            "수능 위주(모집단위별 상이)", False, "해당없음(정시)",
            note="검정고시생에게 공평한 길")
        continue

    # ── 4년제 ──
    # 1) 학생부종합 — 검정고시 핵심 통로
    jong_csat = "모집단위별 수능최저 적용 가능(모집요강 확인)" if uid in TOP_CSAT \
        else ("없음(대다수 모집단위)" if curated else "모집요강 확인 필요")
    add(uid, "수시", "학생부종합", "학생부종합전형", "가능",
        "학생부 대체서식 + 검정고시 성적으로 서류 종합평가",
        "서류 종합평가 중심, 일부 단계별 면접(대학별 상이)", True, jong_csat,
        note="검정고시생에게 가장 길이 열린 전형")

    # 2) 논술 — 시행 여부가 확인된 큐레이션 대학만(미확인 대학에 논술 행을 지어내지 않음)
    if curated and uid not in NO_NONSUL:
        ratio = NONSUL.get(uid, None)
        src = SRC_RULE + SRC_NONSUL
        if isinstance(ratio, int):
            evalm = f"논술 {100-ratio}% + 학생부(비교내신) {ratio}%"
            refl = f"비교내신으로 교과 성적 환산(교과 {ratio}% 반영, 논술 위주)"
            add(uid, "수시", "논술", "논술전형", "가능", refl, evalm, False,
                "수능최저 적용하는 경우 많음(모집요강 확인)", source=src,
                note="내신 비중이 작아 검정고시생에게 유리할 수 있는 전형")
        elif isinstance(ratio, str):  # 특수 evalMethod
            if "100%" in ratio:
                refl = "검정고시 성적 미반영(논술 100%)"
            else:
                refl = "비교내신으로 교과 성적 환산(논술 위주)"
            add(uid, "수시", "논술", "논술전형", "가능", refl, ratio, False,
                "수능최저 적용하는 경우 많음(모집요강 확인)", source=src,
                note="내신 비중이 작아 검정고시생에게 유리할 수 있는 전형")
        else:  # None — 시행하나 비율 미확인
            add(uid, "수시", "논술", "논술전형", "가능",
                "비교내신으로 교과 성적 환산(논술 위주)",
                "논술 위주(학생부/검정고시 반영 비율은 모집요강 확인)", False,
                "수능최저 적용하는 경우 많음(모집요강 확인)", source=src,
                note="내신 비중이 작아 검정고시생에게 유리할 수 있는 전형")

    # 3) 학생부교과(추천형) — 일반적으로 학교장/교사 추천 필요 → 검정고시 불가(교육용 대비 행)
    add(uid, "수시", "학생부교과", "학생부교과(추천형)", "불가", "",
        "학생부교과 중심(추천 필요)", False, "",
        reason="재학 중 고교의 학교장·교사 추천이 필요해 검정고시 출신은 지원할 수 없어요",
        note="교과 일반/검정고시 별도 전형이 있는 대학은 모집요강 확인 시 '가능'으로 갱신")

    # 4) 정시 — 재학생과 동일
    add(uid, "정시", "수능위주", "수능위주전형(일반)", "가능",
        "수능 점수로 평가(재학생과 완전히 동일한 조건)",
        "수능 100%(모집단위별 영역 반영비율 상이)", False, "해당없음(정시)",
        note="검정고시생에게 가장 공평한 길")

with open("admissions.json", "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)

print(f"generated {len(rows)} rows for {len(univs)} universities")
