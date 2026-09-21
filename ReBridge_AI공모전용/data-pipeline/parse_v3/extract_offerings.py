"""모집인원표 → offerings.jsonl (Python 자동 추출).

    python3 extract_offerings.py [--univ id,id] [--doc doc:…] [--limit N] [--force] [--dry]

무엇을 하는가
  요강·시행계획 PDF 에서 '모집단위 × 전형' 모집인원표를 찾아, 표의 칸 하나하나를
  `AGENT_CONTRACT.md` 의 offerings.jsonl 형식으로 바꾼다. 결과는 `work/auto_out/<추출기ID>/<univId>/`
  에 쓰고, 정본 반영은 기존 `merge_agent.py` 하나로만 한다(병합 경로를 늘리지 않는다).

무엇을 하지 않는가
  - 표를 못 읽거나 구조가 확실하지 않으면 **값을 만들지 않는다.** 예외 큐(`work/auto_out/_exceptions.jsonl`)에
    문서·쪽·실패 사유를 남기고 넘어간다. 사람이나 에이전트가 그 쪽만 보면 된다.
  - 합계·소계 행/열은 모집단위 행으로 만들지 않는다. 대신 **검산용**으로 따로 모아, 추출한 값의 합과 비교한다.
  - 빈칸은 버리고, '-' 는 인원 미상으로 남긴다. '0' 은 '뽑지 않음'이라는 뜻이므로 그대로 기록한다.

왜 이렇게 하는가
  2026-09-20 시점에 요강 쪽 자료는 전 대학의 6% 뿐이었고, 전부 에이전트가 한 줄씩 읽어 만든 것이었다.
  모집인원표는 기계가 읽을 수 있는 가장 규칙적인 표이므로 여기부터 Python 으로 돌린다.
"""

import argparse
import json
import re
import warnings
from collections import Counter

warnings.filterwarnings("ignore")

from common import WORK, PARSER_VERSION, RAW, connect, log, text_db
import parse_results as PR

EXTRACTOR = "extract_offerings " + PARSER_VERSION
AGENT_ID = "PY-OFF"                      # merge_agent 에 넘길 때 쓰는 이름
OUT_DIR = WORK / "auto_out" / AGENT_ID
EXC_PATH = WORK / "auto_out" / "_exceptions.jsonl"

# ── 표를 알아보는 말들 ─────────────────────────────────────────────
PROGRAM_HDR = re.compile(r"모집\s*단위|학과|학부|전공|계열|모집\s*학과")
SEATS_HDR = re.compile(r"모집\s*인원|인원|정원|명$|선발\s*인원")
TOTAL_WORD = re.compile(r"^\s*(합\s*계|소\s*계|총\s*계|계|총\s*합|전\s*체)\s*$")
QUOTA_IN = re.compile(r"정원\s*내")
QUOTA_OUT = re.compile(r"정원\s*외")
PHASE_SU = re.compile(r"수시")
PHASE_JEONG = re.compile(r"정시")
ROUND_PAT = re.compile(r"([12])\s*차")
GROUP_PAT = re.compile(r"([가나다])\s*군")
# 모집단위가 아닌 행 이름(구분 열에 흔히 오는 말)
NOT_PROGRAM_ROW = re.compile(r"^\s*(구\s*분|계열|모집\s*시기|학\s*제|주\s*야|비\s*고|번\s*호|연\s*번|순\s*번)\s*$")
# 전형 이름으로 보기 어려운 열 제목
# 전형 이름이 아니라 '인원' 자체를 뜻하는 열 제목(학과 총정원 포함). 이런 열은 전형으로 만들지 않는다.
ONLY_SEATS = re.compile(r"^\s*((입학|모집|총|전체)\s*)?(모집\s*인원|선발\s*인원|인\s*원|정\s*원|모집|계)\s*(\(\s*명\s*\)|명)?\s*$")
NOT_ADMISSION = re.compile(r"^\s*(모집\s*단위|학과|학부|전공|구\s*분|계\s*열|비\s*고|번\s*호|연\s*번|합\s*계|소\s*계|계"
                           r"|단과\s*대학|대\s*학|캠퍼스|학\s*제|주\s*야|학년도|모집\s*시기|선발\s*모형|비\s*율|과정)\s*$")


# 세로쓰기(글자를 위에서 아래로 한 자씩) 머리글은 읽으면 '숙 명 인 재 ︵면 접 형 ︶' 처럼 낱자로 흩어진다.
# 세로쓰기용 괄호·줄표를 보통 글자로 바꾸고, 낱자만 늘어선 말은 붙여 준다.
VERT_PUNCT = str.maketrans({"︵": "(", "︶": ")", "︹": "[", "︺": "]", "︱": "-", "︳": "-", "―": "-"})


def norm(s):
    return re.sub(r"\s+", " ", (s or "").replace("\n", " ")).strip()


def tighten(s):
    """낱자로 흩어진 세로쓰기 머리글을 원래 말로 되돌린다. 보통 머리글은 그대로 둔다."""
    t = norm(s).translate(VERT_PUNCT)
    toks = t.split(" ")
    if len(toks) >= 3 and sum(1 for x in toks if len(x) == 1) / len(toks) >= 0.6:
        return "".join(toks)
    return t


# 모집인원 칸에 '40 명' 처럼 단위가 붙어 나오는 요강이 있다(서울교대 2027 수시).
# 숫자만 인정하면 그런 표는 통째로 버려진다.
INT_CELL = re.compile(r"^\d{1,4}\s*(명)?$")


def is_int_cell(s):
    return bool(INT_CELL.fullmatch((s or "").strip().replace(",", "")))


def to_int(s):
    """'40', '1,234', '40 명' → 정수. 숫자가 아니면 None."""
    t = (s or "").strip().replace(",", "")
    m = INT_CELL.fullmatch(t)
    return int(re.sub(r"\D", "", t)) if m else None


# 시행계획에는 **행이 전형 이름인 표**가 따로 있다(국립목포대 2028 '다. 전형별 모집인원' —
# 교과일반전형 838명 / 학사·전문학사 구분만 있고 학과 구분이 없다).
# 그 표를 모집단위별 표로 읽으면 '교과일반전형' 이 학과가 되고 838 이 한 학과의 인원이 된다.
NOT_PROGRAM_VALUE = re.compile(r"^\s*(학\s*사|전문\s*학사|석\s*사|박\s*사|야\s*간|주\s*간"
                               r"|일괄\s*합산|일\s*괄|단계별(\s*사정)?|사정\s*방법|총\s*점|합\s*산"
                               r"|[가-힣A-Za-z0-9·()\s]{0,20}전\s*형(명)?)\s*$")


def looks_program(s):
    s = norm(s)
    if not s or NOT_PROGRAM_ROW.match(s) or TOTAL_WORD.match(s):
        return False
    if is_int_cell(s) or NOT_PROGRAM_VALUE.match(s):
        return False
    return len(s) >= 2


def row_matches_source(lines, prog, cells):
    """행의 값들을 **순서대로 이어 붙인 것**이 원문 줄에서 학과 이름 뒤에 그대로 나오는가.

    요강 원문은 숫자가 붙어 나오는 일이 많다(인하대 2027 수시 6쪽: '기계공학과349-5411723--').
    칸 하나씩 대조하면 '34' 를 '349' 와 구별하지 못하지만, 행 전체를 순서대로 맞추면
    칸 나누기와 열 순서까지 한 번에 확인된다. 합계가 없는 표를 검증하는 가장 강한 방법이다.
    """
    p = re.sub(r"[\s*※·()\[\]]", "", prog or "")
    if len(p) < 3:
        return False
    seq = "".join(re.sub(r"[\s,]", "", str(c)) for c in cells if c is not None and str(c).strip())
    seq = seq.replace("－", "-").replace("‑", "-")
    if len(seq) < 3 or not re.search(r"\d", seq):
        return False
    # 앞 몇 글자만 보면 끝 값이 틀려도 통과한다(…999 를 …888 로 바꿔도 통과했다).
    # 행 전체가 원문 줄에 그대로 이어져 있어야 인정한다.
    for ln in lines:
        i = ln.find(p)
        if i < 0:
            continue
        if ln[i + len(p):].startswith(seq):
            return True
    return False


