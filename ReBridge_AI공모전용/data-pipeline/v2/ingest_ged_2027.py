#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""2027학년도 「검정고시 출신자 지원 가능 전형」(대교협 5권역) 전용 파서.

## 왜 이 파일이 따로 있나
`ingest_plans.py` 는 대학이 각자 만든 **시행계획 PDF**를 읽는다. 대학마다 판이 달라
규칙만으로는 전형 구조를 못 뽑는다. 반면 이 5권역 PDF는 대교협이 하나의 표로 만든
자료라 6열이 전부 고정이다. 그래서 전형 축을 그대로 읽을 수 있다.

    지역 | 대학 | 전형명 | 공통 지원자격 | 세부 지원자격 | 기타(추가사항)

앱에는 2027학년도 전형이 0행인데, 2026-09 현재 원서를 쓰는 학년도가 2027이다.
이 자료가 그 구멍을 메운다.

## 이 자료의 성격 — 수록된 것 자체가 "지원 가능"이다
제목이 「검정고시 출신자 **지원 가능** 전형」이다. 즉 표에 실렸다 = 검정고시생이
지원할 수 있다. 그래서 기본값은 `가능` 이고, 세부 지원자격에 검정고시를 제한하는
문구가 있을 때만 `조건부` 로 낮추고 **그 문구를 인용으로 남긴다.** 추정하지 않는다.

## 원문은 자르지 않는다
공통·세부·기타 세 칸의 원문을 그대로 보존한다(앱의 "원문 보기"가 목표).
DB에는 `admission_requirement` 에 넣고, 앱에는 `ged_eligible_2027_text.json` 으로 뺀다.

## 추정한 것과 읽은 것의 구분
읽은 것 : 지역·대학·전형명·세 칸의 원문·페이지
추정한 것: 전형유형(전형명에서), 수시/정시(대교협 표준 전형유형 분류에서)
          → 추정한 값에는 `phase_basis` / confidence 를 남긴다. 못 가르면 '미상'.

실행:
    python3 v2/ingest_ged_2027.py --extract          # PDF → rows.jsonl (약 3분)
    python3 v2/ingest_ged_2027.py --build            # 정규화 + 리포트만
    python3 v2/ingest_ged_2027.py --build --to-db    # L1(rebridge.db) 적재까지
    python3 v2/ingest_ged_2027.py --export           # 앱용 JSON (v2/out/ged_2027/)
    python3 v2/ingest_ged_2027.py --export --write   # 앱 src/data/ 에 설치
