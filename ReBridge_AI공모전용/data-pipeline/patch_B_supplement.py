#!/usr/bin/env python3
"""
Patch B 보완 스크립트 — 표구조깨짐 및 잘못 파싱된 행 개선
"""
import os, json, unicodedata, re
import pdfplumber
from pathlib import Path

PDF_DIR = Path("/Users/r_o_und_12/Documents/GitHub/ReBridge/ReBridge_AI공모전용/Application_main_codes/src/data/pdf_sources/2028")
DATA_DIR = Path("/Users/r_o_und_12/Documents/GitHub/ReBridge/ReBridge_AI공모전용/Application_main_codes/src/data")
OUTPUT_JSON = DATA_DIR / "admissions_2028_patch_B.json"

def nfc(s): return unicodedata.normalize("NFC", s)
def clean(s):
    if not s: return s
    return re.sub(r'[ \t]+', ' ', s.replace("\x00"," ")).strip()

def judge_ged(qt, adm_type, phase):
    if not qt:
        return ("가능","","수능") if phase=="정시" else ("조건부","지원자격 정보 없음","")
    if re.search(r'검정고시\s*출신자[는은]\s*(지원할\s*수\s*없|지원\s*불가|제외)', qt):
        return "불가","검정고시 출신자 지원 불가",""
    if re.search(r'검정고시\s*출신자\s*(및|과)[^\n]*제외', qt):
        return "불가","검정고시 출신자 제외 명시",""
    if "학교생활기록부가 없거나" in qt and "지원할 수 없" in qt:
        return "불가","학생부 없는 자 지원 불가",""
    if re.search(r'고등학교장의?\s*추천', qt):
        return "불가","학교장 추천 필수 전형",""
    ok_phrases=["검정고시 합격자","동등 이상의 학력","이와 같은 수준 이상의 학력",
                "법령에 따라 이와 같은","이에 준하는 학력","이와 동등 이상",
                "동등 이상의 학력이 있다고 인정","동등한 학력을 인정","동등학력이 있다고"]
    for p in ok_phrases:
        if p in qt:
            if phase=="정시": return "가능","","수능"
            if "교과" in adm_type: return "조건부","동등학력 인정, 비교내신 환산 가능성","비교내신 환산"
            if "종합" in adm_type: return "가능","","서류평가"
            if "논술" in adm_type: return "가능","","논술+(최저)"
            if "실기" in adm_type: return "가능","","실기"
            return "가능","",""
    if phase=="정시": return "가능","","수능"
    return "조건부","지원자격 추가확인 필요",""

TYPE_PAT = [
    (r'학생부\(교과\)위주|학생부교과','학생부교과'),
    (r'학생부\(종합\)위주|학생부종합','학생부종합'),
    (r'논술위주|논술','논술'),
    (r'실기/실적위주|실기','실기/실적'),
    (r'수능위주|수능','수능위주'),
]
def ctype(s):
    for pat,v in TYPE_PAT:
        if re.search(pat,s): return v
    return "학생부종합"

def comp_extract(pdf):
    COMP_KW = ["비교내신","검정고시","동등학력","환산","산출"]
    best, pg = None, None
    for i, page in enumerate(pdf.pages):
        txt = clean(page.extract_text() or "")
        hits=[clean(l) for l in txt.split("\n") if any(k in l for k in COMP_KW) and len(l)>8]
        if hits:
            cg=" | ".join(hits[:15])
            if best is None or ("비교내신" in cg and "비교내신" not in (best or "")):
                best, pg = cg, i+1
    return best, pg