def line_index(ptext):
    """쪽 원문을 '공백 지운 줄' 목록으로. 학과–인원 짝을 원문 줄에서 확인하는 데 쓴다."""
    return [re.sub(r"\s+", "", ln) for ln in (ptext or "").splitlines() if ln.strip()]


def pair_in_source(lines, prog, seats, window=14):
    """원문 줄에 '학과 이름 바로 뒤에 그 숫자' 가 있는가.

    표의 칸 나누기가 어긋나도, 원문 한 줄에서 짝이 확인되면 그 값은 문서가 실제로 적은 값이다.
    합계가 없어 산수 검산을 못 하는 표(강서대 2027 수시 7쪽)를 위해 둔 두 번째 검산이다.
    """
    if seats is None:
        return False
    p = re.sub(r"[\s*※·()\[\]]", "", prog or "")
    if len(p) < 3:
        return False
    num = str(seats)
    for ln in lines:
        i = ln.find(p)
        if i < 0:
            continue
        tail = ln[i + len(p): i + len(p) + window]
        m = re.match(r"^\D{0,3}(\d{1,4})", tail)
        if m and m.group(1) == num:
            return True
    return False


# 표에 전형 열이 없고 '모집단위 + 모집인원' 두 칸만 있는 모양이 흔하다.
# 이때 전형 이름은 그 쪽의 제목에 있다. (명지대 '학생부교과(교과면접전형)',
#  강서대 '학생부위주(교과) - 일반학생전형', 성균관대 '학생부종합(탐구인재)')
SECTION_ADM = re.compile(
    r"(학생부\s*위주\s*\([^)]{1,20}\)\s*[-–]?\s*[가-힣A-Za-z0-9·]{0,15}전형"
    r"|학생부\s*(교과|종합)\s*\([^)]{1,25}\)"
    r"|[가-힣A-Za-z0-9·()]{2,25}전형"
    r"|논술\s*위주\s*\([^)]{1,20}\)"
    r"|실기\s*[·/]?\s*실적\s*위주\s*\([^)]{1,20}\)"
    r"|수능\s*위주\s*\([^)]{1,20}\))")


def admission_from_page(text):
    """쪽 제목에서 전형 이름을 찾는다. 원문 표기를 그대로 쓴다. 못 찾으면 None."""
    head = (text or "")[:400]
    best = None
    for m in SECTION_ADM.finditer(head):
        t = norm(m.group(0))
        if ONLY_SEATS.match(t) or NOT_ADMISSION.match(t):
            continue
        if len(t) < 3 or re.fullmatch(r"[\d\s,.·\-—()]+", t):
            continue
        # 더 구체적인(긴) 이름을 고른다
        if best is None or len(t) > len(best):
            best = t
    return best


# ── 글자 좌표로 표 만들기 ──────────────────────────────────────────
# pdfplumber 의 선 기반 표 인식은 요강에서 자주 어긋난다. 명지대 2027 수시 22쪽에서는
# 표가 찾아낸 칸 범위가 x=249 까지인데 모집인원 '18' 은 x=278 에 있어, 인원이 통째로 빠졌다.
# 그래서 표 테두리 안의 **낱말 좌표**로 행·열을 다시 만든다(이미지 표 복원에서 쓰는 방법과 같다).

def grid_from_words(page, bbox, col_edges, y_tol=3.0):
    """표 테두리 안의 낱말을 y 로 묶어 행을, 열 경계로 칸을 정한다. 반환: 2차원 글자 격자."""
    x0, top, x1, bottom = bbox
    words = [w for w in page.extract_words(keep_blank_chars=False, use_text_flow=False)
             if x0 - 1 <= (w["x0"] + w["x1"]) / 2 <= x1 + 1 and top - 1 <= (w["top"] + w["bottom"]) / 2 <= bottom + 1]
    if not words:
        return []
    edges = sorted(set(round(e, 1) for e in col_edges))
    if len(edges) < 3:
        # 열 경계가 없으면 **낱말이 시작하는 x 좌표**를 모아 무리 짓는다.
        # 가운데 좌표로 빈틈을 재면 글자 수가 다른 칸끼리 섞여 열이 뭉친다.
        xs = sorted(w["x0"] for w in words)
        groups = [[xs[0]]]
        for a in xs[1:]:
            if a - groups[-1][-1] <= 8:
                groups[-1].append(a)
            else:
                groups.append([a])
        starts = [g[0] for g in groups if len(g) >= 2] or [g[0] for g in groups]
        edges = [x0] + [(a + b) / 2 for a, b in zip(starts, starts[1:])] + [x1]
    ncol = max(len(edges) - 1, 1)

    rows = []
    for w in sorted(words, key=lambda w: ((w["top"] + w["bottom"]) / 2, w["x0"])):
        yc = (w["top"] + w["bottom"]) / 2
        if rows and abs(yc - rows[-1][0]) <= y_tol:
            rows[-1][1].append(w)
        else:
            rows.append([yc, [w]])

    grid = []
    for _, ws in rows:
        cells = [""] * ncol
        for w in ws:
            xc = (w["x0"] + w["x1"]) / 2
            j = 0
            for k in range(ncol):
                if edges[k] <= xc <= edges[k + 1]:
                    j = k
                    break
                if xc > edges[k + 1]:
                    j = min(k + 1, ncol - 1)
            cells[j] = (cells[j] + " " + w["text"]).strip() if cells[j] else w["text"]
        grid.append(cells)
    return grid


# ── 모집인원표 전용 머리글 판정 ────────────────────────────────────
# 입시결과 표는 자료 행에 숫자가 가득해서 '숫자 비율'로 머리글을 가를 수 있지만,
# 모집인원표는 자료 행이 대부분 **학과 이름(글자)** 이라 같은 방법을 쓰면 자료 행까지 머리글로 먹는다.
# (명지대 2027 수시 22쪽: 학과 5줄이 머리글로 들어가 값이 하나도 안 나왔다)
# 그래서 '구체적인 학과 이름이 처음 나오는 행'을 자료 시작으로 본다.
GENERIC_HDR = {"모집단위", "학과", "학부", "전공", "계열", "구분", "단과대학", "대학", "모집인원", "인원",
               "정원", "계", "합계", "소계", "총계", "전형", "전형명", "모집시기", "비고", "학제", "주야",
               "캠퍼스", "모집구분", "선발모형", "모집", "학년도", "군", "차수", "번호", "연번", "순번"}
SPECIFIC_PROGRAM = re.compile(r"(학과|학부|전공|계열|대학원|과$|부$)")
# 제목·안내문에도 '세부'·'(교과)' 처럼 과/부로 끝나는 말이 있어 학과로 오인된다. 이런 말이 있으면 학과가 아니다.
HEADING_WORDS = re.compile(r"전형|위주|내용|방법|기준|자격|반영|비율|일정|서류|안내|참고|산출|유의|절차|평가|선발"
                           r"|접수|발표|등록|문의|기타|모집인원|지원|합격|제출|면접|논술|실기|수능|학생부")


