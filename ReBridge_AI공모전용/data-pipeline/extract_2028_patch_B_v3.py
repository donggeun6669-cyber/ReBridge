#!/usr/bin/env python3
"""
2028 시행계획 PDF 추출 스크립트 v3 — Patch B (경기/충남/충북/대전)
출력: admissions_2028_patch_B.json
"""

import os, json, unicodedata, re
import pdfplumber
from pathlib import Path

PDF_DIR = Path("/Users/r_o_und_12/Documents/GitHub/ReBridge/ReBridge_AI공모전용/Application_main_codes/src/data/pdf_sources/2028")
DATA_DIR = Path("/Users/r_o_und_12/Documents/GitHub/ReBridge/ReBridge_AI공모전용/Application_main_codes/src/data")
UNIS_JSON = DATA_DIR / "universities.json"
OUTPUT_JSON = DATA_DIR / "admissions_2028_patch_B.json"
TARGET_REGIONS = ["경기", "충남", "충북", "대전"]

def nfc(s): return unicodedata.normalize("NFC", s)

def clean(s):
    if not s: return s
    s = s.replace("\x00", " ")
    s = re.sub(r'[ \t]+', ' ', s)
    return s.strip()

def load_universities():
    with open(UNIS_JSON, encoding="utf-8") as f:
        unis = json.load(f)
    m = {}
    for u in unis:
        nm = nfc(u["name"])
        for k in [nm, nm.replace(" ",""), re.sub(r'^국립','',nm), re.sub(r'^국립','',nm).replace(" ","")]:
            if k: m[k] = u["univId"]
    return unis, m

def match_id(name, m, ctr):
    for c in [name, name.replace(" ",""), re.sub(r'^국립','',name), re.sub(r'^국립','',name).replace(" ","")]:
        if c in m: return m[c], False
    for k,v in m.items():
        if len(k)>=4 and k in name: return v, False
        if len(name)>=4 and name.replace(" ","") in k: return v, False
    uid = f"u2028_{ctr[0]:03d}"; ctr[0]+=1; return uid, True

def get_pdfs():
    result = []
    for f in sorted(os.listdir(PDF_DIR)):
        fn = nfc(f)
        for r in TARGET_REGIONS:
            if f"[{r}]" in fn:
                cm = re.search(r'\[(본교|제\d+캠퍼스|분교)\]', fn)
                campus = cm.group(1) if cm else "본교"
                univ_name = re.split(r'\[', fn)[0].strip()
                result.append({"filename":f, "filepath":PDF_DIR/f, "univ_name":univ_name, "region":r, "campus":campus})
                break
    return result

TYPE_PAT = [
    (r'학생부\(교과\)위주','학생부교과'), (r'학생부\(종합\)위주','학생부종합'),
    (r'논술위주','논술'), (r'실기/실적위주','실기/실적'), (r'실기위주','실기/실적'),
    (r'수능위주','수능위주'), (r'학생부교과','학생부교과'), (r'학생부종합','학생부종합'),
    (r'교과우수자|지역균형|교과전형','학생부교과'),
    (r'논술','논술'), (r'실기','실기/실적'), (r'수능','수능위주'),
]
def classify_type(s):
    for pat,val in TYPE_PAT:
        if re.search(pat, s): return val
    return "학생부종합"

def classify_phase(txt):
    for l in txt.strip().split("\n")[:4]:
        if "정시" in l: return "정시"
    if re.search(r'수능위주', txt[:200]): return "정시"
    return "수시"

COMP_KW = ["비교내신","검정고시","동등학력","환산","산출"]

def extract_comp(pdf):
    best, pg = None, None
    for i, page in enumerate(pdf.pages):
        txt = clean(page.extract_text() or "")
        hits = [clean(l) for l in txt.split("\n") if any(k in l for k in COMP_KW) and len(l)>8]
        if hits:
            cg = " | ".join(hits[:15])
            if best is None or ("비교내신" in cg and "비교내신" not in (best or "")):
                best, pg = cg, i+1
    return best, pg

