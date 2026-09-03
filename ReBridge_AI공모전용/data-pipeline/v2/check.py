"""데이터가 어디까지 채워졌는지 한 화면으로 본다. 읽기만 한다.

"환산표 없는 대학이 어디냐" 같은 질문에 스크립트를 새로 짜지 않고 답하기 위한 것.

실행:
  python3 v2/check.py            요약
  python3 v2/check.py --gaps     비어 있는 곳 목록
  python3 v2/check.py --sql "SELECT …"   임의 조회
"""

import argparse

import common as C


def bar(n, total, width=28):
    if not total:
        return ""
    f = int(round(width * n / total))
    return "█" * f + "·" * (width - f)


def year_coverage(con, total):
    """학년도별 대학 커버리지 — '351개 중 몇 개를 채웠나'를 항목마다 숫자로.

    2026-09-03 추가. "처리했다"가 아니라 **처리/미처리 수**로 말하기 위한 표다.
    비어 있는 칸은 0으로 찍는다. 안 보이면 안 한 것과 구분이 안 된다.
    """
    years = sorted({r["y"] for r in con.execute("""
        SELECT year y FROM cutline UNION
        SELECT year y FROM ged_conversion UNION
        SELECT year y FROM admission UNION
        SELECT year y FROM ged_eligibility_univ""") if r["y"]})
    if not years:
        return
    print()
    print(f"  ── 학년도 × 대학 커버리지 (전체 {total}개 대학 기준) ──")
    print(f"    {'학년도':<8}{'전형':>12}{'검정고시가부':>14}{'환산표':>12}{'합격선':>12}")
    Q = {
        "adm":  "SELECT COUNT(DISTINCT univ_id) c FROM admission "
                "WHERE year=? AND status='confirmed'",
        "ged":  "SELECT COUNT(DISTINCT univ_id) c FROM ged_eligibility_univ "
                "WHERE year=? AND verdict <> '판정불가'",
        "conv": "SELECT COUNT(DISTINCT univ_id) c FROM ged_conversion "
                "WHERE year=? AND table_json IS NOT NULL",
        "cut":  "SELECT COUNT(DISTINCT univ_id) c FROM cutline WHERE year=?",
    }
    for y in years:
        n = {k: con.execute(q, (y,)).fetchone()["c"] for k, q in Q.items()}
        print(f"    {y:<8}" + "".join(
            f"{n[k]:>7}/{total:<5}" for k in ("adm", "ged", "conv", "cut")))
        print(f"    {'':8}" + "".join(
            f"{'미처리 ' + str(total - n[k]):>12}" for k in ("adm", "ged", "conv", "cut")))
    # 판정불가는 '처리했지만 사람이 봐야 하는' 몫이라 따로 센다
    for r in con.execute("""SELECT year, COUNT(DISTINCT univ_id) c
                            FROM ged_eligibility_univ WHERE verdict='판정불가'
                            GROUP BY year"""):
        print(f"    ※ {r['year']}학년도 검정고시 가부 '판정불가'(사람 검토 대기): {r['c']}개 대학")