def make_base(univ_name, univ_id, campus, region, fn_nfc, needs_id):
    return {
        "univId":univ_id,"univName":univ_name,"campus":campus,"region":region,
        "phase":None,"admissionType":None,"admissionName":None,"unit":None,
        "recruitCount":None,"evalMethod":None,"interview":None,"csatMinimum":None,
        "gedEligible":None,"gedIneligibleReason":None,"gedReflection":None,
        "comparativeGrade":None,"note":"",
        "source":f"2028 {univ_name} 시행계획 ({fn_nfc})",
        "status":"confirmed_detail","sourceYear":2028,
        "needsUnivId":needs_id if needs_id else None,
    }

# ── 가/나/다 항목 구조 파서 (강남대, 공주대, 순천향대 등)
def parse_ga_na_da(pdf_path, univ_name, univ_id, campus, region, fn_nfc, needs_id):
    """가. 전형명\n지원자격...\n다음줄들 구조"""
    rows = []
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            cg, _ = comp_extract(pdf)
            for i, page in enumerate(pdf.pages):
                txt = page.extract_text() or ""
                if "지원자격" not in txt: continue
                lines = [clean(l) for l in txt.split("\n") if clean(l)]
                pg = i+1
                phase = "정시" if "정시" in txt[:200] else "수시"

                j = 0
                while j < len(lines):
                    l = lines[j]
                    # 가. / 나. / 다. / 라. 등 항목
                    m = re.match(r'^[가나다라마바사아자차카타파하]\.\s*(.+)', l)
                    if m:
                        adm_raw = m.group(1).strip()
                        # 전형명 추출 — "(전형명) - 정원내/외" 패턴
                        nm_m = re.match(r'^([가-힣a-zA-Z()·\s/]+?)(?:\s*-\s*정원|$)', adm_raw)
                        adm_name = nm_m.group(1).strip() if nm_m else adm_raw[:50]

                        # 다음 줄들에서 지원자격 수집
                        qual_lines = []
                        csat_lines = []
                        in_qual = False
                        in_csat = False
                        for k in range(j+1, min(j+20, len(lines))):
                            lk = lines[k]
                            if re.match(r'^[가나다라마바사아자차카타파하]\.\s*', lk): break
                            if lk == "지원자격" or re.match(r'^지원자격\s+모집인원', lk):
                                in_qual = True; in_csat = False
                            elif "수능최저" in lk:
                                in_csat = True; in_qual = False
                            elif in_qual:
                                qual_lines.append(lk)
                                if len(qual_lines) >= 5: in_qual = False
                            elif in_csat:
                                csat_lines.append(lk)
                                if len(csat_lines) >= 10: in_csat = False

                        # 지원자격이 같은 줄에 있는 경우
                        if not qual_lines and "지원자격" in l:
                            after = l[l.index("지원자격")+5:].strip()
                            if after: qual_lines.append(after)

                        qual = " ".join(qual_lines[:5])
                        csat_val = " ".join(csat_lines[:5])
                        if "없음" in csat_val[:30]: csat_val = "없음"

                        adm_type = ctype(adm_name)
                        ged_el, ged_r, ged_h = judge_ged(qual, adm_type, phase)
                        ref = ged_h or ("수능" if phase=="정시" else
                                        "비교내신 환산" if "교과" in adm_type else
                                        "서류평가" if "종합" in adm_type else
                                        "논술+(최저)" if "논술" in adm_type else "")

                        rows.append({
                            "univId":univ_id,"univName":univ_name,"campus":campus,"region":region,
                            "phase":phase,"admissionType":adm_type,"admissionName":adm_name,
                            "unit":None,"recruitCount":None,
                            "evalMethod":None,"interview":False,
                            "csatMinimum":csat_val[:200] if csat_val else None,
                            "gedEligible":ged_el,"gedIneligibleReason":ged_r,"gedReflection":ref,
                            "comparativeGrade":cg,"note":"",
                            "source":f"2028 {univ_name} 시행계획 p.{pg} ({fn_nfc})",
                            "status":"confirmed_detail","sourceYear":2028,
                            "needsUnivId":needs_id if needs_id else None,
                        })
                    j += 1
    except Exception as e:
        pass
    return rows