"""

import argparse
import json
import re
import sqlite3
import time
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import common as C

YEAR = 2027
SRC_DIR = C.PDF_ROOT / "ged_eligible_2027"
DEADLINE_PDF = (C.PDF_ROOT / "kcue_2027" /
                "2027학년도 수시모집 전형 일정 (접수 마감).pdf")
OUTDIR = C.OUT / "ged_2027"
ROWS_JSONL = OUTDIR / "rows.jsonl"
DEADLINE_JSON = OUTDIR / "deadlines.json"

# 권역 — 파일명에서 뽑는다
RE_ZONE = re.compile(r"지원가능전형_([가-힣]+권)_")

HEADER = ("지역", "대학", "전형명")


# ════════════════════════════════════════════════════════════════════
# ① PDF → 행 (원문 그대로)
# ════════════════════════════════════════════════════════════════════
def cell(c):
    """셀 원문. 줄바꿈은 살리고 앞뒤 공백만 턴다.

    ⚠️ `\\n` 을 지우면 '가. …' '나. …' 항목 구분이 사라진다. 살린다.
    """
    return C.nfc(c or "").strip()


def extract_rows(force=False):
    """5권역 PDF의 표를 통째로 뽑아 JSONL로 저장한다. 6열을 다 보존한다."""
    if ROWS_JSONL.exists() and not force:
        print(f"  캐시 사용: {ROWS_JSONL} (다시 뽑으려면 --force)")
        return read_rows()

    import pdfplumber
    OUTDIR.mkdir(parents=True, exist_ok=True)
    rows, stat = [], {}
    pdfs = sorted(p for p in SRC_DIR.glob("*.pdf"))
    if not pdfs:
        raise SystemExit(f"PDF가 없습니다: {SRC_DIR}")

    for path in pdfs:
        fn = C.nfc(path.name)
        zone = (RE_ZONE.search(fn).group(1) if RE_ZONE.search(fn) else "미상")
        t0, n_before = time.time(), len(rows)
        pages_ok = pages_empty = 0
        merged = 0
        with pdfplumber.open(path) as pdf:
            npages = len(pdf.pages)
            for pno, page in enumerate(pdf.pages, 1):
                try:
                    tables = page.extract_tables()
                except Exception:
                    tables = []
                got = 0
                for tb in tables:
                    for r in tb:
                        cs = [cell(c) for c in r]
                        if len(cs) < 6:
                            cs = cs + [""] * (6 - len(cs))
                        if cs[:3] == list(HEADER):
                            continue                      # 매 쪽 반복되는 머리글
                        if not any(cs[:6]):
                            continue
                        # 대학·전형명이 비어 있으면 앞 행이 쪽을 넘어 이어진 것으로 본다.
                        if not cs[1] and not cs[2] and rows:
                            prev = rows[-1]
                            for k, i in (("common", 3), ("detail", 4), ("extra", 5)):
                                if cs[i]:
                                    prev[k] = (prev[k] + "\n" + cs[i]).strip()
                            merged += 1
                            got += 1
                            continue
                        if not cs[1] or not cs[2]:
                            continue                      # 대학/전형명 없는 잔행
                        rows.append({
                            "file": fn, "zone": zone, "page": pno,
                            "region": cs[0], "univ": cs[1], "admission": cs[2],
                            "common": cs[3], "detail": cs[4], "extra": cs[5],
                        })
                        got += 1
                pages_ok += 1 if got else 0
                pages_empty += 0 if got else 1
        stat[fn] = {"zone": zone, "pages": npages, "pagesWithRows": pages_ok,
                    "pagesEmpty": pages_empty, "rows": len(rows) - n_before,
                    "mergedContinuations": merged}
        print(f"  {zone:5s} {npages:3d}쪽 → {len(rows)-n_before:5d}행 "
              f"(행 없는 쪽 {pages_empty}, 이어붙인 행 {merged}) "
              f"{time.time()-t0:.0f}s")

    with open(ROWS_JSONL, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    (OUTDIR / "extract_stat.json").write_text(
        json.dumps(stat, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  총 {len(rows)}행 → {ROWS_JSONL}")
    return rows


def read_rows():
    with open(ROWS_JSONL, encoding="utf-8") as f:
        return [json.loads(l) for l in f]


# ════════════════════════════════════════════════════════════════════
# ② 전형유형 / 수시·정시
# ════════════════════════════════════════════════════════════════════
# 전형명은 대개 '학생부교과(일반전형)' 처럼 유형이 앞에 붙어 있다.
# 아래 순서대로 먼저 걸리는 것을 택한다(교과·종합을 논술보다 앞에 둔다).
TYPE_RULES = [
    ("학생부교과", re.compile(r"학생부\s*위주\s*\(?\s*교과|학생부\s*\(?\s*교과|교과\s*위주|학생부교과")),
    ("학생부종합", re.compile(r"학생부\s*위주\s*\(?\s*종합|학생부\s*\(?\s*종합|종합\s*위주|학생부종합")),
    ("논술",       re.compile(r"논술")),
    ("수능위주",   re.compile(r"수능")),
    ("실기",       re.compile(r"실기|실적|특기자")),
]

# 대교협 표준 전형유형 분류상 유형 자체가 모집시기를 가른다.
#   수시 : 학생부교과 · 학생부종합 · 논술위주 · 실기/실적위주
#   정시 : 수능위주 · 실기/실적위주
# → 실기/실적은 양쪽에 다 있으므로 유형만으로는 가를 수 없다. '미상'으로 둔다.
PHASE_BY_TYPE = {
    "학생부교과": "수시", "학생부종합": "수시", "논술": "수시",
    "수능위주": "정시", "실기": None,
}
# 전형명에 모집시기가 직접 적혀 있으면 그쪽이 우선한다(추정보다 원문이 세다).
RE_PHASE_TEXT = re.compile(r"(수시|정시)")
# 모집군(가군·나군·다군)은 정시에만 있는 개념이다. '국가군' 같은 오탐을 막으려고
# 앞이 한글이 아닐 때만 본다.
RE_GUN = re.compile(r"(?:^|[^가-힣])([가나다])\s*군")

UNKNOWN = "미상"     # NULL을 UNIQUE 제약이 못 잡으므로 자리표시 값을 쓴다

# 정원외 특별전형 — 검정고시생 대부분과 무관하다. 전형명에서 그대로 읽는다.
RE_QUOTA_OUT = re.compile(r"재외국민|외국인|북한이탈주민|위탁생|귀화")


def norm_type(name):
    n = C.squash(name)
    for label, rx in TYPE_RULES:
        if rx.search(n):
            return label
    return None


def norm_phase(name, atype):
    """(phase, 근거). 원문에 적혀 있으면 'text', 유형에서 추정하면 'type'."""
    n = C.squash(name)
    m = RE_PHASE_TEXT.search(n)
    if m:
        return m.group(1), "text"
    if RE_GUN.search(n):
        return "정시", "text"        # 모집군 표기 = 정시
    p = PHASE_BY_TYPE.get(atype)
    return (p, "type") if p else (None, None)


def name_key(name):
    """전형명 매칭 키 — 공백·괄호기호·로마숫자 표기 흔들림만 흡수한다."""
    s = C.nfc(name).replace("\n", "")
    s = re.sub(r"[\s·・.,'\"’”_\-\[\]]", "", s)
    return s


# ════════════════════════════════════════════════════════════════════
# ③ 검정고시 제한 문구
# ════════════════════════════════════════════════════════════════════
# 이 자료는 '지원 가능 전형' 목록이므로 수록 = 가능이 기본이다.
# 아래 문구가 보일 때만 '조건부'로 낮추고 인용을 남긴다. 추정하지 않는다.
#
# 세 번째 값 need_ged 는 "이 문구가 검정고시 이야기일 때만 인정한다"는 뜻이다.
# 없이 돌리면 '외국고교 이수자는 국내고교 3학기 이상…' 같은, 검정고시와 무관한
# 문장까지 조건부로 끌어온다(2026-09-03 실측 3건 오탐).
RE_GED = re.compile(r"검정고시")
GED_LIMIT_RULES = [
    ("검정고시 제외/불가",
     re.compile(r"검정고시.{0,40}?(제외|불가|지원할\s*수\s*없|인정하지\s*않|"
                r"해당\s*(사항\s*)?없|지원\s*자격\s*없)"), False),
    ("검정고시 별도 조건",
     re.compile(r"검정고시.{0,40}?(에\s*한(하여|함)|만\s*지원|별도(의)?\s*(기준|서류|평가)|"
                r"제한|산출\s*불가|성적\s*산출이\s*불가)"), False),
    ("학생부·석차등급 요구",
     re.compile(r"(학교생활기록부|학생부).{0,30}(없거나|없는|미보유|산출할\s*수\s*없|"
                r"산출\s*불가).{0,40}?(지원\s*불가|지원\s*자격\s*없|지원할\s*수\s*없)"), True),
    ("학생부 학기수 요구",
     re.compile(r"(학교생활기록부|학생부|교과\s*성적)[^.]{0,30}?\d\s*(개\s*)?학기\s*이상"), True),
    ("졸업(예정)자 한정",
     re.compile(r"(고등학교|고교)\s*졸업\s*예정자\s*(에\s*한(하여|함)|만\s*지원|로\s*한정)"),
     True),
    ("국내 정규 고교 한정",
     re.compile(r"국내\s*(정규)?\s*(고등학교|고교).{0,12}(졸업|이수).{0,12}"
                r"(에\s*한(하여|함)|만\s*지원|로\s*한정)"), True),
    ("학생부 보유 요구",
     re.compile(r"(학교생활기록부|학생부).{0,20}(보유(한|자)|있는\s*(자|사람)).{0,12}"
                r"(에\s*한(하여|함)|만\s*지원)"), True),
]

# need_ged 규칙에서 '검정고시'가 이 거리 안에 있어야 같은 이야기로 본다.
GED_CTX = 150


def judge_ged(texts):
    """('가능'|'조건부', 규칙명, 인용). 인용은 앞뒤 문맥을 붙여 사람이 검증할 수 있게."""
    for blob in texts:
        if not blob:
            continue
        flat = C.squash(blob)
        for label, rx, need_ged in GED_LIMIT_RULES:
            for m in rx.finditer(flat):
                if need_ged and not RE_GED.search(
                        flat[max(0, m.start() - GED_CTX): m.end() + GED_CTX]):
                    continue
                s = max(0, m.start() - 60)
                return "조건부", label, flat[s:m.end() + 80].strip()
    return "가능", None, None


# ════════════════════════════════════════════════════════════════════
# ④ 수시 접수마감 일정
# ════════════════════════════════════════════════════════════════════
# 2027학년도 수시 원서접수는 2026년 9월이다(학년도 −1년).
DEADLINE_CAL_YEAR = YEAR - 1
RE_DATE = re.compile(r"(\d{1,2})\s*\.\s*(\d{1,2})")
RE_TIME = re.compile(r"(\d{1,2})\s*:\s*(\d{2})")


def extract_deadlines(force=False):
    """접수마감 PDF → [{date,time,univs}]  (원문 그대로. 매칭은 뒤에서)

    이 표는 '대학' 칸이 pdfplumber 셀로 안 잡힌다. '시각' 칸의 y 범위를 그 행의
    띠로 삼고 오른쪽 영역을 잘라 읽는다(inventory/extract_cache.py 와 같은 방식).
    """
    if DEADLINE_JSON.exists() and not force:
        return json.loads(DEADLINE_JSON.read_text(encoding="utf-8"))
    import pdfplumber
    OUTDIR.mkdir(parents=True, exist_ok=True)
    rows = []
    with pdfplumber.open(DEADLINE_PDF) as pdf:
        for pg in pdf.pages:
            for tb in pg.find_tables():
                hdr = [c for c in tb.rows[0].cells if c]
                if len(hdr) < 2:
                    continue
                x_univ, x_right, y_bottom = hdr[-1][0], tb.bbox[2], tb.bbox[3]

                def ctext(c):
                    if not c:
                        return ""
                    return (pg.crop((c[0] + .4, c[1] + .4, c[2] - .4, c[3] - .4))
                            .extract_text() or "").strip()

                body = [r for r in tb.rows[2:] if len(r.cells) > 2 and r.cells[2]]
                for i, r in enumerate(body):
                    top = r.cells[2][1]
                    bot = body[i + 1].cells[2][1] if i + 1 < len(body) else y_bottom
                    univ = (pg.crop((x_univ + .4, top + .4, x_right - .4, bot - .4))
                            .extract_text(x_tolerance=1.2) or "").replace("\n", "")
                    rows.append({"region": ctext(r.cells[0]), "date": ctext(r.cells[1]),
                                 "time": ctext(r.cells[2]), "univs": C.nfc(univ)})
    DEADLINE_JSON.write_text(json.dumps(rows, ensure_ascii=False, indent=1),
                             encoding="utf-8")
    return rows


# 약칭 → 정식명. 규칙으로 못 만드는 것만 손으로 적는다(근거: 접수마감 PDF 표기).
DEADLINE_ALIAS = {
    "한국체대": "한국체육대학교",
    "서울교대": "서울교육대학교", "경인교대": "경인교육대학교",
    "공주교대": "공주교육대학교", "청주교대": "청주교육대학교",
    "춘천교대": "춘천교육대학교", "대구교대": "대구교육대학교",
    "부산교대": "부산교육대학교", "진주교대": "진주교육대학교",
    "광주교대": "광주교육대학교", "전주교대": "전주교육대학교",
    "한국교원대": "한국교원대학교",
    "한예종": "한국예술종합학교",
    "육사": "육군사관학교", "해사": "해군사관학교", "공사": "공군사관학교",
    "국군간호사관": "국군간호사관학교",
}


def deadline_key_index(matcher):
    """대학 마스터에서 접수마감 PDF의 약칭에 대응할 키들을 만든다.

    '고려대학교' → '고려대', '국립순천대학교' → '순천대' …
    """
    idx = defaultdict(list)
    for u in matcher.univs:
        n = C.key_name(u["name"])
        cands = {n}
        for v in C.name_variants(u["name"]):
            cands.add(v)
        # 두 번 돌린다 — '가야대학교(김해)' 는 괄호를 먼저 떼야 '가야대'가 나온다
        for _ in range(2):
            for base in list(cands):
                cands.add(re.sub(r"[\(（][^\)）]*[\)）]", "", base))
                cands.add(re.sub(r"대학교$", "대", base))
                cands.add(re.sub(r"^국립|^공립", "", base))
                cands.add(re.sub(r"^국립|^공립", "", re.sub(r"대학교$", "대", base)))
                cands.add(re.sub(r"교육대학교$", "교대", base))
                cands.add(re.sub(r"체육대학교$", "체대", base))
                cands.add(re.sub(r"여자대학교$", "여대", base))       # 숙명여대 …
                cands.add(re.sub(r"여자대학교", "여대", base))         # 이화여자대학교
        for c in cands:
            if len(c) >= 3:
                idx[c].append(u["univId"])
    return idx


def _campus_split(matcher, ids, raw):
    """'영산대(해운대･양산)' 처럼 한 줄이 캠퍼스 여러 곳을 가리키는 경우를 가른다."""
    m = re.search(r"[\(（]([^\)）]*)[\)）]", raw)
    if not m:
        return []
    toks = [C.squash(t) for t in re.split(r"[･·・,/]", m.group(1)) if C.squash(t)]
    hit = []
    for i in ids:
        nm = matcher.by_id[i]["name"]
        inner = re.search(r"[\(（]([^\)）]*)[\)）]", nm)
        if inner and any(t and t in inner.group(1) for t in toks):
            hit.append(i)
    return hit


def build_deadlines(matcher, rows):
    """{univId: {date,time,raw}} + 매칭 실패 목록.

    같은 이름이 여러 캠퍼스인 대학은 (1) 일정표의 지역, (2) 괄호 안 캠퍼스 표기
    순으로 가른다. 둘 다 안 되면 붙이지 않는다 — 엉뚱한 대학에 마감을 다는 것보다
    비워 두는 편이 낫다.
    """
    idx = deadline_key_index(matcher)
    out, miss = {}, []
    cur_date, cur_region = None, None
    for r in rows:
        if C.squash(r["region"]):
            cur_region = C.squash(r["region"])
        md = RE_DATE.search(r["date"] or "")
        if md:
            cur_date = f"{DEADLINE_CAL_YEAR}-{int(md.group(1)):02d}-{int(md.group(2)):02d}"
        mt = RE_TIME.search(r["time"] or "")
        tm = f"{int(mt.group(1)):02d}:{mt.group(2)}" if mt else None
        if not cur_date or not r["univs"]:
            continue
        for raw in re.split(r"[,，]", r["univs"]):
            raw = C.squash(raw)
            if not raw:
                continue
            hits = []
            full = DEADLINE_ALIAS.get(re.sub(r"[\(（].*", "", raw).strip())
            if full:
                uid = matcher.match(full)
                if uid:
                    hits = [uid]
            if not hits:
                # 캠퍼스 표기 '(서울･고양)' 는 통째로 떼고 학교만 본다
                bare = re.sub(r"[\(（][^\)）]*[\)）]", "", raw)
                for k in (C.key_name(raw), C.key_name(bare)):
                    ids = list(dict.fromkeys(idx.get(k, [])))
                    if not ids:
                        continue
                    if len(ids) == 1:
                        hits = ids
                        break
                    # 괄호 안 캠퍼스 표기를 먼저 본다 — '영산대(해운대･양산)' 는
                    # 한 줄이지만 마스터에서는 두 학교다. 지역으로 자르면 하나가 샌다.
                    camp = _campus_split(matcher, ids, raw)
                    if camp:
                        hits = camp
                        break
                    byreg = [i for i in ids
                             if (matcher.by_id[i].get("region") or "") == cur_region]
                    if len(byreg) == 1:
                        hits = byreg
                        break
                    plain = [i for i in (byreg or ids)
                             if "(" not in matcher.by_id[i]["name"]]
                    if len(plain) == 1:
                        hits = plain
                        break
            if not hits:
                miss.append(raw)
                continue
            for uid in hits:
                out.setdefault(uid, {"date": cur_date, "time": tm, "raw": raw})
    return out, miss


# ════════════════════════════════════════════════════════════════════
# ⑤ 행 → 전형(admission) 묶기
# ════════════════════════════════════════════════════════════════════
def build(rows, matcher):
    """(대학, 전형명) 단위로 묶는다. 한 전형에 세부 지원자격이 여러 개일 수 있다."""
    adms = {}
    unmatched = Counter()
    for r in rows:
        uid = matcher.match(r["univ"], region=r["region"])
        if not uid:
            unmatched[r["univ"]] += 1
            continue
        nm = C.squash(r["admission"].replace("\n", ""))
        atype = norm_type(nm)
        phase, basis = norm_phase(nm, atype)
        k = (uid, name_key(nm))
        a = adms.get(k)
        if not a:
            a = adms[k] = {
                "univId": uid, "univ": matcher.name_of(uid), "rawUniv": r["univ"],
                "region": r["region"], "zone": r["zone"],
                "name": nm, "nameKey": name_key(nm),
                "type": atype, "phase": phase, "phaseBasis": basis,
                "quotaOutside": bool(RE_QUOTA_OUT.search(nm)),
                "file": r["file"], "page": r["page"],
                "reqs": [],
            }
        a["reqs"].append({
            "common": r["common"], "detail": r["detail"], "extra": r["extra"],
            "page": r["page"], "file": r["file"],
        })
    # 검정고시 가부 — 전형 단위로 모든 자격 문구를 훑는다
    for a in adms.values():
        blobs = []
        for q in a["reqs"]:
            blobs += [q["detail"], q["extra"], q["common"]]
        v, rule, quote = judge_ged(blobs)
        a["ged"] = v
        a["gedRule"] = rule
        a["gedQuote"] = quote
    return list(adms.values()), unmatched


# ════════════════════════════════════════════════════════════════════
# ⑥ L1 적재
# ════════════════════════════════════════════════════════════════════
EXTRA_SCHEMA = """
-- ⚠️ 아래는 schema.sql 에 이미 들어 있는 정의와 같다(정본은 schema.sql).
--    기존 DB에 테이블이 없을 수 있어 여기서도 IF NOT EXISTS 로 걸어 둔다.