def judge_ged(qt, adm_type, phase):
    if not qt:
        return ("가능","","수능") if phase=="정시" else ("조건부","지원자격 정보 없음","")
    # 불가
    if re.search(r'검정고시\s*출신자[는은]\s*(지원할\s*수\s*없|지원\s*불가|제외)', qt):
        return "불가","검정고시 출신자 지원 불가",""
    if re.search(r'검정고시\s*출신자\s*(및|과)[^\n]*제외', qt):
        return "불가","검정고시 출신자 제외 명시",""
    if "학교생활기록부가 없는 자는 지원할 수 없" in qt:
        return "불가","학생부 없는 자 지원 불가",""
    if re.search(r'고등학교장의?\s*추천', qt):
        return "불가","학교장 추천 필수 전형",""
    if "재학생에 한" in qt: return "불가","재학생 한정 전형",""
    # 가능
    ok_phrases=["검정고시 합격자","검정고시합격자","동등 이상의 학력","동등이상의 학력",
                "이와 같은 수준 이상의 학력","법령에 따라 이와 같은","이에 준하는 학력",
                "이와 동등 이상","이와 동등한 학력","고등학교 졸업 이상의 학력이 인정",
                "고등학교 졸업 이상의 학력이 있다"]
    for p in ok_phrases:
        if p in qt:
            if phase=="정시": return "가능","","수능"
            if "교과" in adm_type: return "조건부","동등학력 인정, 비교내신 환산 가능성","비교내신 환산"
            if "종합" in adm_type: return "가능","","서류평가"
            if "논술" in adm_type: return "가능","","논술+(최저)"
            if "실기" in adm_type: return "가능","","실기"
            if "수능" in adm_type: return "가능","","수능"
            return "가능","",""
    if re.search(r'국내\s*고등학교\s*졸업\(예정\)자\s*$', qt.strip()):
        return "불가","국내 고교 졸업(예정)자만 명시",""
    if phase=="정시": return "가능","","수능"
    return "조건부","지원자격 추가확인 필요",""

def judge_reflection(adm_type, phase, ged_el, hint=""):
    if hint: return hint
    if phase=="정시": return "수능"
    if ged_el=="불가": return ""
    if "교과" in adm_type: return "비교내신 환산"
    if "종합" in adm_type: return "서류평가"
    if "논술" in adm_type: return "논술+(최저)"
    if "실기" in adm_type: return "실기"
    if "수능" in adm_type: return "수능"
    return ""

TYPE_FIRST = {"논술위주","학생부(교과)위주","학생부(종합)위주","실기/실적위주","수능위주"}
SEC_STOP = {"지원자격","전형방법","수능최저학력기준","세부모집","대학수학능력시험 반영방법"}

def parse_pattern_a(pg, txt):
    """전형유형 첫줄, '전형명 전형' 패턴"""
    lines = [clean(l) for l in txt.split("\n") if clean(l)]
    if not lines: return None
    type_raw = lines[0]
    if not any(k in type_raw for k in TYPE_FIRST): return None
    adm_name = None
    for i in range(1, min(6, len(lines))):
        l = lines[i]
        if "전형" in l and l not in SEC_STOP and "방법" not in l:
            nm = re.sub(r'\s*전형(\s*\[.*\])?$', '', l).strip()
            nm = re.sub(r'\s*\[.*\]$', '', nm).strip()
            if nm and len(nm)>1 and nm not in {"전형유형","모집전형"}:
                adm_name = nm; break
    if not adm_name: return None

    rc = None
    for i, l in enumerate(lines):
        if l=="모집인원" and i+1<len(lines):
            m2 = re.search(r'[\d,]+', lines[i+1])
            if m2: rc = int(m2.group().replace(",",""))
            break

    eval_m = None
    for i, l in enumerate(lines):
        if l=="전형방법" and i+1<len(lines):
            buf=[]
            for j in range(i+1, min(i+8,len(lines))):
                if lines[j] in SEC_STOP: break
                buf.append(lines[j])
            eval_m=" ".join(buf); break

    qual = None
    for i, l in enumerate(lines):
        if l=="지원자격" and i+1<len(lines):
            buf=[]
            for j in range(i+1, len(lines)):
                if lines[j] in SEC_STOP: break
                buf.append(lines[j])
            qual=" ".join(buf); break

    csat = None
    for i, l in enumerate(lines):
        if l=="수능최저학력기준" and i+1<len(lines):
            buf=[]
            for j in range(i+1, min(i+25,len(lines))):
                if lines[j] in {"세부모집","모집군","비고"} or lines[j].startswith("- "): break
                buf.append(lines[j])
            val=" ".join(buf).strip()
            csat="없음" if val.startswith("없음") else (val[:300] if val else None)
            break

    return {"adm_name":adm_name,"adm_type":classify_type(type_raw+" "+adm_name),
            "phase":classify_phase(txt),"recruit_count":rc,
            "eval_method":clean(eval_m) if eval_m else None,"qual_text":qual,
            "csat_text":csat,"interview":bool(eval_m and "면접" in eval_m),"page_num":pg,"pattern":"A"}

