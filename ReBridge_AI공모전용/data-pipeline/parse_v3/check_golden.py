"""정답 묶음 대조 — 추출기를 고칠 때마다 이걸 먼저 돌린다.

    python3 check_golden.py            # 기계 추출 결과(work/auto_out)와 대조
    python3 check_golden.py --db       # 정본 DB(offering 테이블)와 대조

왜 필요한가
  2026-09-20 밤, 추출기 기준을 넓혔더니 전체 검산 통과는 6배 늘었는데
  **원문 대조로 맞다고 확인한 값(강서대 2027 경영학과 16명)이 오히려 탈락**했다.
  고칠 때마다 어디가 깨지는지 모르면 계속 이런 일이 난다. 이 검사가 그 안전망이다.

규칙
  - `golden/offerings_golden.jsonl` 의 값은 **사람이 원문을 직접 본 값**이다.
    검사가 실패하면 고쳐야 하는 쪽은 언제나 추출기이지 정답 묶음이 아니다.
  - 정답을 새로 넣을 때는 반드시 쪽 번호와 근거 문장을 함께 적는다.
"""

import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
GOLD = HERE / "golden" / "offerings_golden.jsonl"


def load_gold():
    out = []
    for ln in GOLD.read_text(encoding="utf-8").splitlines():
        if not ln.strip():
            continue
        r = json.loads(ln)
        if r.get("_주석"):
            continue
        out.append(r)
    return out


def from_auto():
    from common import WORK
    rows = []
    base = WORK / "auto_out" / "PY-OFF"
    if not base.exists():
        return rows
    for f in base.glob("*/offerings.jsonl"):
        uid = f.parent.name
        for ln in f.read_text(encoding="utf-8").splitlines():
            if ln.strip():
                r = json.loads(ln)
                r["univId"] = uid
                rows.append(r)
    return rows


def from_db():
    from common import connect
    con = connect()
    return [{"univId": r[0], "academic_year": r[1], "phase": r[2], "admission_name_raw": r[3],
             "program_name_raw": r[4], "seats_planned": r[5]}
            for r in con.execute("""SELECT o.university_id, o.academic_year, o.phase, o.admission_name_raw,
                                    p.program_name_raw, o.seats_planned
                                    FROM offering o LEFT JOIN program p USING(program_id)""")]


def norm(s):
    """대조용 정규화. 원문에 붙는 각주 표시(*, ※)와 가운뎃점 모양 차이는 같은 이름으로 본다.
    (성균관대 요강의 모집단위는 '인문과학계열*' 처럼 별표가 붙어 있다)"""
    import re
    return re.sub(r"[\s*※·‧・]", "", s or "")


def prog_match(got, want):
    """모집단위 이름이 같은가. 원문은 '기독교학부(신학·기독교상담교육학)' 처럼 뒤에 전공 목록이
    붙는 일이 흔하므로, **정답 이름으로 시작하면** 같은 모집단위로 본다.
    ('경영학과' 가 '글로벌경영학과' 에 걸리지 않게 뒤가 아니라 앞을 본다)"""
    a, b = norm(got), norm(want)
    return bool(b) and (a == b or a.startswith(b))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", action="store_true", help="정본 DB 와 대조(기본은 기계 추출 결과)")
    a = ap.parse_args()
    rows = from_db() if a.db else from_auto()
    where = "정본 DB" if a.db else "기계 추출 결과(work/auto_out/PY-OFF)"
    gold = load_gold()
    print(f"정답 {len(gold)}건을 {where} {len(rows)}행과 대조합니다.\n")
    ok = 0
    for g in gold:
        cand = [r for r in rows
                if r.get("univId") == g["univId"]
                and (r.get("academic_year") in (None, g["academic_year"]))
                and prog_match(r.get("program_name_raw"), g["program_name_raw"])
                and norm(g["admission_contains"]) in norm(r.get("admission_name_raw"))]
        label = f"{g['univ']} {g['academic_year']} {g['program_name_raw']} · {g['admission_contains']}"
        if not cand:
            print(f"  없음  {label} → 기대 {g['seats_planned']}명. 이 값이 아예 안 나왔다")
            continue
        seats = {c.get("seats_planned") for c in cand}
        if g["seats_planned"] in seats:
            print(f"  맞음  {label} = {g['seats_planned']}명")
            ok += 1
        else:
            print(f"  다름  {label} → 기대 {g['seats_planned']}명, 나온 값 {sorted(x for x in seats if x is not None)}")
    print(f"\n{ok} / {len(gold)} 일치")
    raise SystemExit(0 if ok == len(gold) else 1)


if __name__ == "__main__":
    main()
