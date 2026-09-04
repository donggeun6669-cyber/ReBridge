"""2027 모집요강 비교내신 → 앱 JSON 2종.

  ① src/data/comparative_2027.json          (앱이 import 하는 환산 데이터)
  ② public/data/comparative_2027_text.json  (앱이 지연 로드하는 원문 발췌)

## 왜 2027인가

앱 점수엔진(`scoreEngine.js` → `applyComparativeConversion`)은
`conversion.gradeTable` 의 각 행에서 **minAvg/maxAvg** 를 보고 등급을 고른다.

    conv.gradeTable.find(r => avg >= (r.minAvg ?? -Infinity) && avg <= (r.maxAvg ?? Infinity))

즉 "검정고시 평균점수 → 등급" 구간이 없으면 표가 아무 쓸모가 없다
(오히려 첫 행이 무조건 걸려서 전원 1등급이 된다).

2028 시행계획에서 뽑은 표(`comparative_2028.json`, 61개)는 거의 다
`등급 → 환산점수` 뿐이라 구간을 앱 표준 추정표로 채웠다.
2027 모집요강에는 **평균점수 구간이 원문에 실제로 실려 있는 대학**이 있다.
게다가 2027은 지금 원서를 쓰는 학년도라 정본이다.

## 이 스크립트가 지키는 것 (export_app.py 와 같은 원칙)

**검증을 통과한 표만 내보낸다. 틀린 표는 없는 것보다 나쁘다.**
떨어진 표는 지우지 않고 `out/guides_2027/export_2027_report.md` 에 사유와 함께 남긴다.

### 검증 (구간표)
  1. `validation == "fail"` 인 행은 애초에 제외 (추출 단계 검증)
  2. 구간이 있는 등급 5개 이상
  3. 구간 경계값이 전부 0~100 안 (검정고시 평균은 100점 만점)
  4. 경계 최대값 >= 90, 최소값 <= 80, 폭 >= 20
     → 석차등급평균표(1.0~1.99), 표준점수 Z표(1.76~), 실기점수표(50~40) 걸러냄
  5. 경계값이 등급이 커질수록 **작아져야** 한다
     → 석차백분율표(4이하=1등급 … 100이하=9등급)는 반대라 걸러짐
  6. 정규화 후 lo <= hi, 구간 겹침·역전 없음, 등급 오름차순
  7. 구간 사이 빈틈이 3점을 넘지 않음 (열 정렬이 어긋난 표)

### 검증 (환산점수)
  8. 점수 0~1000
  9. 등급이 커질수록 점수가 내려간다(단조)
 10. 등급 칸 수 5 또는 9, 등급 1..N 연속 (앱 표준 추정 구간을 붙일 때만)
 11. gradeScale 이 "5" 인 표는 안 내보낸다 — 앱에 '평균→5등급' 대응표가 없다

## gradeBandSource — 앱이 '추정' 라벨을 붙이는 기준

  official_2027         모집요강 원문에 평균점수 구간이 실려 있다. 앱에서 '추정' 라벨 없음
  app_standard_estimate 구간이 없어 앱 표준 추정표(scoreEngine.js `GRADE_MIN_AVG`)를 붙였다

`GRADE_MIN_AVG` 는 앱 코드에서 **실행 시점에 읽어 와** 아래 사본과 대조한다.
앱 값이 바뀌었는데 사본이 옛날 값이면 스크립트가 멈춘다.
(2026-09-03 실측: `export_app.py` 의 사본은 이미 앱과 달라진 옛 9칸 표였다)

## scoreBands(구간→점수표)를 왜 안 내보내는가

`conversion_2027.jsonl` 의 `scoreBands` 22행은 열 정렬이 한 칸씩 밀려 있다.
원문 대조 실측(2026-09-03):

  강원대 수시 p.62  원문 [100]=925 [95~100)=895 [90~95)=865 …
                    추출 hi=None→895, hi=95→865   ← 한 칸 밀림
  경희대 수시 p.116 원문 [100]=94 [95~100)=90 …
                    추출 hi=100→90                ← 한 칸 밀림
  국립목포대 정시 p.17 원문 96초과=95 91초과=90 …
                    추출 91→90 (맞음) 이지만 맨 위 96초과=95 칸이 통째로 빠짐

한 칸 밀린 환산표는 "없는 것보다 나쁜" 쪽이라 이번 판에서는 내보내지 않는다.
`scoreBands` 는 JSONL·L1에 그대로 있으니 추출기를 고치면 다시 쓸 수 있다.

실행:
  python3 v2/export_app_2027.py --dry-run     # 숫자만 본다
  python3 v2/export_app_2027.py --write       # 두 JSON 을 실제로 만든다
"""

import argparse
import collections
import json
import re
from datetime import datetime

import common as C

YEAR = 2027
SRC_DIR = C.OUT / f"guides_{YEAR}"
JSONL = SRC_DIR / f"conversion_{YEAR}.jsonl"
TEXT_DIR = SRC_DIR / "ged_text"
APP_JSON = C.APP_DATA / f"comparative_{YEAR}.json"
PUBLIC_JSON = (C.ROOT / "Application_main_codes" / "public" / "data"
               / f"comparative_{YEAR}_text.json")
SCORE_ENGINE = C.ROOT / "Application_main_codes" / "src" / "lib" / "scoreEngine.js"
REPORT = SRC_DIR / f"export_{YEAR}_report.md"

EPS = 0.01
AVG_MAX = 100.0          # 검정고시 평균 만점

# 원문 발췌 총량 상한 (요구: 3MB 이하)
TEXT_TOTAL_BUDGET = 1_700_000   # 문자 수 기준. JSON 직렬화 후 크기를 다시 확인한다
TEXT_PAGES_PER_UNIV = 8
TEXT_CHARS_PER_PAGE = 6_000

# 앱 scoreEngine.js 의 GRADE_MIN_AVG 사본. 실행할 때 앱 코드와 대조한다.
APP_GRADE_MIN_AVG = [(3, 96.5), (4, 94.0), (5, 86.5), (6, 84.0), (7, 75.0), (8, 65.5)]


# ── 앱 코드와 표준 추정표가 같은지 확인 (읽기만 한다) ───────────────
RE_PAIR = re.compile(r"\[\s*(\d+)\s*,\s*(\d+(?:\.\d+)?)\s*\]")


