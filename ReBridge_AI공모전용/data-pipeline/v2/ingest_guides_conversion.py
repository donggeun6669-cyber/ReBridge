"""Phase C(모집요강) — 2027 모집요강에서 검정고시 비교내신 산출식을 구조화한다.

## 왜 모집요강인가
**검정고시 비교내신 산출식은 모집요강에만 있다.** 시행계획·기본사항에는 없다.
그래서 2028 시행계획에서 뽑은 out/plans_2028/conversion.jsonl 과 같은 행 구조를
유지하되, 모집요강에서만 나오는 것들을 더 담는다.

## 두 가지 표가 있고, 앱에 더 중요한 쪽은 두 번째다
  ① 등급 → 환산점수      "석차등급 1 2 3 … 9 / 환산점수 10.00 9.96 … 4.00"   → gradeTable
  ② **평균점수 구간 → 등급**  "백점만점성적 100 95이상 90이상 … / 등급 1 2 … 9" → gradeBands
     검정고시생이 가진 건 '검정고시 평균점수'다. ②가 있어야 내 등급을 알 수 있다.
     ①만 있으면 등급을 이미 아는 사람만 쓸 수 있다.

## 숫자 규칙 (v2 규칙 3 — 지어내지 않는다)
  - '1,000' 은 천 단위 쉼표다. 1 과 000 으로 쪼개면 표가 한 칸씩 밀린다(2028에서 실제로 겪음).
  - 검증(단조성·0~1000 범위·등급 수 5 또는 9)에 걸리면 값을 고치지 않고
    validation='fail' + 사유로 남긴다. 사람이 본다.
  - 표가 없고 산문만 있으면 kind='산문만'. 없는 숫자를 만들지 않는다.

## 입력 / 산출
  입력  out/text/guides_2027/*.json            (extract_guides_text.py)
  산출  out/guides_2027/conversion_2027.jsonl  (한 줄 = 한 대학 × 수시/정시)
        out/guides_2027/conversion_2027_report.md

실행:
  python3 v2/ingest_guides_conversion.py --year 2027
  python3 v2/ingest_guides_conversion.py --year 2027 --to-db
"""

import argparse
import json
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C

PHASE_KO = {"susi": "수시", "jeongsi": "정시", "tonghap": "수시+정시"}

# ── 셀·토큰 ─────────────────────────────────────────────────────────
# pdftotext -layout 은 열을 2칸 이상 공백으로 갈라 준다.
_SPLIT = re.compile(r"\s{2,}")
_NUM = r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?"
_UNIT = r"(?:점|％|%|퍼센트|등급)?"
_BOUND = r"(?:이상|이하|미만|초과)"
# ⚠️ 2026-09-03 실측. 등급행은 두 가지로 온다.
#   ① "1등급 2등급 … 9등급"        (가천대)
#   ② "석차등급  1  2  3 … 9"      (중앙대·건국대·동국대 — 이쪽이 더 흔하다)
# ②를 빼먹으면 표가 거의 안 잡힌다(빼먹었을 때 42개, 넣으니 훨씬 늘었다).
RE_GRADE_SUFFIXED = re.compile(r"^(\d)\s*등\s*급$")
RE_GRADE_BARE = re.compile(r"^(\d)$")
RE_PLAIN = re.compile(rf"^-?({_NUM})\s*{_UNIT}$")
RE_BOUND1 = re.compile(rf"^({_NUM})\s*{_UNIT}\s*({_BOUND})$")
RE_RANGE = re.compile(
    rf"^({_NUM})\s*{_UNIT}\s*({_BOUND})?\s*[~∼〜]\s*({_NUM})\s*{_UNIT}\s*({_BOUND})?$")
RE_DASH = re.compile(r"^[-–—­]$")


def cells(line):
    return [c.strip() for c in _SPLIT.split(line.strip()) if c.strip()]


def to_num(s):
    """'1,000' → 1000.0. 천 단위 쉼표를 한 수로 읽는다."""
    return float(str(s).replace(",", ""))


def grade_of(cell):
    c = re.sub(r"\s+", "", cell)
    m = RE_GRADE_SUFFIXED.match(c) or RE_GRADE_BARE.match(c)
    return int(m.group(1)) if m else None


def grade_suffixed(cell):
    return bool(RE_GRADE_SUFFIXED.match(re.sub(r"\s+", "", cell)))


def is_grade_seq(vals):
    """1,2,…,n 오름차순이면 등급행이다(값행이 아니다)."""
    gs = [grade_of(v) for v in vals]
    return all(g is not None for g in gs) and gs == list(range(1, len(gs) + 1))


