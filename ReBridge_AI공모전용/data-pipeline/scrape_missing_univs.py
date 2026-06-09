"""
누락 핵심대학 웹스크래핑 복구 (작업 B 2차 시도)
- 중앙대(cau):    /tmp/cau_2025_susi.pdf
- 인하대(inha):   /tmp/inha_2025_susi_kyobit.pdf
- 한양대(hanyang):/tmp/hanyang_official.pdf
- 충남대/전북대: image-based PDF, 이번 회차 복구 불가
"""

import json, re, pathlib

BASE  = pathlib.Path(__file__).parent
CLEAN = BASE / "results_2025_clean.json"
UNIV  = BASE / "universities.json"

univs = {u["univId"]: u for u in json.loads(UNIV.read_text())}

# ── 이미 추가된 것은 제거하고 원본만 로드 ──────────────────────────
rows_all = json.loads(CLEAN.read_text())
rows = [r for r in rows_all if r.get("univId") not in {"cau","inha","hanyang"}]
print(f"기존 행 수(원본): {len(rows)} (cau/inha/hanyang 제거 후)")

def clean_unit(s):
    if not s: return s
    s = re.sub(r'(?<=[가-힣a-zA-Z·]) (?=[가-힣a-zA-Z·(])', '', s)
    s = re.sub(r'\s*·\s*', '·', s)
    return s.strip()

def make_row(uid, uname, phase, adm_type, adm_name,
             unit, cut_type, cut_grade=None, cut_score=None,
             src_file=None, src_page=None, note="[B: 웹스크래핑 복구]"):
    return dict(univId=uid, univName=uname, phase=phase,
                admissionType=adm_type, admissionName=adm_name,
                unit=unit, year=2025, cutType=cut_type,
                cutGrade=cut_grade, cutScore=cut_score,
                recruitCount=None, competition=None,
                region=univs.get(uid,{}).get("region",""),
                sourceFile=src_file or f"{uid}_2025_scrape",
                sourcePage=src_page, confidence="mid", note=note)