def parse_pattern_b(pg, txt):
    """충남대 스타일: 전형명\n1. 지원자격\n2. 전형요소..."""
    lines=[clean(l) for l in txt.split("\n") if clean(l)]
    has_qual=any(re.match(r'[1-9가나다]\.\s*지원자격',l) for l in lines)
    if not has_qual: return None

    phase="수시"
    adm_name=None
    for i,l in enumerate(lines):
        if "정시" in l[:20]: phase="정시"
        if re.match(r'[1-9가나다]\.\s*지원자격', l):
            for j in range(max(0,i-3), i):
                c=lines[j]
                if (len(c)>2 and len(c)<60 and not re.match(r'[ⅠⅡⅢⅣⅤ]',c)
                        and "학년도" not in c and "대학교" not in c and not c.startswith("※")
                        and not re.match(r'\d\.',c) and c not in SEC_STOP):
                    adm_name=c
            break

    if not adm_name: return None

    qual=None
    for i,l in enumerate(lines):
        if re.match(r'[1-9가나다]\.\s*지원자격',l):
            buf=[]
            for j in range(i+1, len(lines)):
                if re.match(r'[2-9가나다]\.\s*(전형|수능)',lines[j]): break
                buf.append(lines[j])
            qual=" ".join(buf[:20]); break

    eval_m=None
    for i,l in enumerate(lines):
        if re.match(r'[2-9가나다]\.\s*전형(요소|방법)',l):
            buf=[]
            for j in range(i+1,min(i+15,len(lines))):
                if re.match(r'[3-9가나다]\.\s*수능',lines[j]): break
                buf.append(lines[j])
            eval_m=" ".join(buf[:10]); break

    csat=None
    for i,l in enumerate(lines):
        if re.match(r'[2-9가나다]\.\s*수능최저',l) or l=="수능최저학력기준":
            buf=[]
            for j in range(i+1,min(i+20,len(lines))): buf.append(lines[j])
            val=" ".join(buf).strip()
            csat="없음" if "없음" in val[:50] else (val[:300] if val else None); break

    return {"adm_name":adm_name,"adm_type":classify_type(adm_name+" "+(qual or "")),
            "phase":phase,"recruit_count":None,
            "eval_method":clean(eval_m) if eval_m else None,"qual_text":qual,
            "csat_text":csat,"interview":bool(eval_m and "면접" in eval_m),"page_num":pg,"pattern":"B"}

def parse_pattern_c(pg, txt):
    """요약표 — 전형명 + 인원이 같은 줄"""
    if "전형명" not in txt and "모집전형" not in txt: return []
    lines=[clean(l) for l in txt.split("\n") if clean(l)]
    phase="수시"
    for l in lines[:5]:
        if "정시" in l: phase="정시"
    rows=[]
    for l in lines:
        m=re.match(r'^([가-힣a-zA-Z()\s·]+(?:전형|인재|우수자|균형|고른기회|재직자|추천|면접형|서류형|특기자|지원자))\s+(\d+)', l)
        if m:
            nm=m.group(1).strip(); cnt=int(m.group(2))
            if len(nm)>2:
                ep=l[m.end():].strip()
                rows.append({"adm_name":nm,"adm_type":classify_type(nm+" "+l),"phase":phase,
                             "recruit_count":cnt,"eval_method":ep[:200] if ep else None,
                             "qual_text":None,"csat_text":None,"interview":"면접" in l,
                             "page_num":pg,"pattern":"C"})
    return rows

