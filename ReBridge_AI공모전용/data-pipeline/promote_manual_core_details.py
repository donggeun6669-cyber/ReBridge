import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REPORT_DIR = ROOT / "reports"


def source(university, page, pdf):
    return f"{university} 2028 시행계획 p.{page} ({pdf})"


def reflect(admission_type):
    return {
        "학생부종합": "학생부 대체서식 + 검정고시 성적으로 서류 종합평가",
        "학생부교과": "비교내신 환산 또는 대학별 검정고시 성적 환산",
        "논술": "논술고사 중심, 검정고시 성적은 대학별 기준으로 반영",
        "실기": "실기고사 중심, 검정고시 성적은 대학별 기준으로 반영",
        "수능위주": "수능 점수 반영",
    }.get(admission_type, "")


def row(
    univ_id,
    university,
    phase,
    admission_type,
    name,
    count,
    method="",
    csat="미확인",
    eligible="가능",
    reason="",
    page=0,
    pdf="",
):
    return {
        "univId": univ_id,
        "phase": phase,
        "admissionType": admission_type,
        "admissionName": name,
        "gedEligible": eligible,
        "gedIneligibleReason": reason,
        "gedReflection": reflect(admission_type),
        "comparativeGrade": "",
        "evalMethod": method,
        "interview": "면접" in method,
        "csatMinimum": csat,
        "recruitCount": count,
        "unit": "",
        "note": "",
        "source": source(university, page, pdf),
        "status": "confirmed_detail",
    }