# '학부(학과)', '학과/전공', '모집단위(학부)' 처럼 **일반 머리글 낱말만 이어 붙인 말**은 학과 이름이 아니다.
# 숙명여대 2027 수시 4쪽에서 '학부(학과)'·'전공' 줄을 학과 줄로 착각해, 그 아래 세로쓰기로 적힌
# 전형 이름 줄(숙명인재(면접형)·지역균형선발 …)을 통째로 자료 행으로 넘겨 버렸다.
GENERIC_TOKENS = ("단과대학", "모집단위", "학부", "학과", "전공", "계열", "대학", "구분", "캠퍼스",
                  "세부", "과정", "모집", "단위", "학년도", "및", "또는")


def generic_label(t):
    """일반 머리글 낱말을 모두 빼면 아무것도 안 남는가."""
    for tok in sorted(GENERIC_TOKENS, key=len, reverse=True):
        t = t.replace(tok, "")
    return t == ""


def looks_specific_program(s):
    """'인문콘텐츠학부' 처럼 **그 대학의 실제 모집단위 이름**인가. '모집단위'·'학과' 같은 일반 머리글은 아니다."""
    t = re.sub(r"[\s*※·()\[\]/]", "", norm(s))
    if not t or t in GENERIC_HDR or is_int_cell(t) or len(t) < 3:
        return False
    if HEADING_WORDS.search(t) or generic_label(t) or NOT_PROGRAM_VALUE.match(norm(s)):
        return False
    return bool(SPECIFIC_PROGRAM.search(t))


# ── 이름이 실제 이름처럼 생겼는지 ────────────────────────────────────
CIRCLED = re.compile(r"[\u2460-\u2473\u2776-\u277f\u2780-\u2789\u278a-\u2793]")


def clean_program(s):
    """모집단위 이름에서 **각주 표시**를 떼어낸다.

    오산대 요강은 3년제 학과 뒤에 각주 번호 3(원문자 ❸)을 붙여 둔다. 그것을 이름에 남기면
    같은 학과가 '전기공학과 3' 과 '전기공학과' 둘로 갈라져 앱에서 다른 학과가 된다.
    원문 표기는 근거(raw_text)에 그대로 남으므로 정보가 사라지지 않는다.
    """
    t = norm(s)
    t = CIRCLED.sub(" ", t)
    t = re.sub(r"\[[^\]]{1,8}\]", " ", t)              # [면접]·[실기] 같은 안내 표시
    t = re.sub(r"^(?:\s*\d{1,3}(?=\s))+", " ", t)      # 앞에 붙은 각주 번호
    t = norm(t)
    if re.search(r"[가-힣A-Za-z)\]]", t):
        t = re.sub(r"[\s*※]*\d{1,2}\s*$", "", t)       # 뒤에 붙은 각주 번호
    return norm(t) or norm(s)


def sane_program(t):
    """모집단위 자리에 들어온 값이 이름처럼 생겼는가.

    표가 한 칸씩 어긋나면 '105 66 17' 이나 '과 3 5 2 4 2' 같은 것이 모집단위 자리에 들어온다.
    2026-09-21 오산대 요강 1쪽에서 이런 행이 257건 검산을 통과해 나왔다. 여기서 막는다.
    """
    if not t or len(t) < 2:
        return False
    letters = len(re.findall(r"[가-힣A-Za-z]", t))
    if letters < 2 or len(re.findall(r"\d", t)) >= letters:
        return False
    # 글자가 한 개씩 흩어져 있으면(세로쓰기가 행으로 잘못 읽힌 것) 이름이 아니다
    if max((len(m.group(0)) for m in re.finditer(r"[가-힣A-Za-z]+", t)), default=0) < 2:
        return False
    # 실제 모집단위 이름은 길어도 서른 자를 넘지 않는다. 그보다 길면 여러 전공이 한 칸에 뭉친 것이다
    # ('컴퓨터인공지능학부 컴 퓨 터 공 학 전 공 클라우드인프라전공' → 셋이 한 칸에 들어갔다)
    if len(t) > 30 or sum(1 for x in t.split(" ") if len(x) == 1) >= 3:
        return False
    # 전형 이름이 모집단위 자리에 들어온 것('교과일반전형', '일반전형')
    if re.search(r"전\s*형(명)?\s*$", t):
        return False
    # 여러 학과가 한 칸에 뭉친 것('문헌정보학과 소비자경제학과 경영학부 앙트러프러너십전공')
    # 괄호 밖에서 학과·학부·계열·과로 끝나는 토막이 셋 이상이면 한 모집단위가 아니다
    outside = re.sub(r"\([^)]*\)", "", t)
    if sum(1 for x in outside.split(" ") if re.search(r"(학과|학부|계열|전공|과|부)$", x)) >= 3:
        return False
    # 'N개 모집단위', '21개 학과' 같은 묶음 표시
    if re.search(r"\d+\s*개\s*(모집\s*단위|학과|학부|전공|계열)", t):
        return False
    return True


def sane_admission(t):
    """전형 이름 자리에 '주요 (1,759명' 같은 본문 토막이 들어오지 않게."""
    if not t or len(t) < 2:
        return False
    if re.search(r"\d[,.]\d|\d\s*명", t):
        return False
    return len(re.findall(r"[가-힣A-Za-z]", t)) >= 2


def split_headers_seats(grid, max_header=5):
    """(머리글 행 수, 열별 머리글 경로). 자료 행이 하나도 없으면 (None, None)."""
    first = None
    for i, r in enumerate(grid[:max_header + 1]):
        if any(looks_specific_program(PR.cell_str(c)) for c in r):
            first = i
            break
    if first is None or first == 0:
        return None, None            # 머리글이 없거나, 첫 줄부터 학과 = 모집인원표로 보기 어렵다
    nh, headers = PR.split_headers(grid[:first] + [["" ] * len(grid[0])])
    return first, headers


# 작년 입시결과 표(경쟁률·충원·예비번호·환산점수)는 모집단위와 숫자가 나란히 있어 모집인원표와 모양이 같다.
# 명지대 2027 요강에서 '최종 예비 번호' 열을 모집인원으로 읽어 148건이 잘못 나왔다. 머리글로 가른다.
RESULT_TABLE = re.compile(r"경쟁률|충\s*원|예\s*비\s*번호|예비순위|등록률|합격자|지원자|환산\s*점수"
                          r"|백분위|입시\s*결과|전년도|지원율|최초\s*합격|최종\s*등록"
                          r"|전화\s*번호|연\s*락\s*처|팩스|홈페이지|이메일|문의\s*처|E-?mail"
                          r"|반영\s*비율|전형\s*요소|반영\s*교과|총\s*점|배\s*점|만\s*점|백분율|반영\s*방법"
                          r"|후보\s*순위|최대\s*선발|선발\s*가능\s*인원|일괄\s*합산|단계별\s*사정|사정\s*방법", re.I)
# 쪽 머리말·꼬리말이 머리글 줄로 딸려 들어온다('(단위: 명)', '2027학년도 ○○대학교 정시모집요강')
PAGE_CHROME = re.compile(r"모집\s*요강|단위\s*[:：]\s*명|^\s*\(\s*단위|[●▶■◆※]|신입생|20\d\d\s*학년도\s*(수시|정시)")
# '정원내 합계', '수시 1차 소계' 처럼 **합계를 뜻하는 머리글 조각**.
# 맨 끝(잎)이 이것이면 검산용 합계 열이고, 중간에 끼어 있으면 묶음 이름일 뿐이므로 전형 이름에서 뺀다.
TOTAL_SEG = re.compile(r"^\s*((수시|정시|정원\s*내|정원\s*외|모집|전체|총|[12]\s*차)\s*)*"
                       r"(합\s*계|소\s*계|총\s*계|총\s*합)\s*(\([^)]*\))?\s*$")