# ═══════════════════════════════════════════════
# 중앙대 파싱
# ═══════════════════════════════════════════════
def parse_cau():
    import fitz
    try: doc = fitz.open("/tmp/cau_2025_susi.pdf")
    except Exception as e: print(f"CAU 오류: {e}"); return []

    lines = [l.strip() for l in doc[0].get_text().split('\n') if l.strip()]
    doc.close()

    SKIP = {
        "캠퍼스","단과대학","모집단위","지역균형CAU융합형","인재",
        "CAU탐구형","논술전형","전과목","상위5","성적",
        "서울","다빈치","안성","인문","자연",
        "실기전형 합격자 입시결과","경쟁률","충원율","교과등급","평균","실기점수",
    }
    SKIP_START = ("http","발행일","주요전형","2025학","2024학","중앙대","비카우스",
                  "모든 전공","AI ","시대를","세대로","※","+ ","2 0 2","-\t")
    COL_PAT = re.compile(r'^.{2,10}(?:대학|학원)$')
    NUM_PAT = re.compile(r'^[\d.]+$')
    UNIT_PAT = re.compile(
        r'^([가-힣a-zA-Z()·/\s]{2,24}(?:학과|학부|전공|공학|의학|간호학|'
        r'경제학|법학|물리학|화학|수학|교육학|사회학|철학|역사학|인류학|'
        r'경영학|통계학|홍보학|물류학|보안학|'
        r'과(?=[가-힣]?$)|부(?=[가-힣]?$)|학(?=[가-힣]?$)))$'
    )

    ADMISSIONS = [
        ("지역균형",      "학생부교과"),
        ("CAU융합형인재", "학생부종합"),
        ("CAU탐구형인재", "학생부종합"),
    ]

    result = []
    current = None
    parent  = None
    vbuf    = []
    active  = False

    def flush(unit, vals):
        if not unit or not vals: return
        unit = clean_unit(unit)
        # 마지막 값이 논술 점수 (≥30) 이면 분리
        score = None
        if vals and vals[-1] != '-':
            try:
                v = float(vals[-1])
                if v >= 30:
                    score = v
                    vals = vals[:-1]
            except: pass
        # 남은 마지막이 논술 교과등급 (1~9 소수)
        nol = None
        if vals and vals[-1] != '-':
            try:
                v = float(vals[-1])
                if 1.0 <= v <= 9.0:
                    nol = round(v,2)
                    vals = vals[:-1]
            except: pass
        # 앞 3컬럼 → 지역균형, 융합형, 탐구형
        for idx,(aname,atype) in enumerate(ADMISSIONS):
            if idx < len(vals) and vals[idx] != '-':
                try:
                    cg = float(vals[idx])
                    if 1.0 <= cg <= 9.0:
                        result.append(make_row("cau","중앙대학교","수시",atype,aname,
                            unit,"평균",cut_grade=round(cg,2),
                            src_file="cau_2025_susi.pdf",src_page=1,
                            note="[B: 중앙대 입학처 PDF]"))
                except: pass
        if nol:
            result.append(make_row("cau","중앙대학교","수시","논술","논술전형",
                unit,"평균",cut_grade=nol,src_file="cau_2025_susi.pdf",src_page=1,
                note="[B: 중앙대 논술 교과등급]"))
        if score:
            result.append(make_row("cau","중앙대학교","수시","논술","논술전형",
                unit,"평균",cut_score=score,src_file="cau_2025_susi.pdf",src_page=1,
                note="[B: 중앙대 논술점수]"))

    for line in lines:
        if line in SKIP: continue
        if any(line.startswith(s) for s in SKIP_START):
            if not active:   # 데이터 섹션 전이면 스킵만 (break 금지)
                continue
            if current and vbuf: flush(current, vbuf[:])
            break
        # 단과대학
        if COL_PAT.match(line) and not NUM_PAT.match(line):
            if current and vbuf: flush(current, vbuf[:]); vbuf=[]
            current=None; parent=None; active=True; continue
        # 숫자 or 대시
        if NUM_PAT.match(line) or line=='-':
            if active: vbuf.append(line)
            continue
        # 모집단위
        if active and len(line)>=2:
            if current and vbuf: flush(current, vbuf[:]); vbuf=[]
            m = UNIT_PAT.match(line)
            if m:
                u = m.group(1).strip()
                if parent and len(u)<=8 and '학부' not in u and '대학' not in u:
                    current = f"{parent} {u}"
                else:
                    if '학부' in u and len(u)<=10 and '학생부' not in u:
                        parent = u
                    else:
                        parent = None
                    current = u
            else:
                current = line

    if current and vbuf: flush(current, vbuf[:])
    print(f"CAU 파싱 완료: {len(result)}행")
    return result