def read_app_grade_min_avg():
    src = SCORE_ENGINE.read_text(encoding="utf-8")
    m = re.search(r"const\s+GRADE_MIN_AVG\s*=\s*\[(.*?)\];", src, re.S)
    if not m:
        raise SystemExit("scoreEngine.js 에서 GRADE_MIN_AVG 를 못 찾았다. 앱 코드가 바뀌었다.")
    body = re.sub(r"//[^\n]*", "", m.group(1))
    return [(int(g), float(v)) for g, v in RE_PAIR.findall(body)]


def app_standard_bands():
    """앱 표준 추정표 → {등급: (minAvg, maxAvg)}. 앱의 estimateGrade 와 같은 판정."""
    out, upper = {}, AVG_MAX
    for g, lo in APP_GRADE_MIN_AVG:
        out[int(g)] = (float(lo), round(upper, 2))
        upper = round(lo - EPS, 2)
    out[9] = (0.0, round(upper, 2))       # 표의 맨 아래 등급보다 낮으면 9등급
    return out


# ── 구간 정규화 ─────────────────────────────────────────────────────
def normalize_bands(gb):
    """JSONL 의 gradeBands → ([{grade,minAvg,maxAvg}], None) 또는 (None, 사유).

    원문 표 모양이 두 가지다.
      '이상' 사다리   1등급 100 / 2등급 95이상 / 3등급 90이상 …  → lo 가 실린다
      '미만' 사다리   2등급 97미만 / 3등급 90미만 …             → hi 가 실린다
    둘을 섞어 읽으면 한 등급씩 밀리므로 표 전체의 다수결로 방식을 정한다.
    """
    pres = [b for b in gb
            if b.get("raw") and (b.get("lo") is not None or b.get("hi") is not None)]
    if len(pres) < 5:
        return None, f"구간이 있는 등급 {len(pres)}개 (5개 미만)"

    raws = [v for b in pres for v in (b.get("lo"), b.get("hi")) if v is not None]
    if any(v < 0 or v > AVG_MAX for v in raws):
        return None, f"구간 경계가 0~100 밖 ({min(raws)}~{max(raws)})"
    if max(raws) < 90:
        return None, f"구간 최대값 {max(raws)} < 90 — 검정고시 평균(0~100) 표가 아님"
    if min(raws) > 80:
        return None, f"구간 최소값 {min(raws)} > 80 — 구간이 위쪽에만 몰려 있음"
    if max(raws) - min(raws) < 20:
        return None, f"구간 폭 {round(max(raws) - min(raws), 2)} < 20 — 표가 아님"

    pres = sorted(pres, key=lambda b: b["grade"])
    # 등급이 커질수록 경계값이 작아져야 한다. 반대면 석차백분율표다.
    rep = [(b["lo"] if b.get("lo") is not None else b["hi"]) for b in pres]
    if not all(a >= b for a, b in zip(rep, rep[1:])):
        return None, ("등급이 커지는데 구간 경계가 커짐 — 석차백분율표로 보임 "
                      f"({[b.get('raw') for b in pres]})")

    kinds = collections.Counter(b.get("kind") for b in pres)
    up = kinds["이상"] + kinds["초과"] + kinds["point"]
    dn = kinds["미만"] + kinds["이하"]
    style = "up" if up >= dn else "dn"

    all_grades = [int(b["grade"]) for b in gb if b.get("grade") is not None]
    lowest_in_table = max(all_grades) if all_grades else int(pres[-1]["grade"])

    rows = []
    ceil = AVG_MAX
    for b in pres:
        k = b.get("kind")
        if k == "range":
            lo, hi = b["lo"], min(b["hi"], ceil)
        elif k == "미만":
            lo, hi = None, min(ceil, b["hi"] - EPS)
        elif k == "이하":
            lo, hi = None, min(ceil, b["hi"])
        elif k in ("이상", "point", "초과"):
            if style == "up":
                lo = b["lo"] + EPS if k == "초과" else b["lo"]
                hi = ceil
            else:
                # 미만 사다리의 맨 위 칸. lo 는 아랫줄 hi 에서 받는다.
                lo, hi = None, ceil
        else:
            return None, f"구간 종류를 모름({k})"
        rows.append([int(b["grade"]), lo, hi])
        ceil = round((lo if lo is not None else hi) - EPS, 2)

    # lo 가 비어 있는 칸은 바로 아랫줄의 hi 에서 받는다.
    for i, r in enumerate(rows):
        if r[1] is None and i + 1 < len(rows):
            r[1] = round(rows[i + 1][2] + EPS, 2)

    # 맨 아랫줄의 lo 를 지어내야 하는 경우
    if rows and rows[-1][1] is None:
        if int(rows[-1][0]) >= lowest_in_table:
            rows[-1][1] = 0.0            # 표의 마지막 등급 = 바닥. 0 으로 봐도 된다
        else:
            rows.pop()                   # 아래 등급이 더 있는데 값이 없다 → 지어내지 않고 버린다
    if len(rows) < 5:
        return None, f"바닥 구간을 확정할 수 없어 남은 등급 {len(rows)}개 (5개 미만)"
    if any(r[1] is None or r[2] is None for r in rows):
        return None, "정규화 후에도 비어 있는 경계가 남음"

    out = [{"grade": g, "minAvg": round(lo, 2), "maxAvg": round(hi, 2)}
           for g, lo, hi in rows]
    for r in out:
        if r["minAvg"] > r["maxAvg"]:
            return None, f"lo>hi (등급 {r['grade']}: {r['minAvg']}~{r['maxAvg']})"
        if r["minAvg"] < 0 or r["maxAvg"] > AVG_MAX:
            return None, f"정규화 후 0~100 밖 (등급 {r['grade']})"
    for a, b in zip(out, out[1:]):
        if b["grade"] <= a["grade"]:
            return None, f"등급이 오름차순이 아님 ({a['grade']}→{b['grade']})"
        if b["maxAvg"] >= a["minAvg"]:
            return None, (f"구간 겹침 (등급 {a['grade']} {a['minAvg']}~ ↔ "
                          f"등급 {b['grade']} ~{b['maxAvg']})")
        hole = round(a["minAvg"] - b["maxAvg"] - EPS, 2)
        if hole > 3:
            return None, (f"구간 사이 빈틈 {hole}점 (등급 {b['grade']} ~{b['maxAvg']} / "
                          f"등급 {a['grade']} {a['minAvg']}~) — 열 정렬이 어긋난 표")
    return out, None