# ── 아주대 "N. 전형명" 구조
def parse_ajou(pdf_path, univ_name, univ_id, campus, region, fn_nfc, needs_id):
    rows = []
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            cg, _ = comp_extract(pdf)
            # 요약표 (p.3)
            txt3 = pdf.pages[2].extract_text() or ""
            lines3 = [clean(l) for l in txt3.split("\n") if clean(l)]
            phase = "수시"
            for l in lines3[:3]:
                if "정시" in l: phase = "정시"

            # "학생부교과(전형명) 인원 [방법]" 패턴
            for l in lines3:
                m = re.match(r'^([가-힣a-zA-Z()·\s/]+(?:전형|추천|기회|선발|인재|재직자))\s+(\d+)\s*(.*)', l)
                if m:
                    nm = m.group(1).strip(); cnt = int(m.group(2)); ev = m.group(3).strip()
                    if len(nm) > 2:
                        adm_type = ctype(nm+" "+ev)
                        ph = "정시" if "정시" in l else phase
                        ged_el, ged_r, ged_h = judge_ged(None, adm_type, ph)
                        ref = ged_h or ("수능" if ph=="정시" else "비교내신 환산" if "교과" in adm_type else "서류평가" if "종합" in adm_type else "")
                        rows.append({
                            "univId":univ_id,"univName":univ_name,"campus":campus,"region":region,
                            "phase":ph,"admissionType":adm_type,"admissionName":nm,
                            "unit":None,"recruitCount":cnt,
                            "evalMethod":ev[:200] if ev else None,"interview":"면접" in l,
                            "csatMinimum":None,
                            "gedEligible":ged_el,"gedIneligibleReason":ged_r,"gedReflection":ref,
                            "comparativeGrade":cg,"note":"",
                            "source":f"2028 {univ_name} 시행계획 p.3 ({fn_nfc})",
                            "status":"confirmed_detail","sourceYear":2028,
                            "needsUnivId":needs_id if needs_id else None,
                        })

            # 개별 전형 지원자격 페이지 (p.11+)
            for i in range(10, len(pdf.pages)):
                txt = pdf.pages[i].extract_text() or ""
                if "전형 지원 자격" not in txt and "지원자격" not in txt: continue
                lines = [clean(l) for l in txt.split("\n") if clean(l)]
                pg = i+1
                # "N. 전형명" 패턴
                for j, l in enumerate(lines):
                    m = re.match(r'^(\d+)\.\s*([가-힣a-zA-Z()·\s/]+(?:전형|추천|인재|기회|재직자|수시|정시))', l)
                    if m:
                        nm = m.group(2).strip()
                        # 지원자격 내용
                        qual_lines = []
                        for k in range(j+1, min(j+8, len(lines))):
                            if re.match(r'^\d+\.', lines[k]): break
                            qual_lines.append(lines[k])
                        qual = " ".join(qual_lines)
                        phase_pg = "정시" if "정시" in txt[:100] else "수시"
                        adm_type = ctype(nm+" "+qual)
                        ged_el,ged_r,ged_h = judge_ged(qual, adm_type, phase_pg)
                        # 기존 행 업데이트 (이름 매칭)
                        matched = False
                        for r in rows:
                            if r["univName"]==univ_name and nm in (r.get("admissionName") or ""):
                                r["gedEligible"] = ged_el
                                r["gedIneligibleReason"] = ged_r
                                matched = True; break
                        if not matched and len(nm) > 2:
                            ref = ged_h or ("수능" if phase_pg=="정시" else "비교내신 환산" if "교과" in adm_type else "서류평가")
                            rows.append({
                                "univId":univ_id,"univName":univ_name,"campus":campus,"region":region,
                                "phase":phase_pg,"admissionType":adm_type,"admissionName":nm,
                                "unit":None,"recruitCount":None,"evalMethod":None,"interview":False,
                                "csatMinimum":None,
                                "gedEligible":ged_el,"gedIneligibleReason":ged_r,"gedReflection":ref,
                                "comparativeGrade":cg,"note":"",
                                "source":f"2028 {univ_name} 시행계획 p.{pg} ({fn_nfc})",
                                "status":"confirmed_detail","sourceYear":2028,
                                "needsUnivId":needs_id if needs_id else None,
                            })
    except Exception as e:
        pass

    # 중복 제거
    seen = set()
    deduped = []
    for r in rows:
        key = (r.get("phase"), r.get("admissionType"), (r.get("admissionName") or "")[:25])
        if key not in seen:
            seen.add(key); deduped.append(r)
    return deduped