# 머리글 조각이 '합계'로 **끝나면** 그 열은 전형이 아니라 검산용 합계 열이다('수시모집합계')
TOTAL_SUFFIX = re.compile(r"(합\s*계|소\s*계|총\s*계|총\s*합)\s*$")
# 행 이름이 '합계 (정원내 모집단위: 26개)' 처럼 합계로 **시작하면** 그 행은 모집단위가 아니라 합계 행이다
TOTAL_PREFIX = re.compile(r"^\s*(합\s*계|소\s*계|총\s*계|총\s*합)")
# 열 제목 앞에 붙는 '모집인원(정원내)' 같은 토막은 전형 이름이 아니다
SEATS_PREFIX = re.compile(r"모집\s*인원\s*(\([^)]*\))?")


def score_table(grid, max_header=5):
    """이 표가 '모집단위 × 전형 모집인원표' 인가. 0~100."""
    # 교대처럼 모집단위가 하나뿐이면 '머리글 1줄 + 자료 1줄' 짜리 표가 나온다.
    # 행 수로 자르면 그런 표를 통째로 잃는다. 맞는 표인지는 뒤의 원문 줄 대조가 가른다.
    if len(grid) < 2:
        return 0, "행이 2개 미만"
    ncol = max(len(r) for r in grid)
    if ncol < 2:
        return 0, "열이 2개 미만"
    nh, headers = split_headers_seats(grid, max_header)
    if nh is None:
        return 0, "학과 이름이 늘어선 자료 행을 못 찾음"
    body = grid[nh:]
    if not body:
        return 0, "머리글만 있고 자료 행이 없음"
    head_txt = " ".join(h or "" for h in headers)
    if RESULT_TABLE.search(head_txt) or RESULT_TABLE.search(head_txt.replace(" ", "")):
        return 0, f"입시결과·배점 표(모집인원표가 아님): {head_txt[:50]!r}"
    s = 0
    if PROGRAM_HDR.search(head_txt):
        s += 35
    if SEATS_HDR.search(head_txt):
        s += 20
    # 자료 칸 비율. '-' 는 **그 전형으로는 뽑지 않는다**는 뜻이므로 숫자와 똑같이 자료 칸이다.
    # (인하대 2027 정시 표는 칸 대부분이 '-' 라서, 숫자만 세면 점수 미달로 탈락했다)
    cells = [PR.cell_str(c) for r in body for c in r]
    ints = sum(1 for c in cells if is_int_cell(c) or c.strip() in ("-", "\u2013", "\u2014", "\uff0d", "\u2011"))
    if cells and ints / len(cells) >= 0.25:
        s += 25
    elif cells and ints / len(cells) >= 0.12:
        s += 12
    # 모집단위처럼 생긴 행 이름이 여러 개. 학과 열이 맨 앞이 아닐 수 있으므로 **모든 열에서** 가장 많은 곳을 본다.
    ncols = max(len(r) for r in body)
    progs = max((sum(1 for r in body if j < len(r) and looks_program(PR.cell_str(r[j])))
                 for j in range(min(ncols, 4))), default=0)
    if progs >= 3:
        s += 20
    elif progs >= 1:
        s += 8
    return s, f"머리글={head_txt[:60]!r} 자료비율={ints}/{len(cells)} 모집단위행={progs}"


def pick_program_col(headers, body):
    """모집단위 이름이 들어 있는 열 번호. 못 찾으면 None.

    핵심은 **값이 서로 다른 정도**다. '계열'(인문/자연) 열은 같은 값이 반복되지만
    학과 열은 값이 거의 다 다르다. 이걸 안 보면 서울과기대처럼 '자연'이 학과명으로 들어간다.
    """
    ncol = len(headers)
    best, best_score = None, 0
    for j in range(ncol):
        vals = [norm(PR.cell_str(r[j])) if j < len(r) else "" for r in body]
        nonempty = [v for v in vals if v]
        if len(nonempty) < min(2, len(body)):      # 자료 행이 하나뿐인 표도 있다
            continue
        prog = sum(1 for v in nonempty if looks_program(v))
        if prog / len(nonempty) < 0.6:
            continue
        distinct = len({v for v in nonempty if looks_program(v)})
        uniq = distinct / max(prog, 1)
        if uniq < 0.5:                      # 같은 값이 절반 넘게 반복되면 학과 열이 아니다
            continue
        sc = prog * uniq + (25 if PROGRAM_HDR.search(headers[j] or "") else 0) - j
        if sc > best_score:
            best, best_score = j, sc
    return best


# 열 제목을 다 이어 붙여도 **전형에 대해 아무것도 말해 주지 않는** 말들.
# '입학'·'편제'·'수업 연한'·'2027학년도 총 모집 인원' 은 학과 현황표의 정원 열이지 전형이 아니고,
# '가군' 하나만 있는 것도 전형 이름이 아니다('가군 > 일반,실기/실적' 처럼 뒤에 붙으면 전형이다).
NO_ADM_INFO = re.compile(r"^(수시|정시|모집|[가나다라]군|입학|편제|학제|수업|연한|정원|총|인원|명|학년도"
                         r"|코드|번호|전형별|구분|전체|계열|일괄|합산|기준|학과별|20\d\d|[A-Z]|[\s·,()（）\-–])+$")
QUOTA_ONLY = re.compile(r"^\s*정원\s*(내|외)\s*$")


def admission_of(header_path):
    """열 제목에서 전형 이름·정원구분을 뽑는다. 원문 표기를 그대로 쓴다."""
    segs = [x for x in (header_path or "").split(" > ") if x and x.strip()]
    # 맨 끝 조각이 합계면 그 열은 전형이 아니라 검산용 합계 열이다
    if segs and TOTAL_SEG.match(tighten(segs[-1])):
        return None, None
    parts = [tighten(SEATS_PREFIX.sub(" ", x)) for x in segs]
    # 쪽 머리말·꼬리말과 중간에 낀 합계 묶음 이름은 전형 이름이 아니다
    parts = [x for x in parts if x and not PAGE_CHROME.search(x) and not TOTAL_SEG.match(x)]
    quota = None
    keep = []
    for p in parts:
        if QUOTA_OUT.search(p):
            quota = "정원외"
        elif QUOTA_IN.search(p):
            quota = "정원내"
        if QUOTA_ONLY.match(p):
            continue                # 정원 구분은 quota_type 에 따로 들어가므로 이름에 남기지 않는다
        if NOT_ADMISSION.match(p) or NOT_ADMISSION.match(p.replace(" ", "")) or SEATS_HDR.fullmatch(p.strip()):
            continue
        keep.append(p)
    # '모집인원', '모집인원(명)', '인원' 처럼 인원 자체를 뜻하는 토막은 앞뒤 어디에 있든 전형 이름이 아니다
    keep = [k for k in keep if not ONLY_SEATS.match(k) and not ONLY_SEATS.match(k.replace(" ", ""))]
    name = " ".join(keep).strip() or None
    if name and NO_ADM_INFO.match(name.replace(" ", "")):
        name = None              # 전형에 대해 아무것도 말해 주지 않는 열 → 전형 열이 아니다
    return name, quota


GROUP_HDR = re.compile(r"모집\s*군|군$|^군$")
GROUP_CELL = re.compile(r"^\s*([가나다라])\s*군?\s*$")