def main():
    admissions_path = ROOT / "admissions.json"
    admissions = json.loads(admissions_path.read_text(encoding="utf-8"))

    soongsil_pdf = "숭실대학교[서울][본교]_2028_시행계획(1차수).pdf"
    sejong_pdf = "세종대학교[서울][본교]_2028_시행계획(1차수).pdf"
    ajou_pdf = "아주대학교[경기][본교]_2028_시행계획(1차수).pdf"
    skku_pdf = "성균관대학교[서울][본교]_2028_시행계획(1차수).pdf"

    promoted = [
        # 숭실대학교 p.4
        row("soongsil", "숭실대학교", "수시", "학생부종합", "SSU미래인재(면접형)", 538, page=4, pdf=soongsil_pdf),
        row("soongsil", "숭실대학교", "수시", "학생부종합", "SSU미래인재(서류형)", 166, page=4, pdf=soongsil_pdf),
        row("soongsil", "숭실대학교", "수시", "학생부종합", "기회균형", 130, eligible="조건부", reason="지원자격 확인이 필요한 전형이에요", page=4, pdf=soongsil_pdf),
        row("soongsil", "숭실대학교", "수시", "학생부종합", "AI우수자", 17, page=4, pdf=soongsil_pdf),
        row("soongsil", "숭실대학교", "수시", "학생부교과", "교과우수자", 462, page=4, pdf=soongsil_pdf),
        row("soongsil", "숭실대학교", "수시", "논술", "논술우수자", 240, page=4, pdf=soongsil_pdf),
        row("soongsil", "숭실대학교", "수시", "실기", "예체능우수인재", 51, page=4, pdf=soongsil_pdf),
        row("soongsil", "숭실대학교", "정시", "수능위주", "가군", 494, csat="해당없음(정시)", page=4, pdf=soongsil_pdf),
        row("soongsil", "숭실대학교", "정시", "수능위주", "나군", 335, csat="해당없음(정시)", page=4, pdf=soongsil_pdf),
        row("soongsil", "숭실대학교", "정시", "수능위주", "다군", 484, csat="해당없음(정시)", page=4, pdf=soongsil_pdf),
        row("soongsil", "숭실대학교", "정시", "실기", "다군 실기", 56, csat="해당없음(정시)", page=4, pdf=soongsil_pdf),

        # 세종대학교 p.4
        row("sejong", "세종대학교", "수시", "학생부교과", "지역균형 전형", 388, "학생부교과 100%", "적용(세부 기준 확인 필요)", "조건부", "지역/추천 요건을 확인해야 해요", 4, sejong_pdf),
        row("sejong", "세종대학교", "수시", "학생부교과", "항공시스템공학 특별전형", 23, "1단계 학생부교과 100%, 2단계 공군전형", "적용(세부 기준 확인 필요)", "조건부", "계약학과/군 전형 요건을 확인해야 해요", 4, sejong_pdf),
        row("sejong", "세종대학교", "수시", "학생부종합", "세종인재 전형(면접형)", 385, "1단계 서류평가 100%, 2단계 1단계 60% + 면접 40%", "없음", page=4, pdf=sejong_pdf),
        row("sejong", "세종대학교", "수시", "학생부종합", "세종인재 전형(서류형)", 252, "서류평가 100%", "미확인", page=4, pdf=sejong_pdf),
        row("sejong", "세종대학교", "수시", "학생부종합", "기회균형 전형", 99, "서류평가 100%", "미확인", "조건부", "지원자격 확인이 필요한 전형이에요", 4, sejong_pdf),
        row("sejong", "세종대학교", "수시", "학생부종합", "사회기여 및 배려자 전형", 50, "서류평가 100%", "미확인", "조건부", "지원자격 확인이 필요한 전형이에요", 4, sejong_pdf),
        row("sejong", "세종대학교", "수시", "논술", "논술우수자 전형", 344, "논술 100%", "적용(세부 기준 확인 필요)", page=4, pdf=sejong_pdf),
        row("sejong", "세종대학교", "수시", "실기", "실기우수자 전형", 119, "모집단위별 실기 중심", "없음", page=4, pdf=sejong_pdf),
        row("sejong", "세종대학교", "정시", "수능위주", "일반학생 전형(수능형)", 816, "수능 100%", "해당없음(정시)", page=4, pdf=sejong_pdf),
        row("sejong", "세종대학교", "정시", "수능위주", "일반학생 전형(융합형)", 358, "수능 90% + 학생부교과(정성) 10%", "해당없음(정시)", page=4, pdf=sejong_pdf),

        # 아주대학교 p.3
        row("ajou", "아주대학교", "수시", "학생부교과", "학생부교과(고교추천전형)", 279, "학생부교과 90 + 출결 10", "미확인", "조건부", "고교추천 요건을 확인해야 해요", 3, ajou_pdf),
        row("ajou", "아주대학교", "수시", "학생부종합", "ACE전형 면접형", 563, "1단계 서류평가 100, 2단계 1단계성적 70 + 면접 30", "미확인", page=3, pdf=ajou_pdf),
        row("ajou", "아주대학교", "수시", "학생부종합", "ACE전형 서류형", 201, "서류평가 100", "미확인", page=3, pdf=ajou_pdf),
        row("ajou", "아주대학교", "수시", "학생부종합", "고른기회1전형", 95, "서류평가 중심", "미확인", "조건부", "지원자격 확인이 필요한 전형이에요", 3, ajou_pdf),
        row("ajou", "아주대학교", "수시", "학생부종합", "고른기회2전형", 57, "서류평가 중심", "미확인", "조건부", "지원자격 확인이 필요한 전형이에요", 3, ajou_pdf),
        row("ajou", "아주대학교", "수시", "논술", "논술우수자전형", 224, "논술 90 + 학생부교과 10", "미확인", page=3, pdf=ajou_pdf),
        row("ajou", "아주대학교", "정시", "수능위주", "수능(일반전형1)", 10, "수능 95 + 면접 5", "해당없음(정시)", page=3, pdf=ajou_pdf),
        row("ajou", "아주대학교", "정시", "수능위주", "수능(일반전형2)", 146, "수능 100", "해당없음(정시)", page=3, pdf=ajou_pdf),
        row("ajou", "아주대학교", "정시", "수능위주", "수능(일반전형3)", 467, "수능 100", "해당없음(정시)", page=3, pdf=ajou_pdf),

        # 성균관대학교 p.7
        row("skku", "성균관대학교", "수시", "학생부종합", "융합인재", 325, "학생부 100", "적용(세부 기준 확인 필요)", page=7, pdf=skku_pdf),
        row("skku", "성균관대학교", "수시", "학생부종합", "탐구인재", 568, "학생부 100", "없음", page=7, pdf=skku_pdf),
        row("skku", "성균관대학교", "수시", "학생부종합", "성균인재", 218, "1단계 학생부 100, 2단계 학생부 70 + 면접 30", "미확인", page=7, pdf=skku_pdf),
        row("skku", "성균관대학교", "수시", "학생부종합", "과학인재", 155, "학생부/서류 평가", "미확인", page=7, pdf=skku_pdf),
        row("skku", "성균관대학교", "수시", "학생부종합", "기회균형", 29, "서류 100", "미확인", "조건부", "지원자격 확인이 필요한 전형이에요", 7, skku_pdf),
        row("skku", "성균관대학교", "수시", "학생부교과", "추천인재", 415, "학생부 100", "적용(세부 기준 확인 필요)", "조건부", "추천 요건을 확인해야 해요", 7, skku_pdf),
        row("skku", "성균관대학교", "수시", "논술", "논술 언어형", 156, "논술 100", "적용(세부 기준 확인 필요)", page=7, pdf=skku_pdf),
        row("skku", "성균관대학교", "수시", "논술", "논술 수리형", 220, "논술 100", "적용(세부 기준 확인 필요)", page=7, pdf=skku_pdf),
        row("skku", "성균관대학교", "정시", "수능위주", "일반전형 일반형", 1307, "수능 100", "해당없음(정시)", page=7, pdf=skku_pdf),
        row("skku", "성균관대학교", "정시", "수능위주", "일반전형 특화형", 150, "수능 100", "해당없음(정시)", page=7, pdf=skku_pdf),
    ]

    replace_ids = {"soongsil", "sejong", "ajou", "skku"}
    kept = [item for item in admissions if item.get("univId") not in replace_ids]
    kept.extend(promoted)
    admissions_path.write_text(json.dumps(kept, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    report = {
        "replacedUniversityIds": sorted(replace_ids),
        "promotedRows": len(promoted),
        "totalAdmissions": len(kept),
    }
    (REPORT_DIR / "manual_core_promotion_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