# ── 환산점수 검증 ───────────────────────────────────────────────────
def check_scores(gt):
    """gradeTable(등급→점수) 검증. 통과하면 [] , 아니면 사유 리스트."""
    bad = []
    sv = [r["score"] for r in gt if r.get("score") is not None]
    if not sv:
        return ["점수 칸이 전부 비어 있음"]
    if any(v < 0 or v > 1000 for v in sv):
        bad.append(f"점수 0~1000 범위 이탈 ({min(sv)}~{max(sv)})")
    if not all(a >= b for a, b in zip(sv, sv[1:])):
        bad.append("점수 단조성 위반(등급이 낮아질수록 점수가 내려가야 함)")
    if len(set(sv)) < 2:
        bad.append("점수가 전부 같음 — 표가 아님")
    return bad


def check_full_grade_table(rec):
    """앱 표준 추정 구간을 붙이려면 표가 1..N 로 온전해야 한다."""
    gt = rec.get("gradeTable") or []
    bad = check_scores(gt)
    grades = [r.get("grade") for r in gt]
    if any(g is None for g in grades):
        bad.append("등급 칸이 비어 있음")
    elif [int(g) for g in grades] != list(range(1, len(grades) + 1)):
        bad.append(f"등급이 1..N 로 이어지지 않음 {grades}")
    if len(gt) not in (5, 9):
        bad.append(f"등급 칸 수가 {len(gt)}개 (5 또는 9여야 함)")
    if rec.get("gradeScale") == "5":
        bad.append("5등급표 — 앱에 '평균→5등급' 대응표가 없어 구간을 못 붙임(지어내지 않음)")
    if not rec.get("gradeScale"):
        bad.append("gradeScale 미확정")
    return bad


# ── 한 행(JSONL) → conversion ───────────────────────────────────────
def source_label(rec):
    p = rec.get("page")
    s = f"{YEAR} {rec['univ']} {rec.get('phase') or ''} 모집요강"
    if p:
        s += f" p.{p}"
    return re.sub(r"\s+", " ", s).strip()


def build_conversion(rec, std_bands):
    """(conversion, None) 또는 (None, 실패사유 리스트)."""
    gt = rec.get("gradeTable") or []
    score_of = {int(r["grade"]): r.get("score")
                for r in gt if r.get("grade") is not None}

    bands, why = (None, None)
    if rec.get("gradeBands"):
        bands, why = normalize_bands(rec["gradeBands"])

    if bands:
        band_src = "official_2027"
        if gt and check_scores(gt):
            # 구간은 살리고 점수만 버린다. 등급 판정은 여전히 공식이다.
            score_of = {}
        rows = [{"minAvg": b["minAvg"], "maxAvg": b["maxAvg"], "grade": b["grade"],
                 "score": score_of.get(b["grade"])} for b in bands]
    else:
        if not gt:
            return None, [why or "평균점수 구간도 환산표도 없음"]
        bad = check_full_grade_table(rec)
        if bad:
            return None, ([why] if why else []) + bad
        band_src = "app_standard_estimate"
        rows = []
        for r in gt:
            g = int(r["grade"])
            if g not in std_bands:        # 표준 추정표가 못 주는 등급(1·2)은 뺀다.
                continue                  # 남겨두면 minAvg 가 없어 첫 행이 무조건 걸린다.
            lo, hi = std_bands[g]
            rows.append({"minAvg": lo, "maxAvg": hi, "grade": g, "score": r.get("score")})
        if len(rows) < 5:
            return None, [f"표준 추정 구간을 붙일 수 있는 등급 {len(rows)}개 (5개 미만)"]

    sv = [r["score"] for r in rows if r.get("score") is not None]
    conv = {
        "type": "grade_table",
        "maxScore": rec.get("maxScore") if rec.get("maxScore") is not None
                    else (max(sv) if sv else None),
        "minScore": rec.get("minScore") if rec.get("minScore") is not None
                    else (min(sv) if sv else None),
        "gradeTable": rows,
        # ── 출처·성격 (앱은 모르는 키를 무시한다) ──
        "gradeBandSource": band_src,
        "gradeBandLabel": rec.get("bandLabel") or None,
        "avgCoverage": {"minAvg": min(r["minAvg"] for r in rows),
                        "maxAvg": max(r["maxAvg"] for r in rows)},
        "hasOfficialScores": bool(sv),
        "phase": rec.get("phase"),
        "appliesTo": rec.get("appliesTo"),
        "gradeScale": rec.get("gradeScale"),
        "kind": rec.get("kind"),
        "source": source_label(rec),
        "sourceFile": rec.get("source_file"),
        "sourcePage": rec.get("page"),
        "sourceUrl": rec.get("sourceUrl"),
        "quote": rec.get("quote"),
        "year": YEAR,
        "extractedBy": ("data-pipeline/v2/export_app_2027.py "
                        + datetime.now().date().isoformat()),
    }
    return conv, None


# ── 행 고르기 ───────────────────────────────────────────────────────
KIND_RANK = {"구간표+환산표": 0, "구간표": 1, "환산표": 2, "구간→점수표": 3,
             "산문만": 4, "근거없음": 5, "미상": 6}
APPLIES_RANK = {"검정고시전용": 0, "재학생준용": 1, "불명": 2, None: 3}


def pick_best(convs):
    """같은 (대학, 수시/정시) 안에서 하나를 고른다. 공식 구간 > 점수 있음 > 검정고시전용."""
    def key(c):
        return (0 if c["gradeBandSource"] == "official_2027" else 1,
                0 if c["hasOfficialScores"] else 1,
                APPLIES_RANK.get(c.get("appliesTo"), 3),
                -len(c["gradeTable"]),
                c.get("sourcePage") or 9999)
    return sorted(convs, key=key)[0]


# ── 원문 발췌 ───────────────────────────────────────────────────────
RE_STRONG = re.compile(r"비교\s*내신")
RE_TABLE = re.compile(r"환산|배점|반영\s*점수|등급|평균|산출|석차")
RE_GED = re.compile(r"검정고시")
RE_BAND = re.compile(r"\d{2,3}\s*(?:점\s*)?(?:이상|미만|이하|초과)")


