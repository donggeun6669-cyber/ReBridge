#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""L1(SQLite) `ged_freshmen` → 앱이 읽는 검정고시 신입생 통계 JSON.

## 이 스크립트가 지키는 것 (export_app.py / export_app_2027.py 와 같은 원칙)

**출처가 있는 숫자만 내보낸다.** `ged_freshmen` 테이블은 이미
`ingest_academyinfo_ged.py` → (캠퍼스 합산본 `ged_freshmen_by_univ.jsonl`) → DB 적재를
거친 정제 데이터라 여기서는 새로 걸러낼 값 오류는 거의 없다. 대신 이 스크립트가
직접 확인하는 것은 **앱 쪽 키(`universities.json`)와의 일치**다 — 대학알리미 쪽
univId가 하나라도 앱 마스터에 없는 채로 나가면 앱이 그 대학을 못 찾는다.

떨어진(=매칭 안 되는) 대학은 지우지 않고 `out/academyinfo/export_ged_freshmen_report.md`
에 이름·연도와 함께 남긴다. 실행 시점 실측(2026-09-04): 206개 univId 전부가
`universities.json`과 일치해 제외된 대학은 0개였다. 그래도 이 스크립트는 매번
다시 검사한다 — 마스터가 나중에 바뀌면 다시 어긋날 수 있다(지어내지 않는다, 규칙 3).

## trend 판정 기준

대학별로 자료가 있는 연도 중 **가장 이른 연도**와 **가장 늦은 연도**의 ratio(%)를 비교한다.
  - 두 연도 다 있고 이른 연도 ratio > 0   → 상대변화율 = (늦은-이른)/이른 * 100
      +20%p 이상  → "증가" / -20%p 이하 → "감소" / 그 사이 → "비슷"
  - 이른 연도 ratio == 0                 → 늦은 연도 ratio > 0 이면 "증가", 아니면 "비슷"
  - 자료가 있는 연도가 1개 이하           → "자료부족"
±20%는 임의 기준이다(원본에 트렌드 판정 기준이 없다). 근거는 이 리포트에 남긴다.

## 전국 집계

meta.national.byYear 는 연도별로 **이 파일에 실제로 실린 대학들**의 ged_count/total_count를
그대로 합산한 값이다(추정 보정 없음). 2026-09-04 기준 제외 대학이 0개라 사실상 대학알리미
4년제 공시 전체(206개 대학, 대학알리미 4년제 마스터 기준 매칭 성공분)의 합계와 같다.
매칭 실패로 애초에 `ged_freshmen` 테이블에 들어오지 못한 대학(연도별 18~19개, 주로 4년제
마스터와 대학알리미 표기 불일치)은 여기 합계에도 없다 — 그만큼 실제보다 과소집계될 수 있다는
뜻이며, 그 목록은 `out/academyinfo/ged_freshmen_report.md`(ingest_academyinfo_ged.py 산출)에
이미 있다.

## 라이선스 확인 (2026-09-04)