def parse_pdf(pinfo, nm2id, ctr):
    fp=pinfo["filepath"]; un=pinfo["univ_name"]; rg=pinfo["region"]
    camp=pinfo["campus"]; fn=pinfo["filename"]; fn_n=nfc(fn)
    uid, needs=match_id(un, nm2id, ctr)
    rows=[]

    def mkrow(info, cg):
        ged_el,ged_r,ged_h=judge_ged(info.get("qual_text"), info.get("adm_type",""), info.get("phase","수시"))
        ged_ref=judge_reflection(info.get("adm_type",""), info.get("phase","수시"), ged_el, ged_h)
        return {
            "univId":uid,"univName":un,"campus":camp,"region":rg,
            "phase":info.get("phase"),"admissionType":info.get("adm_type"),
            "admissionName":info.get("adm_name"),"unit":None,
            "recruitCount":info.get("recruit_count"),
            "evalMethod":clean(info.get("eval_method") or "")[:300] or None,
            "interview":info.get("interview",False),
            "csatMinimum":clean(info.get("csat_text") or "")[:300] or None,
            "gedEligible":ged_el,"gedIneligibleReason":ged_r,"gedReflection":ged_ref,
            "comparativeGrade":cg,"note":"",
            "source":f"2028 {un} 시행계획 p.{info.get('page_num')} ({fn_n})",
            "status":"confirmed_detail","sourceYear":2028,
            "needsUnivId":needs if needs else None,
        }

    try:
        with pdfplumber.open(str(fp)) as pdf:
            cg, _ = extract_comp(pdf)
            parsed=[]
            for i, page in enumerate(pdf.pages):
                txt = page.extract_text() or ""
                if not txt.strip(): continue
                if "지원자격" not in txt and "전형방법" not in txt: continue
                pg=i+1
                r=parse_pattern_a(pg, txt)
                if r: parsed.append(r); continue
                r=parse_pattern_b(pg, txt)
                if r: parsed.append(r); continue

            if not parsed:
                for i, page in enumerate(pdf.pages):
                    txt=page.extract_text() or ""
                    if txt.strip():
                        rs=parse_pattern_c(i+1, txt)
                        parsed.extend(rs)

            if not parsed:
                rows.append({"univId":uid,"univName":un,"campus":camp,"region":rg,
                             "phase":None,"admissionType":None,"admissionName":None,"unit":None,
                             "recruitCount":None,"evalMethod":None,"interview":None,"csatMinimum":None,
                             "gedEligible":None,"gedIneligibleReason":None,"gedReflection":None,
                             "comparativeGrade":cg,"note":"표구조깨짐",
                             "source":f"2028 {un} 시행계획 ({fn_n})",
                             "status":"confirmed_detail","sourceYear":2028,
                             "needsUnivId":needs if needs else None})
                return rows

            seen=set()
            for info in parsed:
                key=(info.get("phase"), info.get("adm_type"), (info.get("adm_name") or "")[:30])
                if key in seen: continue
                seen.add(key)
                rows.append(mkrow(info, cg))

    except Exception as e:
        rows.append({"univId":uid,"univName":un,"campus":camp,"region":rg,
                     "phase":None,"admissionType":None,"admissionName":None,"unit":None,
                     "recruitCount":None,"evalMethod":None,"interview":None,"csatMinimum":None,
                     "gedEligible":None,"gedIneligibleReason":None,"gedReflection":None,
                     "comparativeGrade":None,"note":f"파싱오류: {str(e)[:150]}",
                     "source":f"2028 {un} 시행계획 ({fn_n})",
                     "status":"confirmed_detail","sourceYear":2028,
                     "needsUnivId":needs if needs else None})
    return rows