def parse_band(cell):
    """구간 셀 → {'raw','lo','hi','loOp','hiOp'}. 못 읽으면 None."""
    c = re.sub(r"\s+", "", cell)
    if RE_DASH.match(c):
        return {"raw": cell, "lo": None, "hi": None, "kind": "none"}
    m = RE_RANGE.match(c)
    if m:
        a, ao, b, bo = m.group(1), m.group(2), m.group(3), m.group(4)
        lo, hi = to_num(a), to_num(b)
        if lo > hi:
            lo, hi = hi, lo
        return {"raw": cell, "lo": lo, "hi": hi, "kind": "range"}
    m = RE_BOUND1.match(c)
    if m:
        v, op = to_num(m.group(1)), m.group(2)
        if op in ("이상", "초과"):
            return {"raw": cell, "lo": v, "hi": None, "kind": op}
        return {"raw": cell, "lo": None, "hi": v, "kind": op}
    m = RE_PLAIN.match(c)
    if m:
        v = to_num(m.group(1))
        return {"raw": cell, "lo": v, "hi": v, "kind": "point"}
    return None


def is_plain_number(cell):
    c = re.sub(r"\s+", "", cell)
    return bool(RE_PLAIN.match(c)) and not RE_BOUND1.match(c)


# ── 행 성격 라벨 ────────────────────────────────────────────────────
RE_LABEL_SCORE = re.compile(
    r"환산\s*점수|반영\s*점수|등급\s*점수|배점|점수|환산|평점")
RE_LABEL_BAND_AVG = re.compile(
    r"백\s*점\s*만점|백점만점성적|평균\s*(점수|성적)|검정고시\s*(과목\s*)?(성적|점수|평균)|"
    r"환산\s*점수|성적|총점|취득\s*점수")
RE_LABEL_BAND_PCT = re.compile(
    r"석차\s*백분율|백분율|백분위|누적\s*비율|석차\s*비율|등급\s*비율")
# 출결(결석일수)·봉사활동 표도 "등급 1~9 / 환산점수" 모양이라 그대로 걸린다.
# 이건 비교내신이 아니다. 표 단위로 잘라 낸다(2026-09-03 실측: 상명대 수시 p.43).
RE_NOT_CONVERSION = re.compile(
    r"결석|출결|지각|조퇴|결과|봉사\s*활동|무단|미인정|학교폭력|감점")

# 문맥 단서
RE_CTX_GED = re.compile(r"비교\s*내신|검정고시")
RE_CTX_STUDENT = re.compile(r"학교생활기록부|학생부|석차\s*등급|이수\s*단위|교과\s*성적")
RE_SCALE9 = re.compile(r"9\s*등급")
RE_SCALE5 = re.compile(r"5\s*등급")

# 후보 페이지
RE_CAND_PAGE = re.compile(r"비교\s*내신")
RE_CAND_PAGE2 = re.compile(r"검정고시")
RE_CAND_PAGE2B = re.compile(r"환산|배점|등급|평균|반영\s*점수|산출")

def tokens(line):
    """줄 → [(시작칸, 끝칸, 글자)]. 2칸 이상 공백이 열 구분자다.

    ⚠️ 왜 위치까지 들고 다니나 (2026-09-03 실측)
      경기대 수시 p.38 은 이렇게 생겼다.
          석차등급      1     2     3     4     5     6     7     8     9
        검정고시 점수                100   96이상  90이상  85이상  80이상  75이상  75미만
      검정고시 행은 앞 두 칸이 비어 있어서 **셀이 7개**다. 개수로 맞추면 통째로 버려지고,
      억지로 맞추면 1등급 칸에 100이 들어가 완전히 틀린 표가 된다.
      열의 **가로 위치**로 맞춰야 빈 칸을 빈 칸으로 남길 수 있다.
    """
    out, pos = [], 0
    for part in re.split(r"(\s{2,})", line):
        if part == "":
            continue
        if re.fullmatch(r"\s{2,}", part):
            pos += len(part)
            continue
        lead = len(part) - len(part.lstrip())
        t = part.strip()
        if t:
            out.append((pos + lead, pos + lead + len(t), t))
        pos += len(part)
    return out


def col_edges(cols):
    """열 [(s,e)…] → 소속 판정용 경계."""
    cen = [(s + e) / 2 for s, e in cols]
    if len(cen) == 1:
        return [cen[0] - 6, cen[0] + 6]
    edges = [cen[0] - (cen[1] - cen[0]) / 2]
    edges += [(cen[i] + cen[i + 1]) / 2 for i in range(len(cen) - 1)]
    edges.append(cen[-1] + (cen[-1] - cen[-2]) / 2)
    return edges


def align(cols, toks):
    """토큰들을 열에 배정한다. (label, [열별 글자 or None]) — 못 맞추면 (None, None)."""
    n = len(cols)
    edges = col_edges(cols)
    vals = [None] * n
    label = []
    for s, e, t in toks:
        c = (s + e) / 2
        if c < edges[0]:
            label.append(t)
            continue
        if c > edges[-1]:
            continue                      # 표 오른쪽 바깥 (쪽번호 등)
        k = 0
        while k < n - 1 and c > edges[k + 1]:
            k += 1
        if vals[k] is not None:
            return None, None             # 한 열에 둘 → 정렬 실패
        vals[k] = t
    return " ".join(label), vals


