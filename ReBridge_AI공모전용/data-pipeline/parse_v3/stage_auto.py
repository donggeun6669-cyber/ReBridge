"""기계 추출 결과를 병합 준비 영역으로 옮긴다.

    python3 stage_auto.py PY-OFF                 # 검산 통과분(confirmed)만
    python3 stage_auto.py PY-OFF --include-pending
    python3 stage_auto.py PY-OFF --dry           # 옮기지 않고 숫자만 본다

왜 필요한가
  추출기는 `work/auto_out/<ID>/` 에 쓰고, 병합기는 `work/agent_out/<ID>/` 를 읽는다.
  이 차이를 모르고 `merge_agent.py PY-OFF` 를 돌리면 **0건을 읽고 '성공'이라고 보고한다.**
  (2026-09-21 외부 교차점검이 지적한 항목이다.)

무엇을 하는가
  1. 준비 영역의 같은 ID 폴더를 **비운다.** 새 결과와 이전 결과를 한 묶음에 섞지 않는다.
  2. 대학마다 `offerings.jsonl` 을 걸러서 옮기고, **옮긴 줄 수를 원본과 대조한다.**
  3. 대학별·상태별 숫자를 표로 찍는다. 이 숫자가 병합기의 행 수 대조와 맞아야 한다.

기본이 confirmed 만인 이유
  `pending` 은 '기계가 이 값을 따로 확인하지 못했다'는 뜻이다. 정본에 넣을 수는 있지만,
  처음 넣을 때는 **검산을 통과한 것만** 넣고 나머지는 예외 큐와 함께 남겨 두는 편이 안전하다.
  넣으려면 `--include-pending` 을 명시한다(그 사실이 기록에 남는다).
"""

import argparse
import json
import shutil
from collections import Counter

from common import WORK, AGENT_DIR


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("agent", help="추출기 ID (예: PY-OFF)")
    ap.add_argument("--include-pending", action="store_true",
                    help="검산으로 확인하지 못한 값(pending)까지 옮긴다")
    ap.add_argument("--dry", action="store_true", help="옮기지 않고 숫자만 본다")
    a = ap.parse_args()

    src = WORK / "auto_out" / a.agent
    dst = AGENT_DIR / a.agent
    if not src.exists():
        raise SystemExit(f"기계 추출 결과가 없다: {src}")

    keep = {"confirmed"} if not a.include_pending else None
    rows_total = Counter()
    moved_total = 0
    per_univ = []

    for ud in sorted(p for p in src.iterdir() if p.is_dir()):
        f = ud / "offerings.jsonl"
        if not f.exists():
            continue
        lines = [l for l in f.read_text(encoding="utf-8").splitlines() if l.strip()]
        st = Counter()
        keepers = []
        for l in lines:
            try:
                r = json.loads(l)
            except json.JSONDecodeError:
                st["읽을 수 없는 줄"] += 1
                continue
            st[r.get("value_status") or "(없음)"] += 1
            if keep is None or r.get("value_status") in keep:
                keepers.append(l)
        rows_total.update(st)
        per_univ.append((ud.name, len(lines), len(keepers)))
        moved_total += len(keepers)
        if a.dry or not keepers:
            continue
        od = dst / ud.name
        od.mkdir(parents=True, exist_ok=True)
        tmp = od / ".offerings.jsonl.tmp"
        tmp.write_text("\n".join(keepers) + "\n", encoding="utf-8")
        tmp.replace(od / "offerings.jsonl")
        # 옮긴 줄 수가 맞는지 바로 확인한다
        back = len([x for x in (od / "offerings.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()])
        if back != len(keepers):
            raise SystemExit(f"옮기다 줄이 달라졌다: {ud.name} {len(keepers)} → {back}")

    if not a.dry:
        # 이전 결과가 남아 있지 않게, 이번에 안 쓴 대학 폴더는 지운다
        names = {u for u, _, k in per_univ if k}
        if dst.exists():
            for od in sorted(p for p in dst.iterdir() if p.is_dir()):
                if od.name not in names:
                    shutil.rmtree(od, ignore_errors=True)

    print(f"기계 추출 결과: {src}")
    print(f"병합 준비 영역: {dst}" + ("  (옮기지 않음 — --dry)" if a.dry else ""))
    print(f"거르는 기준: {'confirmed 만' if keep else 'confirmed + pending 전부'}\n")
    print("| 대학 | 추출된 줄 | 옮긴 줄 |")
    print("|---|---:|---:|")
    for u, n, k in per_univ[:15]:
        print(f"| {u} | {n} | {k} |")
    if len(per_univ) > 15:
        print(f"| …그 외 {len(per_univ) - 15}개 대학 | | |")
    print(f"\n대학 {len(per_univ)}곳 / 추출된 줄 {sum(n for _, n, _ in per_univ)} → **옮긴 줄 {moved_total}**")
    print("상태별:", dict(rows_total))
    print("\n다음: python3 merge_agent.py " + a.agent + "   (행 수 대조에서 위 '옮긴 줄' 과 맞아야 한다)")


if __name__ == "__main__":
    main()
