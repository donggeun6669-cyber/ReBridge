"""전문대학(2~3년제) 「전년도 입시결과」 → L1 cutline 적재.

## 원본
  Application_main_codes/src/data/pdf_sources/college/results/
    전년도입시결과_{2016..2026}학년도_전문대학포털.xls   (프로칼리지 연도 단위 일괄 엑셀)

조사 경위와 항목별 확인 결과는 같은 폴더의 `조사보고.md` 참고(조사일 2026-09-03).
그 문서는 "xlrd 미설치라 파싱 미수행"이라 적었으나, 이 환경엔 xlrd 2.0.2가 이미 있어
실제로 열린다(구형 XLS/CDFV2 포맷, xlrd 2.x는 .xls만 지원 — 정확히 이 포맷).

## 파일 구조 (11개 연도 전수 확인, 동일)
행 0~1이 2단 헤더, 데이터는 행 2부터.
  0 지역 / 1 대학명 / 2 모집시기(수시1차·수시2차·정시모집) / 3 학과명 / 4 입학정원(학과 전체,
    이 행의 모집인원이 아니다 — 같은 학과가 모집시기마다 반복되며 값이 동일하다) /
  5 주·야 / 6 전형구분(일반전형·특별전형) / 7 전형명칭(일반전형·특성화고·일반고·대학자체·고른기회 등) /
  8 점수산출기준-수능(등급|백분위, 종종 빈칸) / 9 점수산출기준-학생부(전 연도 전부 빈칸 실측) /
  10 경쟁률 /
  11~13 합격자평균(수능, 학생부, 교과외) / 14~16 합격자최저(수능, 학생부, 교과외)

## cutline 매핑 — 규칙 3(추정하지 않는다)을 지키기 위한 설계
프로칼리지 결과 파일에는 4년제 어디가 CSV의 '50%컷/70%컷' 같은 백분위 컷 구분이 없고
'합격자평균'과 '합격자최저' 두 값만 있다. 그래서 cut_type은 '평균'|'최저' 두 가지만 쓴다.
한 원본 행에서 학생부(교과내신)·수능·교과외 세 축 중 값이 있는 축마다 별도 cutline 행을
만든다(한 행에 최대 6개: 평균/최저 × 학생부/수능/교과외). 축마다 단위가 다르므로 섞지 않는다.
  - 학생부 축  → cut_grade (9등급제 내신 등급 평균/최저값 그대로)
  - 수능 축    → 점수산출기준이 '등급'이면 cut_grade, '백분위'면 pct_avg. 기준 표기가
                없는데 값만 있는 경우(연도별로 있음)는 단위를 알 수 없으므로 cut_score에
                원문 숫자만 넣고 confidence='low' + note에 "단위 미상"이라 남긴다.
  - 교과외 축  → 단위가 원문에 아예 없다. cut_score에 원문 숫자, confidence='low',
                note="교과외(비교과 등 원문 미상 산출) 값. 단위 불명"
recruit_count는 채우지 않는다(원본 '입학정원'은 학과 전체 정원이지 이 모집시기의 모집인원이
아니다 — 채우면 수시1차+수시2차+정시 세 번 중복 계상된다). capacity·주야 구분은 note에 남긴다.
fill_rate(충원율)는 원본에 없어 NULL.

## 대학 매칭
2025·2026학년도는 138개 전문대학 마스터와 100% 정확히 이름이 일치했다(사전 확인 완료).
그 이전 연도는 폐교·개명·통합된 학교가 섞여 있어(예: 동주대학교, 서라벌대학교, 고구려대학교
— 모두 현재 마스터에 없음) UnivMatcher로도 못 붙는 이름이 남는다. 지어내지 않고
매칭 실패로 남겨 skipped_names에 기록한다.

## 라이선스 (2026-09-04, schema.sql에 source_file.license 컬럼 추가)
전문대교협/프로칼리지 자료는 공공누리가 아니다. 저작권법 보호 저작물이고 무단 복제·배포
금지, 상업적 이용 시 사전 협의·허락 및 출처 명시가 필요하다(조사보고.md 5절, procollege.kr
저작권정책). 이 스크립트가 만드는 모든 source_file 행에 license를 채운다.

## 실행
  python3 v2/ingest_college_results.py                 # 파싱 통계만 (아무것도 쓰지 않음)
  python3 v2/ingest_college_results.py --to-db          # 실제 적재
"""