-- UNIQUE(univ_id,year,phase,type,name_key)는 NULL을 못 잡는다.
-- 이 스크립트는 NULL 대신 '미상'을 넣지만, 다른 적재기가 NULL을 넣어도 막히게 한다.
CREATE UNIQUE INDEX IF NOT EXISTS ux_admission
  ON admission (univ_id, year, COALESCE(phase, '~'), COALESCE(type, '~'),
                COALESCE(name_key, '~'));

-- 2026-09-03 추가 — 전형별 지원자격 **원문**.
-- 이 자료(대교협 검정고시 지원가능 전형)는 자격 문구가 그 자체로 상품이다.
-- 요약하면 앱에서 "원문 보기"를 못 한다. 자르지 않고 통째로 보관한다.
-- 한 전형에 세부 지원자격이 여러 갈래인 경우가 흔해서 seq로 여러 행을 받는다.
CREATE TABLE IF NOT EXISTS admission_requirement (
  admission_id  INTEGER NOT NULL REFERENCES admission(admission_id),
  seq           INTEGER NOT NULL,
  common_text   TEXT,               -- 공통 지원자격 원문
  detail_text   TEXT,               -- 세부 지원자격 원문
  extra_text    TEXT,               -- 기타(추가사항) 원문
  source_id     INTEGER NOT NULL REFERENCES source_file(source_id),
  page          INTEGER,
  PRIMARY KEY (admission_id, seq)
);