def page_score(page, cited, primary=frozenset()):
    """페이지 관련도. 클수록 먼저 남긴다."""
    s = 0
    if page.get("page") in primary:
        s += 200                                   # 환산표를 실제로 뽑아낸 쪽(r["page"])
    elif page.get("page") in cited:
        s += 60                                     # 추출기가 후보로 훑어본 쪽(candPages)
    t = page.get("text") or ""
    hits = page.get("hits") or []
    if "비교내신" in hits or RE_STRONG.search(t):
        s += 40
    if RE_GED.search(t):
        s += 10
    if RE_TABLE.search(t):
        s += 5
    if RE_BAND.search(t):
        s += 8
    return s


def build_text_json(recs_by_univ, name_of):
    """ged_text/*.json → univId별 관련 페이지만 추린 dict."""
    idx = C.jload(TEXT_DIR / "_index.json")
    stats = {"files": 0, "pages_in": 0, "pages_out": 0, "chars": 0,
             "truncated_pages": 0, "univs": 0, "dropped_budget": 0,
             "primary_pages": 0, "primary_pages_total": 0}
    primary_by_univ = collections.defaultdict(set)   # r["page"] — 표를 실제로 뽑아낸 쪽
    cited_by_univ = collections.defaultdict(set)      # + candPages — 추출기가 훑어본 후보 쪽
    for uid, rows in recs_by_univ.items():
        for r in rows:
            if r.get("page"):
                primary_by_univ[uid].add(r["page"])
                cited_by_univ[uid].add(r["page"])
            for p in (r.get("candPages") or []):
                cited_by_univ[uid].add(p)

    ranked = []
    for item in idx["items"]:
        f = TEXT_DIR / item["file"]
        if not f.exists():
            continue
        d = C.jload(f)
        uid = d["univId"]
        stats["files"] += 1
        pages = d.get("pages") or []
        stats["pages_in"] += len(pages)
        cited = cited_by_univ.get(uid, set())
        primary = primary_by_univ.get(uid, set())
        scored = sorted(((page_score(p, cited, primary), p) for p in pages),
                        key=lambda x: (-x[0], x[1].get("page") or 0))
        keep = [(sc, p) for sc, p in scored if sc >= 15][:TEXT_PAGES_PER_UNIV]
        if not keep:
            keep = scored[:2]
        for sc, p in keep:
            ranked.append((sc, uid, d, p))
            if p.get("page") in primary:
                stats["primary_pages_total"] += 1

    # 전체 예산 안에서 관련도 높은 쪽부터 담는다.
    ranked.sort(key=lambda x: (-x[0], x[1], x[3].get("page") or 0))
    out, used = {}, 0
    for sc, uid, d, p in ranked:
        text = p.get("text") or ""
        if len(text) > TEXT_CHARS_PER_PAGE:
            text = text[:TEXT_CHARS_PER_PAGE]
            stats["truncated_pages"] += 1
        if used + len(text) > TEXT_TOTAL_BUDGET:
            stats["dropped_budget"] += 1
            continue
        used += len(text)
        e = out.setdefault(uid, {
            "univId": uid, "univ": d.get("univ") or name_of.get(uid),
            "year": YEAR,
            "sources": [{"file": s.get("file"), "phase": s.get("phaseKo"),
                         "pages": s.get("pages"), "sourceUrl": s.get("sourceUrl")}
                        for s in (d.get("sources") or [])],
            "pages": [],
        })
        is_primary = p.get("page") in primary_by_univ.get(uid, set())
        e["pages"].append({
            "page": p.get("page"),
            "phase": p.get("phaseKo"),
            "sourceFile": p.get("source_file"),
            "hits": p.get("hits"),
            "cited": is_primary,
            "text": text,
        })
        stats["pages_out"] += 1
        stats["chars"] += len(text)
        if is_primary:
            stats["primary_pages"] += 1
    for e in out.values():
        e["pages"].sort(key=lambda p: (p.get("sourceFile") or "", p.get("page") or 0))
    stats["univs"] = len(out)
    return out, stats