# ═══════════════════════════════════════════════
# 인하대 파싱
# ═══════════════════════════════════════════════
def parse_inha():
    import fitz
    try: doc = fitz.open("/tmp/inha_2025_susi_kyobit.pdf")
    except Exception as e: print(f"INHA 오류: {e}"); return []

    result = []
    PAGE_CFG = {
        6:  ("학생부종합","인하미래인재(면접형)","수시"),
        8:  ("학생부교과","지역균형","수시"),
        10: ("논술","논술우수자","수시"),
    }
    NUM_PAT  = re.compile(r'^[\d.]+%?$')
    UNIT_PAT = re.compile(
        r'^([가-힣a-zA-Z()·/\s]{3,30}(?:학과|학부|전공|학|부|원|과정|'
        r'바이오메디컬공학전공|자유전공융합학부)(?:\(.*?\))?)\s*$'
    )

    for pg, (atype, aname, phase) in PAGE_CFG.items():
        if pg >= len(doc): continue
        lines = [l.strip() for l in doc[pg].get_text().split('\n') if l.strip()]
        cur=None; nbuf=[]; started=False

        def flush_inha(unit, nums, at=atype, an=aname, ph=phase):
            unit = clean_unit(unit)
            scores=[v for v in nums if 50<=v<=100]
            # 교과등급: 소수점 있고 1~9.9 범위
            # 경쟁률(7.1, 9.7 등)이 범위 안에 들어올 수 있으므로 LAST 2개를 사용
            # → 면접형: [1단계50%, 1단계70%, 최종50%, 최종70%] 중 마지막 2개 = 최종등록자
            # → 지역균형: [경쟁률, 실질경쟁률, 50%컷, 70%컷] 중 마지막 2개 = 실제 교과등급
            grade_list = [round(v,2) for v in nums if 1.0<=v<=9.9 and v!=round(v,0)]
            if not grade_list:
                grade_list = [round(v,2) for v in nums if 1.0<=v<=9.9]
            if len(grade_list)>=2:
                result.append(make_row("inha","인하대학교",ph,at,an,unit,"50%컷",
                    cut_grade=grade_list[-2],src_file="inha_2025_susi.pdf",
                    note="[B: 인하대 입학처 PDF]"))
                result.append(make_row("inha","인하대학교",ph,at,an,unit,"70%컷",
                    cut_grade=grade_list[-1],src_file="inha_2025_susi.pdf",
                    note="[B: 인하대 입학처 PDF]"))
            elif len(grade_list)==1:
                result.append(make_row("inha","인하대학교",ph,at,an,unit,"50%컷",
                    cut_grade=grade_list[-1],src_file="inha_2025_susi.pdf",
                    note="[B: 인하대 입학처 PDF]"))
            if scores and at=="논술":
                result.append(make_row("inha","인하대학교",ph,at,an,unit,"평균",
                    cut_score=scores[0],src_file="inha_2025_susi.pdf",
                    note="[B: 인하대 논술점수]"))

        for line in lines:
            if "최종등록자 교과등급" in line or "50%CUT" in line or "50%Cut" in line:
                started=True; continue
            if not started: continue
            # 퍼센트 라인 스킵
            if re.match(r'^\d+\.?\d*%$', line): continue
            # 숫자
            if NUM_PAT.match(line.rstrip('%')):
                try: nbuf.append(float(line.rstrip('%')))
                except: pass
                continue
            # 여러 숫자 한 줄
            parts = line.split()
            if len(parts)>=2 and all(re.match(r'^[\d.]+%?$',p) for p in parts):
                for p in parts:
                    try: nbuf.append(float(p.rstrip('%')))
                    except: pass
                continue
            # 모집단위
            m = UNIT_PAT.match(line)
            if m:
                if cur and nbuf: flush_inha(cur, nbuf)
                cur=m.group(1).strip(); nbuf=[]
                continue
            # 모집단위+숫자 같은 줄
            cm = re.match(r'^([가-힣a-zA-Z()·/\s]{3,30}(?:학과|학부|전공|학|부|과정)(?:\(.*?\))?)\s+([\d.\s%]+)$', line)
            if cm:
                if cur and nbuf: flush_inha(cur, nbuf)
                cur=cm.group(1).strip(); nbuf=[]
                for p in cm.group(2).split():
                    try: nbuf.append(float(p.rstrip('%')))
                    except: pass
                continue
            # 다른 텍스트 → 버퍼 flush
            if cur and nbuf and len(line)>5:
                flush_inha(cur, nbuf)
                cur=None; nbuf=[]

        if cur and nbuf: flush_inha(cur, nbuf)

    doc.close()
    print(f"INHA 파싱 완료: {len(result)}행")
    return result