def main():
    print("=== 2028 Patch B 추출 (v3) ===")
    _, nm2id = load_universities()
    pdfs = get_pdfs()
    print(f"PDFs: {len(pdfs)}")
    all_rows=[]; ctr=[1]; broken=[]

    for idx, pinfo in enumerate(pdfs, 1):
        print(f"[{idx:2d}/{len(pdfs)}] {pinfo['univ_name']} [{pinfo['region']}] {pinfo['campus']}", end=" ... ")
        rows=parse_pdf(pinfo, nm2id, ctr)
        all_rows.extend(rows)
        print(f"{len(rows)}행")

        has_b=any("표구조깨짐" in (r.get("note") or "") or "파싱오류" in (r.get("note") or "") for r in rows)
        if has_b: broken.append(nfc(pinfo["filename"]))

        if idx%10==0:
            with open(OUTPUT_JSON,"w",encoding="utf-8") as f:
                json.dump(all_rows,f,ensure_ascii=False,indent=2)
            print(f"  ↳ 중간저장: {len(all_rows)}행")

    with open(OUTPUT_JSON,"w",encoding="utf-8") as f:
        json.dump(all_rows,f,ensure_ascii=False,indent=2)

    ged_d={}
    for r in all_rows:
        v=r.get("gedEligible") or "미판정"
        ged_d[v]=ged_d.get(v,0)+1
    comp_f=sum(1 for r in all_rows if r.get("comparativeGrade"))

    print(f"\n=== 완료 ===")
    print(f"PDFs: {len(pdfs)} | 대학: {len(set(r['univName'] for r in all_rows))} | 행: {len(all_rows)}")
    print(f"gedEligible: {ged_d}")
    print(f"comparativeGrade 채운수: {comp_f}")
    print(f"문제 PDF ({len(broken)}개):")
    for b in broken: print(f"  - {b}")
    return all_rows, pdfs, ged_d, comp_f, broken

if __name__=="__main__":
    main()

# ══════════════════════════════════════════════════
# 패턴 D: 한양대ERICA 스타일 — "□ [정원 내/외] 전형명\n1 모집인원...\n2 지원자격...\n3 전형방법..."
# 패턴 E: 아주대 스타일 — "전형 지원 자격" 표 + 요약표
# ══════════════════════════════════════════════════

def parse_pattern_d(pg, txt):
    """한양대ERICA 스타일"""
    lines = [clean(l) for l in txt.split("\n") if clean(l)]
    # "□ [정원 내/외] 전형명" 패턴
    box_pat = re.compile(r'^[□■◆◇]\s*(?:\[정원\s*(?:내|외)\]\s*)?(.+)')
    adm_names = []
    for i, l in enumerate(lines):
        m = box_pat.match(l)
        if m:
            nm = m.group(1).strip()
            # 전형명인지 확인 (숫자나 일정 표현 아닌 것)
            if (len(nm) > 3 and "일정" not in nm and "모집인원" not in nm
                    and "중복" not in nm and "전형방법" not in nm):
                adm_names.append((i, nm))
    if not adm_names:
        return []

    results = []
    for ai, (start_i, adm_name) in enumerate(adm_names):
        end_i = adm_names[ai+1][0] if ai+1 < len(adm_names) else len(lines)
        section_lines = lines[start_i:end_i]

        # 모집인원
        rc = None
        for l in section_lines[:5]:
            m = re.search(r'모집인원\s*(\d+)명', l)
            if m: rc = int(m.group(1)); break
            m2 = re.match(r'1\s+모집인원\s+(\d+)명', l)
            if m2: rc = int(m2.group(1)); break

        # 지원자격
        qual = None
        for i, l in enumerate(section_lines):
            if re.match(r'2\s+지원자격', l) or l == "지원자격":
                buf = []
                for j in range(i+1, min(i+8, len(section_lines))):
                    if re.match(r'[3-9]\s+', section_lines[j]): break
                    buf.append(section_lines[j])
                qual = " ".join(buf)
                break

        # 전형방법
        eval_m = None
        for i, l in enumerate(section_lines):
            if re.match(r'3\s+전형방법', l) or l == "전형방법":
                buf = []
                for j in range(i+1, min(i+8, len(section_lines))):
                    if re.match(r'[4-9]\s+', section_lines[j]): break
                    buf.append(section_lines[j])
                eval_m = " ".join(buf)
                break

        # 수능최저
        csat = None
        for i, l in enumerate(section_lines):
            if re.match(r'4\s+수능', l) or "수능최저" in l:
                buf = []
                for j in range(i, min(i+10, len(section_lines))):
                    buf.append(section_lines[j])
                val = " ".join(buf).strip()
                csat = "없음" if "미적용" in val else (val[:300] if val else None)
                break

        phase = classify_phase(txt)
        adm_type = classify_type(adm_name + " " + (qual or ""))
        results.append({
            "adm_name": adm_name, "adm_type": adm_type, "phase": phase,
            "recruit_count": rc, "eval_method": clean(eval_m) if eval_m else None,
            "qual_text": qual, "csat_text": csat,
            "interview": bool(eval_m and "면접" in eval_m), "page_num": pg, "pattern": "D"
        })
    return results


