"""2027 모집요강에서 모집단위별 모집인원을 뽑는다. (LLM 없음, 비용 0)

## 왜 필요한가
앱의 `recruitCount` 가 1,007행 중 97개뿐이라 "몇 칸 뽑나" 분석이 막혀 있다.

## 무엇만 뽑나 — 확실한 것만
모집요강의 모집인원 표는 대학마다 모양이 제각각이다.
  ① "모집단위 | 모집인원" 두 열이 나란히 있는 표      ← **이것만 뽑는다**
  ② 전형 × 모집단위 행렬(열이 전형별로 갈리는 표)     ← 뽑지 않는다
  ③ 2026/2027 대비표, 목차                        ← 뽑지 않는다
②를 규칙으로 읽으면 어느 숫자가 어느 전형 것인지 어긋난다.
**틀린 모집인원은 없는 것보다 나쁘다**(v2 규칙 3).

## 산출
  out/guides_2027/recruit_2027.jsonl
    {"univId","univ","year","phase","source_file","page","admissionHint",
     "program","recruitCount","rawLine"}

실행:
  python3 v2/ingest_guides_recruit.py --year 2027
"""

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C
from ingest_guides_conversion import tokens, PHASE_KO

RE_H_UNIT = re.compile(r"^모\s*집\s*단\s*위(\(.*\))?$|^모집단위\(.*\)$|^학\s*과$|^모집단위$")
RE_H_CNT = re.compile(r"^모\s*집\s*인\s*원$|^인\s*원$|^모집인원\(명\)$")
RE_CNT = re.compile(r"^(\d{1,4})\s*명?$")
RE_TOC = re.compile(r"[·․‥…]{4,}|\.{6,}")
RE_STOPWORD = re.compile(
    r"^(계|합계|소계|총계|구분|전형|비고|합\s*계|모집단위|모집인원|인원|학과|계열|"
    r"단과대학|대학|주야|정원내|정원외|\d+)$")
RE_ADM_HINT = re.compile(
    r"(학생부\s*(교과|종합)|논술|실기|수능|교과우수|지역인재|고른기회|기회균형|"
    r"농어촌|특성화고|기초생활|재외국민|특별|일반)[^\n]{0,30}전형|^\s*[가-힣].{0,24}전형")


# ⚠️ 지난해 입시결과 표도 '모집단위 | 모집인원' 헤더를 갖고 있다(가톨릭대 정시 p.43 실측).
#    그 숫자는 **2026학년도** 것이라 2027 모집인원으로 넣으면 통째로 틀린다.
RE_RESULT_TABLE = re.compile(
    r"경쟁률|지원인원|충원율|충원\s*현황|등록률|입시\s*결과|합격자|예비순위|백분위|"
    r"지원자\s*수|최종등록")


def find_pairs(line):
    """한 줄에서 (모집단위 열, 모집인원 열) 쌍들을 찾는다. 2단 표도 있다."""
    if RE_RESULT_TABLE.search(line):
        return []                          # 지난해 입시결과 표 — 손대지 않는다
    toks = tokens(line)
    units = [(s, e) for s, e, t in toks if RE_H_UNIT.match(re.sub(r"\s+", "", t))]
    cnts = [(s, e) for s, e, t in toks if RE_H_CNT.match(re.sub(r"\s+", "", t))]
    starts = sorted(s for s, _, _ in toks)
    pairs = []
    for cs, ce in cnts:
        left = [u for u in units if u[1] <= cs]
        if not left:
            continue
        u = max(left, key=lambda x: x[1])
        if cs - u[1] > 60:                 # 너무 멀면 같은 표가 아니다
            continue
        # 모집단위 열은 **다음 헤더 칸 앞에서** 끝난다.
        # (안 끊으면 '자유전공학부' + '나군' 처럼 옆 열이 학과명에 붙는다)
        nxt = [x for x in starts if x > u[0]]
        u_end = (min(nxt) - 1) if nxt else (cs - 1)
        pairs.append(((u[0] - 4, u_end), (cs - 3, ce + 3)))
    return pairs


def scan_block(lines, i, pair, max_rows=60):
    """헤더 다음 줄부터 (모집단위, 인원) 행을 읽는다."""
    (us, ue), (cs, ce) = pair
    out, misses = [], 0
    for j in range(i + 1, min(len(lines), i + max_rows + 1)):
        ln = lines[j]
        if RE_TOC.search(ln):
            break
        toks = tokens(ln)
        if not toks:
            misses += 1
            if misses >= 4:
                break
            continue
        if find_pairs(ln):                 # 새 헤더를 만나면 멈춘다
            break
        name_parts, cnt = [], None
        for s, e, t in toks:
            c = (s + e) / 2
            if us <= c <= ue:
                name_parts.append(t)
            elif cs <= c <= ce:
                m = RE_CNT.match(re.sub(r"\s+", "", t))
                if m:
                    cnt = int(m.group(1))
        name = C.squash(" ".join(name_parts))
        if cnt is None or not name:
            misses += 1
            if misses >= 4:
                break
            continue
        if RE_STOPWORD.match(re.sub(r"\s+", "", name)):
            continue
        if len(re.sub(r"[^가-힣A-Za-z]", "", name)) < 2:
            continue
        if cnt <= 0 or cnt > 5000:
            continue
        misses = 0
        # 한 줄에 숫자가 여러 개면 어느 게 모집인원인지 확실하지 않다.
        # 값을 고르되 confidence 를 낮춰 사람이 볼 수 있게 한다(지어내지 않기).
        nnum = len(re.findall(r"\d+", ln))
        out.append({"program": name, "recruitCount": cnt, "line": j,
                    "confidence": "mid" if nnum <= 2 else "low",
                    "rawLine": C.squash(ln)})
    return out