-- 2026-09-03 추가 — 대학별 원서접수 마감(수시).
-- 전형 축이 아니라 대학 축이다(대교협 일정표가 대학 단위로 고시한다).
CREATE TABLE IF NOT EXISTS admission_deadline (
  univ_id       TEXT NOT NULL REFERENCES university(univ_id),
  year          INTEGER NOT NULL,
  phase         TEXT NOT NULL,      -- 수시 | 정시
  close_date    TEXT,               -- YYYY-MM-DD (원서접수 마감일)
  close_time    TEXT,               -- HH:MM
  raw_label     TEXT,               -- 원문 표기 (예: '동국대(서울･고양)')
  source_id     INTEGER NOT NULL REFERENCES source_file(source_id),
  PRIMARY KEY (univ_id, year, phase)
);
"""


def _source_id(con, kind, title, path=None, publisher="한국대학교육협의회",
               url=None, sha=None):
    row = con.execute("SELECT source_id FROM source_file WHERE kind=? AND title=?",
                      (kind, C.nfc(title))).fetchone()
    if row:
        return row["source_id"]
    return con.execute(
        """INSERT INTO source_file (kind,year,title,path,sha256,source_url,
                                    publisher,retrieved_at,note)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (kind, YEAR, C.nfc(title), path, sha, url, publisher,
         date.today().isoformat(),
         "2027학년도 검정고시 출신자 지원 가능 전형")).lastrowid