대학알리미 공식 공공데이터이용정책(https://www.academyinfo.go.kr/footer/footer1560/footer.do,
모바일 미러 https://m.academyinfo.go.kr/footer/footer1560/footer.do 에서 실측 확인):

  "① 대학알리미에서 제공하는 공공데이터는 공공데이터법에 따라 누구나 이용가능하고,
     영리목적의 이용을 포함한 자유로운 활용이 보장됩니다. (공공데이터법 제1조, 제3조)"

이 문구는 "공공누리 제1유형(출처표시)"과 실질적으로 같은 수준(출처표시 조건의 자유
이용·상업적 이용 허용)이지만, 페이지에 "공공누리" 마크나 유형 번호가 이 데이터셋에
명시적으로 붙어 있지는 않았다. 그래서 license 필드에는 공공누리 유형을 단정하지 않고
위 확인 사실을 그대로 적는다(지어내지 않는다, 규칙 3). 원본 XLSX 3개는
`Application_main_codes/src/data/pdf_sources/academyinfo/manifest.csv`에 다운로드 URL·
받은 날짜(2026-09-03)·이 정책 링크가 이미 기록돼 있다.

## meta.publisher 관련 수정

작업 지시서 초안은 publisher를 "한국교육개발원"으로 제안했으나, 대학알리미 사이트 footer의
실제 저작권 표시는 "Copyright@한국대학교육협의회 대학정보공시센터"였다(한국교육개발원=KEDI가
아니라 한국대학교육협의회=KCUE가 운영기관). 확인된 사실로 바꿔 적었다.

실행:
  python3 v2/export_ged_freshmen.py --dry-run    # 무엇이 나오는지만 본다
  python3 v2/export_ged_freshmen.py --write       # ged_freshmen.json 갱신
"""

import argparse
import shutil
from datetime import date

import common as C

YEARS = (2024, 2025, 2026)

SOURCE_LABEL = "대학알리미(academyinfo.go.kr) 신입생의 출신고교유형별 현황 — 4년제 대학"
PUBLISHER = "한국대학교육협의회 대학정보공시센터(대학알리미 운영기관)"
SOURCE_URL = "https://www.academyinfo.go.kr"
RETRIEVED_AT = "2026-09-03"  # manifest.csv 실측값(원본 XLSX 3개 다운로드 날짜)
LICENSE_TEXT = (
    "대학알리미 공공데이터이용정책(https://www.academyinfo.go.kr/footer/footer1560/footer.do, "
    "2026-09-04 확인) 원문: \"대학알리미에서 제공하는 공공데이터는 공공데이터법에 따라 "
    "누구나 이용가능하고, 영리목적의 이용을 포함한 자유로운 활용이 보장됩니다"
    "(공공데이터법 제1조, 제3조).\" 공공누리 유형 번호·마크는 이 데이터셋 페이지에 "
    "별도로 명시돼 있지 않아 특정 유형(예: 제1유형)으로 단정하지 않는다 — "
    "실질은 출처표시 조건의 자유이용·상업적 이용 허용에 해당한다."
)
TREND_METHOD = (
    "자료가 있는 연도 중 가장 이른 연도와 가장 늦은 연도의 ratio(%)를 비교. "
    "이른 연도 ratio>0이면 상대변화율=(늦은-이른)/이른*100 을 계산해 "
    "+20%p 이상=증가, -20%p 이하=감소, 그 사이=비슷. 이른 연도 ratio==0이면 "
    "늦은 연도>0일 때만 증가, 아니면 비슷. 자료 연도가 1개 이하면 자료부족. "
    "(원본에 트렌드 판정 기준이 없어 이 스크립트가 정한 임의 기준 — export_ged_freshmen.py 참고)"
)
NOTE_TEXT = (
    "검정고시 출신 신입생 수·비율. 최상위 meta 키는 대학이 아니다 — 순회 시 건너뛸 것. "
    "캠퍼스별 원본 행(제2캠퍼스 등)은 univId 기준으로 이미 합산되어 있다 — 합산 이전 "
    "캠퍼스별 원본은 data-pipeline/v2/out/academyinfo/ged_freshmen.jsonl 에 별도로 있다."
)


def load_records(con):
    """ged_freshmen 전체를 univ_id별로 묶는다."""
    q = """
      SELECT g.univ_id, g.year, g.ged_count, g.total_count, g.ratio, g.source_file,
             u.name AS univ_name
      FROM ged_freshmen g
      JOIN university u ON u.univ_id = g.univ_id
      ORDER BY u.name, g.year
    """
    by_univ = {}
    for r in con.execute(q):
        d = by_univ.setdefault(r["univ_id"], {
            "univId": r["univ_id"], "univName": r["univ_name"],
            "byYear": {}, "files": set(),
        })
        d["byYear"][r["year"]] = {
            "ged": r["ged_count"], "total": r["total_count"], "ratio": r["ratio"],
        }
        if r["source_file"]:
            d["files"].add(r["source_file"])
    return by_univ


def classify_trend(by_year):
    """{연도(int): {...ratio...}} → '증가'|'감소'|'비슷'|'자료부족'"""
    years_with_ratio = sorted(
        y for y, v in by_year.items() if v.get("ratio") is not None)
    if len(years_with_ratio) < 2:
        return "자료부족"
    y0, y1 = years_with_ratio[0], years_with_ratio[-1]
    r0, r1 = by_year[y0]["ratio"], by_year[y1]["ratio"]
    if r0 == 0:
        return "증가" if r1 > 0 else "비슷"
    change = (r1 - r0) / r0 * 100
    if change >= 20:
        return "증가"
    if change <= -20:
        return "감소"
    return "비슷"


def build_entry(rec):
    by_year = rec["byYear"]
    latest_year = max(by_year)
    latest = by_year[latest_year]
    return {
        "byYear": {str(y): by_year[y] for y in sorted(by_year)},
        "latest": {"year": latest_year, "ged": latest["ged"],
                   "total": latest["total"], "ratio": latest["ratio"]},
        "trend": classify_trend(by_year),
        "src": {"files": sorted(rec["files"])},
    }


def national_totals(entries_by_univ):
    """meta.national.byYear — 이 파일에 실제로 실린 대학들의 연도별 합계."""
    out = {}
    for y in YEARS:
        ged = total = 0
        n = 0
        for rec in entries_by_univ.values():
            row = rec["byYear"].get(str(y))
            if not row:
                continue
            ged += row["ged"] or 0
            total += row["total"] or 0
            n += 1
        out[str(y)] = {
            "ged": ged, "total": total,
            "ratio": round(ged / total * 100, 2) if total else None,
            "univs": n,
        }
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="앱 JSON을 실제로 쓴다")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    con = C.connect()
    by_univ = load_records(con)

    app_univs = C.load_universities()
    app_ids = {u["univId"] for u in app_univs}

    included, excluded = {}, []
    for uid, rec in by_univ.items():
        if uid not in app_ids:
            excluded.append(rec)
            continue
        included[uid] = build_entry(rec)

    out = {
        "meta": {
            "years": list(YEARS),
            "source": SOURCE_LABEL,
            "publisher": PUBLISHER,
            "sourceUrl": SOURCE_URL,
            "retrievedAt": RETRIEVED_AT,
            "note": NOTE_TEXT,
            "license": LICENSE_TEXT,
            "trendMethod": TREND_METHOD,
            "national": {"byYear": national_totals(included)},
        }
    }
    for uid, entry in included.items():
        out[uid] = entry

    out_path = C.APP_DATA / "ged_freshmen.json"
    report_dir = C.OUT / "academyinfo"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / "export_ged_freshmen_report.md"

    # ── 연도별 처리 통계 ──────────────────────────────────────────
    year_stats = {}
    for y in YEARS:
        n = sum(1 for rec in by_univ.values() if y in rec["byYear"])
        year_stats[y] = n

    trend_counts = {}
    for entry in included.values():
        trend_counts[entry["trend"]] = trend_counts.get(entry["trend"], 0) + 1

    # ── 리포트 ────────────────────────────────────────────────────
    L = ["# 대학알리미 검정고시 신입생 통계 앱 반영 리포트", "",
         f"- 생성: {date.today().isoformat()}",
         f"- L1(`ged_freshmen`) 대상 대학: **{len(by_univ)}개**",
         f"- `universities.json`과 univId 일치(내보냄): **{len(included)}개**",
         f"- univId 불일치로 제외: **{len(excluded)}개**", "",
         "## 처리 수 / 대상 수 / 제외 수", "",
         "| 항목 | 수 |", "|---|---:|",
         f"| L1 대상 대학(연도 무관 전체) | {len(by_univ)} |",
         f"| 앱 JSON에 실제로 실린 대학 | {len(included)} |",
         f"| univId 불일치로 제외 | {len(excluded)} |", "",
         "| 연도 | 자료 있는 대학 수 |", "|---|---:|"]
    for y in YEARS:
        L.append(f"| {y} | {year_stats[y]} |")
    L += ["", "## trend 판정 결과 분포", "",
          "| trend | 대학 수 |", "|---|---:|"]
    for k in ("증가", "감소", "비슷", "자료부족"):
        L.append(f"| {k} | {trend_counts.get(k, 0)} |")
    L += ["", "판정 기준: " + TREND_METHOD, ""]

    L += ["## 전국 집계 (meta.national.byYear)", "",
          "| 연도 | 검정고시 신입생 합계 | 전체 신입생 합계 | 비율(%) | 집계 대학 수 |",
          "|---|---:|---:|---:|---:|"]
    nat = national_totals(included)
    for y in YEARS:
        row = nat[str(y)]
        L.append(f"| {y} | {row['ged']} | {row['total']} | "
                 f"{row['ratio'] if row['ratio'] is not None else '-'} | {row['univs']} |")
    L += ["", "이 합계는 **이 파일에 실린 대학만** 더한 값이다. univId 매칭에 실패해 애초에 "
          "L1(`ged_freshmen`)에 들어오지 못한 대학(연도별 18~19개, "
          "`out/academyinfo/ged_freshmen_report.md` 참고)은 포함하지 않는다.", ""]

    if excluded:
        L += [f"## univId 불일치로 제외된 대학 ({len(excluded)}개)", "",
              "`ged_freshmen` 테이블에는 있지만 `universities.json`의 univId 목록에는 "
              "없는 대학이다. 지우지 않고 여기 남긴다. universities.json이 갱신되면 "
              "이 스크립트를 다시 돌려 확인해야 한다.", "",
              "| univId | 대학명(L1) | 자료 연도 |", "|---|---|---|"]
        for rec in sorted(excluded, key=lambda r: r["univName"]):
            yrs = ", ".join(str(y) for y in sorted(rec["byYear"]))
            L.append(f"| {rec['univId']} | {rec['univName']} | {yrs} |")
        L.append("")
    else:
        L += ["## univId 불일치로 제외된 대학", "", "- 없음(206개 전부 일치)", ""]

    L += ["## 구조 설명 — 앱 담당자용", "",
          "```", "{", '  "meta": { ... 아래 표 ... },',
          '  "<univId>": { "byYear": {...}, "latest": {...}, "trend": "...", "src": {...} }',
          "}", "```", "",
          "| 키 | 뜻 | 주의 |", "|---|---|---|",
          "| `meta` | 최상위. 대학이 아니다 | **대학을 순회할 때 반드시 건너뛴다** "
          "(`cutlines_2026.json`, `comparative_2027.json`과 같은 함정) |",
          "| `meta.years` | 데이터가 있는 연도 목록 | 현재 [2024, 2025, 2026] |",
          "| `meta.national.byYear.<year>` | 그 해 전국 합계(이 파일에 실린 대학만) | "
          "`ged`/`total`/`ratio`/`univs`(집계 대학 수) |",
          "| `meta.license` | 출처 이용조건 확인 결과 | 지어낸 값 아님. 원문 문구 그대로 "
          "인용 — export_ged_freshmen.py 상단 주석 참고 |",
          "| `meta.trendMethod` | trend 판정 기준 원문 | |",
          "| `<univId>.byYear.<year>.ged` | 그 해 그 대학의 검정고시 출신 신입생 수 | "
          "캠퍼스 합산본(제2캠퍼스 등 포함) |",
          "| `<univId>.byYear.<year>.total` | 그 해 총 신입생 수 | |",
          "| `<univId>.byYear.<year>.ratio` | 검정고시 비율(%) | 원본(대학알리미) 값 "
          "그대로, 재계산하지 않음 |",
          "| `<univId>.latest` | byYear 중 가장 최신 연도 한 벌 | 대학마다 자료가 있는 "
          "최신 연도가 다를 수 있다(전부 2026은 아님) — `latest.year`를 반드시 확인할 것 |",
          "| `<univId>.trend` | `증가`/`감소`/`비슷`/`자료부족` | 판정 기준은 "
          "`meta.trendMethod` |",
          "| `<univId>.src.files` | 이 대학 수치의 출처 XLSX 파일명 목록 | "
          "`academyinfo/4자_출신고교유형_{year}.xlsx` |", ""]

    report_path.write_text("\n".join(L) + "\n", encoding="utf-8")

    print("═" * 62)
    print(f"  L1(ged_freshmen) 대상 대학   {len(by_univ):>4}개")
    print(f"  앱 JSON에 실림(내보냄)        {len(included):>4}개")
    print(f"  univId 불일치 제외            {len(excluded):>4}개")
    for y in YEARS:
        print(f"    {y}년 자료 있는 대학      {year_stats[y]:>4}개")
    print(f"  리포트 → {report_path}")
    print("═" * 62)

    if not a.write or a.dry_run:
        print("  (실제로 쓰려면 --write)")
        return

    if out_path.exists():
        backup = out_path.with_suffix(".json.bak")
        shutil.copy2(out_path, backup)
        print(f"  백업 → {backup.name}")

    size = C.jdump(out, out_path)
    print(f"  갱신 → {out_path}  ({size:,} bytes)")

    con.execute(
        "INSERT INTO ingest_log (ran_at,script,target,rows_in,rows_out,note) "
        "VALUES (?,?,?,?,?,?)",
        (date.today().isoformat(), "export_ged_freshmen.py", "ged_freshmen.json",
         len(by_univ), len(included),
         f"univId 불일치 제외 {len(excluded)}"))
    con.commit()


if __name__ == "__main__":
    main()