def find_group_col(headers, body):
    """'모집군' 열(칸 값이 가/나/다)의 번호. 없으면 None.

    중앙대 2027 정시처럼 군이 **열이 아니라 행 안의 한 칸**으로 적힌 표가 있다.
    이걸 못 읽으면 정시 모집인원에 군이 비어, 지원 가능 여부를 판단할 수 없다.
    """
    for j in range(len(headers)):
        vals = [norm(PR.cell_str(r[j])) if j < len(r) else "" for r in body]
        ne = [v for v in vals if v]
        if not ne:
            continue
        hit = sum(1 for v in ne if GROUP_CELL.match(v))
        if hit / len(ne) >= 0.7 and hit >= 2:
            return j
        if GROUP_HDR.search((headers[j] or "").split(" > ")[-1]) and hit >= 1:
            return j
    return None


def page_ctx(text, doc_scope):
    """쪽 글자에서 수시/정시·차수·군을 읽는다. 없으면 문서 단위 값을 쓴다."""
    phase = doc_scope
    if PHASE_JEONG.search(text or "") and not PHASE_SU.search(text or ""):
        phase = "정시"
    elif PHASE_SU.search(text or "") and not PHASE_JEONG.search(text or ""):
        phase = "수시"
    m = ROUND_PAT.search(text or "")
    rnd = (f"{'수시' if phase == '수시' else '정시'}{m.group(1)}차") if m and phase else None
    g = GROUP_PAT.search(text or "")
    grp = f"{g.group(1)}군" if g and phase == "정시" else None
    return phase, rnd, grp


def row_text(page, table, ri):
    """그 행의 실제 원문 한 줄(근거용). 표 좌표로 잘라 읽는다."""
    try:
        r = table.rows[ri]
        x0, top, x1, bottom = r.bbox
        t = page.crop((max(x0 - 1, 0), max(top - 1, 0), min(x1 + 1, page.width), min(bottom + 1, page.height))).extract_text()
        return norm(t)[:400] or None
    except Exception:  # noqa: BLE001
        return None


# 전형 이름에 흔히 들어가는 말. 이게 들어 있으면 표 머리글을 제대로 읽은 것이고,
# '안내 일반학생'·'및 인원'·'대학입학전형 이월) 장애' 처럼 본문 토막이 섞이면 잘못 읽은 것이다.
ADM_WORDS = re.compile(r"전형|학생부|교과|종합|논술|실기|수능|특별|지역|농어촌|기회|고른|특성화|재직자"
                       r"|만학도|성인|외국인|기초|차상위|장애|보훈|추천|면접|서류|균형|인재|정원외|군$")


def quality(recs):
    """읽은 품질. **이름이 전형처럼 생긴 비율**을 먼저 보고, 그 다음에 이름이 온전한 정도를 본다.

    같은 표라도 머리글을 몇 단까지 살렸느냐에 따라 '학생부종합 인하미래인재 면접형' 이 되기도 하고
    '농어촌' 으로 뭉개지기도 한다. 쪽 전체를 읽은 격자는 제목·안내문까지 머리글로 먹어
    '안내 일반학생' 같은 이름을 만든다. 길이만 보면 그쪽이 이기므로 **전형다움을 먼저** 본다.
    """
    if not recs:
        return (0.0, 0.0, 0)
    names = [r.get("admission_name_raw") or "" for r in recs]
    like = sum(1 for x in names if ADM_WORDS.search(x)) / len(names)
    return (round(like, 2), sum(len(x) for x in names) / len(names), len(recs))