def parse_pattern_e_summary(pg, txt):
    """아주대 스타일 요약표 — 전형 + 인원 + 전형방법이 한 줄"""
    lines = [clean(l) for l in txt.split("\n") if clean(l)]
    if not any("전형방법" in l or "선발방법" in l for l in lines[:5]):
        return []
    phase = "수시"
    for l in lines[:3]:
        if "정시" in l: phase = "정시"
    rows = []
    for l in lines:
        # "학생부교과(전형명) 인원 [방법]" 패턴
        m = re.match(r'^([가-힣a-zA-Z()\s·/]+(?:전형|인재|우수자|균형|기회|선발|추천|재직자))\s+(\d+)\s+(.*)', l)
        if m:
            nm = m.group(1).strip(); cnt = int(m.group(2)); ev = m.group(3).strip()
            if len(nm) > 2:
                rows.append({
                    "adm_name": nm, "adm_type": classify_type(nm+" "+ev), "phase": phase,
                    "recruit_count": cnt, "eval_method": ev[:200] if ev else None,
                    "qual_text": None, "csat_text": None,
                    "interview": "면접" in ev, "page_num": pg, "pattern": "E"
                })
    return rows


def parse_pdf_v4(pinfo, nm2id, ctr):
    """v3 + 패턴 D/E 추가"""
    fp = pinfo["filepath"]; un = pinfo["univ_name"]; rg = pinfo["region"]
    camp = pinfo["campus"]; fn = pinfo["filename"]; fn_n = nfc(fn)
    uid, needs = match_id(un, nm2id, ctr)
    rows = []

    def mkrow(info, cg):
        ged_el, ged_r, ged_h = judge_ged(info.get("qual_text"), info.get("adm_type",""), info.get("phase","수시"))
        ged_ref = judge_reflection(info.get("adm_type",""), info.get("phase","수시"), ged_el, ged_h)
        return {
            "univId": uid, "univName": un, "campus": camp, "region": rg,
            "phase": info.get("phase"), "admissionType": info.get("adm_type"),
            "admissionName": info.get("adm_name"), "unit": None,
            "recruitCount": info.get("recruit_count"),
            "evalMethod": clean(info.get("eval_method") or "")[:300] or None,
            "interview": info.get("interview", False),
            "csatMinimum": clean(info.get("csat_text") or "")[:300] or None,
            "gedEligible": ged_el, "gedIneligibleReason": ged_r, "gedReflection": ged_ref,
            "comparativeGrade": cg, "note": "",
            "source": f"2028 {un} 시행계획 p.{info.get('page_num')} ({fn_n})",
            "status": "confirmed_detail", "sourceYear": 2028,
            "needsUnivId": needs if needs else None,
        }

    try:
        with pdfplumber.open(str(fp)) as pdf:
            cg, _ = extract_comp(pdf)
            parsed = []
            for i, page in enumerate(pdf.pages):
                txt = page.extract_text() or ""
                if not txt.strip(): continue
                pg = i + 1
                if "지원자격" in txt or "전형방법" in txt:
                    r = parse_pattern_a(pg, txt)
                    if r: parsed.append(r); continue
                    r = parse_pattern_b(pg, txt)
                    if r: parsed.append(r); continue
                    rs = parse_pattern_d(pg, txt)
                    if rs: parsed.extend(rs); continue
                rs = parse_pattern_e_summary(pg, txt)
                if rs: parsed.extend(rs)

            if not parsed:
                for i, page in enumerate(pdf.pages):
                    txt = page.extract_text() or ""
                    if txt.strip():
                        rs = parse_pattern_c(i+1, txt)
                        parsed.extend(rs)

            if not parsed:
                rows.append({
                    "univId": uid, "univName": un, "campus": camp, "region": rg,
                    "phase": None, "admissionType": None, "admissionName": None, "unit": None,
                    "recruitCount": None, "evalMethod": None, "interview": None, "csatMinimum": None,
                    "gedEligible": None, "gedIneligibleReason": None, "gedReflection": None,
                    "comparativeGrade": cg, "note": "표구조깨짐",
                    "source": f"2028 {un} 시행계획 ({fn_n})",
                    "status": "confirmed_detail", "sourceYear": 2028,
                    "needsUnivId": needs if needs else None,
                })
                return rows

            seen = set()
            for info in parsed:
                key = (info.get("phase"), info.get("adm_type"), (info.get("adm_name") or "")[:30])
                if key in seen: continue
                seen.add(key)
                rows.append(mkrow(info, cg))

    except Exception as e:
        rows.append({
            "univId": uid, "univName": un, "campus": camp, "region": rg,
            "phase": None, "admissionType": None, "admissionName": None, "unit": None,
            "recruitCount": None, "evalMethod": None, "interview": None, "csatMinimum": None,
            "gedEligible": None, "gedIneligibleReason": None, "gedReflection": None,
            "comparativeGrade": None, "note": f"파싱오류: {str(e)[:150]}",
            "source": f"2028 {un} 시행계획 ({fn_n})",
            "status": "confirmed_detail", "sourceYear": 2028,
            "needsUnivId": needs if needs else None,
        })
    return rows