def summary(con):
    U = con.execute("SELECT COUNT(*) c FROM university").fetchone()["c"]
    print("═" * 68)
    print(f"  대학 마스터 {U}개 (4년제·전문대 합계)")
    print("═" * 68)

    rows = [
        ("전형 정보(실측)", "SELECT COUNT(DISTINCT univ_id) c FROM admission WHERE status='confirmed'"),
        # ⚠️ status='baseline'(KCUE 기본사항에서 온 일반론)을 빼야 한다.
        #    안 빼면 351/351 = 100% 로 보이는데, 실제 대학별 확인은 그만큼 안 돼 있다.
        ("검정고시 가부(대학별 실측)",
         """SELECT COUNT(DISTINCT a.univ_id) c FROM ged_eligibility g
            JOIN admission a ON a.admission_id=g.admission_id
            WHERE a.status='confirmed'"""),
        ("검정고시 가부(시행계획 규칙판정)",
         "SELECT COUNT(DISTINCT univ_id) c FROM ged_eligibility_univ "
         "WHERE verdict <> '판정불가'"),
        ("비교내신 원문", "SELECT COUNT(DISTINCT univ_id) c FROM ged_conversion WHERE raw_text IS NOT NULL"),
        ("비교내신 환산표(계산가능)", "SELECT COUNT(DISTINCT univ_id) c FROM ged_conversion WHERE table_json IS NOT NULL"),
        ("합격선", "SELECT COUNT(DISTINCT univ_id) c FROM cutline"),
        ("합격선(학과 단위)", "SELECT COUNT(DISTINCT univ_id) c FROM cutline WHERE program_id IS NOT NULL"),
    ]
    for label, q in rows:
        n = con.execute(q).fetchone()["c"]
        print(f"  {label:24} {n:>4}/{U}  {bar(n, U)}  {100*n/U:5.1f}%")

    print()
    both = con.execute("""
        SELECT COUNT(*) c FROM (
          SELECT DISTINCT c.univ_id FROM cutline c
          JOIN ged_conversion v ON v.univ_id = c.univ_id AND v.table_json IS NOT NULL)
    """).fetchone()["c"]
    print(f"  ★ 합격선 + 환산표 둘 다 = 실제 계산이 되는 대학: {both}개")
    print("     (v1 문서 기준값은 5개였다)")

    print()
    print("  ── 학년도별 ──")
    for r in con.execute("""SELECT year, COUNT(*) n, COUNT(DISTINCT univ_id) u,
                                   COUNT(DISTINCT program_id) p
                            FROM cutline GROUP BY year ORDER BY year"""):
        print(f"    합격선 {r['year']}학년도: {r['n']:>6,}행  대학 {r['u']:>3}  학과 {r['p']:>5}"
              f"  (내신 {C.grade_scale(r['year'])}등급)")
    for r in con.execute("""SELECT year, COUNT(*) n,
                                   SUM(table_json IS NOT NULL) t
                            FROM ged_conversion GROUP BY year ORDER BY year"""):
        print(f"    환산표 {r['year']}학년도: 원문 {r['n']:>3}  구조화 {r['t']:>3}")

    year_coverage(con, U)

    print()
    print("  ── 출처 ──")
    for r in con.execute("""SELECT kind, COUNT(*) n FROM source_file
                            GROUP BY kind ORDER BY n DESC"""):
        print(f"    {r['kind']:10} {r['n']:>4}건")
    orphan = con.execute("SELECT COUNT(*) c FROM cutline WHERE source_id IS NULL").fetchone()["c"]
    print(f"    출처 없는 합격선: {orphan}행  (0이어야 정상)")
    print("═" * 68)


def gaps(con):
    print("\n── 합격선은 있는데 환산표가 없는 대학 (환산표를 만들면 바로 계산됨) ──")
    q = """SELECT u.name, u.region, COUNT(*) n FROM cutline c
           JOIN university u ON u.univ_id=c.univ_id
           WHERE c.univ_id NOT IN (SELECT univ_id FROM ged_conversion WHERE table_json IS NOT NULL)
           GROUP BY u.univ_id ORDER BY n DESC LIMIT 25"""
    for r in con.execute(q):
        print(f"   {r['name']:24} {r['region']:4} 합격선 {r['n']:>5}행")

    print("\n── 전형 정보가 baseline(일반론)뿐인 대학 ──")
    q = """SELECT u.name, u.kind, u.region FROM university u
           WHERE NOT EXISTS (SELECT 1 FROM admission a
                             WHERE a.univ_id=u.univ_id AND a.status='confirmed')
           ORDER BY u.kind, u.name LIMIT 30"""
    rs = list(con.execute(q))
    for r in rs:
        print(f"   {r['name']:26} {r['kind'] or '':6} {r['region'] or ''}")
    total = con.execute("""SELECT COUNT(*) c FROM university u
        WHERE NOT EXISTS (SELECT 1 FROM admission a
                          WHERE a.univ_id=u.univ_id AND a.status='confirmed')""").fetchone()["c"]
    print(f"   … 총 {total}개")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--gaps", action="store_true")
    ap.add_argument("--sql")
    a = ap.parse_args()
    con = C.connect()
    if a.sql:
        for r in con.execute(a.sql):
            print(dict(r))
    else:
        summary(con)
        if a.gaps:
            gaps(con)