def to_db(adms, deadlines):
    con = C.connect()
    con.execute("PRAGMA busy_timeout = 30000")     # 동시 작업자가 있다
    con.executescript(EXTRA_SCHEMA)

    known = {r["univ_id"] for r in con.execute("SELECT univ_id FROM university")}
    sids = {}
    for f in sorted({a["file"] for a in adms}):
        p = SRC_DIR / f
        sids[f] = _source_id(con, "ged_eligible_2027", f,
                             path=str(p), sha=C.sha256(p) if p.exists() else None)
    dl_sid = _source_id(con, "ged_eligible_2027", C.nfc(DEADLINE_PDF.name),
                        path=str(DEADLINE_PDF),
                        sha=C.sha256(DEADLINE_PDF) if DEADLINE_PDF.exists() else None)

    n_adm = n_req = n_ged = n_skip = 0
    for a in adms:
        if a["univId"] not in known:
            n_skip += 1
            continue
        sid = sids[a["file"]]
        phase = a["phase"] or UNKNOWN
        atype = a["type"] or UNKNOWN
        conf = "high" if a["phaseBasis"] == "text" else "mid"
        con.execute(
            """INSERT INTO admission (univ_id,year,phase,type,name,name_key,
                                      source_id,page,confidence,status)
               VALUES (?,?,?,?,?,?,?,?,?,'confirmed')
               ON CONFLICT (univ_id,year,phase,type,name_key) DO UPDATE SET
                 name=excluded.name, source_id=excluded.source_id,
                 page=excluded.page, confidence=excluded.confidence""",
            (a["univId"], YEAR, phase, atype, a["name"], a["nameKey"],
             sid, a["page"], conf))
        aid = con.execute(
            "SELECT admission_id FROM admission WHERE univ_id=? AND year=? "
            "AND phase=? AND type=? AND name_key=?",
            (a["univId"], YEAR, phase, atype, a["nameKey"])).fetchone()["admission_id"]
        a["admissionId"] = aid
        n_adm += 1

        con.execute("DELETE FROM admission_requirement WHERE admission_id=?", (aid,))
        for i, q in enumerate(a["reqs"], 1):
            con.execute(
                """INSERT INTO admission_requirement
                   (admission_id,seq,common_text,detail_text,extra_text,source_id,page)
                   VALUES (?,?,?,?,?,?,?)""",
                (aid, i, q["common"] or None, q["detail"] or None,
                 q["extra"] or None, sids[q["file"]], q["page"]))
            n_req += 1

        con.execute(
            """INSERT OR REPLACE INTO ged_eligibility
               (admission_id,eligible,reason,reflection,source_id,page,quote,confidence)
               VALUES (?,?,?,NULL,?,?,?,?)""",
            (aid, a["ged"], a["gedRule"], sid, a["page"], a["gedQuote"],
             "high" if a["ged"] == "가능" else "mid"))
        n_ged += 1

    # 대학 단위 가부 — check.py 의 커버리지가 보는 축이다.
    # 이 자료에 수록된 것 자체가 근거이므로 '가능'이다. 다만 그 대학의 전형이
    # 전부 조건부면 대학 단위도 '조건부'로 낮춘다(가장 강한 제한을 따른다).
    n_univ = 0
    byu = defaultdict(list)
    for a in adms:
        if a["univId"] in known:
            byu[a["univId"]].append(a)
    for uid, lst in byu.items():
        verdict = "가능" if any(x["ged"] == "가능" for x in lst) else "조건부"
        cond = [x for x in lst if x["ged"] == "조건부"]
        quote = (cond[0]["gedQuote"] if cond else
                 C.squash(lst[0]["reqs"][0]["common"]) or None)
        con.execute(
            """INSERT OR REPLACE INTO ged_eligibility_univ
               (univ_id,year,verdict,quote,page,evidence_pages,rule,hits,
                source_id,confidence,judged_by,reviewed_at)
               VALUES (?,?,?,?,?,?,?,?,?,'high','rule',NULL)""",
            (uid, YEAR, verdict, quote, lst[0]["page"],
             ",".join(str(p) for p in sorted({x["page"] for x in lst})[:12]),
             f"「2027 검정고시 출신자 지원 가능 전형」 수록 (전형 {len(lst)}건"
             f", 조건부 {len(cond)}건)", len(lst), sids[lst[0]["file"]]))
        n_univ += 1

    n_dl = 0
    for uid, d in deadlines.items():
        if uid not in known:
            continue
        con.execute(
            """INSERT OR REPLACE INTO admission_deadline
               (univ_id,year,phase,close_date,close_time,raw_label,source_id)
               VALUES (?,?, '수시', ?,?,?,?)""",
            (uid, YEAR, d["date"], d["time"], d["raw"], dl_sid))
        n_dl += 1

    con.execute(
        "INSERT INTO ingest_log (ran_at,script,target,rows_in,rows_out,note) "
        "VALUES (?,?,?,?,?,?)",
        (date.today().isoformat(), "ingest_ged_2027.py",
         f"{YEAR} 검정고시 지원가능 전형", len(adms), n_adm,
         f"자격원문 {n_req} / 전형별 가부 {n_ged} / 대학별 가부 {n_univ} / "
         f"마감일정 {n_dl} / 마스터에 없어 건너뜀 {n_skip}"))
    con.commit()
    con.close()
    return {"admission": n_adm, "req": n_req, "ged": n_ged, "univ": n_univ,
            "deadline": n_dl, "skipped": n_skip}