import argparse
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import pandas as pd

import common as C

RESULTS_DIR = C.PDF_ROOT / "college" / "results"
YEARS = list(range(2016, 2027))
PUBLISHER = "한국전문대학교육협의회(전문대교협)/프로칼리지(procollege.kr)"
LICENSE_TEXT = (
    "공공누리 아님. 전문대학포털(procollege.kr) 저작물 — 저작권법에 의해 보호되며 "
    "원칙적으로 한국전문대학교육협의회에 저작권이 있다. 무단 복제·배포 금지(저작권법 "
    "제136조 저작재산권 침해죄 해당 명시). 상업적 이용은 사전 협의·허락 필요하며 허락 시에도 "
    "출처(전문대교협)를 반드시 명시해야 한다. 문의: 전문대교협 입학지원실 "
    "02-3145-1221~1224, kccemaster@kcce.or.kr (조사보고.md 5절, 2026-09-03 조사)"
)
SURVEY_NOTE = "조사보고.md(2026-09-03) 5절 확인 — procollege.kr 「전년도 입시결과」 연도 단위 전체 다운로드(필터 없음)"


def nfc(s):
    return unicodedata.normalize("NFC", str(s)) if s is not None else s


COLNAMES = [
    "region", "univ", "term", "dept", "capacity", "day_night",
    "adm_cat", "adm_name", "basis_csat", "basis_gpa", "competition",
    "avg_csat", "avg_gpa", "avg_other", "min_csat", "min_gpa", "min_other",
]


def load_year_file(year):
    path = RESULTS_DIR / f"전년도입시결과_{year}학년도_전문대학포털.xls"
    if not path.exists():
        return None, path
    df = pd.read_excel(path, engine="xlrd", header=None)
    df.columns = COLNAMES
    df = df.iloc[2:].reset_index(drop=True)
    return df, path


def clean(v):
    """NaN → None, 나머지는 그대로. 문자열은 NFC + 공백정리."""
    if v is None:
        return None
    if isinstance(v, float) and pd.isna(v):
        return None
    if isinstance(v, str):
        s = C.squash(v)
        return s or None
    return v