BOUND_WORDS = ("이상", "이하", "미만", "초과")


def merge_bound_lines(lines, j, cols):
    """'99점 96점 …' 아래 줄에 '이상 이상 …' 이 따로 떨어진 표를 붙인다.

    실측(가천대 수시 p.87): 값줄 / 라벨줄 / 경계어줄 순서로 세 줄에 걸쳐 있다.
    """
    label, vals = align(cols, tokens(lines[j]))
    if vals is None:
        return None, None
    for k in (j + 1, j + 2):
        if k >= len(lines):
            break
        l2, v2 = align(cols, tokens(lines[k]))
        if v2 is None:
            break
        got = [x for x in v2 if x]
        if got and all(re.sub(r"\s+", "", x) in BOUND_WORDS for x in got):
            vals = [f"{a}{b}" if a and b else a for a, b in zip(vals, v2)]
            if not label and l2:
                label = l2
            elif not label and k == j + 2:
                label = " ".join(t for _, _, t in tokens(lines[j + 1]))
            break
        # '1.0~' 처럼 물결로 끝나는 줄은 다음 줄의 숫자와 한 칸이다
        #   (광주여대 정시 p.12: "평균 1.0~ 2.0~ …" / 다음 줄 "1.99 2.99 …")
        cur = [x for x in vals if x]
        if (cur and all(re.sub(r"\s+", "", x).endswith(("~", "∼")) for x in cur)
                and got and all(RE_PLAIN.match(re.sub(r"\s+", "", x)) for x in got)):
            vals = [f"{a}{b}" if a and b else a for a, b in zip(vals, v2)]
            if not label and l2:
                label = l2
            elif not label and k == j + 2:
                label = " ".join(t for _, _, t in tokens(lines[j + 1]))
            break
        if len([x for x in v2 if x]) <= 1 and k == j + 1:
            continue                      # 라벨만 있는 줄
        break
    return label, vals


def _row_kind(vals):
    """열별 글자 → ('score', 숫자들) | ('band', 파싱결과) | None"""
    got = [v for v in vals if v is not None]
    if len(got) < 4:
        return None
    if is_grade_seq(got):
        return None                       # 또 다른 등급행
    plain = [v for v in got if is_plain_number(v)]
    if len(plain) == len(got):
        nums = [to_num(RE_PLAIN.match(re.sub(r"\s+", "", v)).group(1)) for v in got]
        if len(set(nums)) < 2:
            return None
        return "score", [None if v is None else
                         to_num(RE_PLAIN.match(re.sub(r"\s+", "", v)).group(1))
                         for v in vals]
    parsed = [None if v is None else parse_band(v) for v in vals]
    ok = [p for p in parsed if p and p["kind"] != "none"]
    if len(ok) < max(3, len(got) - 2):
        return None
    if not any(p["kind"] in ("range",) + BOUND_WORDS for p in ok):
        return None
    return "band", parsed


def _collect_rows(lines, i, cols, span=10):
    """등급행(i) 주변에서 값행을 모은다."""
    scores, bands = [], []
    for j in range(max(0, i - span), min(len(lines), i + span + 1)):
        if j == i:
            continue
        label, vals = merge_bound_lines(lines, j, cols)
        if vals is None:
            continue
        kind = _row_kind(vals)
        if kind is None:
            continue
        k, payload = kind
        rec = {"label": C.squash(label or ""), "line": j,
               "raw": C.squash(lines[j]), "dist": abs(j - i)}
        if k == "score":
            rec["values"] = payload
            scores.append(rec)
        else:
            rec["cells"] = payload
            bands.append(rec)
    scores.sort(key=lambda r: r["dist"])
    bands.sort(key=lambda r: r["dist"])
    return scores, bands


def _mk_table(lines, i, page, grades, cols, header_label, scores, bands, anchor):
    used = [i] + [r["line"] for r in scores + bands]
    lo, hi = max(0, min(used)), min(len(lines), max(used) + 1)
    return {
        "page": page, "grades": grades, "headerLabel": C.squash(header_label or ""),
        "headerRaw": C.squash(lines[i]), "anchor": anchor,
        "scoreRows": scores, "bandRows": bands,
        "context": "\n".join(lines[max(0, i - 30):min(len(lines), i + 10)]),
        "tableQuote": "\n".join(lines[lo:hi]),
    }


RE_BAND_ANCHOR_LABEL = re.compile(
    r"검정고시|취득\s*성적|취득\s*점수|취득한|평균\s*(점수|성적)|백\s*점\s*만점|"
    r"학생부\s*성적|성적\s*순위|백분위")