# ════════════════════════════════════════════════════════════════════
# ⑦ 앱용 JSON
# ════════════════════════════════════════════════════════════════════
def export(adms, deadlines, write=False):
    """요약본과 원문본을 나눈다. 요약본만 앱 번들에 들어가면 된다."""
    OUTDIR.mkdir(parents=True, exist_ok=True)

    summary = []
    for a in sorted(adms, key=lambda x: (x["univId"], x["nameKey"])):
        d = deadlines.get(a["univId"])
        summary.append({
            "univId": a["univId"],
            "year": YEAR,
            "phase": a["phase"] or None,
            "admissionType": a["type"] or None,
            "admissionName": a["name"],
            "gedEligible": a["ged"],
            "gedIneligibleReason": a["gedRule"] or "",
            "gedReflection": "",
            "comparativeGrade": "",
            "evalMethod": "",
            "interview": None,
            "csatMinimum": "",
            "recruitCount": None,
            "unit": "",
            "note": "",
            "source": f"2027학년도 검정고시 출신자 지원 가능 전형(한국대학교육협의회) "
                      f"{a['zone']} p.{a['page']}",
            "status": "confirmed",
            # 2027 전용 추가 필드
            "region": a["region"],
            "zone": a["zone"],
            "nameKey": a["nameKey"],
            "phaseBasis": a["phaseBasis"],
            "quotaOutside": a["quotaOutside"],
            "applyCloseDate": (d or {}).get("date"),
            "applyCloseTime": (d or {}).get("time"),
            "hasFullText": True,
        })

    texts = defaultdict(list)
    for a in adms:
        texts[a["univId"]].append({
            "nameKey": a["nameKey"],
            "admissionName": a["name"],
            "phase": a["phase"] or None,
            "admissionType": a["type"] or None,
            "gedEligible": a["ged"],
            "gedQuote": a["gedQuote"],
            "sourceFile": a["file"],
            "requirements": [
                {"common": q["common"], "detail": q["detail"],
                 "extra": q["extra"], "page": q["page"]}
                for q in a["reqs"]],
        })

    s1 = C.jdump(summary, OUTDIR / "admissions_2027.json")
    s2 = C.jdump(dict(texts), OUTDIR / "ged_eligible_2027_text.json")
    print(f"  admissions_2027.json         {len(summary):5d}행  {s1/1024:8.0f} KB")
    print(f"  ged_eligible_2027_text.json  {len(texts):5d}대학 {s2/1024:8.0f} KB")
    if write:
        s1 = C.jdump(summary, C.APP_DATA / "admissions_2027.json")
        s2 = C.jdump(dict(texts), C.APP_DATA / "ged_eligible_2027_text.json")
        print(f"  → 앱 설치: {C.APP_DATA}/admissions_2027.json, ged_eligible_2027_text.json")
    return summary, texts