def main_v4():
    print("=== 2028 Patch B 추출 (v4 — 4가지 패턴) ===")
    _, nm2id = load_universities()
    pdfs = get_pdfs()
    print(f"PDFs: {len(pdfs)}")
    all_rows = []; ctr = [1]; broken = []

    for idx, pinfo in enumerate(pdfs, 1):
        print(f"[{idx:2d}/{len(pdfs)}] {pinfo['univ_name']} [{pinfo['region']}] {pinfo['campus']}", end=" ... ")
        rows = parse_pdf_v4(pinfo, nm2id, ctr)
        all_rows.extend(rows)
        print(f"{len(rows)}행")

        has_b = any("표구조깨짐" in (r.get("note") or "") or "파싱오류" in (r.get("note") or "") for r in rows)
        if has_b: broken.append(nfc(pinfo["filename"]))

        if idx % 10 == 0:
            with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
                json.dump(all_rows, f, ensure_ascii=False, indent=2)
            print(f"  ↳ 중간저장: {len(all_rows)}행")

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(all_rows, f, ensure_ascii=False, indent=2)

    ged_d = {}
    for r in all_rows:
        v = r.get("gedEligible") or "미판정"
        ged_d[v] = ged_d.get(v, 0) + 1
    comp_f = sum(1 for r in all_rows if r.get("comparativeGrade"))

    print(f"\n=== 완료 ===")
    print(f"PDFs: {len(pdfs)} | 대학: {len(set(r['univName'] for r in all_rows))} | 행: {len(all_rows)}")
    print(f"gedEligible: {ged_d}")
    print(f"comparativeGrade 채운수: {comp_f}")
    print(f"문제 PDF ({len(broken)}개):")
    for b in broken: print(f"  - {b}")
    return all_rows, pdfs, ged_d, comp_f, broken


if __name__ == "__main__":
    main_v4()
