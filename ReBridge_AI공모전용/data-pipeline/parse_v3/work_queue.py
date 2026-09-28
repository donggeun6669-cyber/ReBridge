"""전체 확대용 작업 대기열 — 어느 대학이 끝났고 다음에 무엇을 할지.

    python3 work_queue.py status                 # 전체 진행 요약
    python3 work_queue.py next <개수> [--exclude a,b]   # 다음에 맡길 대학 목록(문서 많은 순 아님, 번호순)
    python3 work_queue.py detail <univId>        # 그 대학의 문서·추출 현황

    python3 work_queue.py coverage [univId]       # 대학별 자료 7종 × 학년도 커버리지 표

‘끝난 대학(done)’ 기준 — 2026-09-20 강화. 예전 기준(해당 학년도에 offering 이 한 행이라도 있으면 완료)은
전형 합계만 뽑은 대학도 완료로 셌다. 지금 기준은 **보유 문서로 필요한 학년도마다** 아래를 모두 만족할 때다.

  1) 모집전형이 **모집단위(학과)별로** 분해돼 있을 것 — 전형 합계만 있으면 ‘학과미분해’
  2) 지원자격 · 평가방법 · 일정 · 제출서류가 각각 한 건 이상 있을 것
  3) 환산규칙 · 수능최저는 있거나, **원문에 없다는 기록**(value_status=not_found/not_applicable,
     또는 수능최저 minimum_exists='no')이 있을 것 — 그냥 비어 있으면 ‘미확인’이지 ‘없음’이 아니다

자료가 비어 있는 것과 원문에 없는 것을 구분하지 않으면 완성도를 부풀리게 된다. (입시결과는 표 파서가 따로 처리한다)
"""

import sys
from collections import Counter

from common import connect, rawlib


def state(con):
    t = {u["univId"]: u for u in rawlib.targets()}
    docs = {}
    for r in con.execute("""SELECT f.university_id uid, d.document_type dt, count(DISTINCT f.document_id) n
                            FROM document_file f JOIN document d USING(document_id)
                            WHERE f.is_original_format_archive=0 GROUP BY 1,2"""):
        docs.setdefault(r["uid"], {})[r["dt"]] = r["n"]
    merged = {r[0]: r[1] for r in con.execute("SELECT university_id, count(*) FROM merge_log GROUP BY 1")}
    rules = {r[0]: r[1] for r in con.execute("""SELECT university_id, count(*) FROM (
                SELECT university_id FROM offering UNION ALL SELECT university_id FROM eligibility_rule) GROUP BY 1""")}
    cov = coverage_map(con)
    out = []
    for uid, u in sorted(t.items(), key=lambda x: x[1]["no"]):
        d = docs.get(uid, {})
        need = []
        if d.get("모집요강"):
            need.append(2027)
        if d.get("시행계획"):
            need.append(2028)
        c = cov.get(uid, {})
        have = sorted(c)
        missing = []           # 학년도별로 무엇이 모자란지
        for y in need:
            cy = c.get(y)
            if not cy:
                missing.append(f"{y}:자료없음")
                continue
            lack = [k for k in ("학과별모집전형", "지원자격", "평가방법", "일정", "제출서류") if not cy[k]]
            lack += [k for k in ("환산규칙", "수능최저") if not cy[k] and not cy[k + "_없음기록"]]
            if cy["모집전형"] and not cy["학과별모집전형"]:
                lack = ["학과미분해"] + [x for x in lack if x != "학과별모집전형"]
            if lack:
                missing.append(f"{y}:" + "·".join(lack))
        done = bool(need) and not missing
        status = "done" if done else ("partial" if merged.get(uid) else ("no_doc" if not need else "todo"))
        out.append({"no": u["no"], "univId": uid, "name": u["name"], "kind": u["kind"],
                    "요강": d.get("모집요강", 0), "시행계획": d.get("시행계획", 0), "결과": d.get("입시결과", 0),
                    "merged": merged.get(uid, 0), "rules": rules.get(uid, 0), "years": have,
                    "부족": "; ".join(missing), "status": status})
    return out


KINDS = [("모집전형", "offering", None), ("지원자격", "eligibility_rule", None), ("평가방법", "evaluation_component", None),
         ("환산규칙", "conversion_rule", None), ("수능최저", "csat_minimum", None),
         ("일정", "schedule_event", None), ("제출서류", "document_requirement", None)]