# ════════════════════════════════════════════════════════════════════
# 리포트
# ════════════════════════════════════════════════════════════════════
def report(rows, adms, unmatched, deadlines, dl_miss, matcher):
    lines = []
    def P(s=""):
        print(s)
        lines.append(s)

    P(f"\n── 추출 ──────────────────────────────────────────")
    byzone = Counter(r["zone"] for r in rows)
    for z, n in byzone.most_common():
        P(f"  {z:6s} 행 {n:5d}  대학 {len({r['univ'] for r in rows if r['zone']==z}):3d}")
    P(f"  합계   행 {len(rows):5d}  대학 {len({r['univ'] for r in rows}):3d}")

    P(f"\n── 대학 매칭 ─────────────────────────────────────")
    matched = {a['univId'] for a in adms}
    P(f"  매칭 성공 대학 {len(matched)}개 / 실패 {len(unmatched)}개")
    for n, c in unmatched.most_common():
        P(f"    ✗ {n} ({c}행)")
    P(f"  마스터 {len(matcher.univs)}개 중 2027 데이터가 생긴 대학: {len(matched)}개 "
      f"({len(matched)/len(matcher.univs)*100:.0f}%)")
    kinds = Counter(matcher.by_id[i].get("kind") for i in matched)
    allk = Counter(u.get("kind") for u in matcher.univs)
    for k, v in allk.most_common():
        P(f"    {k or '미상'}: {kinds.get(k,0)}/{v}")
    P(f"    ※ 이 자료는 4년제 대상이다. 전문대학이 비는 것은 누락이 아니다.")

    # 한 univId 에 PDF 상 이름이 둘 이상 붙는 경우 = 캠퍼스가 마스터에서 안 갈린다
    byid = defaultdict(set)
    for r in rows:
        uid = matcher.match(r["univ"], region=r["region"])
        if uid:
            byid[uid].add(r["univ"])
    multi = {k: v for k, v in byid.items() if len(v) > 1}
    P(f"  캠퍼스가 한 칸으로 접힌 대학: {len(multi)}개 "
      f"(마스터에 캠퍼스가 따로 없어서 생긴다)")
    for k, v in multi.items():
        P(f"    · {matcher.name_of(k)} ← {', '.join(sorted(v))}")

    P(f"\n── 전형 ──────────────────────────────────────────")
    P(f"  원본 행 {len(rows)} → 전형(대학×전형명) {len(adms)}건")
    tt = Counter(a["type"] or "판정불가" for a in adms)
    for k, v in tt.most_common():
        P(f"    {k:8s} {v:5d}  ({v/len(adms)*100:4.1f}%)")
    qo = sum(1 for a in adms if a["quotaOutside"])
    qon = sum(1 for a in adms if a["quotaOutside"] and not a["type"])
    P(f"    ※ 판정불가 {tt.get('판정불가',0)}건 중 {qon}건은 재외국민·외국인·"
      f"북한이탈주민 등 정원외 특별전형 (전체 정원외 {qo}건)")
    P(f"\n  수시/정시 판정")
    pp = Counter(a["phase"] or "미상" for a in adms)
    for k, v in pp.most_common():
        P(f"    {k:6s} {v:5d}  ({v/len(adms)*100:4.1f}%)")
    ok = sum(v for k, v in pp.items() if k != "미상")
    P(f"    판정 성공률 {ok}/{len(adms)} = {ok/len(adms)*100:.1f}%")
    bb = Counter(a["phaseBasis"] or "-" for a in adms)
    P(f"    근거: 원문에 명시 {bb.get('text',0)} / 전형유형에서 추정 {bb.get('type',0)}"
      f" / 없음 {bb.get('-',0)}")

    P(f"\n── 검정고시 가부 ─────────────────────────────────")
    gg = Counter(a["ged"] for a in adms)
    for k, v in gg.most_common():
        P(f"    {k:5s} {v:5d}")
    rr = Counter(a["gedRule"] for a in adms if a["gedRule"])
    for k, v in rr.most_common():
        P(f"      · {k}: {v}")

    P(f"\n── 접수마감 결합 ─────────────────────────────────")
    dl_univ = {a["univId"] for a in adms if a["univId"] in deadlines}
    P(f"  일정표에서 대학 {len(deadlines)}개 매칭 / 실패 {len(set(dl_miss))}개")
    for n in sorted(set(dl_miss)):
        P(f"    ✗ {n}")
    P(f"  전형 데이터가 있는 대학 중 마감일 결합 {len(dl_univ)}개 "
      f"/ {len(matched)}개")
    P(f"  마감 붙은 전형 {sum(1 for a in adms if a['univId'] in deadlines)}건 "
      f"/ {len(adms)}건")

    OUTDIR.mkdir(parents=True, exist_ok=True)
    (OUTDIR / "report.md").write_text("\n".join(lines), encoding="utf-8")
    return lines