def build_cutline_rows(row, univ_id, grade_scale, program_note):
    """원본 한 행에서 나올 수 있는 cutline 행(dict) 목록을 만든다. 값이 없는 축은 만들지 않는다."""
    out = []
    phase = C.norm_phase(row["term"]) or None
    adm_cat = clean(row["adm_cat"])
    adm_name = clean(row["adm_name"])
    basis_csat = clean(row["basis_csat"])
    competition = clean(row["competition"])

    base_note_bits = [program_note]
    if row["day_night"]:
        base_note_bits.append(f"주야={clean(row['day_night'])}")
    if phase is None and row["term"]:
        base_note_bits.append(f"모집시기 원문='{clean(row['term'])}'")

    def mk(cut_type, axis, cut_grade=None, cut_score=None, pct_avg=None,
           confidence="mid", extra_note=None):
        note_bits = list(base_note_bits)
        note_bits.append(f"축={axis}")
        if extra_note:
            note_bits.append(extra_note)
        out.append(dict(
            univ_id=univ_id, year=None, grade_scale=grade_scale, phase=phase,
            admission_type=adm_cat, admission_name=adm_name,
            cut_type=cut_type, cut_grade=cut_grade, cut_score=cut_score,
            pct_avg=pct_avg, recruit_count=None, competition=competition,
            fill_rate=None, confidence=confidence, note="; ".join(note_bits),
        ))

    avg_gpa, min_gpa = clean(row["avg_gpa"]), clean(row["min_gpa"])
    if avg_gpa is not None:
        mk("평균", "학생부(교과내신 등급)", cut_grade=avg_gpa)
    if min_gpa is not None:
        mk("최저", "학생부(교과내신 등급)", cut_grade=min_gpa)

    avg_csat, min_csat = clean(row["avg_csat"]), clean(row["min_csat"])
    if avg_csat is not None or min_csat is not None:
        if basis_csat == "등급":
            if avg_csat is not None:
                mk("평균", "수능(등급)", cut_grade=avg_csat)
            if min_csat is not None:
                mk("최저", "수능(등급)", cut_grade=min_csat)
        elif basis_csat == "백분위":
            if avg_csat is not None:
                mk("평균", "수능(백분위)", pct_avg=avg_csat)
            if min_csat is not None:
                mk("최저", "수능(백분위)", pct_avg=min_csat)
        else:
            # 원문에 단위 표기가 없다 — 추정하지 않는다. 숫자만 보존하고 낮은 신뢰도로 표시.
            if avg_csat is not None:
                mk("평균", "수능(단위 미상)", cut_score=avg_csat, confidence="low",
                   extra_note="원문에 점수산출기준(등급/백분위) 표기 없음")
            if min_csat is not None:
                mk("최저", "수능(단위 미상)", cut_score=min_csat, confidence="low",
                   extra_note="원문에 점수산출기준(등급/백분위) 표기 없음")

    avg_other, min_other = clean(row["avg_other"]), clean(row["min_other"])
    if avg_other is not None:
        mk("평균", "교과외", cut_score=avg_other, confidence="low",
           extra_note="교과외 항목 — 원문에 산출 단위 설명 없음")
    if min_other is not None:
        mk("최저", "교과외", cut_score=min_other, confidence="low",
           extra_note="교과외 항목 — 원문에 산출 단위 설명 없음")

    return out


def ensure_license_column(con):
    have = {r[1] for r in con.execute("PRAGMA table_info(source_file)")}
    if "license" not in have:
        con.execute("ALTER TABLE source_file ADD COLUMN license TEXT")
        return True
    return False


CUT_COLS = ("univ_id program_id year grade_scale phase admission_type admission_name "
            "cut_type cut_grade cut_score pct_avg recruit_count competition fill_rate "
            "source_id page confidence note").split()