def find_tables(text, page):
    """페이지 원문 → 표 목록.

    두 가지 앵커를 쓴다.
      ① 등급행 앵커  "석차등급 1 2 … 9" 가 있는 표 (가장 흔하다)
      ② 구간행 앵커  등급행이 없고 "검정고시(과목당) 100 95이상 … / 환산점수 98 97 …"
                     처럼 구간→점수만 있는 표 (수원대·경희대 …)
    """
    lines = text.split("\n")
    out, taken = [], set()

    # ① 등급행 앵커
    for i, ln in enumerate(lines):
        toks = tokens(ln)
        if len(toks) < 5:
            continue
        gs, cols, suffixed = [], [], True
        for s, e, t in reversed(toks):
            g = grade_of(t)
            if g is None:
                break
            if not grade_suffixed(t):
                suffixed = False
            gs.append(g)
            cols.append((s, e))
        gs.reverse()
        cols.reverse()
        # ⚠️ 2026-09-03 실측. 검정고시 구간표는 1등급부터 시작하지 않는 대학이 있다.
        #   한림대 수시 p.79  "취득성적 100~98점 … / 석차등급 3등급 4등급 … 9등급"
        #   대구한의대 정시 p.26 "학생부 성적 96~100 … / 등급 2등급 … 9등급"
        # 1등급부터라고 우기면 100~98점이 1등급이 되어 완전히 틀린 표가 된다.
        # 다만 맨숫자(1 2 3 …)는 표 번호일 수 있으므로 1부터일 때만 받는다.
        if len(gs) < 4 or gs != list(range(gs[0], gs[0] + len(gs))):
            continue
        if gs[0] != 1 and not suffixed:
            continue
        if gs[-1] > 9:
            continue
        n = len(gs)
        header_label = " ".join(t for _, _, t in toks[:len(toks) - n])
        if not (suffixed
                or re.search(r"등급|석차|구분", re.sub(r"\s+", "", header_label))
                or n >= 9):
            continue

        scores, bands = _collect_rows(lines, i, cols)
        if not scores and not bands:
            continue
        row_labels = " ".join([header_label] + [r["label"] for r in scores + bands])
        near = " ".join(lines[max(0, i - 2):i + 1])
        if RE_NOT_CONVERSION.search(row_labels) or RE_NOT_CONVERSION.search(near):
            continue
        for r in scores + bands:
            taken.add(r["line"])
        taken.add(i)
        out.append(_mk_table(lines, i, page, gs, cols, header_label,
                             scores, bands, "grade"))

    # ② 구간행 앵커 — 등급행이 없는 '구간 → 환산점수' 표
    for i, ln in enumerate(lines):
        if i in taken:
            continue
        toks = tokens(ln)
        if len(toks) < 5:
            continue
        # 라벨을 뺀 나머지가 구간이어야 한다
        for cut in range(1, min(4, len(toks))):
            cand = toks[cut:]
            if len(cand) < 4:
                break
            label = " ".join(t for _, _, t in toks[:cut])
            if not RE_BAND_ANCHOR_LABEL.search(re.sub(r"\s+", "", label)):
                continue
            parsed = [parse_band(t) for _, _, t in cand]
            ok = [p for p in parsed if p and p["kind"] != "none"]
            if len(ok) < len(cand) - 1:
                continue
            if sum(1 for p in ok if p["kind"] in ("range",) + BOUND_WORDS) < 2:
                continue
            cols = [(s, e) for s, e, _ in cand]
            # 아래(위) 줄에서 같은 열 개수의 숫자행을 찾는다
            score = None
            for j in list(range(i + 1, min(len(lines), i + 6))) + \
                     list(range(max(0, i - 4), i)):
                if j in taken:
                    continue
                l2, v2 = merge_bound_lines(lines, j, cols)
                if v2 is None:
                    continue
                k = _row_kind(v2)
                if k and k[0] == "score":
                    score = {"label": C.squash(l2 or ""), "line": j,
                             "values": k[1], "raw": C.squash(lines[j]), "dist": abs(j - i)}
                    break
            if score is None:
                continue
            near = " ".join(lines[max(0, i - 2):i + 1])
            if RE_NOT_CONVERSION.search(label) or RE_NOT_CONVERSION.search(near):
                continue
            band_rec = {"label": C.squash(label), "line": i,
                        "cells": parsed, "raw": C.squash(ln), "dist": 0}
            taken.add(i)
            taken.add(score["line"])
            out.append(_mk_table(lines, i, page, list(range(1, len(cand) + 1)),
                                 cols, label, [score], [band_rec], "band"))
            break
    return out
def classify(tbl):
    """표 하나 → appliesTo / gradeScale / 근거."""
    ctx = C.squash(tbl["context"])
    head = tbl["headerLabel"] + " " + " ".join(
        r["label"] for r in tbl["scoreRows"] + tbl["bandRows"])

    if RE_CTX_GED.search(ctx) or RE_CTX_GED.search(head):
        applies = "검정고시전용"
    elif RE_CTX_STUDENT.search(ctx) or RE_CTX_STUDENT.search(head):
        applies = "재학생준용"
    else:
        applies = "불명"

    n = max(tbl["grades"])
    if n >= 6:
        scale, by = "9", f"표모양:{n}등급"
    elif RE_SCALE9.search(ctx):
        scale, by = "9", "원문:9등급"
    elif RE_SCALE5.search(ctx) and n == 5:
        scale, by = "5", "원문:5등급"
    else:
        scale, by = None, "단서없음"       # 5칸표는 9등급표의 1~5행일 수 있다 → NULL
    return applies, scale, by