# ════════════════════════════════════════════════════════════════════
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--extract", action="store_true", help="PDF에서 표를 뽑는다")
    ap.add_argument("--force", action="store_true", help="캐시 무시하고 다시 뽑는다")
    ap.add_argument("--build", action="store_true", help="정규화 + 리포트")
    ap.add_argument("--to-db", action="store_true", help="L1(rebridge.db)에 적재")
    ap.add_argument("--export", action="store_true", help="앱용 JSON 생성")
    ap.add_argument("--write", action="store_true", help="앱 src/data/ 에 설치")
    a = ap.parse_args()
    if not any((a.extract, a.build, a.to_db, a.export)):
        ap.error("--extract / --build / --to-db / --export 중 하나는 있어야 합니다")

    print("2027 검정고시 지원가능 전형 (대교협 5권역)")
    if a.extract or not ROWS_JSONL.exists():
        print("[1] PDF 표 추출")
        rows = extract_rows(force=a.force)
    else:
        rows = read_rows()
        print(f"[1] 캐시 {len(rows)}행")

    if not (a.build or a.to_db or a.export):
        return

    matcher = C.UnivMatcher()
    print("[2] 정규화 + 전형 묶기")
    adms, unmatched = build(rows, matcher)
    print("[3] 접수마감 일정")
    dl_rows = extract_deadlines(force=a.force)
    deadlines, dl_miss = build_deadlines(matcher, dl_rows)

    report(rows, adms, unmatched, deadlines, dl_miss, matcher)

    if a.to_db:
        print("\n[4] L1 적재")
        n = to_db(adms, deadlines)
        print(f"  전형 {n['admission']} / 자격원문 {n['req']} / 전형별 가부 {n['ged']}"
              f" / 대학별 가부 {n['univ']} / 마감 {n['deadline']}"
              f" / 건너뜀 {n['skipped']}")
    if a.export:
        print("\n[5] 앱용 JSON")
        export(adms, deadlines, write=a.write)


if __name__ == "__main__":
    main()