# ── main ────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="앱 JSON 2개를 실제로 만든다")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    app_vals = read_app_grade_min_avg()
    if [(int(g), float(v)) for g, v in APP_GRADE_MIN_AVG] != app_vals:
        raise SystemExit(
            "앱의 GRADE_MIN_AVG 가 이 스크립트의 사본과 다르다.\n"
            f"  앱   {app_vals}\n  사본 {APP_GRADE_MIN_AVG}\n"
            "앱 코드는 이 파이프라인이 고치지 않는다. 사본을 앱 값에 맞춘 뒤 다시 돌려라.")
    std_bands = app_standard_bands()

    with open(JSONL, encoding="utf-8") as f:
        rows = [json.loads(l) for l in f]
    univs = {u["univId"]: u for u in C.load_universities()}
    name_of = {uid: u["name"] for uid, u in univs.items()}

    by_univ = collections.defaultdict(list)
    for r in rows:
        by_univ[r["univId"]].append(r)

    # ── 행 → conversion ──
    ok_by_key = collections.defaultdict(list)     # (univId, phase) -> [conversion]
    failed, skipped_val, no_table = [], [], 0
    band_reject = []          # gradeBands 는 있었는데 공식 구간으로 못 쓴 행
    band_univ_all = {r["univId"] for r in rows if r.get("gradeBands")}
    for r in rows:
        if r.get("validation") == "fail":
            skipped_val.append((r, r.get("validationFails") or ["validation=fail"]))
            continue
        if r["univId"] not in univs:
            failed.append((r, [f"universities.json 에 없는 univId({r['univId']})"]))
            continue
        if r.get("gradeBands"):
            nb, nwhy = normalize_bands(r["gradeBands"])
            if nb is None:
                band_reject.append((r, nwhy))
        conv, bad = build_conversion(r, std_bands)
        if conv is None:
            if not r.get("gradeBands") and not r.get("gradeTable"):
                no_table += 1          # 표 자체가 없는 행(산문만·근거없음)은 탈락이 아니다
                continue
            failed.append((r, bad))
            continue
        ok_by_key[(r["univId"], r.get("phase"))].append(conv)

    # ── 대학 단위로 합치기 ──
    app = {}
    base_from_jeongsi, base_official_override = [], []
    for uid, recs in sorted(by_univ.items(), key=lambda kv: name_of.get(kv[0], kv[0])):
        if uid not in univs:
            continue
        by_phase = {}
        for ph in ("수시", "정시"):
            cands = ok_by_key.get((uid, ph))
            if cands:
                by_phase[ph] = pick_best(cands)

        # comparativeGrade — 원문 발췌. 표가 있으면 표 원문, 없으면 산문 문장.
        best_rec = None
        for r in recs:
            if r.get("gradeBands") or r.get("gradeTable"):
                if best_rec is None or (KIND_RANK.get(r.get("kind"), 9)
                                        < KIND_RANK.get(best_rec.get("kind"), 9)):
                    best_rec = r
        quote_parts, ctype = [], "prose"
        if best_rec:
            ctype = "numeric_table"
            quote_parts.append(f"[{best_rec.get('phase')} p.{best_rec.get('page')}]\n"
                               + (best_rec.get("quote") or ""))
        proses = []
        for r in recs:
            for fm in (r.get("formulas") or []):
                s = C.squash(fm.get("text"))
                line = f"[{r.get('phase')} p.{fm.get('page')}] {s}"
                if s and line not in proses:
                    proses.append(line)
        quote_parts += proses[:12]
        entry = {
            "comparativeGrade": "\n".join(quote_parts).strip() or None,
            "comparativeGradeType": ctype,
            "source": (source_label(best_rec) if best_rec
                       else f"{YEAR} {name_of.get(uid, uid)} 모집요강"),
        }
        if by_phase:
            su, jg = by_phase.get("수시"), by_phase.get("정시")
            base = su or jg
            if su and jg and su["gradeBandSource"] != "official_2027" \
                    and jg["gradeBandSource"] == "official_2027":
                base = jg
                base_official_override.append((uid, name_of.get(uid, uid)))
            elif su is None and jg is not None:
                base_from_jeongsi.append((uid, name_of.get(uid, uid)))
            entry["conversion"] = base
            entry["byPhase"] = by_phase
        app[uid] = entry

    app["meta"] = {
        "year": YEAR,
        "source": "대학별 2027학년도 모집요강",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "gradeScale": "9",
        "note": ("conversion 은 '수시' 표를 기본으로 쓴다(수시 표가 없거나 정시 표만 공식 "
                 "구간표면 정시). 전체는 byPhase 에 있다. gradeBandSource 가 "
                 "'official_2027' 이면 평균점수 구간이 모집요강 원문에 실려 있다는 뜻이고, "
                 "'app_standard_estimate' 면 앱 표준 추정 구간을 붙인 것이다."),
        "warning": "최상위 meta 키는 대학이 아니다. 대학을 순회할 때 반드시 건너뛸 것.",
    }

    # ── 원문 발췌 ──
    text_out, tstats = build_text_json(by_univ, name_of)
    text_out["meta"] = {
        "year": YEAR,
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "note": ("대학별 비교내신 산출 관련 발췌만 담았다(원문 전체가 아니다). "
                 "전체 원문은 각 대학 입학처 모집요강에서 확인해야 한다 — "
                 "univId 항목의 `sources[].sourceUrl` 이 그 원본 PDF 다운로드 주소다."),
        "warning": "최상위 meta 키는 대학이 아니다. 대학을 순회할 때 반드시 건너뛸 것.",
    }

    # ── 커버리지 ──
    univ_ids = [k for k in app if k != "meta"]
    with_conv = [k for k in univ_ids if app[k].get("conversion")]
    official = [k for k in with_conv
                if app[k]["conversion"]["gradeBandSource"] == "official_2027"]
    estimate = [k for k in with_conv if k not in official]
    official_any = [k for k in univ_ids
                    if any(c["gradeBandSource"] == "official_2027"
                           for c in (app[k].get("byPhase") or {}).values())]

    comp28 = C.jload(C.APP_DATA / "comparative_2028.json")
    conv28 = {k for k, v in comp28.items() if k != "meta" and v.get("conversion")}
    cut = C.jload(C.APP_DATA / "cutlines_2026.json")
    cut_ids = {k for k in cut if k != "meta"}

    only28 = sorted(conv28 - set(with_conv))
    all_univ_ids = set(univs)
    neither = sorted(all_univ_ids - set(with_conv) - conv28)

    cut_and_official = sorted(cut_ids & set(official_any))
    cut_and_any2027 = sorted(cut_ids & set(with_conv))
    baseline_2028 = sorted(cut_ids & conv28)
    cut_union = sorted(cut_ids & (set(official_any) | conv28))

    # ── DB 대조 ──
    db = {}
    try:
        con = C.connect()
        db["rows"] = con.execute(
            "SELECT COUNT(*) FROM ged_conversion WHERE year=?", (YEAR,)).fetchone()[0]
        db["univs"] = con.execute(
            "SELECT COUNT(DISTINCT univ_id) FROM ged_conversion WHERE year=?",
            (YEAR,)).fetchone()[0]
        db["bands"] = con.execute(
            "SELECT COUNT(DISTINCT univ_id) FROM ged_conversion "
            "WHERE year=? AND grade_bands_json IS NOT NULL", (YEAR,)).fetchone()[0]
        db_keys = {(r[0], r[1]) for r in con.execute(
            "SELECT univ_id, phase FROM ged_conversion WHERE year=?", (YEAR,))}
        jl_keys = {(r["univId"], r.get("phase")) for r in rows}
        db["jsonl_rows"] = len(rows)
        db["jsonl_univs"] = len({r["univId"] for r in rows})
        db["jsonl_keys"] = len(jl_keys)
        db["only_jsonl"] = sorted(jl_keys - db_keys)
        db["only_db"] = sorted(db_keys - jl_keys)
        db["dup_jsonl"] = len(rows) - len(jl_keys)
        db["exported_not_in_db"] = sorted(set(with_conv) - {k for k, _ in db_keys})
        con.close()
    except Exception as e:                                    # noqa: BLE001
        db["error"] = str(e)

    # ── 리포트 ──
    L = ["# 2027 모집요강 비교내신 → 앱 반영 리포트", "",
         f"- 생성: {datetime.now().isoformat(timespec='seconds')}",
         f"- 원천: `v2/out/guides_{YEAR}/conversion_{YEAR}.jsonl` "
         f"({len(rows)}행 / {len({r['univId'] for r in rows})}개 대학)",
         f"- 산출: `src/data/comparative_{YEAR}.json`, "
         f"`public/data/comparative_{YEAR}_text.json`",
         "- 앱 코드(src/lib, src/components)는 한 줄도 고치지 않았다. "
         "이 파일들을 앱에 연결하는 것은 앱 담당의 몫이다.", "",
         "## 먼저 — 이번 판에서 빠진 것", "",
         f"1. **scoreBands(구간→점수표) 22행 / 16개 대학을 통째로 뺐다.** "
         "열 정렬이 한 칸씩 밀려 있다(스크립트 맨 위 주석에 원문 대조 3건).",
         f"2. **추출 단계 검증 실패 {len(skipped_val)}행**은 그대로 뺐다.",
         f"3. **변환 단계 탈락 {len(failed)}행** — 표는 있는데 앱이 쓸 형태로 못 바꿨다.",
         "4. **정시(수능위주) 전형은 앱이 어차피 비교를 안 한다**"
         "(`scoreEngine.js` 가 `dataGap:'csat'` 로 끊는다). "
         "정시 표만 있는 대학은 데이터는 들어가지만 화면에서는 쓰이지 않을 수 있다.",
         "5. `appliesTo == '재학생준용'` 인 표는 재학생 기준표를 검정고시에 준용하는 것이라 "
         "대학이 실제로 그렇게 적용하는지는 원문을 사람이 봐야 한다. "
         "빼지 않고 `appliesTo` 로 표시만 했다.", "",
         "## 처리 수 (대상 대비)", "",
         "| 항목 | 수 |", "|---|---:|",
         f"| JSONL 행 | {len(rows)} |",
         f"| 표가 아예 없는 행(산문만·근거없음) | {no_table} |",
         f"| 추출 검증 실패(validation=fail)로 제외 | {len(skipped_val)} |",
         f"| 변환 단계 탈락 | {len(failed)} |",
         f"| conversion 이 만들어진 행 | {sum(len(v) for v in ok_by_key.values())} |",
         f"| conversion 이 만들어진 (대학,구분) 조합 | {len(ok_by_key)} |",
         f"| **comparative_{YEAR}.json 대학 항목** | **{len(univ_ids)}** |",
         f"| 그중 conversion 이 있는 대학 | {len(with_conv)} |",
         f"| 그중 기본 conversion 이 official_2027 | **{len(official)}** |",
         f"| 그중 기본 conversion 이 app_standard_estimate | {len(estimate)} |",
         f"| 수시·정시 어느 한쪽이라도 공식 구간표가 있는 대학 | **{len(official_any)}** |", "",
         "## 커버리지", "",
         "| 항목 | 대학 수 |", "|---|---:|",
         f"| 2027 conversion 보유 | {len(with_conv)} |",
         f"| 2027 공식 구간표(official_2027) 보유 — 앱에서 '추정' 라벨 안 붙음 | "
         f"**{len(official_any)}** |",
         f"| 2028 표만 있고 2027 은 없음 | {len(only28)} |",
         f"| 2027·2028 둘 다 없음 (universities.json {len(all_univ_ids)}개 기준) | "
         f"{len(neither)} |",
         f"| 2026 합격선 보유 (cutlines_2026.json) | {len(cut_ids)} |",
         f"| **합격선 + 2027 공식 구간표 둘 다** | **{len(cut_and_official)}** |",
         f"| 합격선 + 2027 conversion(추정 구간 포함) | {len(cut_and_any2027)} |",
         f"| 합격선 + 2028 conversion (기존 기준값) | {len(baseline_2028)} |",
         f"| 합격선 + (2027 공식 구간표 또는 2028 표) | {len(cut_union)} |", "",
         "## DB 정합 (`rebridge.db` · `ged_conversion` year=2027)", ""]
    if "error" in db:
        L.append(f"- 읽기 실패: {db['error']}")
    else:
        L += [f"- DB 행 **{db['rows']}** / 대학 **{db['univs']}** / "
              f"grade_bands 있는 대학 {db['bands']}",
              f"- JSONL 행 **{db['jsonl_rows']}** / 대학 **{db['jsonl_univs']}** / "
              f"(대학,구분) 조합 {db['jsonl_keys']}",
              "",
              f"**행 수가 다른 이유는 중복이나 누락이 아니라 유니크 축이다.** "
              f"`ux_conversion_v2` 가 `(univ_id, year, phase)` 라서 한 대학·한 구분에 "
              f"행이 하나만 남는다(뒤 행이 앞 행을 덮어쓴다). "
              f"JSONL 은 후보 표를 여러 개 그대로 흘린다.",
              f"- JSONL 안에서 (대학,구분)이 겹치는 행: **{db['dup_jsonl']}개**"
              f" → {db['jsonl_rows']} − {db['dup_jsonl']} = {db['jsonl_keys']}",
              f"- DB 행 {db['rows']} vs 조합 {db['jsonl_keys']} 차이: "
              f"{db['jsonl_keys'] - db['rows']}",
              f"- JSONL 에만 있는 조합 {len(db['only_jsonl'])}개: {db['only_jsonl']}",
              f"- DB 에만 있는 조합 {len(db['only_db'])}개: {db['only_db']}",
              f"- 이번에 내보낸 대학 중 DB(year=2027)에 없는 대학: "
              f"{len(db['exported_not_in_db'])}개 {db['exported_not_in_db']}",
              "",
              "**중요**: 이 export 는 DB가 아니라 JSONL 을 원천으로 쓴다. "
              "DB 는 (대학,구분)당 마지막 행만 남기므로 더 좋은 표가 덮여 사라진 경우가 있다"
              "(예: 강원대 수시 p.82 구간표+환산표). "
              "다른 세션이 같은 테이블을 건드렸는지는 위 두 목록으로 확인한다."]
    L.append("")

    L += ["## 검증 실패 — 내보내지 않음", "",
          f"### ① 추출 단계 검증 실패 (`validation=fail`) {len(skipped_val)}행", "",
          "| 대학 | 구분 | 쪽 | 사유 |", "|---|---|---:|---|"]
    for r, why in sorted(skipped_val, key=lambda x: x[0]["univ"]):
        L.append(f"| {r['univ']} | {r.get('phase')} | {r.get('page')} | "
                 f"{'; '.join(why)} |")
    L += ["", f"### ② 변환 단계 탈락 {len(failed)}행", "",
          "표는 있는데 앱이 쓸 수 있는 형태로 못 바꾼 행이다. "
          "JSONL·L1(`ged_conversion`)에는 그대로 있다.", "",
          "| 대학 | 구분 | 쪽 | 표종류 | 사유 |", "|---|---|---:|---|---|"]
    for r, why in sorted(failed, key=lambda x: (x[0]["univ"], x[0].get("page") or 0)):
        L.append(f"| {r['univ']} | {r.get('phase')} | {r.get('page')} | "
                 f"{r.get('kind')} | {'; '.join(w for w in why if w)} |")
    L += ["", "### ③ scoreBands(구간→점수표) 22행 — 통째로 제외", "",
          "열 정렬이 한 칸씩 밀려 있다(스크립트 맨 위 주석에 원문 대조 3건). "
          "추출기를 고치면 16개 대학이 더 들어온다.", ""]

    L += [f"## 공식 구간표 대학 {len(official_any)}개", "",
          "이 대학들만 앱에서 '추정' 라벨 없이 등급이 나온다.", "",
          "| 대학 | 기본 구분 | 적용대상 | 등급 구간 수 | 커버 평균 | 환산점수 | 합격선 | 출처 |",
          "|---|---|---|---:|---|---|---|---|"]
    for uid in sorted(official_any, key=lambda k: name_of.get(k, k)):
        c = app[uid]["conversion"]
        cv = c["avgCoverage"]
        L.append(f"| {name_of.get(uid, uid)} | {c.get('phase')} | {c.get('appliesTo')} | "
                 f"{len(c['gradeTable'])} | {cv['minAvg']}~{cv['maxAvg']} | "
                 f"{'있음' if c['hasOfficialScores'] else '없음'} | "
                 f"{'O' if uid in cut_ids else '-'} | "
                 f"{c.get('sourceFile')} p.{c.get('sourcePage')} |")
    L.append("")

    if base_official_override:
        L += ["### 기본 conversion 을 정시 표로 잡은 대학 "
              "(수시는 추정 구간, 정시는 공식 구간)", ""]
        for uid, nm in base_official_override:
            L.append(f"- {nm} (`{uid}`)")
        L.append("")
    if base_from_jeongsi:
        L += [f"### 정시 표만 있어 정시를 기본으로 쓴 대학 {len(base_from_jeongsi)}개", "",
              ", ".join(nm for _, nm in base_from_jeongsi), ""]

    L += [f"## 합격선 + 공식 구간표 둘 다 있는 대학 {len(cut_and_official)}개", "",
          "앱에서 '추정' 라벨 없이 합격선 비교까지 되는 대학이다.", "",
          ", ".join(name_of.get(k, k) for k in cut_and_official) or "(없음)", "",
          f"(참고) 합격선 + 2028 conversion = {len(baseline_2028)}개 — 기존 기준값", ""]

    L += ["## 원문 발췌 파일", "",
          f"- `public/data/comparative_{YEAR}_text.json`",
          f"- 대학 {tstats['univs']}개 / 페이지 {tstats['pages_out']}쪽 "
          f"(원본 {tstats['pages_in']}쪽 중) / 문자 {tstats['chars']:,}",
          "",
          "**자른 기준**", "",
          f"1. 대학당 최대 **{TEXT_PAGES_PER_UNIV}쪽**. "
          f"2. 페이지당 최대 **{TEXT_CHARS_PER_PAGE:,}자**(넘으면 뒤를 자른다). "
          f"3. 전체 **{TEXT_TOTAL_BUDGET:,}자** 예산.",
          "4. 관련도 점수: 환산표를 실제로 뽑아낸 쪽(`page`) **+200**, "
          "추출기가 후보로만 훑어본 쪽(`candPages`) **+60**, "
          "'비교내신' **+40**, '검정고시' **+10**, "
          "'90점 이상' 같은 구간 표현 **+8**, 환산·배점·등급·석차 낱말 **+5**. "
          "**15점 미만은 버린다.** 표를 실제로 뽑아낸 쪽은 점수 차이가 커서 "
          "대학당 상한·전체 예산에 걸려도 항상 가장 먼저 살아남는다("
          f"이번 판 {tstats['primary_pages']}/{tstats['primary_pages_total']}쪽 포함"
          + (", 전량 포함" if tstats['primary_pages'] == tstats['primary_pages_total'] else " — 일부 누락, 아래 확인 필요")
          + ").",
          f"5. 길이 상한에 걸려 뒤를 자른 페이지 {tstats['truncated_pages']}쪽, "
          f"전체 예산에 걸려 뺀 페이지 {tstats['dropped_budget']}쪽.",
          "",
          "원문 자체는 **요약하지 않고 그대로** 넣었다. 자른 것은 쪽 단위와 길이뿐이다.", ""]

    L += ["## 앱 연결 담당이 읽어야 할 키", "",
          "### `src/data/comparative_2027.json`", "",
          "| 키 | 뜻 | 주의 |", "|---|---|---|",
          "| `meta` | 최상위. 대학이 아니다 | **대학을 순회할 때 반드시 건너뛴다** "
          "(`cutlines_2026.json` 과 같은 함정. `comparative_2028.json` 에는 meta 가 없었다) |",
          "| `<univId>.comparativeGrade` | 모집요강 원문 발췌 | 표가 있으면 표 원문, "
          "없으면 검정고시 관련 문장들 |",
          "| `<univId>.comparativeGradeType` | `numeric_table` / `prose` | "
          "`analysis.js` 의 `comparativeTypeOf` 가 그대로 쓴다 |",
          "| `<univId>.source` | 출처 한 줄 | 화면 표기용 |",
          "| `<univId>.conversion` | 앱 기본 conversion (수시 우선) | "
          "`scoreEngine.applyComparativeConversion` 이 읽는다 |",
          "| `<univId>.byPhase.수시` / `.정시` | 구분별 전체 | "
          "앱이 아직 안 읽는다. 전형 구분을 아는 화면이 생기면 여기를 쓰면 된다 |",
          "| `conversion.type` | 항상 `grade_table` | `score_table` 은 이번 판에 없다 |",
          "| `conversion.gradeTable[].minAvg / maxAvg / grade / score` | "
          "평균점수 구간 → 등급 → 환산점수 | "
          "`score` 가 `null` 일 수 있다(구간만 공개한 대학). 앱은 `row.score ?? null` 로 받는다. "
          "**등급 1·2 행이 없는 표가 많다** — 대학이 검정고시에 그 등급을 안 주거나, "
          "앱 표준 추정표가 3등급부터라서다 |",
          "| `conversion.gradeBandSource` | `official_2027` / `app_standard_estimate` | "
          "**앱이 '추정' 라벨을 띄우는 기준.** 지금 코드의 "
          "`gradeBandEstimated = comp?.conversion?.gradeBandSource === 'app_standard_estimate'` "
          "가 그대로 동작한다 |",
          "| `conversion.maxScore` / `minScore` | 환산점수 만점·최저 | "
          "`pointsPerGrade = (maxScore-minScore)/8` 에 쓰인다. "
          "**점수 칸이 전부 비면 `null`** — 그때는 점수 비교가 아니라 등급 비교로 가야 한다 |",
          "| `conversion.hasOfficialScores` | 환산점수가 실제로 있는가 | "
          "`false` 면 등급만 공식이고 점수는 없다 |",
          "| `conversion.avgCoverage.minAvg/maxAvg` | 이 표가 덮는 평균점수 범위 | "
          "범위 밖이면 앱이 `method:'standard'` 로 폴백한다(정상 동작, 버그 아님) |",
          "| `conversion.appliesTo` | `검정고시전용` / `재학생준용` / `불명` | "
          "`재학생준용` 은 재학생 기준표를 검정고시에 준용하는 표다. 화면에 밝히는 게 좋다 |",
          "| `conversion.phase` | 이 표가 나온 구분 | 기본 conversion 이 수시인지 정시인지 |",
          "| `conversion.gradeScale` | `9` | 2027은 9등급제. 2028(5등급)과 섞지 말 것 |",
          "| `conversion.source` / `sourceFile` / `sourcePage` / `sourceUrl` / `quote` | "
          "출처·원문 | 화면에 근거를 보여줄 때 쓴다 |", "",
          "### `public/data/comparative_2027_text.json`", "",
          "| 키 | 뜻 | 주의 |", "|---|---|---|",
          "| `meta` | 최상위. 대학이 아니다 | "
          "**대학을 순회할 때 반드시 건너뛴다.** 전체 원문은 대학 입학처 모집요강에서 "
          "확인하라는 안내와 함께 있다 |",
          "| `<univId>.pages[]` | 비교내신 관련 쪽만 추린 원문 | "
          "요약이 아니라 원문 그대로. 지연 로드(fetch)용이다 |",
          "| `pages[].cited` | 이 쪽에서 환산표를 실제로 뽑았는가 | "
          "`true` 인 쪽을 먼저 보여주면 된다 |",
          "| `pages[].page` / `.phase` / `.sourceFile` / `.hits` | "
          "쪽수 · 수시/정시 · 원본 PDF · 걸린 낱말 | |",
          "| `<univId>.sources[]` | 원본 PDF 목록(쪽수 · 어디가 다운로드 URL) | |", "",
          "### 연도가 섞이면 안 된다", "",
          "- `comparative_2028.json` = 2028 시행계획, **5등급제**.",
          "- `comparative_2027.json` = 2027 모집요강, **9등급제**.",
          "- 합격선 `cutlines_2026.json` = 2026학년도, **9등급제**.",
          "  → 등급 비교의 자가 맞는 쪽은 **2027** 이다.",
          "- 앱은 지금 `comparative_2028.json` 만 import 한다"
          "(`src/lib/scoreEngine.js`, `src/lib/analysis.js`). 바꾸는 건 앱 담당의 몫이다.", "",
          "### 앱 표준 추정표가 이미 한 번 바뀌었다", "",
          "`scoreEngine.js` 의 `GRADE_MIN_AVG` 는 지금 **6칸(3~8등급)** 이다.",
          "`v2/export_app.py` 안의 사본은 아직 옛 **9칸(1~9등급)** 표라 서로 다르다.",
          "이 스크립트는 실행할 때 앱 코드에서 값을 읽어 사본과 대조하고, 다르면 멈춘다.",
          "`export_app.py` 를 다시 돌릴 일이 있으면 그 사본부터 맞춰야 한다.", ""]

    REPORT.write_text("\n".join(L) + "\n", encoding="utf-8")

    # ── 출력 ──
    print("═" * 68)
    print(f"  JSONL 행                    {len(rows):>5}   대학 "
          f"{len({r['univId'] for r in rows})}")
    print(f"  표 없는 행(산문만·근거없음)    {no_table:>5}")
    print(f"  추출 검증 실패 제외           {len(skipped_val):>5}")
    print(f"  변환 단계 탈락               {len(failed):>5}")
    print(f"  comparative_2027 대학 항목    {len(univ_ids):>5}")
    print(f"    conversion 있음            {len(with_conv):>5}")
    print(f"    기본이 official_2027       {len(official):>5}")
    print(f"    수시/정시 어느쪽이든 공식     {len(official_any):>5}")
    print(f"    기본이 app_standard_estimate {len(estimate):>4}")
    print(f"  합격선+공식구간표             {len(cut_and_official):>5}  "
          f"(기존 2028 기준값 {len(baseline_2028)})")
    print(f"  원문 발췌                   대학 {tstats['univs']} / "
          f"{tstats['pages_out']}쪽 / {tstats['chars']:,}자")
    if "error" not in db:
        print(f"  DB(year=2027) 행 {db['rows']} / 대학 {db['univs']}   "
              f"JSONL 조합 {db['jsonl_keys']}")
    print(f"  리포트 → {REPORT}")
    print("═" * 68)

    if not a.write or a.dry_run:
        print("  (실제로 만들려면 --write)")
        return

    n1 = C.jdump(app, APP_JSON)
    n2 = C.jdump(text_out, PUBLIC_JSON)
    print(f"  → {APP_JSON}  ({n1:,} bytes)")
    print(f"  → {PUBLIC_JSON}  ({n2:,} bytes, {n2 / 1048576:.2f} MB)")
    if n2 > 5 * 1024 * 1024:
        print("  ⚠️ 원문 파일이 5MB를 넘었다. TEXT_TOTAL_BUDGET 을 줄여라.")


if __name__ == "__main__":
    main()
