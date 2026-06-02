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
    note="",
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
        "note": note,
        "source": source(university, page, pdf),
        "status": "confirmed_detail",
    }


def main():
    admissions_path = ROOT / "admissions.json"
    admissions = json.loads(admissions_path.read_text(encoding="utf-8"))

    uos_pdf = "서울시립대학교[서울][본교]_2028_시행계획(1차수).pdf"
    cau_pdf = "중앙대학교[서울][본교]_2028_시행계획(1차수).pdf"

    promoted = [
        row(
            "uos",
            "서울시립대학교",
            "수시",
            "논술",
            "논술전형",
            86,
            "논술 100%",
            "있음: 국어, 수학, 영어, 탐구(사회/과학 상위 1과목) 중 3개 영역 등급합 7 이내 및 한국사 4등급 이내",
            page=6,
            pdf=uos_pdf,
        ),
        row(
            "uos",
            "서울시립대학교",
            "수시",
            "학생부교과",
            "고교추천전형",
            346,
            "학생부교과 60% + 서류평가 40%",
            "있음: 국어, 수학, 영어, 탐구(사회/과학 상위 1과목) 중 3개 영역 등급합 7 이내 및 한국사 4등급 이내",
            "불가",
            "국내 고등학교 2028년 졸업예정자 중 학교장 추천을 받은 자만 지원 가능해요",
            6,
            uos_pdf,
        ),
        row(
            "uos",
            "서울시립대학교",
            "수시",
            "학생부종합",
            "학생부종합전형",
            424,
            "1단계 서류평가 100%, 2단계 서류평가 50% + 면접평가 50%",
            "없음",
            page=6,
            pdf=uos_pdf,
        ),
        row(
            "uos",
            "서울시립대학교",
            "수시",
            "학생부종합",
            "기회균형전형 I",
            132,
            "1단계 서류평가 100%, 2단계 서류평가 50% + 면접평가 50%",
            "없음",
            "조건부",
            "국가보훈, 기초생활수급자, 차상위계층, 한부모가족, 특성화고 동일계열 등 별도 자격을 확인해야 해요",
            6,
            uos_pdf,
        ),
        row(
            "uos",
            "서울시립대학교",
            "수시",
            "학생부종합",
            "사회공헌·통합전형",
            46,
            "1단계 서류평가 100%, 2단계 서류평가 50% + 면접평가 50%",
            "없음",
            "조건부",
            "독립유공자 후손, 민주화운동 관련자 자녀, 다문화/다자녀 등 별도 자격을 확인해야 해요",
            7,
            uos_pdf,
        ),
        row(
            "uos",
            "서울시립대학교",
            "수시",
            "실기",
            "실기전형",
            37,
            "음악학과: 실기고사 90% + 학생부교과 10%, 디자인학과: 단계별 학생부교과/실기/면접",
            "없음",
            "불가",
            "국내 고등학교 졸업예정자 대상이며 교과 성적 산출 가능 요건이 있어 검정고시 출신은 지원이 어려워요",
            7,
            uos_pdf,
        ),
        row(
            "uos",
            "서울시립대학교",
            "정시",
            "수능위주",
            "일반전형",
            674,
            "인문·자연계열: 수능 80% + 학생부교과 18% + 출결 2%, 스포츠과학과는 단계별 수능/교과/실기",
            "해당없음(정시)",
            page=7,
            pdf=uos_pdf,
        ),
        row(
            "uos",
            "서울시립대학교",
            "정시",
            "실기",
            "일반전형(실기/실적)",
            57,
            "음악학과: 실기 60% + 수능 30% + 학생부교과 10%, 디자인/조각은 단계별 수능·실기·면접",
            "해당없음(정시)",
            page=7,
            pdf=uos_pdf,
        ),
        row(
            "uos",
            "서울시립대학교",
            "정시",
            "수능위주",
            "기회균형전형 II",
            102,
            "수능 80% + 학생부교과 18% + 출결 2%",
            "해당없음(정시)",
            "조건부",
            "농어촌학생, 특성화고졸업자, 기초생활수급자 등, 장애인대상자 등 별도 자격을 확인해야 해요",
            8,
            uos_pdf,
        ),
        row(
            "cau",
            "중앙대학교",
            "수시",
            "학생부교과",
            "지역균형",
            505,
            "학생부 100%(교과 90, 출결 10)",
            "서울캠퍼스 모집단위 적용(세부 기준 확인 필요)",
            "조건부",
            "지역균형/추천 성격의 전형이라 검정고시 지원 가능 여부는 모집요강에서 확인해야 해요",
            6,
            cau_pdf,
        ),
        row(
            "cau",
            "중앙대학교",
            "수시",
            "학생부종합",
            "탐구하는 학종(Core)",
            499,
            "1단계 서류 100%, 2단계 1단계 60% + 면접 40%",
            "없음",
            page=6,
            pdf=cau_pdf,
        ),
        row("cau", "중앙대학교", "수시", "학생부종합", "모두의 학종(All)", 384, "서류 100%", "없음", page=6, pdf=cau_pdf),
        row(
            "cau",
            "중앙대학교",
            "수시",
            "학생부종합",
            "최저 있는 학종(Up)",
            114,
            "서류 100%(의학부는 단계별 서류/면접)",
            "있음",
            page=6,
            pdf=cau_pdf,
        ),
        row("cau", "중앙대학교", "수시", "학생부종합", "어울림", 20, "서류 100%", "없음", page=6, pdf=cau_pdf),
        row(
            "cau",
            "중앙대학교",
            "수시",
            "학생부종합",
            "기회균형(농어촌학생)",
            141,
            "서류 100%",
            "미확인",
            "조건부",
            "농어촌학생 지원자격을 충족해야 해요",
            6,
            cau_pdf,
        ),
        row(
            "cau",
            "중앙대학교",
            "수시",
            "학생부종합",
            "기회균형(기초생활수급자 및 차상위계층)",
            74,
            "서류 100%",
            "미확인",
            "조건부",
            "기초생활수급자/차상위계층 지원자격을 충족해야 해요",
            6,
            cau_pdf,
        ),
        row(
            "cau",
            "중앙대학교",
            "수시",
            "학생부종합",
            "기회균형(장애인 등 대상자)",
            10,
            "서류 100%",
            "미확인",
            "조건부",
            "장애인 등 대상자 지원자격을 충족해야 해요",
            6,
            cau_pdf,
        ),
        row(
            "cau",
            "중앙대학교",
            "수시",
            "학생부종합",
            "기회균형(특성화고졸재직자)",
            232,
            "서류 100%",
            "미확인",
            "조건부",
            "특성화고졸재직자 지원자격을 충족해야 해요",
            6,
            cau_pdf,
        ),
        row(
            "cau",
            "중앙대학교",
            "수시",
            "논술",
            "모두의 논술",
            395,
            "논술 80% + 학생부 20%(교과 10, 출결 10)",
            "서울캠퍼스 모집단위 적용(세부 기준 확인 필요)",
            page=6,
            pdf=cau_pdf,
        ),
        row("cau", "중앙대학교", "수시", "논술", "재학생 논술", 87, "논술 80% + 학생부 20%(교과 10, 출결 10)", "없음", "불가", "재학생 대상 논술로 검정고시 출신은 지원이 어려워요", 6, cau_pdf),
        row("cau", "중앙대학교", "수시", "실기", "실기", 334, "실기 + 학생부(교과, 출결), 모집단위별 비율 상이", "일부 적용", page=6, pdf=cau_pdf),
        row("cau", "중앙대학교", "수시", "실기", "특기", 54, "수상실적 + 적성실기 + 학생부(교과, 출결)", "없음", "조건부", "특기자 자격과 모집단위별 기준을 확인해야 해요", 6, cau_pdf),
        row("cau", "중앙대학교", "정시", "수능위주", "수능89", 1459, "수능 89% + 학생부(출결) 11%", "해당없음(정시)", page=6, pdf=cau_pdf),
        row("cau", "중앙대학교", "정시", "수능위주", "수능67", 251, "수능 67% + 서류 33%", "있음", page=6, pdf=cau_pdf),
        row("cau", "중앙대학교", "정시", "수능위주", "계약정원 특별전형", 7, "수능 89% + 학생부(출결) 11%", "해당없음(정시)", "조건부", "계약정원 특별전형 자격을 확인해야 해요", 6, cau_pdf),
        row("cau", "중앙대학교", "정시", "수능위주", "기회균형(특성화고교졸업자)", 30, "수능위주", "해당없음(정시)", "조건부", "특성화고교졸업자 지원자격을 충족해야 해요", 6, cau_pdf),
        row("cau", "중앙대학교", "정시", "수능위주", "기회균형(농어촌학생)", 82, "수능위주", "해당없음(정시)", "조건부", "농어촌학생 지원자격을 충족해야 해요", 6, cau_pdf),
        row("cau", "중앙대학교", "정시", "수능위주", "기회균형(기초생활수급자 및 차상위계층)", 30, "수능위주", "해당없음(정시)", "조건부", "기초생활수급자/차상위계층 지원자격을 충족해야 해요", 6, cau_pdf),
        row("cau", "중앙대학교", "정시", "실기", "수능(실기)", 159, "실기 + 수능, 모집단위별 비율 상이", "해당없음(정시)", page=6, pdf=cau_pdf),
        row("cau", "중앙대학교", "정시", "실기", "실기/실적(실기)", 73, "실기/실적 위주", "해당없음(정시)", page=6, pdf=cau_pdf),
        row("cau", "중앙대학교", "정시", "학생부종합", "기회균형(특성화고졸재직자)", 10, "서류 100%", "해당없음(정시)", "조건부", "특성화고졸재직자 지원자격을 충족해야 해요", 6, cau_pdf),
    ]

    replace_ids = {"uos", "cau"}
    kept = [item for item in admissions if item.get("univId") not in replace_ids]
    kept.extend(promoted)
    admissions_path.write_text(json.dumps(kept, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    report = {
        "replacedUniversityIds": sorted(replace_ids),
        "promotedRows": len(promoted),
        "totalAdmissions": len(kept),
    }
    (REPORT_DIR / "manual_more_promotion_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