def run(to_db=False):
    con = C.connect()
    added = ensure_license_column(con)
    if added:
        print("  source_file 컬럼 추가: license")

    matcher = C.UnivMatcher()
    known = {r["univ_id"] for r in con.execute("SELECT univ_id FROM university WHERE kind='전문대학'")}
    prog = {(r["univ_id"], r["name_key"]): r["program_id"]
            for r in con.execute("SELECT program_id, univ_id, name_key FROM program")}

    grand_stat = Counter()
    per_year_report = []
    all_insert_rows = []
    unmatched_by_year = defaultdict(Counter)

    for year in YEARS:
        df, path = load_year_file(year)
        if df is None:
            print(f"  {year}: 파일 없음 ({path})")
            continue
        gscale = C.grade_scale(year)
        n_rows = len(df)
        n_cut_rows = 0
        n_skipped = 0
        n_univ_seen = set()

        for _, row in df.iterrows():
            uname = clean(row["univ"])
            if not uname:
                continue
            uid = matcher.match(uname, region=clean(row["region"]))
            if uid is None or uid not in known:
                unmatched_by_year[year][uname] += 1
                n_skipped += 1
                continue
            n_univ_seen.add(uid)

            dept = clean(row["dept"])
            program_id = None
            program_note = f"학과={dept or '(미상)'}"
            if row["capacity"] is not None and clean(row["capacity"]) is not None:
                program_note += f", 입학정원(학과 전체·이 행의 모집인원 아님)={clean(row['capacity'])}"
            if dept:
                key = C.key_name(dept)
                program_id = prog.get((uid, key))
                if program_id is None and to_db:
                    program_id = con.execute(
                        "INSERT INTO program (univ_id,name,name_key) VALUES (?,?,?)",
                        (uid, dept, key)).lastrowid
                    prog[(uid, key)] = program_id

            for r in build_cutline_rows(row, uid, gscale, program_note):
                r["year"] = year
                r["program_id"] = program_id
                r["source_year"] = year
                all_insert_rows.append(r)
                n_cut_rows += 1

        grand_stat[f"{year}_행"] = n_rows
        grand_stat[f"{year}_컷행생성"] = n_cut_rows
        grand_stat[f"{year}_매칭실패"] = n_skipped
        per_year_report.append((year, n_rows, len(n_univ_seen), n_cut_rows, n_skipped,
                                 len(unmatched_by_year[year])))
        print(f"  {year}: 원본 {n_rows:,}행 · 매칭 대학 {len(n_univ_seen)} · "
              f"cutline 생성 {n_cut_rows:,} · 매칭실패 {n_skipped}행"
              f"({len(unmatched_by_year[year])}개교)")

    print(f"\n총 cutline 생성 행수(적재 전): {len(all_insert_rows):,}")

    if not to_db:
        print("\n--dry-run (기본값). 실제 적재하려면 --to-db")
        print("\n연도별 매칭 실패 대학(상위):")
        for year, names in unmatched_by_year.items():
            if names:
                print(f"  {year}: {dict(names.most_common(8))}")
        return

    # 실제 적재
    src_by_year = {}
    for year in YEARS:
        rows_this_year = [r for r in all_insert_rows if r["source_year"] == year]
        if not rows_this_year:
            continue
        path = RESULTS_DIR / f"전년도입시결과_{year}학년도_전문대학포털.xls"
        old = con.execute("SELECT COUNT(*) c FROM cutline c JOIN university u ON c.univ_id=u.univ_id "
                           "WHERE c.year=? AND u.kind='전문대학'", (year,)).fetchone()["c"]
        if old:
            con.execute("DELETE FROM cutline WHERE year=? AND univ_id IN "
                        "(SELECT univ_id FROM university WHERE kind='전문대학')", (year,))
            print(f"  기존 전문대학 {year}학년도 {old:,}행 삭제 후 재적재")

        existing = con.execute(
            "SELECT source_id FROM source_file WHERE kind='result' AND year=? AND title=?",
            (year, path.name)).fetchone()
        if existing:
            sid = existing["source_id"]
        else:
            sid = con.execute(
                """INSERT INTO source_file
                   (kind,year,title,path,sha256,source_url,publisher,retrieved_at,note,license)
                   VALUES ('result',?,?,?,?,?,?,?,?,?)""",
                (year, path.name, str(path),
                 C.sha256(path) if path.exists() else None,
                 f"https://www.procollege.kr/web/entrance/preResultList_excel.do?sel_1={year}",
                 PUBLISHER, "2026-09-03", SURVEY_NOTE, LICENSE_TEXT)).lastrowid
        src_by_year[year] = sid

        for r in rows_this_year:
            r["source_id"] = sid

    con.executemany(
        f"INSERT INTO cutline ({','.join(CUT_COLS)}) VALUES ({','.join('?' * len(CUT_COLS))})",
        [[r.get(c) for c in CUT_COLS] for r in all_insert_rows])

    con.execute(
        "INSERT INTO ingest_log (ran_at,script,target,rows_in,rows_out,note) VALUES (?,?,?,?,?,?)",
        (date.today().isoformat(), "ingest_college_results.py",
         "전문대학 전년도 입시결과(프로칼리지 XLS, 2016~2026학년도)",
         sum(grand_stat[f"{y}_행"] for y in YEARS if f"{y}_행" in grand_stat),
         len(all_insert_rows),
         f"연도 {len([y for y in YEARS if f'{y}_행' in grand_stat])}개 · "
         f"매칭실패 총 {sum(grand_stat[k] for k in grand_stat if k.endswith('_매칭실패')):,}행 "
         f"· cut_type 평균/최저만(원본에 70%/50%컷 구분 없음) · license 필드 채움"))
    con.commit()
    print("\n적재 완료.")
    return per_year_report, unmatched_by_year


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--to-db", action="store_true")
    args = ap.parse_args()
    run(to_db=args.to_db)