def pick_rows(tbl):
    """점수행·구간행 중 검정고시에 쓸 것을 고른다."""
    score = None
    for r in tbl["scoreRows"]:
        if RE_LABEL_SCORE.search(r["label"]):
            score = r
            break
    if score is None and tbl["scoreRows"]:
        score = tbl["scoreRows"][0]

    def is_pct(r):
        if RE_LABEL_BAND_PCT.search(r["label"]):
            return True
        # 라벨이 비어 있어도 셀에 %가 있으면 석차백분율표다(연세대(미래) 수시 p.57 실측)
        return sum(1 for c in r["cells"] if c and "%" in c.get("raw", "")) >= 2

    band_avg = band_pct = None
    for r in tbl["bandRows"]:
        if is_pct(r):
            band_pct = band_pct or r
        elif band_avg is None and (RE_LABEL_BAND_AVG.search(r["label"])
                                   or not r["label"]):
            band_avg = r
    if band_avg is None:
        for r in tbl["bandRows"]:
            if r is not band_pct and not is_pct(r):
                band_avg = r
                break
    return score, band_avg, band_pct


def validate(grades, scores, bands, anchor="grade"):
    """검증. 실패해도 값을 고치지 않는다 — 사유만 남긴다."""
    fails = []
    n = len(grades)
    if anchor == "grade" and grades and grades[0] == 1 and n not in (5, 9):
        fails.append(f"등급수 비표준({n})")
    if scores:
        sv = [v for v in scores if v is not None]
        if any(v < 0 or v > 1000 for v in sv):
            fails.append("점수 0~1000 범위 이탈")
        if not all(a >= b for a, b in zip(sv, sv[1:])):
            fails.append("점수 단조성 위반(등급이 낮아질수록 점수가 내려가야 함)")
    if bands:
        los = [b["lo"] for b in bands if b and b.get("lo") is not None]
        if len(los) >= 3 and not all(a >= b for a, b in zip(los, los[1:])):
            fails.append("구간 단조성 위반")
        if any(b and b["lo"] is not None and (b["lo"] < 0 or b["lo"] > 1000)
               for b in bands):
            fails.append("구간 0~1000 범위 이탈")
        # 표 가운데가 뻥 뚫려 있으면 열 정렬이 어긋난 것이다(우석대 수시 p.75 실측).
        idxs = [k for k, b in enumerate(bands) if b and b.get("raw")]
        if idxs:
            holes = (idxs[-1] - idxs[0] + 1) - len(idxs)
            if holes >= 2:
                fails.append(f"구간 정렬 의심(표 중간 빈칸 {holes}개)")
    return fails


# ── 산문 산식 ───────────────────────────────────────────────────────
RE_SENT = re.compile(r"[^\n。]{0,220}(비교\s*내신|검정고시)[^\n]{0,260}")


def prose_formulas(pages):
    """표가 없을 때 쓸 산식 문장. 원문 그대로 자르지 않고 줄 단위로 뽑는다."""
    out = []
    for p in pages:
        for ln in p["text"].split("\n"):
            s = C.squash(ln)
            if len(s) < 10:
                continue
            if not RE_CTX_GED.search(s):
                continue
            if not re.search(r"환산|산출|반영|적용|대체|평균|등급|점수", s):
                continue
            out.append({"page": p["page"], "text": s})
    return out[:40]