def extract_doc(pdf, did, uid, years, doc_scope, doc_status, tdb, exc, fallback_year=None):
    """한 문서에서 모집전형 레코드 목록과 검산 정보를 만든다."""
    out, checks, st_skip = [], [], []
    pages = {pi: t for pi, t in tdb.execute("SELECT page_index, text FROM page_text WHERE document_id=?", (did,))}
    cand = [pi for pi, t in pages.items() if t and PROGRAM_HDR.search(t) and SEATS_HDR.search(t)]
    for pi in sorted(cand):
        if pi >= len(pdf.pages):
            continue
        page = pdf.pages[pi]
        try:
            tables = page.find_tables()
        except Exception as e:  # noqa: BLE001
            exc.append({"document_id": did, "university_id": uid, "page_index": pi,
                        "failure": "표 찾기 실패", "detail": str(e)[:200], "extractor": EXTRACTOR})
            continue
        no_ruled = not tables          # 선이 없는 표 → 쪽 전체를 글자 좌표로 읽어 본다(바로 포기하지 않는다)
        ptext = pages.get(pi, "")
        phase, rnd, grp = page_ctx(ptext[:1200], doc_scope)
        page_adm = admission_from_page(ptext)
        src_lines = line_index(ptext)
        year = (PR.year_for(years, PR.detect_years(ptext)) if years else None) or fallback_year
        # 선이 없는 표는 find_tables 가 아예 못 찾는다(강서대 2027 수시 7쪽: 경영학과 16 줄이 선 밖에 있다).
        # 그래서 '쪽 전체를 글자 좌표로 읽은 격자'를 후보로 하나 더 넣고, 검산이 판정하게 둔다.
        candidates = [(ti, t, None) for ti, t in enumerate(tables)]
        try:
            full = grid_from_words(page, (0, 0, page.width, page.height), [])
            if full and len(full) >= 4:
                candidates.append((len(tables), None, full))
        except Exception:  # noqa: BLE001
            pass
        # 같은 쪽에서 나오는 후보는 두 종류다.
        #  (1) 선으로 그려진 표들 — **서로 다른 표**다. 전부 살려야 한다.
        #  (2) 쪽 전체를 글자 좌표로 읽은 격자 — 그 쪽을 통째로 다시 읽은 **대안**이다.
        # 예전에는 이 둘을 한 줄로 세워 최고점 하나만 남겨서, 한 쪽에 표가 둘이면 하나를 잃었다.
        ruled_out, full_out = [], []
        for ti, table, pregrid in candidates:
            recs, chks = [], []
            grid = pregrid if pregrid is not None else table.extract()
            wgrid = []
            if pregrid is None:
                try:
                    edges = []
                    for col in getattr(table, "columns", []) or []:
                        b = getattr(col, "bbox", None)
                        if b:
                            edges += [b[0], b[2]]
                    wgrid = grid_from_words(page, table.bbox, edges)
                except Exception:  # noqa: BLE001
                    wgrid = []
            # 두 격자 중 **전형 이름이 더 잘 살아 있는 쪽**을 쓴다. 숫자 수만 보면
            # 다단 머리글이 뭉개진 격자를 고르게 되어 '학생부종합 > 인하미래인재 > 면접형' 이 '학생부종합' 으로 잘린다.
            def ints_of(g):
                return sum(1 for r in g for c in r if is_int_cell(PR.cell_str(c)))

            def adm_of(g):
                if not g:
                    return 0
                n, h = split_headers_seats(g, 12 if pregrid is not None else 5)
                if not h:
                    return 0
                return sum(1 for x in h if (admission_of(x)[0] or "") and not NOT_ADMISSION.match(x or ""))

            if wgrid and (adm_of(wgrid), ints_of(wgrid)) > (adm_of(grid or []), ints_of(grid or [])):
                grid, used = wgrid, "글자좌표"
            else:
                used = "쪽전체" if pregrid is not None else "표선"
            if not grid:
                continue
            # 쪽 전체를 읽은 격자는 제목·안내문이 앞에 여러 줄 오므로 머리글 탐색 범위를 넓힌다
            mh = 12 if pregrid is not None else 5
            sc, why = score_table(grid, mh)
            why = f"[{used}] " + why
            if sc < 60:
                continue
            nh, headers = split_headers_seats(grid, mh)
            if nh is None:
                continue
            body = grid[nh:]
            pcol = pick_program_col(headers, body)
            if pcol is None:
                exc.append({"document_id": did, "university_id": uid, "page_index": pi, "table": ti,
                            "failure": "모집단위 열을 못 찾음", "detail": why, "extractor": EXTRACTOR})
                continue
            gcol = find_group_col(headers, body)     # 중앙대 정시처럼 군이 행 안의 한 칸인 표
            # 전형 열·합계 열 나누기
            adm_cols, tot_cols = {}, []
            for j in range(len(headers)):
                if j == pcol or j == gcol:
                    continue
                hp = headers[j]
                last = (hp or "").split(" > ")[-1]
                if TOTAL_WORD.search(last) or TOTAL_SUFFIX.search(last) or any(
                        TOTAL_WORD.match(x.strip()) for x in (hp or "").split(" > ")):
                    tot_cols.append(j)
                    continue
                name, quota = admission_of(hp)
                if name and not re.fullmatch(r"[\d\s,.·\-—()]+", name):
                    adm_cols[j] = (name, quota)
            if not adm_cols:
                # '모집단위 + 모집인원' 두 칸짜리 표 → 전형 이름은 쪽 제목에서 가져온다
                seat_cols = [j for j in range(len(headers))
                             if j != pcol and (ONLY_SEATS.match(norm((headers[j] or "").split(" > ")[-1]))
                                               or SEATS_HDR.search(headers[j] or ""))]
                # 한 쪽에 '모집단위–인원' 묶음이 좌우로 둘 이상 있는 경우(성균관대 2027 수시 29쪽)
                if len(seat_cols) >= 2 and page_adm:
                    # 머리글 칸과 자료 칸이 한 칸씩 어긋나는 일이 잦다(성균관대 2027 수시 29쪽:
                    # 머리글 '모집단위'는 8열인데 학과 이름은 9열에 있다).
                    # 그래서 인원 열마다 **왼쪽에서 학과 이름이 실제로 가장 많이 들어 있는 열**을 짝으로 삼는다.
                    blocks = []
                    prev = -1
                    for sj in sorted(seat_cols):
                        best, best_n = None, 0
                        for j in range(sj - 1, prev, -1):
                            n = sum(1 for r in body if j < len(r) and looks_specific_program(PR.cell_str(r[j])))
                            if n > best_n:
                                best, best_n = j, n
                        if best is not None and best_n >= 2:
                            blocks.append((best, sj))
                        prev = sj
                    made_b = 0
                    for pj, sj in blocks:
                        for ri, r in enumerate(body):
                            pn = norm(PR.cell_str(r[pj]) if pj < len(r) else "")
                            v = norm(PR.cell_str(r[sj]) if sj < len(r) else "")
                            if not pn or not is_int_cell(v) or TOTAL_WORD.match(pn) or NOT_PROGRAM_ROW.match(pn):
                                continue
                            seats = to_int(v)
                            # 좌우 묶음은 칸이 어긋나기 쉬우므로 **원문 줄에서 짝이 확인된 것만** 쓴다
                            if not pair_in_source(src_lines, pn, seats):
                                continue
                            pn_clean = clean_program(pn)
                            if not sane_program(pn_clean) or not sane_admission(page_adm):
                                continue
                            recs.append({
                                "key": f"auto_p{pi}_t{ti}_b{pj}_r{ri}",
                                "academic_year": year, "value_status": "confirmed",
                                "note": f"[기계 추출 {EXTRACTOR}] 좌우 2단 표. 원문 줄에서 학과–인원 짝 확인. {why[:70]}",
                                "phase": phase, "round": rnd, "admission_group": grp,
                                "admission_name_raw": page_adm, "quota_type": None,
                                "program_name_raw": pn_clean, "seats_planned": seats, "seats_raw": v,
                                "document_status": doc_status,
                                "evidence": [{"document_id": did, "page_index": pi,
                                              "fields": ["seats_planned", "program_name_raw", "admission_name_raw"],
                                              "header_path": headers[sj], "row_label": pn,
                                              "raw_text": next((ln for ln in (ptext or "").splitlines()
                                                                if pn.replace("*", "") in ln), f"{pn} {v}")[:400]}],
                            })
                            made_b += 1
                    if made_b:
                        (full_out if pregrid is not None else ruled_out).append((quality(recs), recs, chks))
                        continue
                if len(seat_cols) == 1 and page_adm:
                    adm_cols = {seat_cols[0]: (page_adm, None)}
                    tot_cols = [j for j in tot_cols if j != seat_cols[0]]
                    why = "[쪽 제목의 전형] " + why
                else:
                    exc.append({"document_id": did, "university_id": uid, "page_index": pi, "table": ti,
                                "failure": "전형 열을 못 찾음", "detail": why, "extractor": EXTRACTOR})
                    continue

            # ── 검산: 행마다 '각 전형 인원의 합 == 그 행의 계' 인지 본다 ──
            rows_ok, rows_bad, no_total = 0, 0, 0
            cand_rows = []
            for ri, r in enumerate(body):
                prog = norm(PR.cell_str(r[pcol]) if pcol < len(r) else "")
                if not prog or NOT_PROGRAM_ROW.match(prog):
                    continue
                # 합계 행의 '합계'가 학과 열이 아니라 다른 열(구분 열 등)에 있을 수 있다
                is_total_row = bool(TOTAL_WORD.match(prog)) or bool(TOTAL_PREFIX.match(prog)) or any(
                    TOTAL_WORD.match(norm(PR.cell_str(c))) for c in r[:max(pcol, 1) + 1])
                cells = {}
                for j in adm_cols:
                    v = norm(PR.cell_str(r[j]) if j < len(r) else "")
                    if v:
                        cells[j] = v
                nums = [to_int(v) for v in cells.values() if is_int_cell(v)]
                tot = None
                for j in tot_cols:
                    v = norm(PR.cell_str(r[j]) if j < len(r) else "")
                    if is_int_cell(v):
                        tot = to_int(v)
                        break
                row_tot_ok = None          # 이 행 자신의 가로 검산 결과: True / False / None(검산 불가)
                if tot is None:
                    no_total += 1
                elif nums and sum(nums) == tot:
                    rows_ok += 1
                    row_tot_ok = True
                elif nums:
                    rows_bad += 1
                    row_tot_ok = False
                cand_rows.append((ri, r, prog, is_total_row, cells, row_tot_ok))

            # ── 검산 2: '계' 열이 없으면 맨 아래 **합계 행**으로 세로 검산한다 ──
            if rows_ok + rows_bad < 2:
                tot_row = next((c for c in cand_rows if c[3]), None)      # is_total_row
                if tot_row:
                    col_ok = col_bad = 0
                    for j in adm_cols:
                        tv = norm(PR.cell_str(tot_row[1][j]) if j < len(tot_row[1]) else "")
                        if not is_int_cell(tv):
                            continue
                        colsum = 0
                        for ri2, r2, prog2, istot2, cells2, _ok2 in cand_rows:
                            if istot2:
                                continue
                            v2 = cells2.get(j, "")
                            if is_int_cell(v2):
                                colsum += to_int(v2)
                        if colsum == to_int(tv):
                            col_ok += 1
                        else:
                            col_bad += 1
                    # 인원 열이 하나뿐인 표(전형이 쪽 제목에 있는 모양)도 있으므로 1개부터 인정한다.
                    # 한 열이라도 '학과별 값의 합 == 인쇄된 소계' 가 맞으면 표가 제대로 읽힌 것이다.
                    if col_ok + col_bad >= 1:
                        rows_ok, rows_bad = col_ok, col_bad
                        why = f"세로(합계 행) 검산 {col_ok}/{col_ok + col_bad}. " + why

            # 산수 검산이 불가능해도, **행 전체가 원문 줄과 순서까지 일치**하면 그 표는 제대로 읽힌 것이다
            if rows_ok + rows_bad < 1:
                seq_ok = sum(1 for _, r, prog, istot, _c, _o in cand_rows if not istot
                             and row_matches_source(src_lines, prog, r[pcol + 1:]))
                if seq_ok >= 2:
                    rows_ok, rows_bad = seq_ok, 0
                    why = f"[원문 줄 순서 대조 {seq_ok}행] " + why

            # 그래도 안 되면 학과–인원 짝만이라도 원문 줄에서 확인한다
            if rows_ok + rows_bad < 1:
                hit = sum(1 for _, r, prog, istot, cells, _o in cand_rows if not istot
                          for v in cells.values() if is_int_cell(v)
                          and pair_in_source(src_lines, prog, to_int(v)))
                n_data = sum(1 for c in cand_rows if not c[3])
                if hit >= 2 or (hit >= 1 and n_data <= 2):
                    rows_ok, rows_bad = hit, 0
                    why = f"[원문 줄 대조 {hit}건 / 자료 {n_data}행] " + why

            checked = rows_ok + rows_bad
            if checked < 1:
                # 검산할 '계' 열이 없다 → 표가 제대로 읽혔는지 기계가 확인할 방법이 없다.
                # 값을 만들지 않고 예외 큐로 보낸다(사람·에이전트가 그 쪽만 보면 된다).
                exc.append({"document_id": did, "university_id": uid, "page_index": pi, "table": ti,
                            "failure": "검산할 합계 열이 없어 기계 추출로 확정할 수 없음",
                            "detail": f"전형 열 {len(adm_cols)}개, 자료 행 {len(cand_rows)}개. {why}",
                            "extractor": EXTRACTOR})
                st_skip.append(len(cand_rows) * max(len(adm_cols), 1))
                continue
            if rows_ok / checked < 0.8:
                exc.append({"document_id": did, "university_id": uid, "page_index": pi, "table": ti,
                            "failure": "행 합계가 맞지 않음 — 표가 어긋났을 수 있어 값을 만들지 않음",
                            "detail": f"검산 {rows_ok}/{checked} 일치. {why}", "extractor": EXTRACTOR})
                continue

            made, dropped = 0, 0
            for ri, r, prog, is_total_row, cells, row_tot_ok in cand_rows:
                raw = row_text(page, table, ri + nh) if table is not None else " ".join(x for x in r if x)[:400]
                # 이 행 자신이 검증됐는가. **표 전체가 통과했다고 틀린 행까지 확정하지 않는다.**
                # (5행 중 4행이 맞으면 나머지 한 행의 틀린 값까지 confirmed 가 되던 문제)
                # 이 행의 모집군(가/나/다). 열로 적힌 표는 여기서 행마다 읽는다.
                row_grp = grp
                if gcol is not None and gcol < len(r):
                    mg = GROUP_CELL.match(norm(PR.cell_str(r[gcol])))
                    if mg:
                        row_grp = mg.group(1) + "군"
                if row_tot_ok is False:
                    ok_row, ok_why = False, "이 행의 가로 검산이 맞지 않아 보류."
                elif row_tot_ok is True:
                    ok_row, ok_why = True, "이 행의 가로 검산 일치."
                elif row_matches_source(src_lines, prog, r[pcol + 1:]):
                    ok_row, ok_why = True, "이 행이 원문 줄과 순서까지 일치."
                else:
                    ok_row, ok_why = None, "이 행을 따로 확인할 방법이 없어 보류."
                for j, v in cells.items():
                    if not (is_int_cell(v) or v in ("-", "－", "‑")):
                        continue
                    name, quota = adm_cols[j]
                    # 시기·차수는 **그 열의 머리글**에서 읽는 것이 가장 정확하다.
                    # 전문대 요강은 한 표에 수시1차·수시2차·정시가 같이 있어, 쪽 글자로는 시기를 정할 수 없다.
                    hp_j = headers[j] if j < len(headers) else ""
                    col_phase, col_round = phase, rnd
                    if PHASE_SU.search(hp_j) and not PHASE_JEONG.search(hp_j):
                        col_phase = "수시"
                    elif PHASE_JEONG.search(hp_j) and not PHASE_SU.search(hp_j):
                        col_phase = "정시"
                    mrd = ROUND_PAT.search(hp_j)
                    if mrd and col_phase:
                        col_round = f"{col_phase}{mrd.group(1)}차"
                    seats = to_int(v) if is_int_cell(v) else None
                    # 행 단위로 확인이 안 됐으면, 이 칸 하나만이라도 원문 줄에서 짝을 찾아본다
                    if ok_row is None and seats is not None and pair_in_source(src_lines, prog, seats):
                        cell_status, cell_why = "confirmed", "이 값이 원문 줄에서 학과-인원 짝으로 확인됨."
                    else:
                        cell_status = "confirmed" if ok_row else "pending"
                        cell_why = ok_why
                    prog_clean = clean_program(prog)
                    if not is_total_row and seats is not None and seats > 1000:
                        dropped += 1
                        continue
                    if not is_total_row and (not sane_program(prog_clean) or not sane_admission(name)):
                        dropped += 1
                        continue
                    if is_total_row:
                        chks.append({"page_index": pi, "table": ti, "admission": name,
                                       "quota_type": quota, "seats": seats, "label": prog})
                        continue
                    recs.append({
                        "key": f"auto_p{pi}_t{ti}_r{ri}_c{j}",
                        "academic_year": year,
                        # 행 합계로 검산된 표만 confirmed. 검산할 합계가 없으면 pending(사람이 확인해야 한다).
                        "value_status": cell_status,
                        "note": f"[기계 추출 {EXTRACTOR}] {cell_why} 표 검산 {rows_ok}/{checked}. {why[:80]}",
                        "phase": col_phase, "round": col_round, "admission_group": row_grp,
                        "admission_name_raw": name, "quota_type": quota,
                        "program_name_raw": prog_clean,
                        "seats_planned": seats, "seats_raw": v,
                        "document_status": doc_status,
                        "evidence": [{"document_id": did, "page_index": pi,
                                      "fields": ["seats_planned", "program_name_raw", "admission_name_raw"],
                                      "header_path": headers[j] if j < len(headers) else None,
                                      "row_label": prog, "raw_text": raw or f"{prog} {v}"}],
                    })
                    made += 1
            if dropped:
                exc.append({"document_id": did, "university_id": uid, "page_index": pi, "table": ti,
                            "failure": "이름이 어긋난 칸을 버림(표가 한 칸씩 밀렸을 수 있음)",
                            "detail": f"버린 칸 {dropped}개, 만든 칸 {made}개. {why}", "extractor": EXTRACTOR})
            if made == 0:
                exc.append({"document_id": did, "university_id": uid, "page_index": pi, "table": ti,
                            "failure": "표는 찾았으나 값 행을 못 만듦", "detail": why, "extractor": EXTRACTOR})
            (full_out if pregrid is not None else ruled_out).append((quality(recs), recs, chks))

        # 같은 쪽을 여러 방식으로 읽으면 결과가 여럿 나온다. **가장 잘 읽힌 하나만** 쓴다.
        # 인하대 2027 수시 6쪽에서 전형 이름이 온전한 63건과 머리글이 뭉개진 215건이 함께 나왔다.
        made_any = [x for x in ruled_out if x[1]]
        if made_any:
            # 선으로 그려진 표는 **전부** 쓴다. 한 쪽에 표가 둘이면 둘 다 진짜 표다.
            for _q, recs, chks in made_any:
                out.extend(recs)
                checks.extend(chks)
            dropped_full = sum(len(x[1]) for x in full_out)
            if dropped_full:
                exc.append({"document_id": did, "university_id": uid, "page_index": pi,
                            "failure": "쪽 전체를 다시 읽은 결과는 쓰지 않음(선으로 그려진 표를 이미 읽었다)",
                            "detail": f"선 표 {sum(len(x[1]) for x in made_any)}건 채택, 쪽 전체 읽기 {dropped_full}건 버림",
                            "extractor": EXTRACTOR})
        elif full_out:
            best = max(full_out, key=lambda x: x[0])
            out.extend(best[1])
            checks.extend(best[2])
            버린 = sum(len(x[1]) for x in full_out) - len(best[1])
            if 버린:
                exc.append({"document_id": did, "university_id": uid, "page_index": pi,
                            "failure": "쪽 전체를 여러 방식으로 읽어 덜 정확한 쪽을 버림",
                            "detail": f"채택 {len(best[1])}건, 버림 {버린}건", "extractor": EXTRACTOR})
        elif no_ruled:
            exc.append({"document_id": did, "university_id": uid, "page_index": pi,
                        "failure": "표를 못 찾음(선도 없고 글자 좌표로도 표가 안 나옴)", "extractor": EXTRACTOR})
    return out, checks, st_skip