def coverage_map(con):
    """대학 → 학년도 → 자료 종류별 건수/유무. ‘없다는 기록’과 ‘비어 있음’을 구분한다."""
    cov = {}

    def cell(uid, y):
        return cov.setdefault(uid, {}).setdefault(y, {k: 0 for k, _, _ in KINDS} | {
            "학과별모집전형": 0, "환산규칙_없음기록": 0, "수능최저_없음기록": 0})

    for name, tbl, _ in KINDS:
        for r in con.execute(f"SELECT university_id, academic_year, count(*) FROM {tbl} GROUP BY 1,2"):
            if r[1]:
                cell(r[0], r[1])[name] = r[2]
    for r in con.execute("SELECT university_id, academic_year, count(*) FROM offering WHERE program_id IS NOT NULL GROUP BY 1,2"):
        if r[1]:
            cell(r[0], r[1])["학과별모집전형"] = r[2]
    # 원문에 없다는 기록(비어 있는 것과 다르다)
    for r in con.execute("""SELECT university_id, academic_year, count(*) FROM conversion_rule
                            WHERE value_status IN ('not_found','not_applicable','not_published') GROUP BY 1,2"""):
        if r[1]:
            cell(r[0], r[1])["환산규칙_없음기록"] = r[2]
    for r in con.execute("""SELECT university_id, academic_year, count(*) FROM csat_minimum
                            WHERE minimum_exists='no' OR value_status IN ('not_found','not_applicable','not_published') GROUP BY 1,2"""):
        if r[1]:
            cell(r[0], r[1])["수능최저_없음기록"] = r[2]
    return cov


def main():
    con = connect()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    rows = state(con)
    if cmd == "status":
        c = Counter(r["status"] for r in rows)
        print("대상 대학", len(rows), dict(c))
        print("규칙 레코드(모집전형+자격)", sum(r["rules"] for r in rows))
        for r in rows:
            if r["status"] == "partial":
                print(f"  진행중: {r['name']} ({r['univId']}) 연도 {r['years']} 레코드 {r['rules']} — 부족: {r['부족'] or '없음'}")
    elif cmd == "coverage":
        cov = coverage_map(con)
        sel = sys.argv[2] if len(sys.argv) > 2 else None
        cols = [k for k, _, _ in KINDS]
        print("| 대학 | 학년도 | " + " | ".join(cols) + " | 학과별 | 부족 |")
        print("|---|---|" + "---|" * (len(cols) + 2))
        for r in rows:
            if r["status"] in ("todo", "no_doc") or (sel and r["univId"] != sel):
                continue
            for y in sorted(cov.get(r["univId"], {})):
                cy = cov[r["univId"]][y]
                cells = []
                for k in cols:
                    v = cy[k]
                    if v:
                        cells.append(str(v))
                    elif k in ("환산규칙", "수능최저") and cy[k + "_없음기록"]:
                        cells.append("없음(기록)")
                    else:
                        cells.append("—")
                pg = cy["학과별모집전형"]
                print(f"| {r['name']} | {y} | " + " | ".join(cells) +
                      f" | {pg if pg else '—'} | {r['부족'] or ''} |")
        print("\n— = 자료가 비어 있다(원문에 없다는 뜻이 아니다).  '없음(기록)' = 원문에 없다고 기록됨.")
    elif cmd == "next":
        n = int(sys.argv[2])
        ex = set(sys.argv[sys.argv.index("--exclude") + 1].split(",")) if "--exclude" in sys.argv else set()
        todo = [r for r in rows if r["status"] in ("todo", "partial") and r["univId"] not in ex]
        for r in todo[:n]:
            print(f"{r['univId']}\t{r['name']}\t{r['kind']}\t요강{r['요강']}/시행계획{r['시행계획']}\t{r['status']}")
    elif cmd == "detail":
        uid = sys.argv[2]
        r = next(x for x in rows if x["univId"] == uid)
        print(r)
        for q, label in [("SELECT document_id, document_type, admission_scope, page_count, text_layer FROM document d JOIN document_file f USING(document_id) WHERE f.university_id=? AND f.is_original_format_archive=0", "문서"),
                         ("SELECT count(*) FROM offering WHERE university_id=?", "모집전형"),
                         ("SELECT count(*) FROM eligibility_rule WHERE university_id=?", "자격"),
                         ("SELECT count(*) FROM conversion_rule WHERE university_id=?", "환산"),
                         ("SELECT count(*) FROM csat_minimum WHERE university_id=?", "수능최저"),
                         ("SELECT count(*) FROM outcome WHERE university_id=?", "입시결과 값")]:
            print(label, [tuple(x) for x in con.execute(q, (uid,))][:20])


if __name__ == "__main__":
    main()