# ── main ────────────────────────────────────────────────────────────
def run(year=2027, to_db=False, limit=None):
    text_dir = C.OUT / "text" / f"guides_{year}"
    man = C.jload(text_dir / "_manifest.json")
    out_dir = C.OUT / f"guides_{year}"
    out_dir.mkdir(parents=True, exist_ok=True)

    items = man["items"]
    if limit:
        items = items[:limit]

    rows, fails = [], []
    stat = Counter()

    for it in items:
        doc = json.load(open(it["out"], encoding="utf-8"))
        src_file = f"{Path(it['file']).parent.name}/{Path(it['file']).name}"
        cand = [p for p in doc["pages"]
                if RE_CAND_PAGE.search(p["text"])
                or (RE_CAND_PAGE2.search(p["text"]) and RE_CAND_PAGE2B.search(p["text"]))]
        stat["요강 파일"] += 1
        if not cand:
            stat["후보 페이지 0"] += 1
            continue
        stat["후보 페이지 있음"] += 1

        tables = []
        for p in cand:
            tables.extend(find_tables(p["text"], p["page"]))

        base = {
            "univId": it["univId"], "univ": it["univ"], "year": year,
            "phase": PHASE_KO[it["phase"]], "campus": it.get("campus"),
            "source_file": src_file, "sourceUrl": it.get("sourceUrl"),
            "sha256": it.get("sha256"),
            "candPages": [p["page"] for p in cand][:20],
        }

        # 표를 검정고시 관련도 순으로 정렬한다.
        scored = []
        for t in tables:
            applies, scale, by = classify(t)
            score, band_avg, band_pct = pick_rows(t)
            rank = (0 if applies == "검정고시전용" else 1 if applies == "재학생준용" else 2,
                    0 if band_avg else 1,          # 구간표가 앱에서 가장 중요
                    0 if score else 1,
                    -len(t["grades"]))
            scored.append((rank, t, applies, scale, by, score, band_avg, band_pct))
        scored.sort(key=lambda x: x[0])

        ged_tables = [s for s in scored if s[2] == "검정고시전용"]
        use = (ged_tables or scored or [None])[0]

        if use is None:
            pf = prose_formulas(cand)
            row = {**base, "kind": "산문만" if pf else "근거없음",
                   "gradeTable": None, "gradeBands": None,
                   "formulas": pf,
                   "quote": pf[0]["text"] if pf else None,
                   "page": pf[0]["page"] if pf else None,
                   "gradeScale": None, "appliesTo": "불명", "maxScore": None}
            stat[row["kind"]] += 1
            rows.append(row)
            continue

        _, t, applies, scale, by, score, band_avg, band_pct = use

        grade_table = grade_bands = pct_bands = score_bands = None
        if t.get("anchor") == "band":
            # 등급이 없는 '구간 → 환산점수' 표. 등급 번호를 붙이면 지어내는 것이 된다.
            if band_avg and score:
                score_bands = [
                    {"band": (b or {}).get("raw"), "lo": (b or {}).get("lo"),
                     "hi": (b or {}).get("hi"), "boundKind": (b or {}).get("kind"),
                     "score": v}
                    for b, v in zip(band_avg["cells"], score["values"])]
        else:
            if score:
                grade_table = [{"grade": g, "score": v}
                               for g, v in zip(t["grades"], score["values"])]
            if band_avg:
                grade_bands = [{"grade": g, **(b or {"raw": None})}
                               for g, b in zip(t["grades"], band_avg["cells"])]
            if band_pct:
                pct_bands = [{"grade": g, **(b or {"raw": None})}
                             for g, b in zip(t["grades"], band_pct["cells"])]

        vfails = validate(t["grades"],
                          score["values"] if score else None,
                          band_avg["cells"] if band_avg else None,
                          t.get("anchor", "grade"))

        kind = ("구간→점수표" if score_bands
                else "구간표+환산표" if grade_bands and grade_table
                else "구간표" if grade_bands
                else "환산표" if grade_table else "미상")

        row = {
            **base,
            "kind": kind,
            "type": "grade_table",
            "page": t["page"],
            "gradeScale": scale,
            "gradeScaleBy": by,
            "appliesTo": applies,
            "anchor": t.get("anchor"),
            "gradeTable": grade_table,
            "gradeBands": grade_bands,            # ★ 앱에서 가장 중요한 필드
            "scoreBands": score_bands,            # ★ 등급 없이 구간→점수만 있는 표
            "percentileBands": pct_bands,
            "maxScore": (max(v for v in score["values"] if v is not None)
                         if score and any(v is not None for v in score["values"])
                         else None),
            "minScore": (min(v for v in score["values"] if v is not None)
                         if score and any(v is not None for v in score["values"])
                         else None),
            "scoreLabel": score["label"] if score else None,
            "bandLabel": band_avg["label"] if band_avg else None,
            "tableLabel": t["headerLabel"],
            "quote": t["tableQuote"],             # 원문 그대로
            "contextQuote": C.squash(t["context"])[:1200],
            "formulas": prose_formulas(cand)[:12],
            "validation": "fail" if vfails else "pass",
            "validationFails": vfails,
            "otherTables": [
                {"page": s[1]["page"], "appliesTo": s[2], "grades": len(s[1]["grades"]),
                 "header": s[1]["headerLabel"],
                 "hasBands": bool(s[6]), "hasScores": bool(s[5]),
                 "quote": s[1]["tableQuote"][:900]}
                for s in scored[1:8]],
        }
        stat[kind] += 1
        stat[f"적용:{applies}"] += 1
        if vfails:
            stat["검증 실패"] += 1
            for f in vfails:
                fails.append({"univId": row["univId"], "univ": row["univ"],
                              "phase": row["phase"], "page": row["page"],
                              "reason": f, "source_file": src_file})
        if grade_bands:
            stat["gradeBands 있음"] += 1
        if score_bands:
            stat["scoreBands 있음"] += 1
        rows.append(row)

    out_jsonl = out_dir / f"conversion_{year}.jsonl"
    with open(out_jsonl, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    # ── 리포트 ──
    n_univ = len({r["univId"] for r in rows})
    n_univ_band = len({r["univId"] for r in rows if r.get("gradeBands")})
    n_univ_sband = len({r["univId"] for r in rows if r.get("scoreBands")})
    n_univ_tbl = len({r["univId"] for r in rows if r.get("gradeTable")})
    n_univ_prose = len({r["univId"] for r in rows if r["kind"] == "산문만"})
    fail_by_reason = Counter(f["reason"] for f in fails)

    md = [f"# 2027 모집요강 비교내신 구조화 결과 ({date.today().isoformat()})", "",
          f"- 요강 파일(대학×수시/정시) 처리: **{stat['요강 파일']}개**",
          f"- 후보 페이지가 있는 파일: **{stat['후보 페이지 있음']}개** "
          f"(없음 {stat['후보 페이지 0']}개)",
          f"- 산출 행: **{len(rows)}행** / 대학 **{n_univ}개**",
          f"- gradeBands(평균점수 구간→등급) 있는 대학: **{n_univ_band}개**",
          f"- scoreBands(점수 구간→환산점수, 등급 없음) 있는 대학: **{n_univ_sband}개**",
          f"- gradeTable(등급→환산점수) 있는 대학: **{n_univ_tbl}개**",
          f"- 산문만: **{n_univ_prose}개 대학**", "",
          "## 표 종류", ""]
    for k in ("구간표+환산표", "구간표", "구간→점수표", "환산표", "산문만", "근거없음", "미상"):
        if stat[k]:
            md.append(f"- {k}: {stat[k]}행")
    md += ["", "## 적용대상", ""]
    for k in ("검정고시전용", "재학생준용", "불명"):
        md.append(f"- {k}: {stat['적용:'+k]}행")
    md += ["", "## 검증 실패 사유별", ""]
    if fail_by_reason:
        for k, v in fail_by_reason.most_common():
            md.append(f"- {k}: {v}건")
    else:
        md.append("- 없음")
    md += ["", "## 검증 실패 목록", "",
           "| 대학 | 구분 | 쪽 | 사유 | 출처 |", "|---|---|---|---|---|"]
    for f in fails[:200]:
        md.append(f"| {f['univ']} | {f['phase']} | {f['page']} | {f['reason']} "
                  f"| {f['source_file']} |")
    (out_dir / f"conversion_{year}_report.md").write_text(
        "\n".join(md) + "\n", encoding="utf-8")

    print("═" * 62)
    for k, v in stat.most_common():
        print(f"  {k:22} {v:>5}")
    print("─" * 62)
    print(f"  행 {len(rows)} / 대학 {n_univ}")
    print(f"  gradeBands 있는 대학 {n_univ_band} · scoreBands {n_univ_sband} "
          f"· gradeTable 있는 대학 {n_univ_tbl}")
    print(f"  검증 실패 {len(fails)}건: {dict(fail_by_reason)}")
    print("═" * 62)
    print(f"  → {out_jsonl}")

    if to_db:
        n = promote(year, rows)
        print(f"  L1 적재: {n}행 (year={year})")
    return rows


# ── L1 적재 ─────────────────────────────────────────────────────────
EXTRA_COLS = [
    ("grade_bands_json", "TEXT"),      # ★ 평균점수 구간 → 등급
    ("score_bands_json", "TEXT"),      # 등급 없이 구간→환산점수만 있는 표
    ("percentile_bands_json", "TEXT"),
    ("formula_text", "TEXT"),          # 산식이 문장이면 그 원문
    ("quote", "TEXT"),                 # 표 원문 그대로
    ("source_file", "TEXT"),           # {대학명}/susi.pdf
    ("table_label", "TEXT"),
    ("validation", "TEXT"),            # pass | fail
    ("validation_note", "TEXT"),
    ("kind", "TEXT"),                  # 구간표 | 환산표 | 구간표+환산표 | 산문만
]


def ensure_columns(con):
    have = {r["name"] for r in con.execute("PRAGMA table_info(ged_conversion)")}
    added = []
    for name, typ in EXTRA_COLS:
        if name not in have:
            con.execute(f"ALTER TABLE ged_conversion ADD COLUMN {name} {typ}")
            added.append(name)
    # 2027은 한 대학에 수시·정시 두 행이 필요하다.
    # 기존 ux_conversion(univ_id, year, COALESCE(admission_id,-1)) 로는 둘째 행이 막힌다.
    # 컬럼은 그대로 두고 유니크 축에 phase 만 더한다.
    idx = {r[1] for r in con.execute("PRAGMA index_list(ged_conversion)")}
    if "ux_conversion_v2" not in idx:
        con.execute("DROP INDEX IF EXISTS ux_conversion")
        con.execute("CREATE UNIQUE INDEX IF NOT EXISTS ux_conversion_v2 "
                    "ON ged_conversion (univ_id, year, COALESCE(admission_id,-1), "
                    "COALESCE(phase,''))")
        added.append("index:ux_conversion_v2")
    return added


def _source_id(con, year, title, path, sha, url):
    row = con.execute("SELECT source_id FROM source_file WHERE kind='guideline' "
                      "AND year=? AND title=?", (year, C.nfc(title))).fetchone()
    if row:
        return row["source_id"]
    # ⚠️ source_file 은 UNIQUE(kind, sha256) 이다.
    #    캠퍼스별 PDF가 내용이 같은 대학이 있어(가톨릭대·강원대 …) 같은 지문이 두 번 온다.
    #    먼저 지문으로 찾아서 재사용한다 — 원본 대장은 append만 한다(v2 규칙 2).
    if sha:
        row = con.execute("SELECT source_id FROM source_file "
                          "WHERE kind='guideline' AND sha256=?", (sha,)).fetchone()
        if row:
            return row["source_id"]
    return con.execute(
        """INSERT INTO source_file (kind,year,title,path,sha256,source_url,
                                    publisher,retrieved_at,note)
           VALUES ('guideline',?,?,?,?,?,?,?,?)""",
        (year, C.nfc(title), path, sha, url, "개별 대학 입학처",
         date.today().isoformat(), "2027 모집요강")).lastrowid


def promote(year, rows):
    con = C.connect()
    con.execute("PRAGMA busy_timeout=30000")        # 동시 작업자가 있다
    ensure_columns(con)
    known = {r["univ_id"] for r in con.execute("SELECT univ_id FROM university")}
    n = skipped = 0
    for r in rows:
        if r["univId"] not in known:
            skipped += 1
            continue
        sid = _source_id(con, year, r["source_file"], None, r.get("sha256"),
                         r.get("sourceUrl"))
        table_json = json.dumps({"type": r.get("type"),
                                 "gradeTable": r.get("gradeTable"),
                                 "maxScore": r.get("maxScore"),
                                 "minScore": r.get("minScore")},
                                ensure_ascii=False) if r.get("gradeTable") else None
        bands_json = (json.dumps(r["gradeBands"], ensure_ascii=False)
                      if r.get("gradeBands") else None)
        pct_json = (json.dumps(r["percentileBands"], ensure_ascii=False)
                    if r.get("percentileBands") else None)
        sband_json = (json.dumps(r["scoreBands"], ensure_ascii=False)
                      if r.get("scoreBands") else None)
        formula = (json.dumps(r.get("formulas"), ensure_ascii=False)
                   if r.get("formulas") else None)
        conf = ("high" if (r.get("gradeBands") or r.get("scoreBands"))
                and r.get("validation") == "pass"
                else "low" if r.get("validation") == "fail" or r["kind"] in
                ("산문만", "근거없음") else "mid")
        con.execute(
            """INSERT INTO ged_conversion
               (univ_id,year,admission_id,raw_text,raw_type,table_json,table_type,
                grade_scale,applies_to,phase,max_score,min_score,source_id,page,
                confidence,grade_bands_json,score_bands_json,percentile_bands_json,
                formula_text,quote,source_file,table_label,validation,
                validation_note,kind)
               VALUES (?,?,NULL,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT (univ_id, year, COALESCE(admission_id,-1),
                            COALESCE(phase,'')) DO UPDATE SET
                 raw_type=excluded.raw_type, table_json=excluded.table_json,
                 table_type=excluded.table_type, grade_scale=excluded.grade_scale,
                 applies_to=excluded.applies_to, max_score=excluded.max_score,
                 min_score=excluded.min_score, source_id=excluded.source_id,
                 page=excluded.page, confidence=excluded.confidence,
                 grade_bands_json=excluded.grade_bands_json,
                 score_bands_json=excluded.score_bands_json,
                 percentile_bands_json=excluded.percentile_bands_json,
                 formula_text=excluded.formula_text, quote=excluded.quote,
                 source_file=excluded.source_file, table_label=excluded.table_label,
                 validation=excluded.validation,
                 validation_note=excluded.validation_note, kind=excluded.kind""",
            (r["univId"], year,
             "numeric_table" if table_json else "comparative_prose",
             table_json, r.get("type"), r.get("gradeScale"), r.get("appliesTo"),
             r.get("phase"), r.get("maxScore"), r.get("minScore"), sid, r.get("page"),
             conf, bands_json, sband_json, pct_json, formula, r.get("quote"),
             r["source_file"],
             r.get("tableLabel"), r.get("validation"),
             "; ".join(r.get("validationFails") or []) or None, r.get("kind")))
        n += 1
    con.execute(
        "INSERT INTO ingest_log (ran_at,script,target,rows_in,rows_out,note) "
        "VALUES (?,?,?,?,?,?)",
        (date.today().isoformat(), "ingest_guides_conversion.py",
         f"{year} 모집요강 비교내신", len(rows), n,
         f"대학마스터에 없어 건너뜀 {skipped}"))
    con.commit()
    if skipped:
        print(f"  ⚠️ 대학 마스터에 없어 건너뜀 {skipped}행")
    return n


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2027)
    ap.add_argument("--to-db", action="store_true")
    ap.add_argument("--limit", type=int)
    a = ap.parse_args()
    run(a.year, a.to_db, a.limit)