# ═══════════════════════════════════════════════
# 한양대 파싱
# ═══════════════════════════════════════════════
def parse_hanyang():
    import fitz
    try: doc = fitz.open("/tmp/hanyang_official.pdf")
    except Exception as e: print(f"HY 오류: {e}"); return []

    result = []

    # (page_idx_0based, adm_type, adm_name, phase, is_score_page)
    PAGE_CFG = [
        (7,  "학생부교과","추천형","수시",False),
        (8,  "학생부교과","추천형","수시",False),
        (9,  "학생부종합","추천형","수시",False),
        (10, "학생부종합","서류형","수시",False),
        (11, "학생부종합","서류형","수시",False),
        (12, "학생부종합","면접형","수시",False),
        (13, "논술",     "논술전형","수시",True),
        (14, "논술",     "논술전형","수시",True),
        (17, "수능위주", "수능일반","정시",True),
        (18, "수능위주", "수능일반","정시",True),
    ]

    UNIT_PAT = re.compile(
        r'^([가-힣a-zA-Z()·/\s]{3,35}(?:학과|학부|전공|학|부|원|과정|'
        r'공학부|의학과|인터칼리지|계열|전기전공)(?:\s*\([^)]+\))?)\s*$'
    )
    NUM_PAT = re.compile(r'^[\d.]+$')
    COLLEGE_PAT = re.compile(r'^.{2,10}(?:대학|학원)$')
    SKIP_WORDS = {
        "2024~26학년도","한양대학교","입시통계","대학","모집단위","계열",
        "경쟁률","추가합격인원","최종등록자","내신등급","수능최저충족률",
        "논술","점수","2026","2025","2024","자연","인문","상경","예체능",
        "오전","오후","공과대학","인문과학대학","사회과학대학",
        "자연과학대학","경제금융대학","경영대학","사범대학","생활과학대학",
        "예술·체육대학","정책과학대학","국제대학","간호대학","서울캠퍼스",
        "Hanyang","University","입시통계",
        "이상","최고점","대학교","입시 통계","통계",
    }
    SKIP_CONTAINS = [
        "학년도", "입시통계", "한양대", "상위 80%", "80% 평균", "수학 응시",
        "확률과", "미적분", "기하", "국어", "수학", "영어", "탐구", "한국사",
        "백분위", "응시현황", "04763",
    ]

    for pg,atype,aname,phase,is_score in PAGE_CFG:
        if pg>=len(doc): continue
        if phase=="정시":
            lines=[l.strip() for l in doc[pg].get_text().split('\n') if l.strip()]
            result.extend(_hy_jeongsi(lines, pg+1))
            continue

        lines=[l.strip() for l in doc[pg].get_text().split('\n') if l.strip()]
        cur=None; nbuf=[]

        def flush_hy(unit, nums, at=atype, an=aname, ph=phase, isc=is_score):
            unit=clean_unit(unit)
            if isc:  # 논술
                big=[v for v in nums if v>=50]
                # 2025 논술점수 = 두번째 big값 (2026이 먼저 나옴)
                if len(big)>=2:
                    result.append(make_row("hanyang","한양대학교",ph,at,an,unit,"평균",
                        cut_score=round(big[1],2),src_file="hanyang_official.pdf",
                        src_page=pg+1,note="[B: 한양대 입학처 PDF - 논술점수]"))
                elif len(big)==1:
                    result.append(make_row("hanyang","한양대학교",ph,at,an,unit,"평균",
                        cut_score=round(big[0],2),src_file="hanyang_official.pdf",
                        src_page=pg+1,note="[B: 한양대 입학처 PDF - 논술점수]"))
            else:  # 교과/종합 등급
                grades=[v for v in nums if 1.0<=v<=6.0 and v!=int(v)]
                # 2025 데이터 = grades 두번째 값
                if len(grades)>=2:
                    cg=grades[1]
                elif len(grades)==1:
                    cg=grades[0]
                else: return
                result.append(make_row("hanyang","한양대학교",ph,at,an,unit,"평균",
                    cut_grade=round(cg,2),src_file="hanyang_official.pdf",
                    src_page=pg+1,note="[B: 한양대 입학처 PDF - 내신등급 평균]"))

        for line in lines:
            if line in SKIP_WORDS: continue
            if any(s in line for s in SKIP_CONTAINS): continue
            if NUM_PAT.match(line):
                try: nbuf.append(float(line))
                except: pass
                continue
            parts=line.split()
            if len(parts)>=2 and all(re.match(r'^[\d.]+$',p) for p in parts):
                for p in parts:
                    try: nbuf.append(float(p))
                    except: pass
                continue
            # 모집단위
            if UNIT_PAT.match(line) and not COLLEGE_PAT.match(line):
                if cur and nbuf: flush_hy(cur, nbuf)
                cur=line; nbuf=[]; continue
            if COLLEGE_PAT.match(line):
                if cur and nbuf: flush_hy(cur, nbuf)
                cur=None; nbuf=[]; continue

        if cur and nbuf: flush_hy(cur, nbuf)

    doc.close()
    print(f"HY 파싱 완료: {len(result)}행")
    return result