def reconcile(rows, checks):
    """인쇄된 합계와 추출한 값의 합을 비교한다. 맞지 않으면 그대로 보고한다(값을 고치지 않는다)."""
    got = Counter()
    for r in rows:
        if r["seats_planned"] is not None:
            got[(r["evidence"][0]["page_index"], r["admission_name_raw"], r["quota_type"])] += r["seats_planned"]
    res = []
    for c in checks:
        if c["seats"] is None:
            continue
        k = (c["page_index"], c["admission"], c["quota_type"])
        res.append({"쪽": c["page_index"], "전형": c["admission"], "정원구분": c["quota_type"],
                    "인쇄된합계": c["seats"], "추출합": got.get(k, 0), "일치": got.get(k, 0) == c["seats"]})
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--univ"); ap.add_argument("--doc")
    ap.add_argument("--limit", type=int); ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry", action="store_true", help="파일을 쓰지 않고 결과 수만 본다")
    a = ap.parse_args()
    import pdfplumber
    con, tdb = connect(), text_db()
    q = """SELECT DISTINCT f.document_id, f.university_id, f.raw_path, d.document_type, d.admission_scope,
                  d.academic_years_detected, d.academic_years_claimed
           FROM document_file f JOIN document d USING(document_id) JOIN university_campus u ON u.university_id=f.university_id
           WHERE d.document_type IN ('모집요강','시행계획') AND u.in_target=1 AND f.is_original_format_archive=0
             AND lower(f.raw_path) LIKE '%.pdf'"""
    docs = list(con.execute(q))
    if a.univ:
        keep = set(a.univ.split(","))
        docs = [d for d in docs if d["university_id"] in keep]
    if a.doc:
        docs = [d for d in docs if d["document_id"] == a.doc]
    if a.limit:
        docs = docs[:a.limit]

    st = Counter()
    exc = []
    exc_flushed = 0          # 어디까지 파일에 썼는지. 문서 하나 끝날 때마다 바로 쓴다.
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    EXC_PATH.parent.mkdir(parents=True, exist_ok=True)

    def flush_exc():
        """예외를 **문서 하나 끝날 때마다** 파일에 쓴다.

        2026-09-20 전체 실행에서 예외 큐를 맨 끝에 한 번에 쓰게 만들어 두었더니,
        중간에 멈추자 그때까지의 예외 기록이 통째로 사라졌다. 같은 일이 없게 한다.
        """
        nonlocal exc_flushed
        if a.dry or exc_flushed >= len(exc):
            return
        with EXC_PATH.open("a", encoding="utf-8") as f:
            for e in exc[exc_flushed:]:
                f.write(json.dumps(e, ensure_ascii=False) + "\n")
        exc_flushed = len(exc)
    for d in docs:
        did, uid = d["document_id"], d["university_id"]
        if not a.force and con.execute(
                "SELECT 1 FROM processing_log WHERE document_id=? AND stage='auto_offerings' AND parser_version=?",
                (did, PARSER_VERSION)).fetchone():
            st["건너뜀(이미 처리)"] += 1
            continue
        path = RAW / d["raw_path"]
        if not path.exists():
            exc.append({"document_id": did, "university_id": uid, "failure": "파일 없음", "extractor": EXTRACTOR})
            st["파일 없음"] += 1
            flush_exc()
            continue
        years = json.loads(d["academic_years_detected"] or "[]") or json.loads(d["academic_years_claimed"] or "[]")
        scope = {"수시": "수시", "정시": "정시"}.get(d["admission_scope"])
        status = "시행계획" if d["document_type"] == "시행계획" else "확정요강"
        # RAW 는 '2027/대학이름/…' 처럼 학년도 폴더로 나뉘어 있다. 본문에서 연도를 못 읽으면 이것을 쓴다.
        mfy = re.match(r"(20\d\d)/", d["raw_path"] or "")
        fallback = (int(years[0]) if len(years) == 1 else None) or (int(mfy.group(1)) if mfy else None)
        try:
            with pdfplumber.open(path) as pdf:
                rows, checks, skipped = extract_doc(pdf, did, uid, years, scope, status, tdb, exc, fallback)
        except Exception as e:  # noqa: BLE001
            exc.append({"document_id": did, "university_id": uid, "failure": "PDF 열기 실패",
                        "detail": str(e)[:200], "extractor": EXTRACTOR})
            st["열기 실패"] += 1
            flush_exc()
            continue
        rec = reconcile(rows, checks)
        st["문서"] += 1
        st["레코드"] += len(rows)
        st["검산불가로 버린 칸"] += sum(skipped)
        st["합계대조 일치"] += sum(1 for x in rec if x["일치"])
        st["합계대조 불일치"] += sum(1 for x in rec if not x["일치"])
        if not a.dry:
            # **문서 하나 = 파일 하나**, 임시 파일에 쓴 뒤 이름을 바꿔 끼운다(원자적 교체).
            # 예전에는 대학 파일 하나에 이어 붙이면서 '이번 실행에서 처음 만나는 대학'이면 지웠다.
            # 그래서 중간에 멈췄다가 이어 돌리면, 먼저 처리한 문서의 결과가 통째로 사라졌다.
            ud = OUT_DIR / uid
            ud.mkdir(parents=True, exist_ok=True)
            safe = "doc_" + re.sub(r"[^0-9A-Za-z]", "_", did)
            tmp = ud / f".{safe}.jsonl.tmp"
            tmp.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
            tmp.replace(ud / f"{safe}.jsonl")
            (ud / f"{safe}._reconcile.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1),
                                                        encoding="utf-8")
        if not a.dry:
            log(con, did, "auto_offerings", "done" if rows else "partial",
                f"{uid}: 모집전형 {len(rows)}건, 합계대조 {sum(1 for x in rec if x['일치'])}/{len(rec)}")
            con.commit()
        flush_exc()
    flush_exc()
    if not a.dry:
        # 대학별 묶음(offerings.jsonl)은 **문서 파일들에서 매번 새로 만든다.**
        # 이어 붙이지 않으므로 중복도 손실도 생기지 않는다.
        for ud in sorted(OUT_DIR.glob("*")):
            if not ud.is_dir():
                continue
            parts = sorted(ud.glob("doc_*.jsonl"))
            text = "".join(f.read_text(encoding="utf-8") for f in parts)
            tmp = ud / ".offerings.jsonl.tmp"
            tmp.write_text(text, encoding="utf-8")
            tmp.replace(ud / "offerings.jsonl")
            st["묶은 문서"] += len(parts)
    st["예외"] = len(exc)
    print(dict(st))
    if exc:
        c = Counter(e["failure"] for e in exc)
        print("예외 사유:", c.most_common())


if __name__ == "__main__":
    main()
