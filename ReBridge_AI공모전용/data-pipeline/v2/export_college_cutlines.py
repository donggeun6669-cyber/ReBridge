"""전문대학 전형결과(L1 cutline) → 앱용 cutlines_college_<year>.json

## 4년제와 무엇이 다른가

1) 컷의 종류가 다르다.
   어디가(4년제)는 70%컷·50%컷만 준다. 전문대교협 자료는 학과별 **합격자 평균 등급**과
   **합격자 최저 등급**을 준다. 최저 등급은 "이 등급까지도 합격했다"는 뜻이라
   검정고시생에게는 70%컷보다 오히려 쓸모가 크다. 둘 다 싣는다.
   → cutGradeAvg 는 '평균'을 그대로 넣는다(4년제는 원천에 평균이 없어 항상 null이다).
     cutGrade70 은 전문대 원천에 없으므로 null이다. 없는 걸 만들지 않는다.

2) 전형 이름 체계가 다르다.
   원천은 '일반전형'/'특별전형'이고, 앱(2028 시행계획)의 전문대 전형은
   '일반(서류)'(수시)와 '수능위주'(정시)다. 그래서 이렇게 잇는다.
       수시 일반전형 → '일반(서류)'   (검정고시생의 주 타깃)
       정시 전체     → '수능위주'
   수시 특별전형은 만학도·특성화고 등 자격 제한이 붙는 경우가 많아 주 판정에 쓰지 않고,
   같은 블록의 byType['특별전형 평균']에 참고값으로만 넣는다. 버리지도, 섞지도 않는다.

3) 저작권 조건이 다르다.
   대교협 어디가와 달리 전문대교협 자료는 공공누리가 아니고 무단 복제·배포가 금지돼 있다.
   그래서 학과 단위 원본 행(25만 행)은 앱에 싣지 않는다. 대학×전형 단위로 집계한
   통계값만 내보내고, 출처와 이용 조건을 meta에 그대로 적는다.
   (4년제도 집계값만 싣고 있어 방식 자체는 같다.)

## 집계 방식

parse_adiga_csv.py와 같다 — confidence high/mid 행만 쓰고 학과별 값의 중앙값을 낸다.
low는 원천 표기가 깨졌거나 센티널이 섞인 행이라 제외한다.

실행:
    python3 v2/export_college_cutlines.py --year 2026 --dry-run
    python3 v2/export_college_cutlines.py --year 2026 --write
"""

import argparse
import json
import shutil
import statistics as st
import sys
import unicodedata
from collections import defaultdict
from datetime import date
from pathlib import Path

from common import connect

ROOT = Path(__file__).resolve().parents[2]
APP_DATA = ROOT / "Application_main_codes" / "src" / "data"
OUT_DIR = Path(__file__).resolve().parent / "out" / "college"

USE_CONFIDENCE = {"high", "mid"}
GRADE_SCALE = "9"

# 원천 전형 → 앱 전형(admissions.json의 전문대 admissionType)
PHASE_TYPE_TO_APP = {
    ("수시", "일반전형"): "일반(서류)",
    ("정시", "일반전형"): "수능위주",
    ("정시", "특별전형"): "수능위주",
}
# 주 판정에 쓰지 않고 참고값으로만 넣는 것
REFERENCE_ONLY = {("수시", "특별전형"): "특별전형"}


def median(vals):
    vals = [v for v in vals if v is not None]
    return round(st.median(vals), 2) if vals else None


def nfc(s):
    return unicodedata.normalize("NFC", s) if isinstance(s, str) else s


def fetch(conn, year):
    """전문대 행만 — source_file.license 가 있는 것이 전문대교협 자료다."""
    sql = """
        SELECT c.univ_id, c.phase, c.admission_type, c.cut_type, c.cut_grade,
               c.confidence, c.admission_name, s.title, s.publisher, s.license
          FROM cutline c
          JOIN source_file s ON s.source_id = c.source_id
         WHERE c.year = ?
           AND s.license IS NOT NULL
           AND c.cut_grade IS NOT NULL
    """
    return list(conn.execute(sql, (year,)))