# ── 메인: 현재 데이터 로드 후 보완
def main():
    with open(OUTPUT_JSON, encoding="utf-8") as f:
        data = json.load(f)

    print(f"기존 데이터: {len(data)}행")

    # 보완 대상: note=표구조깨짐 or admissionName이 이상한 행들
    supplement_targets = {
        "강남대학교": "gana",  # 가나다 패턴
        "나사렛대학교": "gana",
        "아주대학교": "ajou",
        "안양대학교": "gana",
        "순천향대학교": "gana",
        "평택대학교": "gana",
        "우송대학교": "gana",
    }

    # 제거할 행 (이름 이상하거나 note=표구조깨짐)
    bad_names = {"None", None, "", "가. 전형별 지원자격", "<목 차>", "작성된 자료입니다.",
                 "수시모집", "지원자격", "전공배정(단, 보건행정경영학전공 제외)"}

    # univId 조회
    from extract_2028_patch_B_v3 import load_universities, match_id, get_pdfs
    _, nm2id = load_universities()
    pdfs_info = {nfc(p["univ_name"]): p for p in get_pdfs()}

    removed = []
    kept = []
    for r in data:
        un = r.get("univName", "")
        nm = r.get("admissionName")
        note = r.get("note", "")
        if (note == "표구조깨짐" or nm in bad_names or
                (nm and len(str(nm)) > 40 and "전형" not in str(nm))):
            removed.append(un)
        else:
            kept.append(r)

    print(f"제거된 행: {len(removed)} (대학: {set(removed)})")
    print(f"유지된 행: {len(kept)}")

    # 보완 추가
    ctr = [200]
    new_rows = []

    for un, ptype in supplement_targets.items():
        pinfo = pdfs_info.get(un)
        if not pinfo:
            print(f"  {un}: PDF 정보 없음")
            continue
        uid, needs = match_id(un, nm2id, ctr)
        fn_nfc = nfc(pinfo["filename"])
        fp = pinfo["filepath"]

        if ptype == "gana":
            rows = parse_ga_na_da(fp, un, uid, pinfo["region"], pinfo["campus"], fn_nfc, needs)
        elif ptype == "ajou":
            rows = parse_ajou(fp, un, uid, pinfo["region"], pinfo["campus"], fn_nfc, needs)
        else:
            rows = []

        print(f"  {un}: {len(rows)}행 보완")
        new_rows.extend(rows)

    final = kept + new_rows
    # 최종 중복 제거
    seen = set()
    deduped = []
    for r in final:
        key = (r.get("univName"), r.get("phase"), r.get("admissionType"),
               (r.get("admissionName") or "")[:25])
        if key not in seen:
            seen.add(key); deduped.append(r)

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(deduped, f, ensure_ascii=False, indent=2)

    print(f"\n최종: {len(deduped)}행")
    ged_d = {}
    for r in deduped:
        v = r.get("gedEligible") or "미판정"
        ged_d[v] = ged_d.get(v,0)+1
    print(f"gedEligible: {ged_d}")
    comp_f = sum(1 for r in deduped if r.get("comparativeGrade"))
    print(f"comparativeGrade 채운수: {comp_f}")

if __name__=="__main__":
    main()