def _hy_jeongsi(lines, page_no):
    """한양대 정시 p18-19: 국/수/탐 80% 평균 백분위"""
    result=[]
    NUM_PAT=re.compile(r'^[\d.]+%?$')
    UNIT_PAT=re.compile(
        r'^([가-힣a-zA-Z()·/\s]{3,35}(?:학과|학부|전공|학|부|과정)(?:\s*\([^)]+\))?)\s*$'
    )
    SKIP={"모집군","대학","모집단위","최종등록자","백분위","국어","수학","탐구","국/수/탐","영어","한국사",
          "평균","등급","응시현황","확률과통계","미적분","기하","가","나","다"}
    SKIP_CONT=["학년도","입시통계","한양대","80%","응시현황","확률과","미적분","기하"]
    GUN_PAT=re.compile(r'^<[가나다]>군$')

    cur=None; nbuf=[]; gun="가"
    for line in lines:
        if GUN_PAT.match(line): gun=line[1]; continue
        if line in SKIP: continue
        if any(s in line for s in SKIP_CONT): continue
        if NUM_PAT.match(line.rstrip('%')):
            try: nbuf.append(float(line.rstrip('%')))
            except: pass
            continue
        parts=line.split()
        if len(parts)>=2 and all(re.match(r'^[\d.]+%?$',p) for p in parts):
            for p in parts:
                try: nbuf.append(float(p.rstrip('%')))
                except: pass
            continue
        m=UNIT_PAT.match(line)
        if m:
            if cur and len(nbuf)>=4:
                try:
                    avg=float(nbuf[3])
                    if 30<=avg<=100:
                        result.append(make_row("hanyang","한양대학교","정시","수능위주","수능일반",
                            clean_unit(cur),"80%컷",cut_score=round(avg,2),
                            src_file="hanyang_official.pdf",src_page=page_no,
                            note=f"[B: 한양대 정시 수능 80%평균 ({gun}군)]"))
                except: pass
            cur=m.group(1).strip(); nbuf=[]; continue

    if cur and len(nbuf)>=4:
        try:
            avg=float(nbuf[3])
            if 30<=avg<=100:
                result.append(make_row("hanyang","한양대학교","정시","수능위주","수능일반",
                    clean_unit(cur),"80%컷",cut_score=round(avg,2),
                    src_file="hanyang_official.pdf",src_page=page_no,
                    note="[B: 한양대 정시 수능 80%평균]"))
        except: pass

    return result


# ═══════════════════════════════════════════════
# 실행
# ═══════════════════════════════════════════════
print("\n[중앙대 파싱]")
cau_rows = parse_cau()

print("\n[인하대 파싱]")
inha_rows = parse_inha()

print("\n[한양대 파싱]")
hy_rows = parse_hanyang()

all_new = cau_rows + inha_rows + hy_rows
print(f"\n총 추가: {len(all_new)}행 (CAU={len(cau_rows)} INHA={len(inha_rows)} HY={len(hy_rows)})")

rows.extend(all_new)
(BASE / "results_2025_clean.json").write_text(
    json.dumps(rows, ensure_ascii=False, indent=2)
)
print(f"results_2025_clean.json: {len(rows)}행")

# 리포트
REPORT = BASE / "reports" / "results_2025_clean_report.md"
# 기존 리포트에서 B-2 섹션 이후 제거
orig = REPORT.read_text() if REPORT.exists() else ""
if "## B-2" in orig:
    orig = orig[:orig.index("## B-2")]

stats = {}
for r in all_new:
    stats[r["univName"]] = stats.get(r["univName"],0)+1

patch = "\n\n## B-2 웹스크래핑 복구 결과\n\n| 대학 | 복구 행수 |\n| --- | ---: |\n"
for name,cnt in sorted(stats.items()):
    patch += f"| {name} | {cnt} |\n"
for name in ["충남대학교","전북대학교"]:
    patch += f"| {name} | 0 (이미지 PDF 복구 불가) |\n"
patch += f"\n- 총 추가: {len(all_new)}행\n- 방법: 각 대학 입학처 PDF 직접 파싱\n"
REPORT.write_text(orig+patch)
print("리포트 업데이트 완료")