def build(rows):
    """대학 × 앱전형 집계. 4년제 cutlines_*.json과 같은 모양으로 맞춘다."""
    # (univId, 앱전형) -> {'평균': [...], '최저': [...]}
    main = defaultdict(lambda: defaultdict(list))
    # (univId, 앱전형) -> {'특별전형 평균': [...], '특별전형 최저': [...]}
    ref = defaultdict(lambda: defaultdict(list))
    meta = defaultdict(lambda: {"files": set(), "publisher": None, "license": None})
    skipped_low = 0
    skipped_unmapped = 0

    for r in rows:
        (uid, phase, atype, cut_type, grade, conf, _aname, title, publisher, license_) = r
        if conf not in USE_CONFIDENCE:
            skipped_low += 1
            continue
        key = (nfc(phase), nfc(atype))
        app_type = PHASE_TYPE_TO_APP.get(key)
        if app_type:
            main[(uid, app_type)][nfc(cut_type)].append(grade)
        elif key in REFERENCE_ONLY:
            # 수시 특별전형 → 같은 대학의 수시 블록에 참고값으로 붙인다
            ref[(uid, "일반(서류)")][f"특별전형 {nfc(cut_type)}"].append(grade)
        else:
            skipped_unmapped += 1
            continue
        m = meta[uid]
        m["files"].add(nfc(title))
        m["publisher"] = nfc(publisher)
        m["license"] = nfc(license_)

    out = defaultdict(dict)
    for (uid, app_type), buckets in main.items():
        avg = median(buckets.get("평균", []))
        low = median(buckets.get("최저", []))
        if avg is None and low is None:
            continue

        by_type = {}
        if avg is not None:
            by_type["평균"] = {"grade": avg, "score": None, "n": len(buckets.get("평균", []))}
        if low is not None:
            by_type["최저"] = {"grade": low, "score": None, "n": len(buckets.get("최저", []))}
        for k, vals in ref.get((uid, app_type), {}).items():
            v = median(vals)
            if v is not None:
                by_type[k] = {"grade": v, "score": None, "n": len(vals)}

        m = meta[uid]
        out[uid][app_type] = {
            # 4년제 파일과 같은 4필드 — 앱 scoreEngine이 그대로 읽는다
            "cutGradeAvg": avg,      # 전문대 원천에는 진짜 '평균'이 있다
            "cutGrade70": None,      # 전문대 원천에 70%컷이 없다. 지어내지 않는다
            "cutScoreAvg": None,     # 환산점수 자체가 없다
            "cutScore70": None,
            # 합격자 최저 등급 — 4년제에는 없는 값이라 별도 필드로 둔다
            "cutGradeLowest": low,
            "n": max(len(buckets.get("평균", [])), len(buckets.get("최저", []))),
            "confidence": "mid",
            "byType": by_type,
            "src": {
                "files": sorted(m["files"]),
                "publisher": m["publisher"],
                "license": m["license"],
                "method": "median(high+mid)",
                "gradeScale": GRADE_SCALE,
            },
        }
    return out, skipped_low, skipped_unmapped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--write", action="store_true", help="앱 JSON을 실제로 쓴다")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.write and not args.dry_run:
        print("--write 또는 --dry-run 중 하나를 지정해야 한다."); sys.exit(2)

    conn = connect()
    rows = fetch(conn, args.year)
    blocks, skipped_low, skipped_unmapped = build(rows)

    # univId가 앱 마스터에 실재하는지 확인 — 없는 키는 넣지 않는다
    univ = json.loads((APP_DATA / "universities.json").read_text())
    known = {u["univId"] for u in univ}
    names = {u["univId"]: u["name"] for u in univ}
    kinds = {u["univId"]: u.get("kind") for u in univ}
    unknown = sorted(set(blocks) - known)
    for k in unknown:
        blocks.pop(k)
    not_college = sorted(k for k in blocks if kinds.get(k) != "전문대학")

    doc = {
        "meta": {
            "year": args.year,
            "gradeScale": GRADE_SCALE,
            "kind": "전문대학",
            "method": "median(high+mid) · 대학×전형유형 집계",
            "publisher": "한국전문대학교육협의회(전문대교협) 전문대학포털 프로칼리지",
            "sourceUrl": "https://www.procollege.kr",
            "retrievedAt": str(date.today()),
            "cutTypes": {
                "평균": "학과별 합격자 평균 등급의 중앙값",
                "최저": "학과별 합격자 최저 등급의 중앙값 — 이 등급까지도 합격한 사례가 있다는 뜻",
                "특별전형 평균": "수시 특별전형 참고값. 만학도·특성화고 등 자격 제한이 붙는 경우가 많다",
            },
            "note": "최상위 meta 키는 대학이 아니다 — 순회 시 반드시 건너뛸 것. "
                    "4년제(cutlines_YYYY.json)와 달리 cutGrade70·cutScore는 원천에 없어 항상 null이고, "
                    "대신 cutGradeAvg(합격자 평균)와 cutGradeLowest(합격자 최저)를 쓴다.",
            "license": "전문대교협 자료는 공공누리가 아니다. 무단 복제·배포가 금지돼 있어 "
                       "학과 단위 원본은 싣지 않고 대학×전형 단위 집계값만 담았다. "
                       "상업적 이용 시 전문대교협과 사전 협의가 필요하다.",
        }
    }
    for uid in sorted(blocks):
        doc[uid] = blocks[uid]

    dest = APP_DATA / f"cutlines_college_{args.year}.json"
    body = json.dumps(doc, ensure_ascii=False)

    print("=" * 66)
    print(f"  {args.year}학년도 전문대 전형결과 → 앱 JSON")
    print(f"  원본 행 {len(rows):,}  (confidence low 제외 {skipped_low:,} · 매핑 대상 아님 {skipped_unmapped:,})")
    print(f"  대학 {len(blocks)}개 · 블록 {sum(len(v) for v in blocks.values())}개 · {len(body)/1024:.0f}KB")
    by_app = defaultdict(int)
    for v in blocks.values():
        for t in v:
            by_app[t] += 1
    for t, n in sorted(by_app.items(), key=lambda x: -x[1]):
        print(f"    {t}: {n}개 대학")
    n_low = sum(1 for v in blocks.values() for b in v.values() if b.get("cutGradeLowest") is not None)
    print(f"  합격자 최저 등급이 있는 블록: {n_low}")
    if unknown:
        print(f"  ⚠ 마스터에 없는 univId {len(unknown)}개 제외: {unknown[:5]}")
    if not_college:
        print(f"  ⚠ 전문대가 아닌데 포함된 대학 {len(not_college)}개: "
              f"{[names.get(k, k) for k in not_college[:5]]}")
    print("=" * 66)

    if args.write:
        if dest.exists():
            shutil.copy(dest, dest.with_suffix(".json.bak"))
        dest.write_text(body, encoding="utf-8")
        print(f"  wrote {dest}")
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        report = OUT_DIR / f"export_college_{args.year}_report.md"
        lines = [
            f"# 전문대 {args.year}학년도 합격선 앱 내보내기",
            "", f"- 생성일: {date.today()}",
            f"- 원본 행: {len(rows):,} (low 제외 {skipped_low:,} · 매핑 대상 아님 {skipped_unmapped:,})",
            f"- 대학: {len(blocks)}개 · 블록: {sum(len(v) for v in blocks.values())}개",
            "", "## 앱 전형별 대학 수", "",
            "| 앱 전형 | 대학 수 |", "|---|---:|",
        ]
        for t, n in sorted(by_app.items(), key=lambda x: -x[1]):
            lines.append(f"| {t} | {n} |")
        lines += [
            "", "## 전형 매핑", "",
            "| 원천 | 앱 전형 | 비고 |", "|---|---|---|",
            "| 수시 일반전형 | 일반(서류) | 검정고시생 주 타깃 |",
            "| 정시 (일반·특별) | 수능위주 | 앱은 정시를 검정고시 평균과 직접 비교하지 않는다 |",
            "| 수시 특별전형 | (주 판정 제외) | byType['특별전형 평균'/'특별전형 최저']에 참고값으로만 |",
            "", "## 저작권", "",
            "전문대교협 자료는 공공누리가 아니며 무단 복제·배포가 금지돼 있다.",
            "학과 단위 원본(25만 행)은 앱에 싣지 않고 대학×전형 집계값만 내보냈다.",
            "상업적 이용 시 전문대교협 사전 협의가 필요하다 (입학지원실 02-3145-1221).",
        ]
        if unknown:
            lines += ["", f"## 마스터에 없어 제외한 univId {len(unknown)}개", "", ", ".join(unknown)]
        report.write_text("\n".join(lines), encoding="utf-8")
        print(f"  wrote {report}")
    else:
        print("  (dry-run — 파일을 쓰지 않았다)")


if __name__ == "__main__":
    main()