def admission_hint(lines, i):
    for k in range(i, max(-1, i - 25), -1):
        s = C.squash(lines[k])
        if not s or len(s) > 60:
            continue
        m = RE_ADM_HINT.search(s)
        if m:
            return s[:60]
    return None


def run(year=2027, limit=None):
    text_dir = C.OUT / "text" / f"guides_{year}"
    man = C.jload(text_dir / "_manifest.json")
    out_dir = C.OUT / f"guides_{year}"
    out_dir.mkdir(parents=True, exist_ok=True)
    items = man["items"][:limit] if limit else man["items"]

    rows = []
    stat = Counter()
    for it in items:
        d = json.load(open(it["out"], encoding="utf-8"))
        src = f"{Path(it['file']).parent.name}/{Path(it['file']).name}"
        stat["요강 파일"] += 1
        got = 0
        for p in d["pages"]:
            lines = p["text"].split("\n")
            page_txt = p["text"]
            if re.search(r"입시\s*결과|지난해\s*경쟁률|전년도\s*경쟁률", page_txt):
                stat["입시결과 쪽(건너뜀)"] += 1
                continue
            for i, ln in enumerate(lines):
                if RE_TOC.search(ln):
                    continue
                for pair in find_pairs(ln):
                    block = scan_block(lines, i, pair)
                    if len(block) < 2:          # 한 줄짜리는 표가 아니다
                        continue
                    hint = admission_hint(lines, i)
                    for b in block:
                        rows.append({
                            "univId": it["univId"], "univ": it["univ"], "year": year,
                            "phase": PHASE_KO[it["phase"]], "campus": it.get("campus"),
                            "source_file": src, "sourceUrl": it.get("sourceUrl"),
                            "page": p["page"], "admissionHint": hint,
                            "program": b["program"], "recruitCount": b["recruitCount"],
                            "confidence": b["confidence"], "rawLine": b["rawLine"]})
                    got += len(block)
        if got:
            stat["행 나온 파일"] += 1
        else:
            stat["행 0인 파일"] += 1

    # 같은 (대학·구분·쪽·모집단위) 중복 제거 — 2단 표를 두 번 읽는 경우가 있다
    seen, uniq = set(), []
    for r in rows:
        k = (r["univId"], r["phase"], r["page"], r["program"], r["recruitCount"])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(r)

    out = out_dir / f"recruit_{year}.jsonl"
    with open(out, "w", encoding="utf-8") as f:
        for r in uniq:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    conf = Counter(r["confidence"] for r in uniq)
    md = [f"# 2027 모집요강 모집인원 추출 결과", "",
          "이 표는 **'모집단위 | 모집인원' 두 열이 붙어 있는 표'만** 읽은 것이다.",
          "전형×모집단위 행렬은 손대지 않았다(어긋난 숫자가 없는 것보다 나쁘다).",
          "지난해 입시결과 표(경쟁률·충원율이 같이 있는 표)는 통째로 건너뛴다.", "",
          f"- 요강 파일 {stat['요강 파일']}개 중 행이 나온 파일 {stat['행 나온 파일']}개",
          f"- 행 {len(uniq)}개 / 대학 {len({r['univId'] for r in uniq})}개",
          f"- confidence: " + ", ".join(f"{k} {v}" for k, v in conf.most_common()),
          "",
          "`confidence=low` 는 한 줄에 숫자가 3개 이상이라 어느 칸이 모집인원인지",
          "확실하지 않은 행이다. `rawLine` 에 원문 줄이 그대로 들어 있으니 대조하면 된다.",
          ""]
    (out_dir / f"recruit_{year}_report.md").write_text("\n".join(md), encoding="utf-8")

    print("═" * 62)
    for k, v in stat.most_common():
        print(f"  {k:20} {v:>5}")
    print(f"  추출 행 {len(rows)} → 중복 제거 후 {len(uniq)}")
    print(f"  대학 {len({r['univId'] for r in uniq})}개 / "
          f"모집단위(이름 기준) {len({(r['univId'], r['program']) for r in uniq})}개")
    print(f"  confidence: {dict(conf)}")
    print(f"  인원 합계 {sum(r['recruitCount'] for r in uniq):,}명 "
          f"(⚠️ 중복 집계 가능 — 전형별 표가 여러 쪽에 걸침)")
    print("═" * 62)
    print(f"  → {out}")
    return uniq


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2027)
    ap.add_argument("--limit", type=int)
    a = ap.parse_args()
    run(a.year, a.limit)
