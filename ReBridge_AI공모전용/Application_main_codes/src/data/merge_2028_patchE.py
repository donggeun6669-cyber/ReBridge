"""Merge admissions_2028_patch_E.json into the 2028 dataset (replace strategy).

- admissions_2028.json : 기존 cnu 행 전부 제거 → patch_E 행으로 교체 (_patch='E' 태그)
- comparative_2028.json : cnu 비교내신 정보를 numeric_table 타입으로 교정

기존 patch_D(additive)와 달리 이번은 cnu 기존 행을 완전히 교체합니다.
--write 없으면 dry-run (diff만 출력).
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="실제 파일에 기록 (없으면 dry-run)")
    args = ap.parse_args()

    adm = load(ROOT / "admissions_2028.json")
    comp = load(ROOT / "comparative_2028.json")
    patch = load(ROOT / "admissions_2028_patch_E.json")

    # ── admissions 교체 ──────────────────────────────────────────
    before_cnu = [r for r in adm if r.get("univId") == "cnu"]
    before_other = [r for r in adm if r.get("univId") != "cnu"]

    patched = [dict(r, _patch="E") for r in patch]

    adm_new = before_other + patched

    # ── comparative 교정 ──────────────────────────────────────────
    # 실제 비교내신 환산표 (p.31) — numeric_table로 덮어씀
    comp_new = dict(comp)
    comp_new["cnu"] = {
        "comparativeGrade": (
            "검정고시 취득성적 환산: 100점→80 / 95~99점→70 / 90~94점→60 / "
            "80~89점→45 / 70~79점→25 / 70점미만→0 "
            "(국어·수학·영어 각 3단위, 나머지 과목 1단위)"
        ),
        "comparativeGradeType": "numeric_table",
        "source": "2028 충남대 시행계획 p.31",
    }

    # ── 리포트 ───────────────────────────────────────────────────
    print("=== patch_E 적용 결과 ===")
    print(f"admissions 기존 cnu 행 수  : {len(before_cnu)}")
    print(f"admissions patch_E 행 수   : {len(patched)}")
    print(f"admissions 전체 before     : {len(adm)}")
    print(f"admissions 전체 after      : {len(adm_new)}")
    print()
    print("삭제된 전형 (기존에만 있던 것):")
    before_names = {r.get("admissionName") for r in before_cnu}
    after_names = {r.get("admissionName") for r in patched}
    for name in sorted(before_names - after_names):
        print(f"  - {name}")
    print()
    print("추가된 전형 (patch_E에 새로운 것):")
    for name in sorted(after_names - before_names):
        print(f"  + {name}")
    print()
    print("교정된 전형 (양쪽에 있는 것):")
    for name in sorted(before_names & after_names):
        print(f"  ~ {name}")
    print()

    # gedEligible 분포
    ged_dist = {}
    for r in patched:
        k = r.get("gedEligible", "?")
        ged_dist[k] = ged_dist.get(k, 0) + 1
    print("gedEligible 분포 (patch_E):", ged_dist)
    print()

    # phase/admissionType 분포
    phase_dist = {}
    for r in patched:
        k = f"{r.get('phase')}/{r.get('admissionType')}"
        phase_dist[k] = phase_dist.get(k, 0) + 1
    print("phase/admissionType 분포:")
    for k, v in sorted(phase_dist.items()):
        print(f"  {k}: {v}개")
    print()

    # 무결성 체크
    no_ged = [r.get("admissionName") for r in patched if not r.get("gedEligible")]
    if no_ged:
        print(f"[경고] gedEligible 비어있는 행: {no_ged}")
    else:
        print("[OK] gedEligible 빈 값 없음")

    if args.write:
        (ROOT / "admissions_2028.json").write_text(
            json.dumps(adm_new, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        (ROOT / "comparative_2028.json").write_text(
            json.dumps(comp_new, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print("\nWROTE admissions_2028.json + comparative_2028.json")
    else:
        print("\nDRY-RUN (파일 미수정). --write 옵션으로 재실행하면 반영됩니다.")


if __name__ == "__main__":
    main()
